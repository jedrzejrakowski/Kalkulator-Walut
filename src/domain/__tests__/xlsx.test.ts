import { describe, expect, it } from 'vitest';
import { archiwum, crc32 } from '../zip';
import { numerDaty, plikXlsx } from '../xlsx';
import { zestawienie } from '../zestawienie';
import type { Wpis } from '../historia';

/** Odczyt archiwum bez kompresji — wystarczy, żeby sprawdzić, co w nim leży. */
function rozpakuj(zip: Uint8Array): Map<string, string> {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const pliki = new Map<string, string>();
  let i = 0;
  while (v.getUint32(i, true) === 0x04034b50) {
    const rozmiar = v.getUint32(i + 18, true);
    const dl = v.getUint16(i + 26, true);
    const nazwa = new TextDecoder().decode(zip.subarray(i + 30, i + 30 + dl));
    const dane = zip.subarray(i + 30 + dl, i + 30 + dl + rozmiar);
    expect(crc32(dane)).toBe(v.getUint32(i + 14, true));
    pliki.set(nazwa, new TextDecoder().decode(dane));
    i += 30 + dl + rozmiar;
  }
  return pliki;
}

describe('ZIP', () => {
  it('liczy CRC-32 zgodnie ze wzorcem', () => {
    // Wektor kontrolny z definicji CRC-32: „123456789" → CBF43926.
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('zapisuje pliki tak, że dają się odczytać z powrotem', () => {
    const zip = archiwum([
      { nazwa: 'a.txt', dane: new TextEncoder().encode('zażółć') },
      { nazwa: 'katalog/b.xml', dane: new TextEncoder().encode('<x/>') },
    ]);
    const pliki = rozpakuj(zip);
    expect(pliki.get('a.txt')).toBe('zażółć');
    expect(pliki.get('katalog/b.xml')).toBe('<x/>');
  });

  it('kończy się poprawnym katalogiem centralnym', () => {
    const zip = archiwum([{ nazwa: 'a', dane: new Uint8Array([1, 2, 3]) }]);
    const v = new DataView(zip.buffer);
    const koniec = zip.length - 22;
    expect(v.getUint32(koniec, true)).toBe(0x06054b50);
    expect(v.getUint16(koniec + 10, true)).toBe(1);
    // Przesunięcie katalogu wskazuje na wpis centralny.
    expect(v.getUint32(v.getUint32(koniec + 16, true), true)).toBe(0x02014b50);
  });
});

describe('numer seryjny daty Excela', () => {
  it('zgadza się z Excelem', () => {
    // Excel pokazuje 46245 jako 11.08.2026, a 1 jako 1.01.1900.
    expect(numerDaty('2026-08-11')).toBe(46245);
    expect(numerDaty('1900-01-01')).toBe(2);
    expect(numerDaty('1900-03-01')).toBe(61);
  });
});

describe('arkusz zestawienia', () => {
  const wpis = (id: number, kod: string, kwota: number, kurs: number, pln: number, data: string): Wpis => ({
    id,
    przeliczenie: {
      kwota, kurs: { kod, nazwa: kod, tabela: 'B', numerTabeli: '31/B/NBP/2026', kurs, dataTabeli: '2026-08-05' },
      kursDocelowy: null, dataZdarzenia: data, dataWymagana: data, wynikPln: pln, wynikDocelowy: null,
      kursKrzyzowy: null, kursStarszyNizWymagany: false,
    },
  });
  const z = zestawienie(
    [wpis(1, 'SCR', 1450, 0.2759, 400.06, '2026-08-11'), wpis(2, 'VND', 1_000_000, 0.00014309, 143.09, '2026-08-12')],
    'Seszele & Wietnam <08/2026>',
    '2026-09-23',
  );
  const pliki = rozpakuj(plikXlsx(z, new Date(2026, 8, 23, 12, 0)));
  const arkusz = pliki.get('xl/worksheets/sheet1.xml')!;

  it('zawiera wszystkie części skoroszytu', () => {
    expect([...pliki.keys()].sort()).toEqual([
      '[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels',
      'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml',
    ]);
  });

  it('zapisuje kwoty i kursy jako liczby, z pełną dokładnością', () => {
    expect(arkusz).toContain('<c r="C7" s="3"><v>1450</v></c>');
    expect(arkusz).toContain('<c r="E8" s="4"><v>0.00014309</v></c>');
    expect(arkusz).toContain('<c r="H7" s="3"><v>400.06</v></c>');
  });

  it('zapisuje daty jako daty, nie tekst', () => {
    expect(arkusz).toContain('<c r="B7" s="2"><v>46245</v></c>');
  });

  it('liczy sumy formułami, z zapisaną wartością', () => {
    expect(arkusz).toContain('<f>SUM(H7:H8)</f><v>543.15</v>');
    expect(arkusz).toContain('<f>SUMIF(D$7:D$8,D11,H$7:H$8)</f><v>400.06</v>');
    expect(arkusz).toContain('<f>COUNTIF(D$7:D$8,D12)</f><v>1</v>');
  });

  it('zabezpiecza znaki specjalne w tekście', () => {
    expect(arkusz).toContain('Seszele &amp; Wietnam &lt;08/2026&gt;');
    expect(arkusz).not.toContain('Seszele & Wietnam');
  });

  it('ma poprawny XML w każdej części', () => {
    for (const [nazwa, tresc] of pliki) {
      const dok = new DOMParser().parseFromString(tresc, 'application/xml');
      expect(dok.getElementsByTagName('parsererror'), nazwa).toHaveLength(0);
    }
  });
});
