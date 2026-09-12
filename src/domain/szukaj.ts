/**
 * Wyszukiwanie waluty po kodzie albo nazwie.
 *
 * Wydzielone z komponentów, bo z tej samej wyszukiwarki korzysta wybór waluty
 * źródłowej i docelowej. Wspólna musi być semantyka szukania, nie wygląd listy
 * — dlatego dzielimy funkcję, a nie komponent.
 */

/**
 * Tekst sprowadzony do postaci porównywalnej: małe litery bez znaków
 * diakrytycznych.
 *
 * NBP zapisuje nazwy po polsku, a nazwy walut bywają obce: „peso filipińskie”,
 * „lej rumuński”. Nikt nie sięga po ogonki, szukając waluty w pośpiechu, więc
 * „filipinskie” musi trafiać tak samo jak „filipińskie”.
 */
export function znormalizuj(tekst: string): string {
  return (
    tekst
      .toLocaleLowerCase('pl')
      .normalize('NFD')
      // Znaki łączące, które NFD odkleja od liter: ogonek, kreska, kropka.
      .replace(/[̀-ͯ]/g, '')
      // „ł” jest osobną literą, a nie „l” ze znakiem — NFD jej nie rozłoży.
      .replace(/ł/g, 'l')
  );
}

/**
 * Pozycje pasujące do frazy. Pusta fraza przepuszcza wszystko, bo pusta
 * wyszukiwarka ma pokazywać pełną listę, a nie pustkę.
 */
export function filtruj<T extends { kod: string; nazwa: string }>(
  pozycje: readonly T[],
  szukane: string,
): T[] {
  const fraza = znormalizuj(szukane.trim());
  if (fraza === '') return [...pozycje];
  return pozycje.filter(
    (p) => znormalizuj(p.kod).includes(fraza) || znormalizuj(p.nazwa).includes(fraza),
  );
}
