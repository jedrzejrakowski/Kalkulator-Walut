/**
 * Historia przeliczeń.
 *
 * Notatnik pomocniczy, nie dokumentacja księgowa: siedzi w przeglądarce na
 * jednej maszynie i zniknie razem z danymi witryny. Ma oszczędzić ponownego
 * liczenia, a nie zastąpić dowodu w księgach.
 *
 * Wpis niesie komplet danych potrzebnych na dowodzie — kurs, numer tabeli
 * i jej datę — bo po tygodniu sama kwota i wynik niczego nie tłumaczą.
 */
import { poPolsku } from './dates';
import { formatAmount, formatKurs, formatPln } from './money';
import type { Przeliczenie } from './types';

const KLUCZ = 'kalkulator-walut-historia';

/**
 * Ile wpisów trzymamy. Przy kilkunastu przeliczeniach dziennie to zapas na
 * wiele miesięcy, a localStorage nie zbliża się do swojego limitu.
 */
export const LIMIT = 200;

export interface Wpis {
  /** Znacznik czasu zapisu, w milisekundach — służy też za identyfikator. */
  id: number;
  przeliczenie: Przeliczenie;
}

/** Czy dwa przeliczenia dotyczą tego samego zdarzenia. */
function toSamo(a: Przeliczenie, b: Przeliczenie): boolean {
  return (
    a.kwota === b.kwota &&
    a.kurs.kod === b.kurs.kod &&
    a.dataZdarzenia === b.dataZdarzenia &&
    (a.kursDocelowy?.kod ?? null) === (b.kursDocelowy?.kod ?? null)
  );
}

/**
 * Dopisuje przeliczenie na czoło historii.
 *
 * Powtórzone przeliczenie tego samego zdarzenia nie dubluje wiersza — przy
 * zapisie automatycznym poprawianie kwoty czy daty zasypywałoby historię
 * wariantami tej samej pozycji.
 */
export function dopisz(historia: Wpis[], przeliczenie: Przeliczenie, teraz = Date.now()): Wpis[] {
  const pierwszy = historia[0];
  if (pierwszy && toSamo(pierwszy.przeliczenie, przeliczenie)) return historia;
  return [{ id: teraz, przeliczenie }, ...historia].slice(0, LIMIT);
}

export function usun(historia: Wpis[], id: number): Wpis[] {
  return historia.filter((w) => w.id !== id);
}

/** Czy obiekt z pamięci ma kształt, na którym da się polegać. */
function poprawny(kandydat: unknown): kandydat is Wpis {
  if (typeof kandydat !== 'object' || kandydat === null) return false;
  const w = kandydat as Partial<Wpis>;
  const p = w.przeliczenie;
  return (
    typeof w.id === 'number' &&
    typeof p === 'object' && p !== null &&
    typeof p.kwota === 'number' &&
    typeof p.wynikPln === 'number' &&
    typeof p.dataZdarzenia === 'string' &&
    typeof p.kurs === 'object' && p.kurs !== null &&
    typeof p.kurs.kod === 'string' &&
    typeof p.kurs.kurs === 'number' &&
    typeof p.kurs.dataTabeli === 'string'
  );
}

/**
 * Wczytuje historię, odrzucając wpisy uszkodzone.
 *
 * Zawartość pamięci przeglądarki to dane spoza aplikacji: mogła ją zostawić
 * starsza wersja programu albo ktoś, kto zajrzał do narzędzi deweloperskich.
 * Jeden zepsuty wpis nie może wywrócić całego ekranu.
 */
export function wczytaj(): Wpis[] {
  try {
    const zapisane = localStorage.getItem(KLUCZ);
    if (!zapisane) return [];
    const odczytane: unknown = JSON.parse(zapisane);
    if (!Array.isArray(odczytane)) return [];
    return odczytane.filter(poprawny).slice(0, LIMIT);
  } catch {
    // Tryb prywatny, zablokowane dane witryny albo uszkodzony wpis.
    return [];
  }
}

export function zapisz(historia: Wpis[]): void {
  try {
    localStorage.setItem(KLUCZ, JSON.stringify(historia));
  } catch {
    // Brak zapisu nie może przerwać liczenia; historia zadziała do zamknięcia okna.
  }
}

export function wyczysc(): void {
  try {
    localStorage.removeItem(KLUCZ);
  } catch {
    // Jak wyżej — czyszczenie stanu w pamięci i tak się powiedzie.
  }
}

/**
 * Jedna linia opisująca przeliczenie, do wklejenia w opis dowodu.
 *
 * Jedna, bo pola opisu w programach księgowych bywają jednowierszowe, a
 * złamany tekst wkleja się tam jako śmieci. Mieści komplet: rachunek, tabele
 * i obie daty — czyli wszystko, czym trzeba udowodnić wybór kursu.
 */
export function opisDoSchowka(p: Przeliczenie): string {
  const { kurs, kursDocelowy } = p;

  const rachunek = [
    `${formatAmount(p.kwota)} ${kurs.kod} po kursie ${formatKurs(kurs.kurs)} zł = ${formatPln(p.wynikPln)}`,
  ];
  if (kursDocelowy && p.wynikDocelowy !== null) {
    rachunek.push(
      `${formatPln(p.wynikPln)} ÷ ${formatKurs(kursDocelowy.kurs)} zł = ` +
        `${formatAmount(p.wynikDocelowy)} ${kursDocelowy.kod}`,
    );
  }

  const rozneTabele = kursDocelowy !== null && kursDocelowy.numerTabeli !== kurs.numerTabeli;
  const tabele = rozneTabele
    ? `tabele ${kurs.numerTabeli} z ${poPolsku(kurs.dataTabeli)} oraz ` +
      `${kursDocelowy.numerTabeli} z ${poPolsku(kursDocelowy.dataTabeli)}`
    : `tabela ${kurs.numerTabeli} z ${poPolsku(kurs.dataTabeli)}`;

  return `${rachunek.join('; ')}; ${tabele}; zdarzenie gospodarcze ${poPolsku(p.dataZdarzenia)}`;
}
