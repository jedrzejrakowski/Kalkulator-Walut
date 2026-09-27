/**
 * Kontrola dostępu: logowanie, sesje i API kont.
 *
 * Program liczy w przeglądarce, więc logowanie sprawdzane w jego kodzie
 * dałoby się obejść w minutę. Tu serwer decyduje, zanim wyda jakikolwiek
 * plik aplikacji: bez ważnej sesji nie ma ani strony, ani skryptów.
 *
 * `obsluz` zwraca gotową odpowiedź albo `null` — wtedy serwer wydaje plik.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BladKonta,
  czyHasloPasuje,
  dodaj,
  type Magazyn,
  normalizujLogin,
  opis,
  skrotHasla,
  skrotZastepczy,
  sprawdzHasloNowe,
  sprawdzLogin,
  sprawdzNazwe,
  ustawHaslo,
  usun,
  type Uzytkownik,
  zmienDane,
} from './uzytkownicy';

export const CIASTKO_SESJI = 'kw_sesja';
/** Jawne ciasteczko z identyfikatorem — aplikacja wie z niego, czyja jest historia. */
export const CIASTKO_ZNACZNIK = 'kw_zalogowany';

export const STRONA_LOGOWANIA = '/logowanie.html';
export const ADRES_LOGOWANIA = '/api/logowanie';
export const ADRES_WYLOGOWANIA = '/api/wyloguj';
/** Nagłówek, którego cudza strona nie doda do zapytania bez zgody serwera. */
export const NAGLOWEK_API = 'x-kalkulator';

const GODZINA = 60 * 60 * 1000;
/** Z „Zapamiętaj na tym urządzeniu". */
export const WAZNOSC_ZAPAMIETANIA = 30 * 24 * GODZINA;
/** Bez zapamiętania — sesja przeglądarki, ale nie dłużej niż dzień roboczy. */
export const WAZNOSC_SESJI = 12 * GODZINA;
/** Opóźnienie po złym haśle — spowalnia zgadywanie. */
export const KARA_ZA_BLAD = 800;

/**
 * Adresy dostępne bez logowania: ekran logowania, a do tego manifest i ikony,
 * które przeglądarka pobiera bez ciasteczek — bez nich zainstalowana
 * aplikacja straciłaby ikonę. Nic z tego nie zdradza działania programu.
 */
const PUBLICZNE = new Set([STRONA_LOGOWANIA, '/manifest.webmanifest', '/favicon.ico', '/robots.txt']);
const PUBLICZNE_KATALOGI = ['/icons/'];

export interface Kontekst {
  magazyn: Magazyn;
  /** Tajny klucz serwera do podpisywania sesji. */
  klucz: Buffer;
  teraz?: () => number;
  czekaj?: (ms: number) => Promise<void>;
}

// --- żeton sesji ---

/**
 * Żeton: `v2.<wygasa>.<podpis>.<login>`.
 *
 * Podpis obejmuje też skrót hasła użytkownika: zmiana hasła albo usunięcie
 * konta unieważnia od razu wszystkie jego sesje, a cudzych nie rusza.
 */
function podpis(klucz: Buffer, login: string, wygasa: number, u: Uzytkownik): Buffer {
  return createHmac('sha256', klucz).update(`v2.${wygasa}.${login}.${u.haslo}`).digest();
}

export function wydajZeton(klucz: Buffer, u: Uzytkownik, wygasa: number): string {
  return `v2.${wygasa}.${podpis(klucz, u.login, wygasa, u).toString('base64url')}.${u.login}`;
}

interface Sesja {
  uzytkownik: Uzytkownik;
  wygasa: number;
}

async function odczytajSesje(zeton: string | undefined, k: Kontekst, teraz: number): Promise<Sesja | null> {
  const m = zeton?.match(/^v2\.(\d{1,16})\.([A-Za-z0-9_-]{43})\.([a-z0-9._-]{2,32})$/);
  if (!m) return null;
  const wygasa = Number(m[1]);
  if (wygasa <= teraz) return null;
  const u = await k.magazyn.znajdz(m[3]!);
  if (!u) return null;
  const oczekiwany = podpis(k.klucz, u.login, wygasa, u);
  const podany = Buffer.from(m[2]!, 'base64url');
  if (podany.length !== oczekiwany.length || !timingSafeEqual(podany, oczekiwany)) return null;
  return { uzytkownik: u, wygasa };
}

// --- pomocnicze ---

export function odczytajCiastko(zapytanie: Request, nazwa: string): string | undefined {
  for (const para of (zapytanie.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = para.trim().split('=');
    if (k === nazwa) return v.join('=');
  }
  return undefined;
}

/**
 * Adres, na który wrócić po zalogowaniu — tylko ścieżka w obrębie tej witryny.
 * Bez tej kontroli link „zaloguj się, a potem idź na obcą stronę" byłby
 * klasycznym chwytem na wyłudzenie.
 */
export function bezpiecznyPowrot(powrot: string | null | undefined): string {
  if (!powrot || !powrot.startsWith('/') || powrot.startsWith('//') || powrot.includes('\\')) return '/';
  if (powrot.startsWith(STRONA_LOGOWANIA) || powrot.startsWith('/api/')) return '/';
  return powrot;
}

function czyPubliczny(sciezka: string): boolean {
  return PUBLICZNE.has(sciezka) || PUBLICZNE_KATALOGI.some((k) => sciezka.startsWith(k));
}

/** Czy żądanie to otwarcie strony, a nie pobranie skryptu czy obrazka. */
function czyStrona(zapytanie: Request): boolean {
  if (zapytanie.headers.get('sec-fetch-dest') === 'document') return true;
  return (zapytanie.headers.get('accept') ?? '').includes('text/html');
}

/** Ciasteczka sesji; `zyje` null — do zamknięcia przeglądarki. */
function ciastka(zeton: string, login: string, zyje: number | null): string[] {
  const trwalosc = zyje === null ? '' : `; Max-Age=${Math.floor(zyje / 1000)}`;
  return [
    `${CIASTKO_SESJI}=${zeton}; Path=/; HttpOnly; Secure; SameSite=Lax${trwalosc}`,
    `${CIASTKO_ZNACZNIK}=${login}; Path=/; Secure; SameSite=Lax${trwalosc}`,
  ];
}

const SKASUJ_CIASTKA = [
  `${CIASTKO_SESJI}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
  `${CIASTKO_ZNACZNIK}=; Path=/; Secure; SameSite=Lax; Max-Age=0`,
];

function przekierowanie(dokad: string, status = 303, doustawienia: string[] = []): Response {
  const naglowki = new Headers({ Location: dokad, 'Cache-Control': 'no-store' });
  for (const c of doustawienia) naglowki.append('Set-Cookie', c);
  return new Response(null, { status, headers: naglowki });
}

function tekst(tresc: string, status: number): Response {
  return new Response(tresc, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function json(dane: unknown, status = 200, doustawienia: string[] = []): Response {
  const naglowki = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  for (const c of doustawienia) naglowki.append('Set-Cookie', c);
  return new Response(JSON.stringify(dane), { status, headers: naglowki });
}

const blad = (wiadomosc: string, status: number) => json({ blad: wiadomosc }, status);

// --- logowanie ---

async function zaloguj(zapytanie: Request, k: Kontekst, teraz: number): Promise<Response> {
  let dane: FormData;
  try {
    dane = await zapytanie.formData();
  } catch {
    return tekst('Nieprawidłowe zapytanie.', 400);
  }
  const powrot = bezpiecznyPowrot(String(dane.get('powrot') ?? ''));
  const login = normalizujLogin(String(dane.get('login') ?? ''));
  const haslo = String(dane.get('haslo') ?? '');

  let u: Uzytkownik | undefined;
  let pasuje = false;
  try {
    u = await k.magazyn.znajdz(login);
    // Nieistniejące konto sprawdzamy tak samo długo jak istniejące.
    pasuje = await czyHasloPasuje(haslo, u?.haslo ?? (await skrotZastepczy()));
  } catch (e) {
    if (e instanceof BladKonta) return tekst(e.message, e.status);
    throw e;
  }

  if (!u || !pasuje) {
    await (k.czekaj ?? czekajDomyslnie)(KARA_ZA_BLAD);
    const z = new URLSearchParams({ blad: '1', powrot });
    if (login) z.set('login', login);
    return przekierowanie(`${STRONA_LOGOWANIA}?${z}`);
  }

  const zapamietaj = dane.get('zapamietaj') === '1';
  const zyje = zapamietaj ? WAZNOSC_ZAPAMIETANIA : WAZNOSC_SESJI;
  return przekierowanie(powrot, 303, ciastka(wydajZeton(k.klucz, u, teraz + zyje), u.login, zapamietaj ? zyje : null));
}

const czekajDomyslnie = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// --- API ---

async function czytajJson(zapytanie: Request): Promise<Record<string, unknown>> {
  try {
    const dane: unknown = await zapytanie.json();
    if (typeof dane === 'object' && dane !== null && !Array.isArray(dane)) return dane as Record<string, unknown>;
  } catch {
    // niżej
  }
  throw new BladKonta(400, 'Nieprawidłowe dane.');
}

const napis = (v: unknown) => (typeof v === 'string' ? v : '');

async function api(zapytanie: Request, sciezka: string, sesja: Sesja, k: Kontekst, teraz: number): Promise<Response> {
  const ja = sesja.uzytkownik;
  const metoda = zapytanie.method;

  if (sciezka === '/api/ja' && metoda === 'GET') return json(opis(ja));

  if (sciezka === '/api/haslo' && metoda === 'POST') {
    const dane = await czytajJson(zapytanie);
    const stare = napis(dane.stare);
    const nowe = napis(dane.nowe);
    if (!(await czyHasloPasuje(stare, ja.haslo))) {
      await (k.czekaj ?? czekajDomyslnie)(KARA_ZA_BLAD);
      throw new BladKonta(400, 'Obecne hasło się nie zgadza.');
    }
    sprawdzHasloNowe(nowe, ja.login);
    if (nowe === stare) throw new BladKonta(400, 'Nowe hasło musi być inne niż obecne.');
    const skrot = await skrotHasla(nowe);
    const lista = await k.magazyn.zmien((l) => ustawHaslo(l, ja.login, skrot, false, new Date(teraz)));
    const po = lista.find((u) => u.login === ja.login)!;
    // Nowe hasło unieważnia stare sesje — także tę, więc wydajemy nową z tym
    // samym terminem. Długi termin oznacza, że było „zapamiętaj".
    const zyje = sesja.wygasa - teraz;
    return json(opis(po), 200, ciastka(wydajZeton(k.klucz, po, sesja.wygasa), po.login, zyje > WAZNOSC_SESJI ? zyje : null));
  }

  // Z hasłem od administratora wolno tylko ustawić własne.
  if (ja.wymagaZmiany) throw new BladKonta(403, 'Najpierw ustaw własne hasło.');
  if (!ja.admin) throw new BladKonta(403, 'Ta czynność wymaga uprawnień administratora.');

  if (sciezka === '/api/uzytkownicy') {
    if (metoda === 'GET') return json((await k.magazyn.wszyscy()).map(opis));
    if (metoda === 'POST') {
      const dane = await czytajJson(zapytanie);
      const login = normalizujLogin(napis(dane.login));
      sprawdzLogin(login);
      const nazwa = sprawdzNazwe(napis(dane.nazwa));
      const haslo = napis(dane.haslo);
      sprawdzHasloNowe(haslo, login);
      const skrot = await skrotHasla(haslo);
      const nowy = { login, nazwa, admin: dane.admin === true, haslo: skrot, wymagaZmiany: true };
      const lista = await k.magazyn.zmien((l) => dodaj(l, nowy, new Date(teraz)));
      return json(opis(lista.find((u) => u.login === login)!), 201);
    }
  }

  const m = sciezka.match(/^\/api\/uzytkownicy\/([a-z0-9._-]{2,32})(\/haslo)?$/);
  if (m) {
    const login = m[1]!;
    if (m[2] && metoda === 'POST') {
      if (login === ja.login) throw new BladKonta(400, 'Własne hasło zmienia się w oknie „Konto".');
      const dane = await czytajJson(zapytanie);
      const haslo = napis(dane.haslo);
      sprawdzHasloNowe(haslo, login);
      const skrot = await skrotHasla(haslo);
      const lista = await k.magazyn.zmien((l) => ustawHaslo(l, login, skrot, true, new Date(teraz)));
      return json(opis(lista.find((u) => u.login === login)!));
    }
    if (!m[2] && metoda === 'PATCH') {
      const dane = await czytajJson(zapytanie);
      const zmiany: { nazwa?: string; admin?: boolean } = {};
      if ('nazwa' in dane) zmiany.nazwa = sprawdzNazwe(napis(dane.nazwa));
      if (typeof dane.admin === 'boolean') zmiany.admin = dane.admin;
      const lista = await k.magazyn.zmien((l) => zmienDane(l, login, zmiany, ja.login));
      return json(opis(lista.find((u) => u.login === login)!));
    }
    if (!m[2] && metoda === 'DELETE') {
      await k.magazyn.zmien((l) => usun(l, login, ja.login));
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }
  }

  return blad('Nie ma takiej czynności.', 404);
}

/**
 * Czy zapytanie do API przyszło z samej aplikacji.
 *
 * Cudza strona może kazać przeglądarce wysłać formularz pod nasz adres, ale
 * nie dołoży własnego nagłówka bez zgody serwera. Do tego ciasteczka
 * SameSite=Lax i znacznik Sec-Fetch-Site w nowych przeglądarkach.
 */
function czyZAplikacji(zapytanie: Request): boolean {
  if (zapytanie.headers.get(NAGLOWEK_API) !== '1') return false;
  const skad = zapytanie.headers.get('sec-fetch-site');
  return skad === null || skad === 'same-origin';
}

// --- rozdzielnik ---

export async function obsluz(zapytanie: Request, k: Kontekst): Promise<Response | null> {
  const teraz = (k.teraz ?? Date.now)();
  const { pathname: sciezka, search } = new URL(zapytanie.url);

  // Bez kont nikt się nie zaloguje — zamykamy, zamiast otwierać wszystkim.
  if ((await k.magazyn.wszyscy()).length === 0) {
    return tekst('Kalkulator jest zamknięty: nie ma jeszcze żadnego konta. Administrator zakłada je na serwerze.', 503);
  }

  if (sciezka === ADRES_LOGOWANIA) {
    if (zapytanie.method !== 'POST') return przekierowanie(STRONA_LOGOWANIA);
    return zaloguj(zapytanie, k, teraz);
  }

  if (sciezka === ADRES_WYLOGOWANIA) return przekierowanie(STRONA_LOGOWANIA, 303, SKASUJ_CIASTKA);

  if (czyPubliczny(sciezka)) return null;

  const sesja = await odczytajSesje(odczytajCiastko(zapytanie, CIASTKO_SESJI), k, teraz);

  if (sciezka.startsWith('/api/')) {
    if (!czyZAplikacji(zapytanie)) return blad('Zapytanie spoza aplikacji.', 403);
    if (!sesja) return blad('Sesja wygasła — zaloguj się ponownie.', 401);
    try {
      return await api(zapytanie, sciezka, sesja, k, teraz);
    } catch (e) {
      if (e instanceof BladKonta) return blad(e.message, e.status);
      throw e;
    }
  }

  if (sesja) return null;

  // Strona dostaje przekierowanie na logowanie. Skrypt czy obrazek — odmowę:
  // przekierowany, trafiłby do pamięci offline aplikacji jako strona logowania.
  if (czyStrona(zapytanie)) {
    return przekierowanie(`${STRONA_LOGOWANIA}?powrot=${encodeURIComponent(sciezka + search)}`, 302);
  }
  return tekst('Wymagane logowanie.', 401);
}
