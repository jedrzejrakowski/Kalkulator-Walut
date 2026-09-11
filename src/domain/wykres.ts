/**
 * Geometria wykresu kursu.
 *
 * Wydzielona z komponentu, bo to czysta matematyka: skale, kreski osi i ścieżki.
 * Dzięki temu da się sprawdzić testem, że każda kreska opisuje wartość mieszczącą
 * się w wykresie, a punkty nie wychodzą poza obszar rysowania.
 */
import type { DataIso } from './dates';

export interface Punkt {
  data: DataIso;
  kurs: number;
}

export interface Ramka {
  szerokosc: number;
  wysokosc: number;
  gora: number;
  prawo: number;
  dol: number;
  lewo: number;
}

export interface Zakres {
  min: number;
  max: number;
}

/** Odstęp kresek dobrany do rzędu wielkości: 1, 2 albo 5 razy potęga dziesiątki. */
function krok(rozpietosc: number, ile: number): number {
  const surowy = rozpietosc / ile;
  const rzad = 10 ** Math.floor(Math.log10(surowy));
  const znormalizowany = surowy / rzad;
  const mnoznik = znormalizowany <= 1 ? 1 : znormalizowany <= 2 ? 2 : znormalizowany <= 5 ? 5 : 10;
  return mnoznik * rzad;
}

/**
 * Wartości kresek osi pionowej wraz z zakresem, który obejmują.
 *
 * Zakres rozszerzamy do pełnych kresek, żeby linia nie dotykała krawędzi,
 * a każda podpisana kreska odnosiła się do wartości widocznej na wykresie.
 */
export function osPionowa(punkty: Punkt[], ile = 4): { kreski: number[]; zakres: Zakres } {
  const wartosci = punkty.map((p) => p.kurs);
  const min = Math.min(...wartosci);
  const max = Math.max(...wartosci);

  // Kurs bez zmian w całym okresie dałby zerową rozpiętość i dzielenie przez zero.
  const rozpietosc = max - min || Math.abs(max) * 0.02 || 1;
  const k = krok(rozpietosc, ile);

  const dol = Math.floor((min - rozpietosc * 0.05) / k) * k;
  const gora = Math.ceil((max + rozpietosc * 0.05) / k) * k;

  const kreski: number[] = [];
  // Mnożenie zamiast dodawania w pętli — sumowanie ułamków gubi wartości.
  for (let i = 0; dol + i * k <= gora + k / 1000; i += 1) kreski.push(dol + i * k);

  return { kreski, zakres: { min: dol, max: gora } };
}

export function poziomo(indeks: number, ile: number, r: Ramka): number {
  const szerokoscPola = r.szerokosc - r.lewo - r.prawo;
  if (ile <= 1) return r.lewo + szerokoscPola / 2;
  return r.lewo + (indeks / (ile - 1)) * szerokoscPola;
}

export function pionowo(wartosc: number, zakres: Zakres, r: Ramka): number {
  const wysokoscPola = r.wysokosc - r.gora - r.dol;
  const udzial = (wartosc - zakres.min) / (zakres.max - zakres.min);
  return r.gora + (1 - udzial) * wysokoscPola;
}

export function sciezka(punkty: Punkt[], zakres: Zakres, r: Ramka): string {
  return punkty
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${poziomo(i, punkty.length, r).toFixed(2)} ${pionowo(p.kurs, zakres, r).toFixed(2)}`)
    .join(' ');
}

/** Ścieżka wypełnienia pod linią, domknięta wzdłuż dolnej krawędzi pola. */
export function wypelnienie(punkty: Punkt[], zakres: Zakres, r: Ramka): string {
  if (punkty.length === 0) return '';
  const dol = r.wysokosc - r.dol;
  const pierwszy = poziomo(0, punkty.length, r).toFixed(2);
  const ostatni = poziomo(punkty.length - 1, punkty.length, r).toFixed(2);
  return `${sciezka(punkty, zakres, r)} L${ostatni} ${dol.toFixed(2)} L${pierwszy} ${dol.toFixed(2)} Z`;
}

/** Indeks punktu najbliższego wskazanej pozycji poziomej. */
export function najblizszy(x: number, ile: number, r: Ramka): number {
  if (ile <= 1) return 0;
  const szerokoscPola = r.szerokosc - r.lewo - r.prawo;
  const udzial = (x - r.lewo) / szerokoscPola;
  return Math.min(ile - 1, Math.max(0, Math.round(udzial * (ile - 1))));
}

/** Kilka równomiernie rozłożonych indeksów do podpisania osi poziomej. */
export function podpisyOsi(ile: number, maks = 5): number[] {
  if (ile === 0) return [];
  if (ile <= maks) return Array.from({ length: ile }, (_, i) => i);
  const krokIndeksu = (ile - 1) / (maks - 1);
  return Array.from({ length: maks }, (_, i) => Math.round(i * krokIndeksu));
}

/**
 * Ramka dobrana do dostępnej szerokości.
 *
 * Wykres rysujemy w jednostkach SVG, a przeglądarka skaluje go do kontenera —
 * razem z podpisami osi. Gdyby ramka miała stałą szerokość, na telefonie cały
 * rysunek zjeżdżałby do połowy rozmiaru i daty stawały się nieczytelne.
 * Dlatego ramka ma tyle jednostek, ile pikseli daje kontener: skala zostaje
 * bliska jedności, a podpisy zachowują swój rozmiar.
 */
export function ramka(dostepna: number): Ramka {
  const szerokosc = Math.min(720, Math.max(260, Math.round(dostepna) || 620));
  const waski = szerokosc < 420;
  return {
    szerokosc,
    // Niższy wykres na wąskim ekranie, żeby karta nie rosła w nieskończoność.
    wysokosc: waski ? 190 : 250,
    gora: 14,
    prawo: 14,
    // Miejsce na podpisy osi pionowej — kursy bywają czterocyfrowe po przecinku.
    dol: 30,
    lewo: waski ? 52 : 62,
  };
}
