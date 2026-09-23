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
 * po przecinku", liczymy iloczyn albo iloraz na `BigInt`, a zaokrąglamy raz,
 * na końcu, dokładnie. Końcówki od pół grosza idą w górę — tak zaokrągla się
 * kwoty w złotych i groszach.
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
 * `String(x)` daje najkrótszy ciąg, który wraca do tej samej liczby. Dla
 * kwoty wpisanej przez użytkownika i kursu z JSON-a NBP to dokładnie te
 * cyfry, które weszły — `4.3125` wraca jako „4.3125", a nie jako rozwinięcie
 * binarne. Obsługujemy też zapis wykładniczy, bo JavaScript przechodzi na
 * niego poniżej 0,000001, a taki kurs może się kiedyś w tabeli B pojawić.
 */
function dziesietna(x: number): Dziesietna {
  if (!Number.isFinite(x)) throw new RangeError(`Nie da się liczyć groszy z wartości ${x}`);

  const [podstawa, wykladnik = '0'] = String(x).toLowerCase().split('e');
  const ujemna = podstawa!.startsWith('-');
  const [calkowita, ulamek = ''] = podstawa!.replace('-', '').split('.');

  let m = BigInt(calkowita! + ulamek);
  let s = ulamek.length - Number(wykladnik);
  if (s < 0) {
    m *= 10n ** BigInt(-s);
    s = 0;
  }
  return { m: ujemna ? -m : m, s };
}

const potega = (n: number) => 10n ** BigInt(n);

/** Iloraz licznika przez mianownik, zaokrąglony połową od zera. Mianownik dodatni. */
function podziel(licznik: bigint, mianownik: bigint): bigint {
  // round(L/M) dla L ≥ 0 to floor((2L + M) / 2M) — połowa idzie w górę.
  const bezwzgledny = licznik < 0n ? -licznik : licznik;
  const q = (bezwzgledny * 2n + mianownik) / (2n * mianownik);
  return licznik < 0n ? -q : q;
}

/** Wynik w groszach z powrotem na złote, jako zwykła liczba. */
function naZlote(grosze: bigint): number {
  return Number(grosze) / 100;
}

/** a × b, zaokrąglone do groszy. */
export function iloczyn(a: number, b: number): number {
  const x = dziesietna(a);
  const y = dziesietna(b);
  // Wynik ma x.s + y.s miejsc; do groszy potrzebne są dwa.
  return naZlote(podziel(x.m * y.m * 100n, potega(x.s + y.s)));
}

/** a ÷ b, zaokrąglone do groszy. */
export function iloraz(a: number, b: number): number {
  if (b === 0) throw new RangeError('Dzielenie przez zero przy liczeniu groszy');
  const x = dziesietna(a);
  const y = dziesietna(b);
  // a/b = (x.m / 10^x.s) / (y.m / 10^y.s) = x.m · 10^y.s / (y.m · 10^x.s)
  const licznik = x.m * potega(y.s) * 100n;
  const mianownik = y.m * potega(x.s);
  return naZlote(mianownik < 0n ? podziel(-licznik, -mianownik) : podziel(licznik, mianownik));
}

/**
 * a × b ÷ c, zaokrąglone do groszy jednym ruchem.
 *
 * Proporcje typu „kwota × limit ÷ wartość pojazdu" trzeba liczyć w całości:
 * zaokrąglenie wyniku pośredniego albo sam iloraz limitu przez wartość
 * zapisany jako ułamek binarny przesunąłby wynik o grosz.
 */
export function iloczynPrzezIloraz(a: number, b: number, c: number): number {
  if (c === 0) throw new RangeError('Dzielenie przez zero przy liczeniu groszy');
  const x = dziesietna(a);
  const y = dziesietna(b);
  const z = dziesietna(c);
  const licznik = x.m * y.m * potega(z.s) * 100n;
  const mianownik = z.m * potega(x.s + y.s);
  return naZlote(mianownik < 0n ? podziel(-licznik, -mianownik) : podziel(licznik, mianownik));
}

/**
 * Wartość zaokrąglona do groszy.
 *
 * Bezpieczna dla liczb, które same są krótkimi ułamkami dziesiętnymi —
 * sumy i różnice kwot już zaokrąglonych, kwoty wpisane ręcznie. Iloczynów
 * i ilorazów tędy nie przepuszczamy: te liczymy funkcjami powyżej, bo błąd
 * powstaje już przy samym mnożeniu, zanim cokolwiek zaokrąglimy.
 */
export function doGroszy(wartosc: number): number {
  const x = dziesietna(wartosc);
  return naZlote(podziel(x.m * 100n, potega(x.s)));
}
