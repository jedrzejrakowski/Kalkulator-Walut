import { describe, expect, it } from 'vitest';
import {
  DNI_TYGODNIA, miesiacDaty, nazwaMiesiaca, przesunMiesiac, siatkaMiesiaca, wyjasnienie,
} from '../kalendarz';

describe('nawigacja po miesiącach', () => {
  it('przesuwa w obie strony', () => {
    expect(przesunMiesiac('2026-09', 1)).toBe('2026-10');
    expect(przesunMiesiac('2026-09', -1)).toBe('2026-08');
  });

  it('przechodzi przez granicę roku', () => {
    expect(przesunMiesiac('2026-12', 1)).toBe('2027-01');
    expect(przesunMiesiac('2026-01', -1)).toBe('2025-12');
    expect(przesunMiesiac('2026-01', -13)).toBe('2024-12');
  });

  it('nazywa miesiąc po polsku', () => {
    expect(nazwaMiesiaca('2026-09')).toBe('wrzesień 2026');
    expect(nazwaMiesiaca('2026-01')).toBe('styczeń 2026');
    expect(nazwaMiesiaca('2026-12')).toBe('grudzień 2026');
  });

  it('wyjmuje miesiąc z daty', () => {
    expect(miesiacDaty('2026-09-12')).toBe('2026-09');
  });
});

describe('siatka miesiąca', () => {
  it('zaczyna się w poniedziałek i kończy w niedzielę', () => {
    for (const miesiac of ['2026-01', '2026-02', '2026-09', '2027-03']) {
      const siatka = siatkaMiesiaca(miesiac);
      expect(siatka.length % 7).toBe(0);
      expect(DNI_TYGODNIA).toHaveLength(7);
      // Pierwsze pole to poniedziałek, ostatnie to niedziela.
      expect(siatka[0]!.wolny).toBe(false);
      expect(siatka[siatka.length - 1]!.wolny).toBe(true);
    }
  });

  it('obejmuje wszystkie dni miesiąca dokładnie raz', () => {
    const wrzesien = siatkaMiesiaca('2026-09').filter((d) => d.wMiesiacu);
    expect(wrzesien).toHaveLength(30);
    expect(wrzesien[0]!.numer).toBe(1);
    expect(wrzesien[29]!.numer).toBe(30);
    expect(new Set(wrzesien.map((d) => d.data)).size).toBe(30);
  });

  it('dopełnia tygodnie dniami sąsiednich miesięcy', () => {
    // 1 września 2026 to wtorek, więc przed nim stoi jeden dzień z sierpnia.
    const siatka = siatkaMiesiaca('2026-09');
    expect(siatka[0]!.data).toBe('2026-08-31');
    expect(siatka[0]!.wMiesiacu).toBe(false);
    expect(siatka.filter((d) => !d.wMiesiacu).every((d) => d.data < '2026-09-01' || d.data > '2026-09-30')).toBe(true);
  });

  it('radzi sobie z miesiącem zaczynającym się w poniedziałek', () => {
    // 1 czerwca 2026 to poniedziałek — nie ma czego dopełniać na początku.
    const siatka = siatkaMiesiaca('2026-06');
    expect(siatka[0]!.data).toBe('2026-06-01');
    expect(siatka[0]!.wMiesiacu).toBe(true);
  });

  it('nie gubi doby w lutym roku przestępnego', () => {
    const luty = siatkaMiesiaca('2028-02').filter((d) => d.wMiesiacu);
    expect(luty).toHaveLength(29);
    expect(luty[28]!.data).toBe('2028-02-29');
  });

  it('oznacza soboty i niedziele', () => {
    const siatka = siatkaMiesiaca('2026-09');
    const wolne = siatka.filter((d) => d.wMiesiacu && d.wolny).map((d) => d.numer);
    expect(wolne).toEqual([5, 6, 12, 13, 19, 20, 26, 27]);
  });

  it('blokuje dni po dacie granicznej', () => {
    const siatka = siatkaMiesiaca('2026-09', '2026-09-13');
    expect(siatka.find((d) => d.data === '2026-09-13')!.zablokowany).toBe(false);
    expect(siatka.find((d) => d.data === '2026-09-14')!.zablokowany).toBe(true);
    expect(siatka.filter((d) => d.zablokowany).every((d) => d.data > '2026-09-13')).toBe(true);
  });

  it('bez daty granicznej nie blokuje niczego', () => {
    expect(siatkaMiesiaca('2026-09').some((d) => d.zablokowany)).toBe(false);
  });
});

describe('wyjaśnienie pod siatką', () => {
  it('przy sobocie wskazuje piątek', () => {
    expect(wyjasnienie('2026-09-12')).toEqual({ dzien: 'sobotę', dzienKursu: '2026-09-11' });
  });

  it('przy poniedziałku cofa się do piątku, a nie do niedzieli', () => {
    expect(wyjasnienie('2026-09-14')).toEqual({ dzien: 'poniedziałek', dzienKursu: '2026-09-11' });
  });

  it('w środku tygodnia wskazuje dzień wcześniejszy', () => {
    expect(wyjasnienie('2026-09-10')).toEqual({ dzien: 'czwartek', dzienKursu: '2026-09-09' });
  });

  it('nazwy dni są w bierniku, żeby wpadły w zdanie „wypada w…”', () => {
    expect(wyjasnienie('2026-09-13').dzien).toBe('niedzielę');
    expect(wyjasnienie('2026-09-09').dzien).toBe('środę');
  });
});
