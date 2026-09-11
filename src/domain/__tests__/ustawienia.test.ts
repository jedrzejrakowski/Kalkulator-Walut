import { describe, expect, it, vi } from 'vitest';
import {
  czyCiemny, DOMYŚLNE, KROJE, PALETY, SKALE, wczytaj, zapisz, zastosuj,
  type Ustawienia,
} from '../ustawienia';

const pamiec = () => {
  const dane = new Map<string, string>();
  return {
    getItem: (k: string) => dane.get(k) ?? null,
    setItem: (k: string, v: string) => void dane.set(k, v),
    removeItem: (k: string) => void dane.delete(k),
    clear: () => dane.clear(),
    key: () => null,
    length: 0,
  } as Storage;
};

describe('zapis i odczyt ustawień', () => {
  it('bez zapisanych danych zwraca ustawienia domyślne', () => {
    vi.stubGlobal('localStorage', pamiec());
    expect(wczytaj()).toEqual(DOMYŚLNE);
  });

  it('odtwarza zapisane ustawienia', () => {
    vi.stubGlobal('localStorage', pamiec());
    const moje: Ustawienia = { motyw: 'ciemny', paleta: 'bordowy', krój: 'georgia', skala: 1.25 };
    zapisz(moje);
    expect(wczytaj()).toEqual(moje);
  });

  it('odrzuca wartości spoza dozwolonych i wraca do domyślnych', () => {
    // Chroni przed ręcznie zepsutym wpisem w pamięci przeglądarki.
    const p = pamiec();
    p.setItem('kalkulator-walut:ustawienia',
      JSON.stringify({ motyw: 'neonowy', paleta: 'różowy', krój: 'comic', skala: 9 }));
    vi.stubGlobal('localStorage', p);
    expect(wczytaj()).toEqual(DOMYŚLNE);
  });

  it('nie wywraca się, gdy przeglądarka blokuje zapis', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('zablokowane'); },
      setItem: () => { throw new Error('zablokowane'); },
    } as unknown as Storage);
    expect(() => zapisz(DOMYŚLNE)).not.toThrow();
    expect(wczytaj()).toEqual(DOMYŚLNE);
  });
});

describe('wybór wariantu motywu', () => {
  const u = (motyw: Ustawienia['motyw']): Ustawienia => ({ ...DOMYŚLNE, motyw });

  it('wybór użytkownika wygrywa z ustawieniem systemu', () => {
    expect(czyCiemny(u('ciemny'), false)).toBe(true);
    expect(czyCiemny(u('jasny'), true)).toBe(false);
  });

  it('przy ustawieniu systemowym decyduje system', () => {
    expect(czyCiemny(u('system'), true)).toBe(true);
    expect(czyCiemny(u('system'), false)).toBe(false);
  });
});

describe('przeniesienie do zmiennych CSS', () => {
  it('ustawia odcienie właściwe dla wariantu ciemnego', () => {
    const korzeń = document.createElement('html');
    zastosuj({ ...DOMYŚLNE, paleta: 'bordowy', motyw: 'ciemny' }, korzeń, false);
    expect(korzeń.style.getPropertyValue('--accent')).toBe(PALETY.bordowy.ciemny.accent);
    expect(korzeń.dataset.theme).toBe('dark');
  });

  it('przy ustawieniu systemowym nie stempluje atrybutu motywu', () => {
    // Bez atrybutu o wariancie decyduje reguła prefers-color-scheme.
    const korzeń = document.createElement('html');
    zastosuj({ ...DOMYŚLNE, motyw: 'system' }, korzeń, true);
    expect(korzeń.dataset.theme).toBeUndefined();
    expect(korzeń.style.getPropertyValue('--accent')).toBe(PALETY.morski.ciemny.accent);
  });

  it('przenosi skalę pisma i krój', () => {
    const korzeń = document.createElement('html');
    zastosuj({ ...DOMYŚLNE, skala: 1.25, krój: 'verdana' }, korzeń, false);
    expect(korzeń.style.getPropertyValue('--skala')).toBe('1.25');
    expect(korzeń.style.getPropertyValue('--font-sans')).toBe(KROJE.verdana.stos);
  });

  it('każda paleta ma komplet odcieni dla obu motywów', () => {
    for (const opis of Object.values(PALETY))
      for (const wariant of [opis.jasny, opis.ciemny])
        for (const wartość of Object.values(wariant))
          expect(wartość).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('skale są uporządkowane rosnąco i zawierają rozmiar podstawowy', () => {
    expect([...SKALE]).toEqual([...SKALE].sort((a, b) => a - b));
    expect(SKALE).toContain(1);
  });
});
