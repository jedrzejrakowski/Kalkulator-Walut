import { describe, expect, it } from 'vitest';
import {
  najblizszy, osPionowa, podpisyOsi, pionowo, poziomo, ramka, sciezka, wypelnienie,
  type Punkt, type Ramka,
} from '../wykres';

const RAMKA: Ramka = { szerokosc: 600, wysokosc: 240, gora: 16, prawo: 16, dol: 28, lewo: 56 };

const seria = (kursy: number[]): Punkt[] =>
  kursy.map((kurs, i) => ({ data: `2026-09-${String(i + 1).padStart(2, '0')}`, kurs }));

describe('oś pionowa', () => {
  it('obejmuje wszystkie wartości serii', () => {
    const punkty = seria([4.21, 4.35, 4.18, 4.4]);
    const { zakres } = osPionowa(punkty);
    expect(zakres.min).toBeLessThanOrEqual(4.18);
    expect(zakres.max).toBeGreaterThanOrEqual(4.4);
  });

  it('każda kreska mieści się w zakresie wykresu', () => {
    // Kreska opisująca wartość spoza pola rysowania byłaby kłamstwem.
    const { kreski, zakres } = osPionowa(seria([4.21, 4.35, 4.18, 4.4]));
    for (const k of kreski) {
      expect(k).toBeGreaterThanOrEqual(zakres.min - 1e-9);
      expect(k).toBeLessThanOrEqual(zakres.max + 1e-9);
    }
  });

  it('radzi sobie z kursem niezmiennym przez cały okres', () => {
    // Zerowa rozpiętość dałaby dzielenie przez zero przy skalowaniu.
    const { kreski, zakres } = osPionowa(seria([4.25, 4.25, 4.25]));
    expect(zakres.max).toBeGreaterThan(zakres.min);
    expect(kreski.length).toBeGreaterThan(1);
    expect(Number.isFinite(pionowo(4.25, zakres, RAMKA))).toBe(true);
  });

  it('działa dla walut o bardzo małej wartości jednostkowej', () => {
    // Dong wietnamski: kursy rzędu dziesięciotysięcznych części grosza.
    const { kreski, zakres } = osPionowa(seria([0.00014309, 0.00014512, 0.00014201]));
    expect(zakres.min).toBeLessThanOrEqual(0.00014201);
    expect(zakres.max).toBeGreaterThanOrEqual(0.00014512);
    expect(kreski.every((k) => Number.isFinite(k))).toBe(true);
  });

  it('kreski są rosnące i równo oddalone', () => {
    const { kreski } = osPionowa(seria([1, 7.5]));
    const odstepy = kreski.slice(1).map((k, i) => k - kreski[i]!);
    for (const o of odstepy) expect(o).toBeCloseTo(odstepy[0]!, 9);
  });
});

describe('skalowanie', () => {
  const punkty = seria([4.2, 4.3, 4.25, 4.4]);
  const { zakres } = osPionowa(punkty);

  it('pierwszy i ostatni punkt siedzą na krawędziach pola', () => {
    expect(poziomo(0, 4, RAMKA)).toBeCloseTo(RAMKA.lewo, 6);
    expect(poziomo(3, 4, RAMKA)).toBeCloseTo(RAMKA.szerokosc - RAMKA.prawo, 6);
  });

  it('pojedynczy punkt ląduje na środku', () => {
    expect(poziomo(0, 1, RAMKA)).toBeCloseTo((RAMKA.lewo + RAMKA.szerokosc - RAMKA.prawo) / 2, 6);
  });

  it('wyższy kurs jest wyżej na ekranie', () => {
    // Oś ekranu rośnie w dół, więc większa wartość musi dać mniejszą współrzędną.
    expect(pionowo(4.4, zakres, RAMKA)).toBeLessThan(pionowo(4.2, zakres, RAMKA));
  });

  it('żaden punkt nie wychodzi poza pole rysowania', () => {
    for (const p of punkty) {
      const y = pionowo(p.kurs, zakres, RAMKA);
      expect(y).toBeGreaterThanOrEqual(RAMKA.gora);
      expect(y).toBeLessThanOrEqual(RAMKA.wysokosc - RAMKA.dol);
    }
  });
});

describe('ścieżki', () => {
  it('linia ma tyle odcinków, ile punktów', () => {
    const d = sciezka(seria([4.2, 4.3, 4.25]), { min: 4, max: 4.5 }, RAMKA);
    expect(d.startsWith('M')).toBe(true);
    expect(d.match(/L/g)).toHaveLength(2);
  });

  it('wypełnienie domyka się przy dolnej krawędzi', () => {
    const d = wypelnienie(seria([4.2, 4.3]), { min: 4, max: 4.5 }, RAMKA);
    expect(d.endsWith('Z')).toBe(true);
    expect(d).toContain((RAMKA.wysokosc - RAMKA.dol).toFixed(2));
  });

  it('pusta seria nie wywraca wypełnienia', () => {
    expect(wypelnienie([], { min: 0, max: 1 }, RAMKA)).toBe('');
  });
});

describe('wskazywanie punktu', () => {
  it('trafia w punkt najbliższy kursorowi', () => {
    expect(najblizszy(RAMKA.lewo, 5, RAMKA)).toBe(0);
    expect(najblizszy(RAMKA.szerokosc - RAMKA.prawo, 5, RAMKA)).toBe(4);
  });

  it('nie wychodzi poza serię przy kursorze poza polem', () => {
    expect(najblizszy(-500, 5, RAMKA)).toBe(0);
    expect(najblizszy(5000, 5, RAMKA)).toBe(4);
  });
});

describe('podpisy osi poziomej', () => {
  it('przy krótkiej serii podpisuje każdy punkt', () => {
    expect(podpisyOsi(3)).toEqual([0, 1, 2]);
  });

  it('przy długiej serii wybiera równomiernie, z pierwszym i ostatnim', () => {
    const p = podpisyOsi(250, 5);
    expect(p).toHaveLength(5);
    expect(p[0]).toBe(0);
    expect(p.at(-1)).toBe(249);
    expect([...p]).toEqual([...p].sort((a, b) => a - b));
  });

  it('pusta seria nie ma podpisów', () => {
    expect(podpisyOsi(0)).toEqual([]);
  });
});

describe('ramka zależna od szerokości', () => {
  it('ma tyle jednostek, ile pikseli daje kontener — skala zostaje 1:1', () => {
    expect(ramka(380).szerokosc).toBe(380);
    expect(ramka(620).szerokosc).toBe(620);
  });

  it('nie schodzi poniżej sensownego minimum ani nie rozciąga się bez końca', () => {
    expect(ramka(120).szerokosc).toBe(260);
    expect(ramka(2000).szerokosc).toBe(720);
  });

  it('na wąskim ekranie obniża wykres i zwęża margines osi pionowej', () => {
    const waska = ramka(360);
    const szeroka = ramka(620);
    expect(waska.wysokosc).toBeLessThan(szeroka.wysokosc);
    expect(waska.lewo).toBeLessThan(szeroka.lewo);
  });

  it('przy nieznanej szerokości (0 z serwera) wraca do wartości domyślnej', () => {
    expect(ramka(0).szerokosc).toBe(620);
    expect(ramka(Number.NaN).szerokosc).toBe(620);
  });

  it('zawsze zostawia pole rysowania o dodatnich wymiarach', () => {
    for (const szerokosc of [0, 200, 320, 480, 900, 1600]) {
      const r = ramka(szerokosc);
      expect(r.szerokosc - r.lewo - r.prawo).toBeGreaterThan(0);
      expect(r.wysokosc - r.gora - r.dol).toBeGreaterThan(0);
    }
  });
});
