import { poprzedniDzienRoboczy, type DataIso } from './dates';
import { pobierzKurs } from './nbp';
import type { Kurs, Przeliczenie } from './types';

/** Zaokrąglenie do pełnych groszy, odporne na błąd reprezentacji zmiennoprzecinkowej. */
export function doGroszy(wartosc: number): number {
  return Math.round((wartosc + Number.EPSILON) * 100) / 100;
}

/**
 * Składa wynik z gotowych kursów — rozdzielone od pobierania, żeby dało się testować.
 *
 * Wartość w złotych zaokrąglamy do groszy przed dalszym przeliczeniem, bo to
 * ona trafia do ksiąg. Dzięki temu rachunek pokazany na ekranie odtwarza się
 * krok po kroku: kwota razy kurs daje złote, złote przez kurs docelowy dają
 * walutę docelową.
 */
export function zloz(
  kwota: number,
  dataZdarzenia: DataIso,
  kurs: Kurs,
  kursDocelowy: Kurs | null = null,
): Przeliczenie {
  const dataWymagana = poprzedniDzienRoboczy(dataZdarzenia);
  const wynikPln = doGroszy(kwota * kurs.kurs);

  return {
    kwota,
    kurs,
    kursDocelowy,
    dataZdarzenia,
    dataWymagana,
    wynikPln,
    wynikDocelowy: kursDocelowy ? doGroszy(wynikPln / kursDocelowy.kurs) : null,
    kursKrzyzowy: kursDocelowy ? kurs.kurs / kursDocelowy.kurs : null,
    kursStarszyNizWymagany:
      kurs.dataTabeli < dataWymagana ||
      (kursDocelowy !== null && kursDocelowy.dataTabeli < dataWymagana),
  };
}

/** Oznaczenie złotego jako waluty docelowej. */
export const ZLOTY = 'PLN';

/**
 * Przelicza kwotę według kursu średniego NBP z ostatniego dnia roboczego
 * poprzedzającego zdarzenie gospodarcze.
 *
 * Waluta docelowa inna niż złoty wymaga dwóch kursów z tego samego dnia.
 * Mogą pochodzić z różnych tabel, a wtedy także z różnych dni — tabela B
 * bywa starsza, bo ogłaszana jest raz w tygodniu.
 */
export async function przelicz(
  kwota: number,
  kod: string,
  dataZdarzenia: DataIso,
  kodDocelowy: string = ZLOTY,
  pobierz?: typeof fetch,
): Promise<Przeliczenie> {
  const doDnia = poprzedniDzienRoboczy(dataZdarzenia);
  const kurs = await pobierzKurs(kod, doDnia, pobierz);
  const kursDocelowy =
    kodDocelowy === ZLOTY || kodDocelowy === kod
      ? null
      : await pobierzKurs(kodDocelowy, doDnia, pobierz);
  return zloz(kwota, dataZdarzenia, kurs, kursDocelowy);
}
