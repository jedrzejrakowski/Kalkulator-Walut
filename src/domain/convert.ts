import { poprzedniDzienRoboczy, type DataIso } from './dates';
import { pobierzKurs } from './nbp';
import type { Kurs, Przeliczenie } from './types';

/** Zaokrąglenie do pełnych groszy, odporne na błąd reprezentacji zmiennoprzecinkowej. */
export function doGroszy(wartosc: number): number {
  return Math.round((wartosc + Number.EPSILON) * 100) / 100;
}

/** Składa wynik z gotowego kursu — rozdzielone od pobierania, żeby dało się testować. */
export function zloz(kwota: number, dataZdarzenia: DataIso, kurs: Kurs): Przeliczenie {
  const dataWymagana = poprzedniDzienRoboczy(dataZdarzenia);
  return {
    kwota,
    kurs,
    dataZdarzenia,
    dataWymagana,
    wynikPln: doGroszy(kwota * kurs.kurs),
    kursStarszyNizWymagany: kurs.dataTabeli < dataWymagana,
  };
}

/**
 * Przelicza kwotę na złote według kursu średniego NBP z ostatniego dnia
 * roboczego poprzedzającego zdarzenie gospodarcze.
 */
export async function przelicz(
  kwota: number,
  kod: string,
  dataZdarzenia: DataIso,
  pobierz?: typeof fetch,
): Promise<Przeliczenie> {
  const kurs = await pobierzKurs(kod, poprzedniDzienRoboczy(dataZdarzenia), pobierz);
  return zloz(kwota, dataZdarzenia, kurs);
}
