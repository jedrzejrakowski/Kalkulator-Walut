// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WAZNOSC_SESJI, wydajZeton } from '../../src/serwer/ochrona';
import { LIMIT_TRESCI, utworzSerwer } from '../serwer';

const HASLO = 'jesienne-liscie-nad-wisla';

interface Odp {
  status: number;
  naglowki: IncomingHttpHeaders;
  tresc: string;
}

/**
 * Surowe zapytanie HTTP. `fetch` sam porządkuje „..” w adresie, a tu właśnie
 * o to chodzi, żeby serwer dostał adres dokładnie taki, jaki wyśle napastnik.
 */
function zapytaj(port: number, sciezka: string, opcje: { metoda?: string; naglowki?: Record<string, string>; tresc?: string } = {}): Promise<Odp> {
  return new Promise((dalej, blad) => {
    const z = request({ host: '127.0.0.1', port, path: sciezka, method: opcje.metoda ?? 'GET', headers: opcje.naglowki }, (r) => {
      const kawalki: Buffer[] = [];
      r.on('data', (k: Buffer) => kawalki.push(k));
      r.on('end', () => dalej({ status: r.statusCode!, naglowki: r.headers, tresc: Buffer.concat(kawalki).toString('utf8') }));
    });
    z.on('error', blad);
    if (opcje.tresc !== undefined) z.write(opcje.tresc);
    z.end();
  });
}

const STRONA = { accept: 'text/html', 'sec-fetch-dest': 'document' };

describe('serwer na VPS', () => {
  let katalogTestu: string;
  let serwer: Server;
  let port: number;
  let ciastko: string;

  beforeAll(async () => {
    katalogTestu = await mkdtemp(path.join(tmpdir(), 'kalkulator-vps-'));
    const dist = path.join(katalogTestu, 'dist');
    await mkdir(path.join(dist, 'assets'), { recursive: true });
    await mkdir(path.join(dist, 'icons'), { recursive: true });
    await writeFile(path.join(dist, 'index.html'), '<!doctype html><title>APLIKACJA</title>');
    await writeFile(path.join(dist, 'logowanie.html'), '<!doctype html><title>LOGOWANIE</title>');
    await writeFile(path.join(dist, 'manifest.webmanifest'), '{"name":"Kalkulator"}');
    await writeFile(path.join(dist, 'icons', 'icon.svg'), '<svg/>');
    await writeFile(path.join(dist, 'assets', 'index-abc123.js'), 'console.log("APLIKACJA")');
    await writeFile(path.join(dist, 'sw.js'), '// SW');
    await writeFile(path.join(dist, '.env'), 'TAJNE=1');
    // Plik obok katalogu aplikacji — nie może wyjść na zewnątrz.
    await writeFile(path.join(katalogTestu, 'sekret.txt'), 'TAJNE');

    serwer = utworzSerwer({ katalog: dist, haslo: HASLO });
    await new Promise<void>((r) => serwer.listen(0, '127.0.0.1', r));
    port = (serwer.address() as AddressInfo).port;
    ciastko = `kw_sesja=${await wydajZeton(HASLO, Date.now() + WAZNOSC_SESJI)}`;
  });

  afterAll(async () => {
    await new Promise((r) => serwer.close(r));
    await rm(katalogTestu, { recursive: true, force: true });
  });

  it('niezalogowanego odsyła na ekran logowania, a skryptów nie wydaje', async () => {
    const strona = await zapytaj(port, '/?waluta=THB', { naglowki: STRONA });
    expect(strona.status).toBe(302);
    expect(strona.naglowki.location).toBe('/logowanie.html?powrot=%2F%3Fwaluta%3DTHB');

    for (const s of ['/assets/index-abc123.js', '/index.html', '/sw.js']) {
      const o = await zapytaj(port, s);
      expect(o.status, s).toBe(401);
      expect(o.tresc).not.toContain('APLIKACJA');
    }
  });

  it('bez logowania wydaje ekran logowania, manifest i ikony — z właściwym typem', async () => {
    const logowanie = await zapytaj(port, '/logowanie.html?blad=1');
    expect(logowanie.status).toBe(200);
    expect(logowanie.naglowki['content-type']).toBe('text/html; charset=utf-8');
    expect(logowanie.tresc).toContain('LOGOWANIE');

    const manifest = await zapytaj(port, '/manifest.webmanifest');
    expect(manifest.status).toBe(200);
    expect(manifest.naglowki['content-type']).toBe('application/manifest+json');

    expect((await zapytaj(port, '/icons/icon.svg')).naglowki['content-type']).toBe('image/svg+xml');
  });

  it('logowanie przez formularz działa tak samo jak na Vercelu', async () => {
    const zle = await zapytaj(port, '/api/logowanie', {
      metoda: 'POST',
      naglowki: { 'content-type': 'application/x-www-form-urlencoded' },
      tresc: 'haslo=zgaduje&powrot=%2F',
    });
    expect(zle.status).toBe(303);
    expect(zle.naglowki.location).toBe('/logowanie.html?blad=1&powrot=%2F');
    expect(zle.naglowki['set-cookie']).toBeUndefined();

    const dobre = await zapytaj(port, '/api/logowanie', {
      metoda: 'POST',
      naglowki: { 'content-type': 'application/x-www-form-urlencoded' },
      tresc: `haslo=${encodeURIComponent(HASLO)}&zapamietaj=1&powrot=%2F`,
    });
    expect(dobre.status).toBe(303);
    expect(dobre.naglowki.location).toBe('/');
    const ciastka = dobre.naglowki['set-cookie']!;
    expect(ciastka).toHaveLength(2);
    expect(ciastka[0]).toMatch(/^kw_sesja=v1\..*HttpOnly; Secure; SameSite=Lax; Max-Age=2592000$/);

    const zeton = ciastka[0]!.split(';')[0]!;
    const aplikacja = await zapytaj(port, '/', { naglowki: { ...STRONA, cookie: zeton } });
    expect(aplikacja.status).toBe(200);
    expect(aplikacja.tresc).toContain('APLIKACJA');
  });

  it('zalogowanemu wydaje aplikację z pamięcią podręczną tylko dla plików ze skrótem', async () => {
    const strona = await zapytaj(port, '/', { naglowki: { ...STRONA, cookie: ciastko } });
    expect(strona.status).toBe(200);
    expect(strona.naglowki['content-type']).toBe('text/html; charset=utf-8');
    expect(strona.naglowki['cache-control']).toBe('private, no-cache');

    const skrypt = await zapytaj(port, '/assets/index-abc123.js', { naglowki: { cookie: ciastko } });
    expect(skrypt.status).toBe(200);
    expect(skrypt.naglowki['content-type']).toBe('text/javascript; charset=utf-8');
    expect(skrypt.naglowki['cache-control']).toBe('private, max-age=31536000, immutable');
    expect(skrypt.naglowki['content-length']).toBe(String(Buffer.byteLength('console.log("APLIKACJA")')));
  });

  it('nie wypuszcza poza katalog aplikacji ani do plików ukrytych', async () => {
    for (const s of [
      '/../sekret.txt',
      '/%2e%2e/sekret.txt',
      '/assets/..%2f..%2fsekret.txt',
      '/assets/%2e%2e/%2e%2e/sekret.txt',
      '/..%5csekret.txt',
      '/icons/..%00/sekret.txt',
      '/.env',
      '/%2eenv',
      '/assets/',
      '/nie-ma-takiego.html',
      '/%E0%A4%A',
    ]) {
      const o = await zapytaj(port, s, { naglowki: { cookie: ciastko } });
      expect([400, 404], `${s} → ${o.status}`).toContain(o.status);
      expect(o.tresc).not.toContain('TAJNE');
    }
    // Nawet bez logowania publiczny katalog ikon nie jest furtką.
    const przezIkony = await zapytaj(port, '/icons/../../sekret.txt');
    expect(przezIkony.tresc).not.toContain('TAJNE');
  });

  it('odrzuca adresy w postaci pełnej i zaczynające się od //', async () => {
    expect((await zapytaj(port, 'http://inny.example/index.html', { naglowki: { cookie: ciastko } })).status).toBe(400);
    expect((await zapytaj(port, '//inny.example/index.html', { naglowki: { cookie: ciastko } })).status).toBe(400);
  });

  it('HEAD bez treści, 304 przy niezmienionym pliku, 405 dla innych metod', async () => {
    const head = await zapytaj(port, '/', { metoda: 'HEAD', naglowki: { cookie: ciastko } });
    expect(head.status).toBe(200);
    expect(head.tresc).toBe('');
    expect(head.naglowki['content-length']).toBeDefined();

    const etag = head.naglowki.etag!;
    const ponownie = await zapytaj(port, '/', { naglowki: { cookie: ciastko, 'if-none-match': etag } });
    expect(ponownie.status).toBe(304);
    expect(ponownie.tresc).toBe('');

    const post = await zapytaj(port, '/index.html', { metoda: 'POST', naglowki: { cookie: ciastko }, tresc: 'x' });
    expect(post.status).toBe(405);
    expect(post.naglowki.allow).toBe('GET, HEAD');
  });

  it('zbyt duży formularz odrzuca, zanim go wczyta', async () => {
    const o = await zapytaj(port, '/api/logowanie', {
      metoda: 'POST',
      naglowki: { 'content-type': 'application/x-www-form-urlencoded' },
      tresc: 'haslo=' + 'a'.repeat(LIMIT_TRESCI),
    });
    expect(o.status).toBe(413);
  });

  it('każda odpowiedź ma nagłówki bezpieczeństwa', async () => {
    for (const [s, n] of [
      ['/logowanie.html', {}],
      ['/', STRONA],
      ['/assets/index-abc123.js', {}],
      ['/', { ...STRONA, cookie: ciastko }],
      ['/nie-ma.js', { cookie: ciastko }],
    ] as const) {
      const o = await zapytaj(port, s, { naglowki: n });
      expect(o.naglowki['x-content-type-options'], s).toBe('nosniff');
      expect(o.naglowki['x-frame-options'], s).toBe('DENY');
      expect(o.naglowki['referrer-policy'], s).toBe('same-origin');
    }
  });

  it('bez hasła zamyka wszystko, jak na Vercelu', async () => {
    const zamkniety = utworzSerwer({ katalog: path.join(katalogTestu, 'dist'), haslo: undefined });
    await new Promise<void>((r) => zamkniety.listen(0, '127.0.0.1', r));
    const p = (zamkniety.address() as AddressInfo).port;
    try {
      for (const s of ['/', '/logowanie.html', '/assets/index-abc123.js']) {
        const o = await zapytaj(p, s, { naglowki: STRONA });
        expect(o.status, s).toBe(503);
        expect(o.tresc).toContain('KALKULATOR_HASLO');
      }
    } finally {
      await new Promise((r) => zamkniety.close(r));
    }
  });
});
