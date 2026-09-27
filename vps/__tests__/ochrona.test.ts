// @vitest-environment node
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  bezpiecznyPowrot,
  KARA_ZA_BLAD,
  obsluz,
  WAZNOSC_SESJI,
  WAZNOSC_ZAPAMIETANIA,
  wydajZeton,
} from '../ochrona';
import type { Uzytkownik } from '../uzytkownicy';
import { gotoweSkroty, HASLO_ADMINA, HASLO_ANNY, konta, srodowisko, type Srodowisko } from './pomoc';

const TERAZ = Date.UTC(2026, 8, 27, 12, 0, 0);
const ADRES = 'https://kalkulator.apkownia.cloud';
const API = { 'x-kalkulator': '1', 'sec-fetch-site': 'same-origin' };

function strona(sciezka: string, ciastko?: string): Request {
  const naglowki: Record<string, string> = { accept: 'text/html', 'sec-fetch-dest': 'document' };
  if (ciastko) naglowki.cookie = ciastko;
  return new Request(ADRES + sciezka, { headers: naglowki });
}

function plik(sciezka: string, ciastko?: string): Request {
  const naglowki: Record<string, string> = { accept: '*/*', 'sec-fetch-dest': 'script' };
  if (ciastko) naglowki.cookie = ciastko;
  return new Request(ADRES + sciezka, { headers: naglowki });
}

function formularz(pola: Record<string, string>): Request {
  return new Request(ADRES + '/api/logowanie', { method: 'POST', body: new URLSearchParams(pola) });
}

function api(metoda: string, sciezka: string, ciastko: string | undefined, dane?: unknown, naglowki = API): Request {
  const h: Record<string, string> = { ...naglowki };
  if (ciastko) h.cookie = ciastko;
  if (dane !== undefined) h['content-type'] = 'application/json';
  return new Request(ADRES + sciezka, { method: metoda, headers: h, body: dane === undefined ? undefined : JSON.stringify(dane) });
}

/** Ciasteczko sesji z odpowiedzi — tak, jak odesłałaby je przeglądarka. */
function sesjaZ(o: Response): string {
  const c = o.headers.getSetCookie().find((x) => x.startsWith('kw_sesja='));
  if (!c) throw new Error('Brak ciasteczka sesji');
  return c.split(';')[0]!;
}

let s: Srodowisko;
afterEach(() => s?.sprzataj());
beforeAll(() => gotoweSkroty());

async function zaloguj(login: string, haslo: string, dodatkowe: Record<string, string> = {}): Promise<Response> {
  return (await obsluz(formularz({ login, haslo, powrot: '/', ...dodatkowe }), s.kontekst))!;
}

async function zalogowany(login: string, haslo: string): Promise<string> {
  const o = await zaloguj(login, haslo);
  expect(o.status).toBe(303);
  return sesjaZ(o);
}

describe('bez kont', () => {
  it('zamyka wszystko, łącznie z ekranem logowania', async () => {
    s = await srodowisko([]);
    for (const z of [strona('/'), strona('/logowanie.html'), plik('/manifest.webmanifest')]) {
      expect((await obsluz(z, s.kontekst))!.status).toBe(503);
    }
  });
});

describe('logowanie', () => {
  it('niezalogowanego odsyła na ekran logowania z adresem powrotu', async () => {
    s = await srodowisko(undefined, () => TERAZ);
    const o = (await obsluz(strona('/?waluta=THB'), s.kontekst))!;
    expect(o.status).toBe(302);
    expect(o.headers.get('location')).toBe('/logowanie.html?powrot=%2F%3Fwaluta%3DTHB');
  });

  it('przepuszcza bez logowania tylko ekran logowania, manifest i ikony', async () => {
    s = await srodowisko();
    for (const p of ['/logowanie.html', '/manifest.webmanifest', '/icons/icon-192.png', '/favicon.ico', '/robots.txt']) {
      expect(await obsluz(plik(p), s.kontekst), p).toBeNull();
    }
    for (const p of ['/assets/index-abc.js', '/sw.js', '/index.html']) {
      expect((await obsluz(plik(p), s.kontekst))!.status, p).toBe(401);
    }
  });

  it('złe hasło i nieistniejące konto: ta sama odpowiedź, ta sama kara, bez ciasteczek', async () => {
    s = await srodowisko(undefined, () => TERAZ);
    const kary: number[] = [];
    s.kontekst.czekaj = async (ms) => {
      kary.push(ms);
    };
    const zle = await zaloguj('jedrzej', 'zgaduje-sobie-haslo');
    const brak = await zaloguj('nikt', 'zgaduje-sobie-haslo');
    expect(kary).toEqual([KARA_ZA_BLAD, KARA_ZA_BLAD]);
    for (const [o, login] of [[zle, 'jedrzej'], [brak, 'nikt']] as const) {
      expect(o.status).toBe(303);
      expect(o.headers.get('location')).toBe(`/logowanie.html?blad=1&powrot=%2F&login=${login}`);
      expect(o.headers.getSetCookie()).toEqual([]);
    }
    // Hasło innej osoby nie otwiera konta.
    expect((await zaloguj('jedrzej', HASLO_ANNY)).headers.get('location')).toContain('blad=1');
  });

  it('dobre hasło: sesja na 12 godzin, identyfikator w jawnym ciasteczku; wielkość liter w identyfikatorze bez znaczenia', async () => {
    s = await srodowisko(undefined, () => TERAZ);
    const o = await zaloguj('  Anna.Nowak ', HASLO_ANNY);
    expect(o.status).toBe(303);
    expect(o.headers.get('location')).toBe('/');
    const [sesja, znacznik] = o.headers.getSetCookie();
    expect(sesja).toMatch(/^kw_sesja=v2\.\d+\.[\w-]{43}\.anna\.nowak; Path=\/; HttpOnly; Secure; SameSite=Lax$/);
    expect(znacznik).toBe('kw_zalogowany=anna.nowak; Path=/; Secure; SameSite=Lax');
    expect(sesja).toContain(`v2.${TERAZ + WAZNOSC_SESJI}.`);
  });

  it('„Zapamiętaj na tym urządzeniu" daje 30 dni', async () => {
    s = await srodowisko(undefined, () => TERAZ);
    const o = await zaloguj('jedrzej', HASLO_ADMINA, { zapamietaj: '1' });
    for (const c of o.headers.getSetCookie()) expect(c).toMatch(/; Max-Age=2592000$/);
    expect(sesjaZ(o)).toContain(`v2.${TERAZ + WAZNOSC_ZAPAMIETANIA}.`);
  });

  it('po zalogowaniu wraca tylko na adres w obrębie witryny', async () => {
    for (const [powrot, oczekiwany] of [
      ['/?waluta=THB', '/?waluta=THB'],
      ['https://obca.example/', '/'],
      ['//obca.example/', '/'],
      ['/\\obca.example', '/'],
      ['/api/wyloguj', '/'],
      ['/logowanie.html?blad=1', '/'],
      ['', '/'],
      [null, '/'],
    ] as const) {
      expect(bezpiecznyPowrot(powrot), String(powrot)).toBe(oczekiwany);
    }
  });

  it('wylogowanie kasuje oba ciasteczka', async () => {
    s = await srodowisko();
    const o = (await obsluz(strona('/api/wyloguj'), s.kontekst))!;
    expect(o.status).toBe(303);
    expect(o.headers.get('location')).toBe('/logowanie.html');
    expect(o.headers.getSetCookie().map((c) => c.split('=')[0])).toEqual(['kw_sesja', 'kw_zalogowany']);
    expect(o.headers.getSetCookie().every((c) => c.endsWith('Max-Age=0'))).toBe(true);
  });
});

describe('sesja', () => {
  it('ważna przepuszcza do aplikacji, podrobiona i przeterminowana — nie', async () => {
    let teraz = TERAZ;
    s = await srodowisko(undefined, () => teraz);
    const [admin] = await konta();
    const dobry = wydajZeton(s.kontekst.klucz, admin!, TERAZ + WAZNOSC_SESJI);
    expect(await obsluz(strona('/', `kw_sesja=${dobry}`), s.kontekst)).toBeNull();

    const [, wygasa, podpis, login] = dobry.split('.');
    const podrobione = [
      `v2.${Number(wygasa) + WAZNOSC_ZAPAMIETANIA}.${podpis}.${login}`, // przedłużony termin
      `v2.${wygasa}.${podpis}.anna.nowak`, // cudzy identyfikator
      `v2.${wygasa}.${podpis!.replace(/^./, (z) => (z === 'A' ? 'B' : 'A'))}.${login}`,
      wydajZeton(Buffer.alloc(32, 8), admin!, TERAZ + WAZNOSC_SESJI), // obcy klucz
      'kw_zalogowany=jedrzej',
      '',
    ];
    for (const z of podrobione) {
      expect((await obsluz(strona('/', `kw_sesja=${z}`), s.kontekst))!.status, z).toBe(302);
    }
    teraz = TERAZ + WAZNOSC_SESJI;
    expect((await obsluz(strona('/', `kw_sesja=${dobry}`), s.kontekst))!.status).toBe(302);
  });

  it('sam jawny znacznik nie wystarcza do wejścia', async () => {
    s = await srodowisko();
    expect((await obsluz(strona('/', 'kw_zalogowany=jedrzej'), s.kontekst))!.status).toBe(302);
  });
});

describe('API', () => {
  it('bez nagłówka aplikacji albo z cudzej strony — odmowa, nawet z ważną sesją', async () => {
    s = await srodowisko();
    const sesja = await zalogowany('jedrzej', HASLO_ADMINA);
    expect((await obsluz(api('GET', '/api/ja', sesja, undefined, {} as typeof API), s.kontekst))!.status).toBe(403);
    const zCudzej = { 'x-kalkulator': '1', 'sec-fetch-site': 'cross-site' };
    expect((await obsluz(api('GET', '/api/ja', sesja, undefined, zCudzej), s.kontekst))!.status).toBe(403);
    expect((await obsluz(api('GET', '/api/ja', undefined), s.kontekst))!.status).toBe(401);
  });

  it('/api/ja opisuje konto bez skrótu hasła', async () => {
    s = await srodowisko();
    const sesja = await zalogowany('anna.nowak', HASLO_ANNY);
    const o = (await obsluz(api('GET', '/api/ja', sesja), s.kontekst))!;
    expect(o.status).toBe(200);
    const ja = (await o.json()) as Record<string, unknown>;
    expect(ja).toMatchObject({ login: 'anna.nowak', nazwa: 'Anna Nowak', admin: false, wymagaZmiany: false });
    expect(ja).not.toHaveProperty('haslo');
  });

  it('zwykły użytkownik nie ma dostępu do listy kont', async () => {
    s = await srodowisko();
    const sesja = await zalogowany('anna.nowak', HASLO_ANNY);
    for (const [m, p, d] of [
      ['GET', '/api/uzytkownicy'],
      ['POST', '/api/uzytkownicy', { login: 'ktos', haslo: 'dlugie-haslo-testowe' }],
      ['DELETE', '/api/uzytkownicy/jedrzej'],
      ['PATCH', '/api/uzytkownicy/anna.nowak', { admin: true }],
    ] as const) {
      expect((await obsluz(api(m, p, sesja, d), s.kontekst))!.status, `${m} ${p}`).toBe(403);
    }
  });
});

describe('zmiana własnego hasła', () => {
  it('wymaga obecnego hasła i sensownego nowego', async () => {
    s = await srodowisko();
    const sesja = await zalogowany('anna.nowak', HASLO_ANNY);
    const proby: [unknown, string][] = [
      [{ stare: 'nie-to-haslo-wcale', nowe: 'calkiem-nowe-haslo-anny' }, 'Obecne hasło się nie zgadza.'],
      [{ stare: HASLO_ANNY, nowe: 'krotkie' }, 'co najmniej 12 znaków'],
      [{ stare: HASLO_ANNY, nowe: 'anna.nowak-i-cos-jeszcze' }, 'identyfikatora'],
      [{ stare: HASLO_ANNY, nowe: HASLO_ANNY }, 'inne niż obecne'],
    ];
    for (const [dane, komunikat] of proby) {
      const o = (await obsluz(api('POST', '/api/haslo', sesja, dane), s.kontekst))!;
      expect(o.status).toBe(400);
      expect(((await o.json()) as { blad: string }).blad).toContain(komunikat);
    }
  });

  it('po zmianie stare sesje wygasają, a bieżąca dostaje nowe ciasteczko', async () => {
    s = await srodowisko(undefined, () => TERAZ);
    const naLaptopie = await zalogowany('anna.nowak', HASLO_ANNY);
    const naTelefonie = await zalogowany('anna.nowak', HASLO_ANNY);
    const admina = await zalogowany('jedrzej', HASLO_ADMINA);

    const o = (await obsluz(api('POST', '/api/haslo', naLaptopie, { stare: HASLO_ANNY, nowe: 'nowe haslo anny 2026' }), s.kontekst))!;
    expect(o.status).toBe(200);
    const nowa = sesjaZ(o);
    // Termin bez zmian; bez „zapamiętaj" ciasteczko nadal sesyjne.
    expect(o.headers.getSetCookie()[0]).not.toContain('Max-Age');

    expect(await obsluz(strona('/', nowa), s.kontekst)).toBeNull();
    expect((await obsluz(strona('/', naTelefonie), s.kontekst))!.status).toBe(302);
    expect((await obsluz(strona('/', naLaptopie), s.kontekst))!.status).toBe(302);
    // Cudze sesje zostają.
    expect(await obsluz(strona('/', admina), s.kontekst)).toBeNull();

    expect((await zaloguj('anna.nowak', HASLO_ANNY)).headers.get('location')).toContain('blad=1');
    expect((await zaloguj('anna.nowak', 'nowe haslo anny 2026')).headers.get('location')).toBe('/');
  });
});

describe('hasło startowe od administratora', () => {
  it('do czasu zmiany wolno tylko sprawdzić konto i ustawić własne hasło', async () => {
    const lista = await konta();
    lista[1]!.wymagaZmiany = true;
    lista[1]!.admin = true;
    s = await srodowisko(lista);
    const sesja = await zalogowany('anna.nowak', HASLO_ANNY);

    expect((await obsluz(api('GET', '/api/uzytkownicy', sesja), s.kontekst))!.status).toBe(403);
    const ja = (await (await obsluz(api('GET', '/api/ja', sesja), s.kontekst))!.json()) as { wymagaZmiany: boolean };
    expect(ja.wymagaZmiany).toBe(true);

    const o = (await obsluz(api('POST', '/api/haslo', sesja, { stare: HASLO_ANNY, nowe: 'wlasne haslo anny 2026' }), s.kontekst))!;
    expect(((await o.json()) as { wymagaZmiany: boolean }).wymagaZmiany).toBe(false);
    expect((await obsluz(api('GET', '/api/uzytkownicy', sesjaZ(o)), s.kontekst))!.status).toBe(200);
  });
});

describe('panel administratora', () => {
  it('lista kont bez skrótów haseł', async () => {
    s = await srodowisko();
    const sesja = await zalogowany('jedrzej', HASLO_ADMINA);
    const lista = (await (await obsluz(api('GET', '/api/uzytkownicy', sesja), s.kontekst))!.json()) as Record<string, unknown>[];
    expect(lista.map((u) => u.login)).toEqual(['jedrzej', 'anna.nowak']);
    expect(lista.every((u) => !('haslo' in u))).toBe(true);
  });

  it('dodaje konto z hasłem startowym; nowa osoba loguje się i musi je zmienić', async () => {
    s = await srodowisko();
    const sesja = await zalogowany('jedrzej', HASLO_ADMINA);
    const o = (await obsluz(api('POST', '/api/uzytkownicy', sesja, { login: ' Piotr.K ', nazwa: '  Piotr   Kowalski ', haslo: 'startowe-haslo-piotra', admin: false }), s.kontekst))!;
    expect(o.status).toBe(201);
    expect(await o.json()).toMatchObject({ login: 'piotr.k', nazwa: 'Piotr Kowalski', admin: false, wymagaZmiany: true });

    const jego = await zalogowany('piotr.k', 'startowe-haslo-piotra');
    const ja = (await (await obsluz(api('GET', '/api/ja', jego), s.kontekst))!.json()) as { wymagaZmiany: boolean };
    expect(ja.wymagaZmiany).toBe(true);
  });

  it('odrzuca zły identyfikator, słabe hasło i zajęty identyfikator', async () => {
    s = await srodowisko();
    const sesja = await zalogowany('jedrzej', HASLO_ADMINA);
    const proby: [unknown, number][] = [
      [{ login: 'ł', haslo: 'dlugie-haslo-testowe' }, 400],
      [{ login: 'jan kowalski', haslo: 'dlugie-haslo-testowe' }, 400],
      [{ login: '-jan', haslo: 'dlugie-haslo-testowe' }, 400],
      [{ login: 'jan', haslo: 'krotkie' }, 400],
      [{ login: 'jan', haslo: 'dlugie-haslo-testowe', nazwa: 'a'.repeat(81) }, 400],
      [{ login: 'Anna.Nowak', haslo: 'dlugie-haslo-testowe' }, 409],
      ['nie obiekt', 400],
    ];
    for (const [dane, status] of proby) {
      expect((await obsluz(api('POST', '/api/uzytkownicy', sesja, dane), s.kontekst))!.status, JSON.stringify(dane)).toBe(status);
    }
    expect((await s.magazyn.wszyscy()).length).toBe(2);
  });

  it('reset hasła: stare sesje tej osoby wygasają, nowe hasło jest startowe', async () => {
    s = await srodowisko();
    const admin = await zalogowany('jedrzej', HASLO_ADMINA);
    const anny = await zalogowany('anna.nowak', HASLO_ANNY);
    const o = (await obsluz(api('POST', '/api/uzytkownicy/anna.nowak/haslo', admin, { haslo: 'reset-hasla-anny-01' }), s.kontekst))!;
    expect(o.status).toBe(200);
    expect(await o.json()).toMatchObject({ wymagaZmiany: true });
    expect((await obsluz(strona('/', anny), s.kontekst))!.status).toBe(302);
    expect(await obsluz(strona('/', admin), s.kontekst)).toBeNull();
    expect((await zaloguj('anna.nowak', 'reset-hasla-anny-01')).headers.get('location')).toBe('/');
    // Własne hasło administrator zmienia jak każdy — ze starym hasłem.
    expect((await obsluz(api('POST', '/api/uzytkownicy/jedrzej/haslo', admin, { haslo: 'reset-wlasnego-hasla' }), s.kontekst))!.status).toBe(400);
  });

  it('uprawnienia i usuwanie: zawsze zostaje administrator, nie da się usunąć siebie', async () => {
    s = await srodowisko();
    const admin = await zalogowany('jedrzej', HASLO_ADMINA);
    const anny = await zalogowany('anna.nowak', HASLO_ANNY);

    const zmien = (login: string, dane: unknown) => obsluz(api('PATCH', `/api/uzytkownicy/${login}`, admin, dane), s.kontekst);
    expect((await zmien('jedrzej', { admin: false }))!.status).toBe(400);
    expect((await obsluz(api('DELETE', '/api/uzytkownicy/jedrzej', admin), s.kontekst))!.status).toBe(400);
    expect((await obsluz(api('DELETE', '/api/uzytkownicy/nikt', admin), s.kontekst))!.status).toBe(404);

    const awans = await zmien('anna.nowak', { admin: true, nazwa: 'Anna Nowak-Kowalska' });
    expect(await awans!.json()).toMatchObject({ admin: true, nazwa: 'Anna Nowak-Kowalska' });
    // Uprawnienia działają od razu, bez ponownego logowania.
    expect((await obsluz(api('GET', '/api/uzytkownicy', anny), s.kontekst))!.status).toBe(200);

    expect((await obsluz(api('DELETE', '/api/uzytkownicy/anna.nowak', admin), s.kontekst))!.status).toBe(204);
    expect((await obsluz(strona('/', anny), s.kontekst))!.status).toBe(302);
    expect((await s.magazyn.wszyscy()).map((u: Uzytkownik) => u.login)).toEqual(['jedrzej']);
  });

  it('konto usunięte przez innego administratora nie może się już usunąć samo', async () => {
    const lista = await konta();
    lista[1]!.admin = true;
    s = await srodowisko(lista);
    const anny = await zalogowany('anna.nowak', HASLO_ANNY);
    const admin = await zalogowany('jedrzej', HASLO_ADMINA);
    expect((await obsluz(api('DELETE', '/api/uzytkownicy/anna.nowak', admin), s.kontekst))!.status).toBe(204);
    // Ostatni administrator nie może zostać usunięty przez usuniętą już sesję.
    expect((await obsluz(api('DELETE', '/api/uzytkownicy/jedrzej', anny), s.kontekst))!.status).toBe(401);
  });
});
