import { describe, expect, it, vi } from 'vitest';
import { BladNbp, pobierzKurs, pobierzWaluty } from '../nbp';
import { przelicz, zloz } from '../convert';
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
    const wynik = await przelicz(1000, 'EUR', '2026-06-24', pobierz as unknown as typeof fetch);
    expect(pobierz.mock.calls[0]![0]).toContain('/2026-06-23/?format=json');
    expect(wynik.wynikPln).toBe(4256.7);
  });
});
