/**
 * Konta użytkowników po stronie przeglądarki: zapytania do API serwera
 * i generator haseł startowych.
 *
 * Wszystkie decyzje zapadają na serwerze — tu tylko wysyłamy prośby i
 * pokazujemy odpowiedź. Ukrycie przycisku nie jest zabezpieczeniem, odmowa
 * serwera jest.
 */
import { NAGLOWEK_API } from './sesja';

export interface Konto {
  login: string;
  nazwa: string;
  admin: boolean;
  /** Hasło nadał administrator — trzeba ustawić własne. */
  wymagaZmiany: boolean;
  utworzono: string;
  zmianaHasla: string;
}

/** Sesja wygasła albo konto usunięto — trzeba zalogować się od nowa. */
export class BladSesji extends Error {}

async function zapytaj<T>(metoda: string, adres: string, dane?: unknown): Promise<T> {
  const naglowki: Record<string, string> = { [NAGLOWEK_API]: '1' };
  if (dane !== undefined) naglowki['Content-Type'] = 'application/json';
  let odpowiedz: Response;
  try {
    odpowiedz = await fetch(adres, {
      method: metoda,
      headers: naglowki,
      body: dane === undefined ? undefined : JSON.stringify(dane),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new Error('Brak połączenia z serwerem.');
  }
  if (odpowiedz.status === 204) return undefined as T;
  const tresc: unknown = await odpowiedz.json().catch(() => null);
  if (odpowiedz.status === 401) throw new BladSesji('Sesja wygasła — zaloguj się ponownie.');
  if (!odpowiedz.ok) {
    const blad = (tresc as { blad?: unknown } | null)?.blad;
    throw new Error(typeof blad === 'string' ? blad : `Serwer odpowiedział błędem ${odpowiedz.status}.`);
  }
  return tresc as T;
}

export const pobierzJa = () => zapytaj<Konto>('GET', '/api/ja');
export const zmienWlasneHaslo = (stare: string, nowe: string) => zapytaj<Konto>('POST', '/api/haslo', { stare, nowe });

export const listaKont = () => zapytaj<Konto[]>('GET', '/api/uzytkownicy');
export const dodajKonto = (dane: { login: string; nazwa: string; haslo: string; admin: boolean }) =>
  zapytaj<Konto>('POST', '/api/uzytkownicy', dane);
export const nadajHaslo = (login: string, haslo: string) =>
  zapytaj<Konto>('POST', `/api/uzytkownicy/${encodeURIComponent(login)}/haslo`, { haslo });
export const zmienKonto = (login: string, zmiany: { nazwa?: string; admin?: boolean }) =>
  zapytaj<Konto>('PATCH', `/api/uzytkownicy/${encodeURIComponent(login)}`, zmiany);
export const usunKonto = (login: string) => zapytaj<void>('DELETE', `/api/uzytkownicy/${encodeURIComponent(login)}`);

/** Musi się zgadzać z serwerem — sprawdza to test. */
export const NAJKROTSZE_HASLO = 12;

/**
 * Hasło startowe do przekazania nowej osobie: trzy grupy po pięć znaków.
 *
 * Bez liter i cyfr łatwych do pomylenia (l, 1, o, 0), bo takie hasło często
 * się przepisuje z kartki. 15 znaków z 31 możliwych to ponad 70 bitów
 * losowości — i tak jest jednorazowe, przy pierwszym wejściu trzeba je zmienić.
 */
export function wygenerujHaslo(losuj: (n: number) => Uint32Array = (n) => crypto.getRandomValues(new Uint32Array(n))): string {
  const ZNAKI = 'abcdefghjkmnpqrstuvwxyz23456789';
  const liczby = losuj(15);
  let wynik = '';
  for (let i = 0; i < 15; i++) {
    if (i > 0 && i % 5 === 0) wynik += '-';
    wynik += ZNAKI[liczby[i]! % ZNAKI.length];
  }
  return wynik;
}

/** Data ISO po polsku, np. „27.09.2026". */
export function dataKonta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
