import { describe, expect, it } from 'vitest';
import { UKLAD_DOMYSLNY, type Wpis } from '../historia';
import { TYTUL_DOMYSLNY, kolejnoscZestawienia, nazwaPliku, zestawienie } from '../zestawienie';
import type { Kurs, Przeliczenie } from '../types';

const kurs = (kod: string, wartosc: number, numer = '31/B/NBP/2026', data = '2026-08-05'): Kurs => ({
  kod, nazwa: kod.toLowerCase(), tabela: 'B', numerTabeli: numer, kurs: wartosc, dataTabeli: data,
});

const wpis = (id: number, kod: string, kwota: number, wartosc: number, wynikPln: number, data: string): Wpis => ({
  id,
  przeliczenie: {
    kwota, kurs: kurs(kod, wartosc), kursDocelowy: null, dataZdarzenia: data, dataWymagana: data,
    wynikPln, wynikDocelowy: null, kursKrzyzowy: null, kursStarszyNizWymagany: false,
  } satisfies Przeliczenie,
});

// Kolejność liczenia: najnowszy zapis pierwszy — tak trzyma to historia.
const wpisy: Wpis[] = [
  wpis(4, 'VND', 1_000_000, 0.00014309, 143.09, '2026-08-12'),
  wpis(3, 'SCR', 1450, 0.2759, 400.06, '2026-08-11'),
  wpis(2, 'THB', 0.1, 0.1101, 0.01, '2026-08-10'),
  wpis(1, 'THB', 0.2, 0.1101, 0.02, '2026-08-10'),
];

describe('kolejność zestawienia', () => {
  it('bez wybranego sortowania idzie chronologicznie po dacie zdarzenia', () => {
    const ids = kolejnoscZestawienia(wpisy, UKLAD_DOMYSLNY).map((w) => w.id);
    // Dwa paragony z 10.08 — w kolejności, w jakiej je liczono.
    expect(ids).toEqual([1, 2, 3, 4]);
  });

  it('wybrane sortowanie przechodzi do pliku bez zmian', () => {
    const uklad = { ...UKLAD_DOMYSLNY, klucz: 'wynik' as const };
    expect(kolejnoscZestawienia(wpisy, uklad)).toBe(wpisy);
  });
});

describe('zestawienie', () => {
  const z = zestawienie(kolejnoscZestawienia(wpisy, UKLAD_DOMYSLNY), 'Seszele 08/2026', '2026-09-23');

  it('numeruje wiersze od jedynki w kolejności dokumentu', () => {
    expect(z.wiersze.map((w) => w.lp)).toEqual([1, 2, 3, 4]);
    expect(z.wiersze[2]).toMatchObject({ waluta: 'SCR', kwota: 1450, kurs: 0.2759, wartoscPln: 400.06 });
  });

  it('niesie w każdym wierszu tabelę NBP i jej datę', () => {
    expect(z.wiersze[0]).toMatchObject({ numerTabeli: '31/B/NBP/2026', dataTabeli: '2026-08-05' });
  });

  it('sumuje każdą walutę osobno, alfabetycznie', () => {
    expect(z.sumy).toEqual([
      { waluta: 'SCR', liczba: 1, kwota: 1450, wartoscPln: 400.06 },
      { waluta: 'THB', liczba: 2, kwota: 0.3, wartoscPln: 0.03 },
      { waluta: 'VND', liczba: 1, kwota: 1_000_000, wartoscPln: 143.09 },
    ]);
  });

  it('sumuje dokładnie — 0,1 + 0,2 to 0,3, a nie 0,30000000000000004', () => {
    expect(z.sumy.find((s) => s.waluta === 'THB')!.kwota).toBe(0.3);
  });

  it('suma końcowa to suma wierszy już zaokrąglonych', () => {
    expect(z.razemPln).toBe(543.18);
    expect(z.razemPln).toBe(z.sumy.reduce((s, x) => Math.round((s + x.wartoscPln) * 100) / 100, 0));
  });

  it('podaje zakres dat zdarzeń', () => {
    expect(z.od).toBe('2026-08-10');
    expect(z.doDnia).toBe('2026-08-12');
  });

  it('bez dryfu przy setkach groszowych pozycji', () => {
    const duzo = Array.from({ length: 1000 }, (_, i) => wpis(i, 'EUR', 0.1, 4.3, 0.43, '2026-08-01'));
    const d = zestawienie(duzo, '', '2026-09-23');
    expect(d.sumy[0]!.kwota).toBe(100);
    expect(d.razemPln).toBe(430);
  });

  it('pusty tytuł zastępuje domyślnym', () => {
    expect(zestawienie(wpisy, '   ', '2026-09-23').tytul).toBe(TYTUL_DOMYSLNY);
  });

  it('puste zestawienie ma zera i brak dat', () => {
    const p = zestawienie([], '', '2026-09-23');
    expect(p).toMatchObject({ wiersze: [], sumy: [], razemPln: 0, od: null, doDnia: null });
  });
});

describe('nazwa pliku', () => {
  it('bierze tytuł i datę sporządzenia', () => {
    const z = zestawienie(wpisy, 'Seszele 08/2026', '2026-09-23');
    expect(nazwaPliku(z, 'xlsx')).toBe('Seszele 08 2026 2026-09-23.xlsx');
  });

  it('usuwa znaki, których Windows nie przyjmie w nazwie', () => {
    const z = zestawienie(wpisy, 'Wyjazd: "Bali" <marzec>?', '2026-09-23');
    expect(nazwaPliku(z, 'pdf')).toBe('Wyjazd Bali marzec 2026-09-23.pdf');
  });
});
