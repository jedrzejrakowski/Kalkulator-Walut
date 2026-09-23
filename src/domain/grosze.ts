/**
 * Rachunek groszowy na liczbach całkowitych.
 *
 * Liczby zmiennoprzecinkowe nie przechowują dokładnie większości ułamków
 * dziesiętnych: 400,055 leży w pamięci jako 400,05499999…, więc zwykłe
 * zaokrąglenie daje 400,05 zamiast 400,06. Poprzednia wersja próbowała to
 * łatać, dodając `Number.EPSILON`, ale ta poprawka ma sens tylko przy
 * liczbach bliskich jedności — przy setkach złotych jest mniejsza niż
 * dokładność samej liczby i znika bez śladu.
 *
 * Tutaj każdy argument zamieniamy na parę „całkowita mantysa i liczba miejsc
 * po przecinku", liczymy na `BigInt`, a zaokrąglamy raz, na końcu, dokładnie.
 * Końcówki od pół grosza idą w górę — tak zaokrągla się kwoty w złotych.
 *
 * Ten sam plik żyje w Kalkulatorze VAT — zmiany warto przenosić w obie strony.
 */

interface Dziesietna {
  /** Wartość bez przecinka, ze znakiem. */
  m: bigint;
  /** Liczba miejsc po przecinku: wartość to m / 10^s. */
  s: number;
}

/**
 * Liczba w postaci dziesiętnej, odczytana z jej najkrótszego zapisu.
 *
 * `String(x)` daje najkrótszy ciąg, który wraca do tej samej liczby. Dla kwoty
 * wpisanej przez użytkownika i stawki podanej w procentach to dokładnie te
 * cyfry, które weszły — `0.23` wraca jako „0.23", a nie jako rozwinięcie
 * binarne. Obsługujemy też zapis wykładniczy, na który JavaScript przechodzi
 * przy bardzo małych i bardzo dużych liczbach.
 */
function dziesietna(x: number): Dziesietna {
  if (!Number.isFinite(x)) throw new RangeError(`Nie da się liczyć groszy z wartości ${x}`);

  const [podstawa, wykladnik = '0'] = String(x).toLowerCase().split('e');
  const ujemna = podstawa!.startsWith('-');
  const [calkowita, ulamekDziesietny = ''] = podstawa!.replace('-', '').split('.');

  let m = BigInt(calkowita! + ulamekDziesietny);
  let s = ulamekDziesietny.length - Number(wykladnik);
  if (s < 0) {
    m *= 10n ** BigInt(-s);
    s = 0;
  }
  return { m: ujemna ? -m : m, s };
}

const potega = (n: number) => 10n ** BigInt(n);

/**
 * Grosze z powrotem na złote.
 *
 * Przez zapis dziesiętny, a nie przez dzielenie przez 100: dzielenie to
 * znowu arytmetyka zmiennoprzecinkowa, która przy dużych liczbach potrafi
 * zgubić ostatnią cyfrę. Odczyt ciągu „123.45" daje zawsze najbliższą liczbę.
 */
function naZlote(grosze: bigint): number {
  const ujemna = grosze < 0n;
  const wartosc = ujemna ? -grosze : grosze;
  const zlote = wartosc / 100n;
  const reszta = String(wartosc % 100n).padStart(2, '0');
  return Number(`${ujemna ? '-' : ''}${zlote}.${reszta}`);
}

/**
 * Iloczyn liczników przez iloczyn mianowników, zaokrąglony do groszy.
 *
 * Jedna funkcja na wszystkie przypadki, bo w kalkulatorze proporcje bywają
 * wieloczłonowe — odliczenie organizacji to kwota × prewspółczynnik ×
 * proporcja × ½, a limit to kwota × limit ÷ wartość pojazdu. Każdy człon
 * liczony osobno i zaokrąglany po drodze mógłby przesunąć wynik o grosz.
 */
export function ulamek(liczniki: number[], mianowniki: number[] = []): number {
  let licznik = 100n; // wynik od razu w groszach
  let mianownik = 1n;
  let skala = 0;

  for (const a of liczniki) {
    const x = dziesietna(a);
    licznik *= x.m;
    skala += x.s;
  }
  for (const b of mianowniki) {
    const y = dziesietna(b);
    if (y.m === 0n) throw new RangeError('Dzielenie przez zero przy liczeniu groszy');
    mianownik *= y.m;
    skala -= y.s;
  }

  // Skala mówi, ile miejsc po przecinku wniosły liczniki ponad mianowniki.
  if (skala > 0) mianownik *= potega(skala);
  else licznik *= potega(-skala);

  if (mianownik < 0n) {
    licznik = -licznik;
    mianownik = -mianownik;
  }

  // round(L/M) dla L ≥ 0 to floor((2L + M) / 2M) — połowa idzie w górę,
  // a dla ujemnych lustrzanie, żeby korekta dawała kwotę z przeciwnym znakiem.
  const bezwzgledny = licznik < 0n ? -licznik : licznik;
  const q = (bezwzgledny * 2n + mianownik) / (2n * mianownik);
  return naZlote(licznik < 0n ? -q : q);
}

/** a × b, zaokrąglone do groszy. */
export const iloczyn = (a: number, b: number): number => ulamek([a, b]);

/** a ÷ b, zaokrąglone do groszy. */
export const iloraz = (a: number, b: number): number => ulamek([a], [b]);

/** a × b ÷ c, zaokrąglone do groszy jednym ruchem. */
export const iloczynPrzezIloraz = (a: number, b: number, c: number): number => ulamek([a, b], [c]);

/**
 * Wartość zaokrąglona do groszy.
 *
 * Bezpieczna dla liczb, które same są krótkimi ułamkami dziesiętnymi — sum
 * i różnic kwot już zaokrąglonych, kwot wpisanych ręcznie. Iloczynów
 * i ilorazów tędy nie przepuszczamy: te liczymy funkcją `ulamek`, bo błąd
 * powstaje już przy samym mnożeniu, zanim cokolwiek zaokrąglimy.
 */
export const doGroszy = (wartosc: number): number => ulamek([wartosc]);
