// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  bezpiecznyPowrot,
  czyHasloPoprawne,
  czyZetonWazny,
  KARA_ZA_BLAD,
  obsluz,
  WAZNOSC_SESJI,
  WAZNOSC_ZAPAMIETANIA,
  wydajZeton,
} from '../ochrona';

const HASLO = 'jesienne-liscie-nad-wisla';
const TERAZ = Date.UTC(2026, 8, 25, 12, 0, 0);
const ADRES = 'https://kalkulator-walut.vercel.app';

const bezCzekania = async () => {};

function strona(sciezka: string, ciastko?: string): Request {
  const naglowki: Record<string, string> = { accept: 'text/html,application/xhtml+xml', 'sec-fetch-dest': 'document' };
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

const przepuszczone = (o: Response) => o.headers.get('x-middleware-next') === '1';

async function zalogowany(ciastko = ''): Promise<string> {
  return `${ciastko}kw_sesja=${await wydajZeton(HASLO, TERAZ + WAZNOSC_SESJI)}`;
}

describe('ochrona hasłem', () => {
  it('bez ustawionego hasła zamyka wszystko, łącznie ze stroną logowania', async () => {
    for (const haslo of [undefined, '']) {
      for (const z of [strona('/'), strona('/logowanie.html'), plik('/manifest.webmanifest')]) {
        const o = await obsluz(z, haslo, TERAZ);
        expect(o.status).toBe(503);
        expect(await o.text()).toContain('KALKULATOR_HASLO');
      }
    }
  });

  it('przepuszcza bez logowania tylko ekran logowania, manifest i ikony', async () => {
    for (const s of ['/logowanie.html', '/manifest.webmanifest', '/icons/icon-192.png', '/favicon.ico', '/robots.txt']) {
      expect(przepuszczone(await obsluz(plik(s), HASLO, TERAZ)), s).toBe(true);
    }
  });

  it('niezalogowanego przy otwieraniu strony odsyła na logowanie z adresem powrotu', async () => {
    const o = await obsluz(strona('/?waluta=USD'), HASLO, TERAZ);
    expect(o.status).toBe(302);
    expect(o.headers.get('location')).toBe('/logowanie.html?powrot=%2F%3Fwaluta%3DUSD');
    expect(o.headers.get('cache-control')).toBe('no-store');
  });

  it('niezalogowanemu odmawia skryptów i danych, zamiast podsuwać stronę logowania', async () => {
    for (const s of ['/assets/index-abc123.js', '/assets/index.css', '/sw.js', '/index.html']) {
      const o = await obsluz(plik(s), HASLO, TERAZ);
      expect(o.status, s).toBe(401);
      expect(o.headers.get('location')).toBeNull();
    }
  });

  it('z ważną sesją przepuszcza do aplikacji', async () => {
    const ciastko = await zalogowany('motyw=ciemny; ');
    expect(przepuszczone(await obsluz(strona('/'), HASLO, TERAZ))).toBe(false);
    expect(przepuszczone(await obsluz(strona('/', ciastko), HASLO, TERAZ))).toBe(true);
    expect(przepuszczone(await obsluz(plik('/assets/index-abc123.js', ciastko), HASLO, TERAZ))).toBe(true);
  });

  it('złe hasło: odczekuje karę i wraca na logowanie z błędem, bez ciasteczek', async () => {
    const kary: number[] = [];
    const o = await obsluz(formularz({ haslo: 'zgaduje', powrot: '/historia' }), HASLO, TERAZ, async (ms) => {
      kary.push(ms);
    });
    expect(kary).toEqual([KARA_ZA_BLAD]);
    expect(o.status).toBe(303);
    expect(o.headers.get('location')).toBe('/logowanie.html?blad=1&powrot=%2Fhistoria');
    expect(o.headers.getSetCookie()).toEqual([]);
  });

  it('puste hasło i hasło różniące się wielkością liter też są złe', async () => {
    expect(await czyHasloPoprawne('', HASLO)).toBe(false);
    expect(await czyHasloPoprawne(HASLO.toUpperCase(), HASLO)).toBe(false);
    expect(await czyHasloPoprawne(HASLO + ' ', HASLO)).toBe(false);
    expect(await czyHasloPoprawne(HASLO, HASLO)).toBe(true);
  });

  it('dobre hasło bez zapamiętania: ciasteczka sesyjne, żeton na 12 godzin', async () => {
    const o = await obsluz(formularz({ haslo: HASLO, powrot: '/' }), HASLO, TERAZ, bezCzekania);
    expect(o.status).toBe(303);
    expect(o.headers.get('location')).toBe('/');
    const [sesja, znacznik] = o.headers.getSetCookie();
    expect(sesja).toMatch(/^kw_sesja=v1\.\d+\.[\w-]+; Path=\/; HttpOnly; Secure; SameSite=Lax$/);
    expect(znacznik).toBe('kw_zalogowany=1; Path=/; Secure; SameSite=Lax');

    const zeton = sesja!.split(';')[0]!.slice('kw_sesja='.length);
    expect(await czyZetonWazny(zeton, HASLO, TERAZ + WAZNOSC_SESJI - 1)).toBe(true);
    expect(await czyZetonWazny(zeton, HASLO, TERAZ + WAZNOSC_SESJI)).toBe(false);
  });

  it('„Zapamiętaj na tym urządzeniu" daje ciasteczka na 30 dni', async () => {
    const o = await obsluz(formularz({ haslo: HASLO, zapamietaj: '1', powrot: '/' }), HASLO, TERAZ, bezCzekania);
    const [sesja, znacznik] = o.headers.getSetCookie();
    expect(sesja).toMatch(/; Max-Age=2592000$/);
    expect(znacznik).toMatch(/; Max-Age=2592000$/);
    const zeton = sesja!.split(';')[0]!.slice('kw_sesja='.length);
    expect(await czyZetonWazny(zeton, HASLO, TERAZ + WAZNOSC_ZAPAMIETANIA - 1)).toBe(true);
    expect(await czyZetonWazny(zeton, HASLO, TERAZ + WAZNOSC_ZAPAMIETANIA)).toBe(false);
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
    ]) {
      const o = await obsluz(formularz({ haslo: HASLO, powrot: powrot! }), HASLO, TERAZ, bezCzekania);
      expect(o.headers.get('location'), powrot).toBe(oczekiwany);
    }
    expect(bezpiecznyPowrot(null)).toBe('/');
  });

  it('odrzuca żeton podrobiony, przeterminowany albo podpisany starym hasłem', async () => {
    const dobry = await wydajZeton(HASLO, TERAZ + WAZNOSC_SESJI);
    const [, wygasa, podpis] = dobry.split('.');
    const dalszy = String(Number(wygasa) + WAZNOSC_ZAPAMIETANIA);

    expect(await czyZetonWazny(dobry, HASLO, TERAZ)).toBe(true);
    // Przedłużenie terminu bez nowego podpisu.
    expect(await czyZetonWazny(`v1.${dalszy}.${podpis}`, HASLO, TERAZ)).toBe(false);
    // Zmieniony podpis.
    const zmieniony = podpis!.slice(0, -2) + (podpis!.endsWith('AA') ? 'BB' : 'AA');
    expect(await czyZetonWazny(`v1.${wygasa}.${zmieniony}`, HASLO, TERAZ)).toBe(false);
    // Śmieci i formy brzegowe.
    for (const z of [undefined, '', '1', 'v1..', `v2.${wygasa}.${podpis}`, `v1.${wygasa}.${podpis}.x`, `v1.-5.${podpis}`, `v1.${wygasa}.+/=`]) {
      expect(await czyZetonWazny(z, HASLO, TERAZ), String(z)).toBe(false);
    }
    // Po terminie.
    expect(await czyZetonWazny(dobry, HASLO, TERAZ + WAZNOSC_SESJI)).toBe(false);
    // Zmiana hasła unieważnia wszystkie sesje.
    expect(await czyZetonWazny(dobry, 'nowe-haslo-po-zmianie', TERAZ)).toBe(false);
  });

  it('wylogowanie kasuje oba ciasteczka i wraca na ekran logowania', async () => {
    const o = await obsluz(strona('/api/wyloguj', await zalogowany()), HASLO, TERAZ);
    expect(o.status).toBe(303);
    expect(o.headers.get('location')).toBe('/logowanie.html');
    const ciastka = o.headers.getSetCookie();
    expect(ciastka).toHaveLength(2);
    expect(ciastka.every((c) => c.endsWith('Max-Age=0'))).toBe(true);
    expect(ciastka.map((c) => c.split('=')[0])).toEqual(['kw_sesja', 'kw_zalogowany']);
  });

  it('wejście na adres logowania zwykłym linkiem wraca do formularza', async () => {
    const o = await obsluz(strona('/api/logowanie'), HASLO, TERAZ);
    expect(o.status).toBe(303);
    expect(o.headers.get('location')).toBe('/logowanie.html');
  });

  it('nieczytelny formularz nie wysypuje serwera', async () => {
    const z = new Request(ADRES + '/api/logowanie', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=brak' },
      body: 'to nie jest formularz',
    });
    expect((await obsluz(z, HASLO, TERAZ, bezCzekania)).status).toBe(400);
  });

  it('sam jawny znacznik nie wystarcza do wejścia', async () => {
    expect(przepuszczone(await obsluz(strona('/', 'kw_zalogowany=1'), HASLO, TERAZ))).toBe(false);
  });
});
