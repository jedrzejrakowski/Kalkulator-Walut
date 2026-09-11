import { describe, expect, it, vi } from 'vitest';
import { BladNbp, pobierzKurs, pobierzSerie, pobierzWaluty } from '../nbp';
import { doGroszy, przelicz, zloz } from '../convert';
import type { Kurs } from '../types';

const brak = () => new Response('404 NotFound', { status: 404 });
const json = (dane: unknown) => new Response(JSON.stringify(dane), { status: 200 });

const kursZTabeli = (tabela: string, kod: string, waluta: string, mid: number, data: string) =>
  json({
    table: tabela, currency: waluta, code: kod,
    rates: [{ no: `100/${tabela}/NBP/2026`, effectiveDate: data, mid }],
  });

describe('pobieranie kursu', () => {
  it('bierze kurs z tabeli A, gdy waluta tam jest', async () => {
    const pobierz = vi.fn(async (url: string) =>
      url.includes('/rates/a/eur/') ? kursZTabeli('A', 'EUR', 'euro', 4.2567, '2026-06-23') : brak(),
    );
    const kurs = await pobierzKurs('EUR', '2026-06-23', pobierz as unknown as typeof fetch);
    expect(kurs.tabela).toBe('A');
    expect(kurs.kurs).toBe(4.2567);
    expect(pobierz).toHaveBeenCalledTimes(1);
  });

  it('sięga do tabeli B, gdy waluty nie ma w tabeli A', async () => {
    // Tak zachowują się waluty rynków wschodzących — oryginalny kalkulator
    // odpytywał wyłącznie tabelę A i dla nich nie działał w ogóle.
    const pobierz = vi.fn(async (url: string) =>
      url.includes('/rates/b/vnd/')
        ? kursZTabeli('B', 'VND', 'dong (Wietnam)', 0.00015, '2026-06-17')
        : brak(),
    );
    const kurs = await pobierzKurs('VND', '2026-06-23', pobierz as unknown as typeof fetch);
    expect(kurs.tabela).toBe('B');
    expect(kurs.numerTabeli).toContain('/B/NBP/');
  });

  it('odpytuje zakres dat, a nie każdy dzień osobno', async () => {
    const pobierz = vi.fn(async (_url: string) => kursZTabeli('A', 'USD', 'dolar', 3.9, '2026-06-23'));
    await pobierzKurs('USD', '2026-06-23', pobierz as unknown as typeof fetch);
    const url = pobierz.mock.calls[0]![0];
    expect(url).toContain('/2026-06-07/2026-06-23/');
  });

  it('z zakresu bierze ostatnią ogłoszoną tabelę', async () => {
    const pobierz = vi.fn(async (_url: string) =>
      json({
        table: 'B', currency: 'riel', code: 'KHR',
        rates: [
          { no: '24/B/NBP/2026', effectiveDate: '2026-06-10', mid: 0.00092 },
          { no: '25/B/NBP/2026', effectiveDate: '2026-06-17', mid: 0.00094 },
        ],
      }),
    );
    const kurs = await pobierzKurs('KHR', '2026-06-23', pobierz as unknown as typeof fetch);
    expect(kurs.dataTabeli).toBe('2026-06-17');
    expect(kurs.kurs).toBe(0.00094);
  });

  it('mówi wprost, gdy kursu nie ma w żadnej tabeli', async () => {
    const pobierz = vi.fn(async (_url: string) => brak());
    await expect(pobierzKurs('XYZ', '2026-06-23', pobierz as unknown as typeof fetch))
      .rejects.toThrow(BladNbp);
  });

  it('odróżnia brak sieci od braku tabeli', async () => {
    const pobierz = vi.fn(async (_url: string) => { throw new TypeError('failed to fetch'); });
    await expect(pobierzKurs('EUR', '2026-06-23', pobierz as unknown as typeof fetch))
      .rejects.toThrow(/połączenia/);
  });
});

describe('lista walut', () => {
  it('łączy obie tabele i oznacza pochodzenie', async () => {
    const pobierz = vi.fn(async (url: string) =>
      json([
        url.includes('/tables/a/')
          ? { table: 'A', no: '120/A/NBP/2026', effectiveDate: '2026-06-23',
              rates: [{ code: 'EUR', currency: 'euro', mid: 4.25 }] }
          : { table: 'B', no: '25/B/NBP/2026', effectiveDate: '2026-06-17',
              rates: [{ code: 'VND', currency: 'dong (Wietnam)', mid: 0.00015 }] },
      ]),
    );
    const waluty = await pobierzWaluty(pobierz as unknown as typeof fetch);
    expect(waluty.map((w) => `${w.kod}:${w.tabela}`)).toEqual(['EUR:A', 'VND:B']);
  });
});

describe('przeliczenie', () => {
  const kurs: Kurs = {
    kod: 'EUR', nazwa: 'euro', tabela: 'A', numerTabeli: '120/A/NBP/2026',
    kurs: 4.2567, dataTabeli: '2026-06-23',
  };

  it('mnoży kwotę przez kurs i zaokrągla do groszy', () => {
    expect(zloz(1000, '2026-06-24', kurs).wynikPln).toBe(4256.7);
    expect(zloz(42, '2026-06-24', kurs).wynikPln).toBe(178.78);
  });

  it('wskazuje dzień, z którego kurs powinien pochodzić', () => {
    expect(zloz(100, '2026-06-24', kurs).dataWymagana).toBe('2026-06-23');
  });

  it('sygnalizuje kurs starszy niż wymagany dzień', () => {
    const tygodniowy: Kurs = { ...kurs, tabela: 'B', dataTabeli: '2026-06-17' };
    expect(zloz(100, '2026-06-24', tygodniowy).kursStarszyNizWymagany).toBe(true);
    expect(zloz(100, '2026-06-24', kurs).kursStarszyNizWymagany).toBe(false);
  });

  it('pobiera kurs na dzień poprzedzający zdarzenie', async () => {
    const pobierz = vi.fn(async (_url: string) => kursZTabeli('A', 'EUR', 'euro', 4.2567, '2026-06-23'));
    const wynik = await przelicz(1000, 'EUR', '2026-06-24', 'PLN', pobierz as unknown as typeof fetch);
    expect(pobierz.mock.calls[0]![0]).toContain('/2026-06-23/?format=json');
    expect(wynik.wynikPln).toBe(4256.7);
  });
});

describe('dokładność kursu na dowodzie', () => {
  it('kwota razy kurs odtwarza wynik dla walut o małej wartości jednostkowej', () => {
    // Dong wietnamski: przy kursie skróconym do sześciu miejsc milion dongów
    // dawał 143,00 zamiast 143,09 — dziewięć groszy różnicy na dowodzie.
    const kurs: Kurs = {
      kod: 'VND', nazwa: 'dong (Wietnam)', tabela: 'B',
      numerTabeli: '036/B/NBP/2026', kurs: 0.00014309, dataTabeli: '2026-09-09',
    };
    const wynik = zloz(1_000_000, '2026-09-11', kurs);
    expect(wynik.wynikPln).toBe(143.09);
    expect(doGroszy(wynik.kwota * kurs.kurs)).toBe(wynik.wynikPln);
  });
});

describe('przeliczanie między walutami obcymi', () => {
  const eur: Kurs = {
    kod: 'EUR', nazwa: 'euro', tabela: 'A', numerTabeli: '120/A/NBP/2026',
    kurs: 4.2567, dataTabeli: '2026-06-23',
  };
  const usd: Kurs = {
    kod: 'USD', nazwa: 'dolar amerykański', tabela: 'A', numerTabeli: '120/A/NBP/2026',
    kurs: 3.7111, dataTabeli: '2026-06-23',
  };

  it('prowadzi przeliczenie przez złotego', () => {
    // 1000 EUR to 4256,70 zł, a to z kolei 1147,02 USD.
    const w = zloz(1000, '2026-06-24', eur, usd);
    expect(w.wynikPln).toBe(4256.7);
    expect(w.wynikDocelowy).toBe(1147.02);
  });

  it('pokazany rachunek odtwarza się krok po kroku', () => {
    // Zaokrąglenie na złotym jest celowe: to ta kwota trafia do ksiąg,
    // więc dalsze przeliczenie musi wychodzić właśnie z niej.
    const w = zloz(1000, '2026-06-24', eur, usd);
    expect(doGroszy(w.kwota * w.kurs.kurs)).toBe(w.wynikPln);
    expect(doGroszy(w.wynikPln / usd.kurs)).toBe(w.wynikDocelowy);
  });

  it('podaje kurs krzyżowy', () => {
    const w = zloz(1000, '2026-06-24', eur, usd);
    expect(w.kursKrzyzowy).toBeCloseTo(4.2567 / 3.7111, 10);
  });

  it('przy celu w złotych nie ma kursu docelowego', () => {
    const w = zloz(1000, '2026-06-24', eur);
    expect(w.kursDocelowy).toBeNull();
    expect(w.wynikDocelowy).toBeNull();
    expect(w.kursKrzyzowy).toBeNull();
  });

  it('starsza tabela po którejkolwiek stronie jest sygnalizowana', () => {
    // EUR z czwartku, dong ze środy — tabela B jest tygodniowa.
    const dong: Kurs = { ...usd, kod: 'VND', tabela: 'B', dataTabeli: '2026-06-17', kurs: 0.00014309 };
    expect(zloz(1000, '2026-06-24', eur, dong).kursStarszyNizWymagany).toBe(true);
    expect(zloz(1000, '2026-06-24', eur, usd).kursStarszyNizWymagany).toBe(false);
  });

  it('pobiera oba kursy na ten sam wymagany dzień', async () => {
    const pobierz = vi.fn(async (url: string) =>
      url.includes('/eur/')
        ? kursZTabeli('A', 'EUR', 'euro', 4.2567, '2026-06-23')
        : kursZTabeli('A', 'USD', 'dolar', 3.7111, '2026-06-23'),
    );
    const w = await przelicz(1000, 'EUR', '2026-06-24', 'USD', pobierz as unknown as typeof fetch);
    expect(pobierz).toHaveBeenCalledTimes(2);
    for (const [url] of pobierz.mock.calls) expect(url).toContain('/2026-06-23/?format=json');
    expect(w.wynikDocelowy).toBe(1147.02);
  });

  it('ta sama waluta po obu stronach nie pobiera drugiego kursu', async () => {
    const pobierz = vi.fn(async (_url: string) => kursZTabeli('A', 'EUR', 'euro', 4.2567, '2026-06-23'));
    const w = await przelicz(1000, 'EUR', '2026-06-24', 'EUR', pobierz as unknown as typeof fetch);
    expect(pobierz).toHaveBeenCalledTimes(1);
    expect(w.kursDocelowy).toBeNull();
  });
});

describe('szereg kursów', () => {
  const szereg = (tabela: string, kod: string, pary: [string, number][]) =>
    json({
      table: tabela, currency: 'waluta', code: kod,
      rates: pary.map(([effectiveDate, mid], i) => ({ no: `${i}/${tabela}/NBP/2026`, effectiveDate, mid })),
    });

  it('zwraca wszystkie punkty z zakresu', async () => {
    const pobierz = vi.fn(async (url: string) =>
      url.includes('/rates/a/eur/')
        ? szereg('A', 'EUR', [['2026-09-08', 4.25], ['2026-09-09', 4.26], ['2026-09-10', 4.24]])
        : brak(),
    );
    const s = await pobierzSerie('EUR', '2026-09-01', '2026-09-10', pobierz as unknown as typeof fetch);
    expect(s.punkty).toHaveLength(3);
    expect(s.punkty[0]).toEqual({ data: '2026-09-08', kurs: 4.25 });
    expect(s.tabela).toBe('A');
  });

  it('sięga do tabeli B, gdy waluty nie ma w tabeli A', async () => {
    const pobierz = vi.fn(async (url: string) =>
      url.includes('/rates/b/vnd/')
        ? szereg('B', 'VND', [['2026-09-02', 0.000143], ['2026-09-09', 0.000144]])
        : brak(),
    );
    const s = await pobierzSerie('VND', '2026-09-01', '2026-09-10', pobierz as unknown as typeof fetch);
    // Tabela tygodniowa daje rzadsze punkty — to cecha danych, nie brak.
    expect(s.punkty).toHaveLength(2);
    expect(s.tabela).toBe('B');
  });

  it('mówi wprost, gdy w okresie nie ma żadnej tabeli', async () => {
    const pobierz = vi.fn(async (_url: string) => brak());
    await expect(pobierzSerie('XYZ', '2026-09-01', '2026-09-10', pobierz as unknown as typeof fetch))
      .rejects.toThrow(/nie ogłosił kursów/);
  });
});
