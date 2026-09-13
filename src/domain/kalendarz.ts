/**
 * Siatka miesiąca dla własnego kalendarza.
 *
 * Natywny kalendarzyk przeglądarki nie wie nic o regule z art. 11a ust. 2
 * ustawy o PIT, więc nie pokaże, że sobota cofnie kurs do piątku. Tutaj
 * liczymy to, co trzeba na siatce zaznaczyć: dni wolne, dzień kursu i dni
 * poza dozwolonym zakresem.
 *
 * Cała arytmetyka idzie przez `dates.ts`, czyli po UTC — kalendarz nie może
 * zgubić doby przy zmianie czasu.
 */
import {
  czyWeekend, dzienTygodnia, poprzedniDzienRoboczy, przesun, type DataIso,
} from './dates';

/** Skróty od poniedziałku, bo tak wygląda polski kalendarz. */
export const DNI_TYGODNIA = ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'] as const;

const MIESIACE = [
  'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień',
] as const;

const NAZWY_DNI = [
  'niedzielę', 'poniedziałek', 'wtorek', 'środę', 'czwartek', 'piątek', 'sobotę',
] as const;

/** Miesiąc w zapisie RRRR-MM. */
export type Miesiac = string;

export interface Dzien {
  data: DataIso;
  /** Numer dnia w swoim miesiącu. */
  numer: number;
  /** Czy dzień należy do pokazywanego miesiąca, czy tylko dopełnia tydzień. */
  wMiesiacu: boolean;
  /** Sobota albo niedziela — NBP nie ogłasza wtedy tabeli. */
  wolny: boolean;
  /** Poza dozwolonym zakresem: zdarzenie gospodarcze nie bywa z przyszłości. */
  zablokowany: boolean;
}

export function miesiacDaty(data: DataIso): Miesiac {
  return data.slice(0, 7);
}

export function przesunMiesiac(miesiac: Miesiac, o: number): Miesiac {
  const [rok, nr] = miesiac.split('-').map(Number);
  const suma = (rok ?? 0) * 12 + (nr ?? 1) - 1 + o;
  return `${String(Math.floor(suma / 12)).padStart(4, '0')}-${String((suma % 12) + 1).padStart(2, '0')}`;
}

export function nazwaMiesiaca(miesiac: Miesiac): string {
  const [rok, nr] = miesiac.split('-').map(Number);
  return `${MIESIACE[(nr ?? 1) - 1]} ${rok}`;
}

/** Numer dnia tygodnia liczony od poniedziałku: 0 to poniedziałek, 6 to niedziela. */
function odPoniedzialku(data: DataIso): number {
  return (dzienTygodnia(data) + 6) % 7;
}

/**
 * Pełne tygodnie obejmujące miesiąc.
 *
 * Siatka zaczyna się w poniedziałek i kończy w niedzielę, a brakujące pola
 * dopełniają dni sąsiednich miesięcy — inaczej ostatni rząd urywałby się
 * w połowie i wyglądał na błąd rysowania.
 */
export function siatkaMiesiaca(miesiac: Miesiac, max?: DataIso): Dzien[] {
  const pierwszy = `${miesiac}-01`;
  const poczatek = przesun(pierwszy, -odPoniedzialku(pierwszy));

  const dni: Dzien[] = [];
  for (let i = 0; ; i += 1) {
    const data = przesun(poczatek, i);
    // Kończymy dopiero po niedzieli tygodnia zamykającego miesiąc.
    if (i >= 7 && data.slice(0, 7) > miesiac && odPoniedzialku(data) === 0) break;
    dni.push({
      data,
      numer: Number(data.slice(8)),
      wMiesiacu: data.slice(0, 7) === miesiac,
      wolny: czyWeekend(data),
      zablokowany: max !== undefined && data > max,
    });
  }
  return dni;
}

/**
 * Z czego składa się zdanie pod siatką.
 *
 * Domena zwraca części, a nie gotowy tekst, bo obie daty mają być na ekranie
 * wytłuszczone — składanie znaczników w łańcuchu znaków szybko robi się
 * nieczytelne i nie da się go przetestować osobno.
 *
 * Świąt tu nie rozstrzygamy: to NBP decyduje, kiedy ogłasza tabelę, a zapas
 * na taki przypadek niesie podpowiedź pod samym polem.
 */
export function wyjasnienie(data: DataIso): { dzien: string; dzienKursu: DataIso } {
  return {
    dzien: NAZWY_DNI[dzienTygodnia(data)]!,
    dzienKursu: poprzedniDzienRoboczy(data),
  };
}

export { poprzedniDzienRoboczy };
