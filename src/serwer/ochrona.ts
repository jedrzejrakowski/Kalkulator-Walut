/**
 * Ochrona wdrożenia hasłem — kod uruchamiany na serwerze Vercel.
 *
 * Program działa w całości w przeglądarce, więc hasło sprawdzane w jego
 * kodzie dałoby się obejść narzędziami przeglądarki w minutę. Tutaj
 * sprawdzamy je, zanim serwer w ogóle wyda jakikolwiek plik aplikacji:
 * bez ważnej sesji nie ma ani strony, ani skryptów.
 *
 * Plik nie trafia do paczki przeglądarki — importuje go tylko `middleware.ts`
 * w katalogu głównym, który Vercel uruchamia przed każdym żądaniem.
 */
import { next } from '@vercel/functions/middleware';

export const CIASTKO_SESJI = 'kw_sesja';
/** Jawny znacznik dla aplikacji — mówi tylko, że jest co wylogować. */
export const CIASTKO_ZNACZNIK = 'kw_zalogowany';

export const STRONA_LOGOWANIA = '/logowanie.html';
export const ADRES_LOGOWANIA = '/api/logowanie';
export const ADRES_WYLOGOWANIA = '/api/wyloguj';

const DZIEN = 24 * 60 * 60 * 1000;
/** Z „Zapamiętaj na tym urządzeniu". */
export const WAZNOSC_ZAPAMIETANIA = 30 * DZIEN;
/** Bez zapamiętania — sesja przeglądarki, ale nie dłużej niż dzień roboczy. */
export const WAZNOSC_SESJI = 12 * 60 * 60 * 1000;

/** Opóźnienie po złym haśle — spowalnia zgadywanie. */
export const KARA_ZA_BLAD = 800;

/**
 * Adresy dostępne bez logowania.
 *
 * Ekran logowania musi się jakoś wyświetlić. Manifest i ikony przeglądarka
 * pobiera bez ciasteczek — gdyby były chronione, aplikacji zainstalowanej na
 * pulpicie zniknęłaby ikona. Nic z tego nie zdradza działania programu.
 */
const PUBLICZNE = new Set([STRONA_LOGOWANIA, '/manifest.webmanifest', '/favicon.ico', '/robots.txt']);
const PUBLICZNE_KATALOGI = ['/icons/'];

const kodowanie = new TextEncoder();

function base64url(bajty: ArrayBuffer): string {
  let tekst = '';
  for (const b of new Uint8Array(bajty)) tekst += String.fromCharCode(b);
  return btoa(tekst).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function zBase64url(tekst: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(tekst)) return null;
  const dopelnione = tekst.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (tekst.length % 4)) % 4);
  try {
    return Uint8Array.from(atob(dopelnione), (z) => z.charCodeAt(0));
  } catch {
    return null;
  }
}

/**
 * Klucz podpisu wyprowadzony z hasła.
 *
 * Dzięki temu wystarcza jedna zmienna środowiskowa, a zmiana hasła
 * unieważnia od razu wszystkie zapamiętane sesje na wszystkich urządzeniach.
 * Wystarcza pojedynczy skrót, bo podpis chroni przed podrobieniem ciasteczka,
 * a nie hasło przed kimś, kto już ma dostęp do zalogowanego urządzenia.
 */
let pamiecKlucza: { haslo: string; klucz: Promise<CryptoKey> } | null = null;

function klucz(haslo: string): Promise<CryptoKey> {
  if (pamiecKlucza?.haslo !== haslo) {
    const klucz = crypto.subtle
      .digest('SHA-256', kodowanie.encode(`kalkulator-walut/sesja/v1:${haslo}`))
      .then((skrot) => crypto.subtle.importKey('raw', skrot, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']));
    pamiecKlucza = { haslo, klucz };
  }
  return pamiecKlucza.klucz;
}

/** Porównanie hasła w stałym czasie — długość odpowiedzi nie zdradza, ile znaków trafiono. */
export async function czyHasloPoprawne(podane: string, haslo: string): Promise<boolean> {
  const k = await klucz(haslo);
  const wzor = await crypto.subtle.sign('HMAC', k, kodowanie.encode(`haslo:${haslo}`));
  return crypto.subtle.verify('HMAC', k, wzor, kodowanie.encode(`haslo:${podane}`));
}

/** Żeton sesji: wersja, termin ważności i podpis — bez żadnych danych o użytkowniku. */
export async function wydajZeton(haslo: string, wygasa: number): Promise<string> {
  const tresc = `v1.${wygasa}`;
  const podpis = await crypto.subtle.sign('HMAC', await klucz(haslo), kodowanie.encode(tresc));
  return `${tresc}.${base64url(podpis)}`;
}

export async function czyZetonWazny(zeton: string | undefined, haslo: string, teraz: number): Promise<boolean> {
  const czesci = zeton?.split('.');
  if (!czesci || czesci.length !== 3 || czesci[0] !== 'v1' || !/^\d{1,16}$/.test(czesci[1]!)) return false;
  if (Number(czesci[1]) <= teraz) return false;
  const podpis = zBase64url(czesci[2]!);
  if (!podpis) return false;
  return crypto.subtle.verify('HMAC', await klucz(haslo), podpis, kodowanie.encode(`v1.${czesci[1]}`));
}

export function odczytajCiastko(zapytanie: Request, nazwa: string): string | undefined {
  for (const para of (zapytanie.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = para.trim().split('=');
    if (k === nazwa) return v.join('=');
  }
  return undefined;
}

/**
 * Adres, na który wrócić po zalogowaniu — tylko ścieżka w obrębie tej witryny.
 *
 * Bez tej kontroli ktoś mógłby podesłać link „zaloguj się, a potem idź na
 * obcą stronę" — przekierowanie przez zaufany adres to klasyczny chwyt.
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

function ciastka(zeton: string, zyje: number | null): string[] {
  // Bez Max-Age ciasteczko żyje do zamknięcia przeglądarki; żeton i tak wygasa po 12 godzinach.
  const trwalosc = zyje === null ? '' : `; Max-Age=${Math.floor(zyje / 1000)}`;
  return [
    `${CIASTKO_SESJI}=${zeton}; Path=/; HttpOnly; Secure; SameSite=Lax${trwalosc}`,
    `${CIASTKO_ZNACZNIK}=1; Path=/; Secure; SameSite=Lax${trwalosc}`,
  ];
}

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

async function zaloguj(zapytanie: Request, haslo: string, teraz: number, czekaj: (ms: number) => Promise<void>) {
  let dane: FormData;
  try {
    dane = await zapytanie.formData();
  } catch {
    return tekst('Nieprawidłowe zapytanie.', 400);
  }
  const powrot = bezpiecznyPowrot(String(dane.get('powrot') ?? ''));

  if (!(await czyHasloPoprawne(String(dane.get('haslo') ?? ''), haslo))) {
    await czekaj(KARA_ZA_BLAD);
    return przekierowanie(`${STRONA_LOGOWANIA}?blad=1&powrot=${encodeURIComponent(powrot)}`);
  }

  const zapamietaj = dane.get('zapamietaj') === '1';
  const zyje = zapamietaj ? WAZNOSC_ZAPAMIETANIA : WAZNOSC_SESJI;
  return przekierowanie(powrot, 303, ciastka(await wydajZeton(haslo, teraz + zyje), zapamietaj ? zyje : null));
}

/**
 * Obsługa jednego żądania: albo odpowiedź od razu, albo `next()` — przepuść
 * do plików aplikacji.
 */
export async function obsluz(
  zapytanie: Request,
  haslo: string | undefined,
  teraz: number = Date.now(),
  czekaj: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<Response> {
  // Brak hasła to błąd wdrożenia — zamykamy, zamiast po cichu otworzyć wszystko.
  if (!haslo) {
    return tekst('Kalkulator jest zamknięty: nie ustawiono hasła (KALKULATOR_HASLO).', 503);
  }

  const { pathname } = new URL(zapytanie.url);

  if (pathname === ADRES_LOGOWANIA) {
    if (zapytanie.method !== 'POST') return przekierowanie(STRONA_LOGOWANIA);
    return zaloguj(zapytanie, haslo, teraz, czekaj);
  }

  if (pathname === ADRES_WYLOGOWANIA) {
    const skasuj = [
      `${CIASTKO_SESJI}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      `${CIASTKO_ZNACZNIK}=; Path=/; Secure; SameSite=Lax; Max-Age=0`,
    ];
    return przekierowanie(STRONA_LOGOWANIA, 303, skasuj);
  }

  if (czyPubliczny(pathname)) return next();

  if (await czyZetonWazny(odczytajCiastko(zapytanie, CIASTKO_SESJI), haslo, teraz)) return next();

  // Strona dostaje przekierowanie na logowanie. Skrypt czy obrazek — odmowę:
  // przekierowany, trafiłby do pamięci offline aplikacji jako strona logowania.
  if (czyStrona(zapytanie)) {
    const { pathname: p, search } = new URL(zapytanie.url);
    return przekierowanie(`${STRONA_LOGOWANIA}?powrot=${encodeURIComponent(p + search)}`, 302);
  }
  return tekst('Wymagane logowanie.', 401);
}
