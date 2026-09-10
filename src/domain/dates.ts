/**
 * Daty kalendarzowe bez strefy czasowej.
 *
 * Oryginalny kalkulator mieszał `toISOString()`, które działa w UTC, z metodami
 * `getDate()` i `setDate()`, które działają w czasie lokalnym. W Polsce zwykle
 * wychodziło dobrze, ale latem między północą a drugą w nocy data zdarzenia
 * cofała się o dobę. Tutaj wszystkie rachunki idą po UTC, a jedynym miejscem
 * czytającym zegar lokalny jest `dzisiaj`.
 */

/** Data kalendarzowa w zapisie RRRR-MM-DD. */
export type DataIso = string;

const WZORZEC = /^\d{4}-\d{2}-\d{2}$/;

export function czyPoprawnaData(wartosc: string): wartosc is DataIso {
  if (!WZORZEC.test(wartosc)) return false;
  const d = naDate(wartosc);
  return !Number.isNaN(d.getTime()) && naIso(d) === wartosc;
}

function naDate(data: DataIso): Date {
  const [rok, miesiac, dzien] = data.split('-').map(Number);
  return new Date(Date.UTC(rok, miesiac - 1, dzien));
}

function naIso(data: Date): DataIso {
  return data.toISOString().slice(0, 10);
}

/** Dzisiejsza data według zegara użytkownika, nie według UTC. */
export function dzisiaj(zegar: Date = new Date()): DataIso {
  const rok = zegar.getFullYear();
  const miesiac = String(zegar.getMonth() + 1).padStart(2, '0');
  const dzien = String(zegar.getDate()).padStart(2, '0');
  return `${rok}-${miesiac}-${dzien}`;
}

export function przesun(data: DataIso, oDni: number): DataIso {
  const d = naDate(data);
  d.setUTCDate(d.getUTCDate() + oDni);
  return naIso(d);
}

/** 0 to niedziela, 6 to sobota. */
export function dzienTygodnia(data: DataIso): number {
  return naDate(data).getUTCDay();
}

export function czyWeekend(data: DataIso): boolean {
  const dzien = dzienTygodnia(data);
  return dzien === 0 || dzien === 6;
}

/**
 * Ostatni dzień roboczy poprzedzający wskazaną datę.
 *
 * Tego kursu wymaga art. 11a ustawy o PIT oraz art. 15a ustawy o CIT przy
 * przeliczaniu transakcji walutowych. Święta pomija dopiero warstwa pobierania
 * kursu, bo to NBP decyduje, w które dni ogłasza tabelę.
 */
export function poprzedniDzienRoboczy(data: DataIso): DataIso {
  let wynik = przesun(data, -1);
  while (czyWeekend(wynik)) wynik = przesun(wynik, -1);
  return wynik;
}

/** Data w zapisie polskim, do pokazania użytkownikowi. */
export function poPolsku(data: DataIso): string {
  const [rok, miesiac, dzien] = data.split('-');
  return `${dzien}.${miesiac}.${rok}`;
}
