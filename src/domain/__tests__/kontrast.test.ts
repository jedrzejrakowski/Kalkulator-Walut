import { describe, expect, it } from 'vitest';
import { ATRAMENT, PALETY, type Paleta } from '../ustawienia';

/** Jasność względna według WCAG. */
function jasnosc(hex: string): number {
  const kanaly = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = kanaly.map((k) => (k <= 0.03928 ? k / 12.92 : ((k + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Stosunek kontrastu dwóch barw; 4.5 to próg czytelności zwykłego tekstu. */
function kontrast(a: string, b: string): number {
  const [ja, jb] = [jasnosc(a), jasnosc(b)];
  const [jasna, ciemna] = ja > jb ? [ja, jb] : [jb, ja];
  return (jasna + 0.05) / (ciemna + 0.05);
}

// Tła kart, na których stoi tekst w kolorze wiodącym.
const POWIERZCHNIA = { jasny: '#ffffff', ciemny: '#1c2027' } as const;

const PROG = 4.5;

describe('czytelność palet', () => {
  it('narzędzie liczy kontrast zgodnie z WCAG', () => {
    // Biel na czerni to najwyższy możliwy stosunek, równy 21.
    expect(kontrast('#ffffff', '#000000')).toBeCloseTo(21, 1);
    expect(kontrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  for (const klucz of Object.keys(PALETY) as Paleta[]) {
    const paleta = PALETY[klucz];

    describe(paleta.nazwa, () => {
      for (const wariant of ['jasny', 'ciemny'] as const) {
        it(`napis na wypełnieniu jest czytelny w motywie ${wariant}`, () => {
          // Tu siedział błąd: w motywie ciemnym jasny kolor wiodący dostawał
          // biały napis, przez co przyciski zlewały się z tłem.
          const wynik = kontrast(paleta[wariant].accent, ATRAMENT[wariant]);
          expect(wynik).toBeGreaterThanOrEqual(PROG);
        });

        it(`kolor wiodący jako tekst jest czytelny w motywie ${wariant}`, () => {
          const wynik = kontrast(paleta[wariant].accent, POWIERZCHNIA[wariant]);
          expect(wynik).toBeGreaterThanOrEqual(PROG);
        });

        it(`podświetlenie odcina się od koloru wiodącego w motywie ${wariant}`, () => {
          const wynik = kontrast(paleta[wariant].accentSoft, paleta[wariant].accent);
          expect(wynik).toBeGreaterThanOrEqual(3);
        });
      }

      it('pasek tytułu udźwignie biały napis w obu motywach', () => {
        for (const wariant of ['jasny', 'ciemny'] as const)
          expect(kontrast(paleta[wariant].titlebarBg, '#ffffff')).toBeGreaterThanOrEqual(PROG);
      });
    });
  }
});
