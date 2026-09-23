/**
 * Zestawienie przeliczeń do rozliczenia wyjazdu.
 *
 * Dokument ma dowodzić, że każdy paragon przeliczono po właściwym kursie,
 * więc każdy wiersz niesie komplet: datę zdarzenia, kwotę, kurs, numer
 * i datę tabeli NBP oraz wartość w złotych. Pod tabelą sumy cząstkowe dla
 * każdej waluty i suma końcowa.
 *
 * Model jest wspólny dla PDF i Excela — oba pliki pokazują te same liczby,
 * bo liczą się tu, a nie w warstwie, która je rysuje.
 */
import type { DataIso } from './dates';
import type { Uklad, Wpis } from './historia';

export interface Wiersz {
  lp: number;
  data: DataIso;
  kwota: number;
  waluta: string;
  kurs: number;
  numerTabeli: string;
  dataTabeli: DataIso;
  /** Wartość w złotych, zaokrąglona do grosza dla tego jednego paragonu. */
  wartoscPln: number;
}

export interface SumaWaluty {
  waluta: string;
  liczba: number;
  /** Suma kwot w walucie obcej. */
  kwota: number;
  /** Suma wartości w złotych z wierszy już zaokrąglonych. */
  wartoscPln: number;
}

export interface Zestawienie {
  tytul: string;
  sporzadzono: DataIso;
  /** Najwcześniejsza i najpóźniejsza data zdarzenia w zestawieniu. */
  od: DataIso | null;
  doDnia: DataIso | null;
  wiersze: Wiersz[];
  sumy: SumaWaluty[];
  razemPln: number;
}

export const TYTUL_DOMYSLNY = 'Zestawienie przeliczeń walut';

/** Podstawa i metoda — to samo zdanie idzie do PDF i do Excela. */
export const PODSTAWA =
  'Kurs średni NBP z ostatniego dnia roboczego poprzedzającego datę zdarzenia ' +
  '(art. 11a ust. 2 ustawy o PIT, art. 15 ust. 1 ustawy o CIT, art. 31a ust. 1 ustawy o VAT).';

export const METODA =
  'Każda pozycja przeliczona i zaokrąglona do grosza osobno, od pół grosza w górę; ' +
  'sumy liczone z pozycji już zaokrąglonych.';

/**
 * Kwota na grosze jako liczba całkowita.
 *
 * Kwoty w zestawieniu mają najwyżej dwa miejsca po przecinku, więc pomnożone
 * przez 100 leżą o miliardowe części od liczby całkowitej — zaokrąglenie
 * zwraca dokładnie tę liczbę. Sumujemy potem liczby całkowite, bez dryfu,
 * jaki daje dodawanie setek ułamków dziesiętnych.
 */
const naGrosze = (kwota: number) => Math.round(kwota * 100);
const naZlote = (grosze: number) => grosze / 100;

/**
 * Wpisy w kolejności zestawienia.
 *
 * Jeśli nie wybrano sortowania, dokument idzie chronologicznie po dacie
 * zdarzenia — tak czyta się rozliczenie wyjazdu. Kolejność liczenia, domyślna
 * na ekranie historii, w dokumencie byłaby przypadkowa. Wybrane sortowanie
 * szanujemy: co widać na ekranie, to trafia do pliku.
 */
export function kolejnoscZestawienia(wpisy: Wpis[], uklad: Uklad): Wpis[] {
  if (uklad.klucz !== 'zapis') return wpisy;
  return [...wpisy].sort((a, b) => {
    const x = a.przeliczenie.dataZdarzenia;
    const y = b.przeliczenie.dataZdarzenia;
    // Równe daty: starszy zapis wyżej, czyli w kolejności, w jakiej liczono.
    return x === y ? a.id - b.id : x < y ? -1 : 1;
  });
}

export function zestawienie(wpisy: Wpis[], tytul: string, sporzadzono: DataIso): Zestawienie {
  const wiersze: Wiersz[] = wpisy.map((w, i) => {
    const p = w.przeliczenie;
    return {
      lp: i + 1,
      data: p.dataZdarzenia,
      kwota: p.kwota,
      waluta: p.kurs.kod,
      kurs: p.kurs.kurs,
      numerTabeli: p.kurs.numerTabeli,
      dataTabeli: p.kurs.dataTabeli,
      wartoscPln: p.wynikPln,
    };
  });

  const wgWaluty = new Map<string, { liczba: number; kwota: number; pln: number }>();
  for (const w of wiersze) {
    const suma = wgWaluty.get(w.waluta) ?? { liczba: 0, kwota: 0, pln: 0 };
    suma.liczba += 1;
    suma.kwota += naGrosze(w.kwota);
    suma.pln += naGrosze(w.wartoscPln);
    wgWaluty.set(w.waluta, suma);
  }

  const sumy: SumaWaluty[] = [...wgWaluty]
    .map(([waluta, s]) => ({ waluta, liczba: s.liczba, kwota: naZlote(s.kwota), wartoscPln: naZlote(s.pln) }))
    .sort((a, b) => a.waluta.localeCompare(b.waluta));

  const daty = wiersze.map((w) => w.data).sort();

  return {
    tytul: tytul.trim() || TYTUL_DOMYSLNY,
    sporzadzono,
    od: daty[0] ?? null,
    doDnia: daty[daty.length - 1] ?? null,
    wiersze,
    sumy,
    razemPln: naZlote(wiersze.reduce((s, w) => s + naGrosze(w.wartoscPln), 0)),
  };
}

/**
 * Nazwa pliku z tytułu: bez znaków, których Windows nie przyjmie w nazwie,
 * z datą sporządzenia na końcu, żeby kolejne wersje się nie nadpisywały.
 */
export function nazwaPliku(z: Zestawienie, rozszerzenie: string): string {
  const rdzen = z.tytul.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return `${rdzen} ${z.sporzadzono}.${rozszerzenie}`;
}
