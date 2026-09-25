/**
 * Serwer kalkulatora na własnym VPS-ie.
 *
 * Na Vercelu hasło sprawdza middleware, które platforma uruchamia sama. Tu tę
 * samą rolę pełni ten plik: każde żądanie przechodzi najpierw przez `obsluz`
 * z `src/serwer/ochrona.ts` (ta sama logika co na Vercelu), a dopiero gdy ta
 * przepuści, serwer wydaje plik z katalogu `dist/`.
 *
 * Serwer słucha tylko na 127.0.0.1 — z internetem rozmawia Caddy, który
 * dokłada HTTPS. Bez HTTPS przeglądarka nie odeśle ciasteczka logowania.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { open, stat } from 'node:fs/promises';
import path from 'node:path';
import { obsluz } from '../src/serwer/ochrona';

const TYPY: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

/** Na każdej odpowiedzi — także na ekranie logowania i przekierowaniach. */
const NAGLOWKI_BEZPIECZENSTWA: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  // Ekranu logowania nie da się osadzić w cudzej stronie i podstępem kliknąć.
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
};

/** Formularz logowania to hasło i dwa krótkie pola — więcej to nie formularz. */
export const LIMIT_TRESCI = 16 * 1024;

export interface Opcje {
  /** Katalog ze zbudowaną aplikacją (`dist/`). */
  katalog: string;
  /** Hasło; bez niego serwer odmawia wszystkiego, jak na Vercelu. */
  haslo: string | undefined;
}

class BladZapytania extends Error {
  constructor(readonly status: number, wiadomosc: string) {
    super(wiadomosc);
  }
}

function odpowiedzTekstem(res: ServerResponse, status: number, tresc: string, dodatkowe: Record<string, string> = {}) {
  res.writeHead(status, {
    ...NAGLOWKI_BEZPIECZENSTWA,
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...dodatkowe,
  });
  res.end(tresc);
}

async function wczytajTresc(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const deklarowana = Number(req.headers['content-length'] ?? 0);
  if (deklarowana > LIMIT_TRESCI) throw new BladZapytania(413, 'Za duże zapytanie.');
  const kawalki: Buffer[] = [];
  let razem = 0;
  for await (const kawalek of req as AsyncIterable<Buffer>) {
    razem += kawalek.length;
    if (razem > LIMIT_TRESCI) throw new BladZapytania(413, 'Za duże zapytanie.');
    kawalki.push(kawalek);
  }
  return Buffer.concat(kawalki);
}

/** Zapytanie Node → standardowy `Request`, na którym pracuje `ochrona.ts`. */
function naZapytanie(req: IncomingMessage, sciezka: string, tresc: Buffer | undefined): Request {
  const naglowki = new Headers();
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    naglowki.append(req.rawHeaders[i]!, req.rawHeaders[i + 1]!);
  }
  return new Request(`http://kalkulator${sciezka}`, {
    method: req.method,
    headers: naglowki,
    body: tresc ? new Uint8Array(tresc) : undefined,
  });
}

async function wyslijOdpowiedz(res: ServerResponse, odpowiedz: Response, bezTresci: boolean) {
  const naglowki: Record<string, string | string[]> = { ...NAGLOWKI_BEZPIECZENSTWA };
  odpowiedz.headers.forEach((wartosc, nazwa) => {
    if (nazwa !== 'set-cookie') naglowki[nazwa] = wartosc;
  });
  const ciastka = odpowiedz.headers.getSetCookie();
  if (ciastka.length > 0) naglowki['set-cookie'] = ciastka;
  const tresc = Buffer.from(await odpowiedz.arrayBuffer());
  res.writeHead(odpowiedz.status, naglowki);
  res.end(bezTresci ? undefined : tresc);
}

/**
 * Plik z katalogu aplikacji — i nic spoza niego.
 *
 * Ścieżkę dekodujemy, normalizujemy i sprawdzamy, czy nadal leży w katalogu
 * aplikacji: „/../" w adresie nie może wyprowadzić do reszty dysku serwera.
 */
async function wyslijPlik(req: IncomingMessage, res: ServerResponse, korzen: string, sciezkaUrl: string) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    odpowiedzTekstem(res, 405, 'Niedozwolona metoda.', { Allow: 'GET, HEAD' });
    return;
  }

  let sciezka: string;
  try {
    sciezka = decodeURIComponent(sciezkaUrl);
  } catch {
    odpowiedzTekstem(res, 400, 'Nieprawidłowy adres.');
    return;
  }
  if (sciezka.includes('\0') || sciezka.includes('\\')) {
    odpowiedzTekstem(res, 400, 'Nieprawidłowy adres.');
    return;
  }
  // Pliki ukryte (.git, .env itp.) nie są częścią aplikacji.
  if (sciezka.split('/').some((czlon) => czlon.startsWith('.'))) {
    odpowiedzTekstem(res, 404, 'Nie znaleziono.');
    return;
  }
  if (sciezka.endsWith('/')) sciezka += 'index.html';

  const plik = path.resolve(korzen, '.' + sciezka);
  if (!plik.startsWith(korzen + path.sep)) {
    odpowiedzTekstem(res, 404, 'Nie znaleziono.');
    return;
  }

  let info;
  try {
    info = await stat(plik);
  } catch {
    info = null;
  }
  if (!info?.isFile()) {
    odpowiedzTekstem(res, 404, 'Nie znaleziono.');
    return;
  }

  const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
  const naglowki: Record<string, string> = {
    ...NAGLOWKI_BEZPIECZENSTWA,
    'Content-Type': TYPY[path.extname(plik).toLowerCase()] ?? 'application/octet-stream',
    ETag: etag,
    // Pliki z /assets/ mają skrót treści w nazwie — nowa wersja to nowa nazwa.
    // Reszta (index.html, sw.js) musi być sprawdzana przy każdym wejściu.
    // „private": to treść za logowaniem, żaden pośrednik nie może jej przechować.
    'Cache-Control': sciezka.startsWith('/assets/') ? 'private, max-age=31536000, immutable' : 'private, no-cache',
  };

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, naglowki);
    res.end();
    return;
  }

  naglowki['Content-Length'] = String(info.size);
  if (req.method === 'HEAD') {
    res.writeHead(200, naglowki);
    res.end();
    return;
  }
  const uchwyt = await open(plik);
  res.writeHead(200, naglowki);
  uchwyt.createReadStream().pipe(res);
}

async function obsluzZapytanie(req: IncomingMessage, res: ServerResponse, opcje: Opcje, korzen: string) {
  const adres = req.url ?? '';
  // Tylko zwykła postać ścieżki; „http://…" i „//…" nie mają tu czego szukać.
  if (!adres.startsWith('/') || adres.startsWith('//')) {
    odpowiedzTekstem(res, 400, 'Nieprawidłowy adres.');
    return;
  }

  const zapytanie = naZapytanie(req, adres, await wczytajTresc(req));
  const odpowiedz = await obsluz(zapytanie, opcje.haslo);

  if (odpowiedz.headers.get('x-middleware-next') === '1') {
    await wyslijPlik(req, res, korzen, new URL(zapytanie.url).pathname);
  } else {
    await wyslijOdpowiedz(res, odpowiedz, req.method === 'HEAD');
  }
}

export function utworzSerwer(opcje: Opcje): Server {
  const korzen = path.resolve(opcje.katalog);
  return createServer((req, res) => {
    obsluzZapytanie(req, res, opcje, korzen).catch((blad: unknown) => {
      if (blad instanceof BladZapytania) {
        if (!res.headersSent) odpowiedzTekstem(res, blad.status, blad.message, { Connection: 'close' });
        return;
      }
      console.error('Błąd obsługi zapytania:', blad);
      if (!res.headersSent) odpowiedzTekstem(res, 500, 'Błąd serwera.');
      else res.destroy();
    });
  });
}
