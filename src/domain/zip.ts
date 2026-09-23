/**
 * Archiwum ZIP bez kompresji.
 *
 * Plik .xlsx to archiwum ZIP z kilkoma plikami XML. Biblioteka do Excela
 * dołożyłaby kilkaset kilobajtów do programu, który celowo nie ma zależności,
 * a do zapisania archiwum wystarczy kilka nagłówków i suma kontrolna.
 * Pliki zapisujemy bez kompresji — to dozwolona metoda ZIP, a przy
 * zestawieniu na kilkaset wierszy różnica w rozmiarze jest bez znaczenia.
 */

export interface PlikArchiwum {
  nazwa: string;
  dane: Uint8Array;
}

/** Tablica do CRC-32 — tej samej sumy kontrolnej, której używa ZIP. */
const TABLICA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(dane: Uint8Array): number {
  let c = 0xffffffff;
  for (const bajt of dane) c = TABLICA_CRC[(c ^ bajt) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Data i czas w zapisie DOS, jakiego wymaga nagłówek ZIP. */
function czasDos(d: Date): { czas: number; data: number } {
  return {
    czas: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    data: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const UTF8 = 0x0800; // flaga: nazwy plików w UTF-8

export function archiwum(pliki: PlikArchiwum[], kiedy: Date = new Date()): Uint8Array {
  const { czas, data } = czasDos(kiedy);
  const kodowanie = new TextEncoder();

  const lokalne: Uint8Array[] = [];
  const centralne: Uint8Array[] = [];
  let przesuniecie = 0;

  for (const plik of pliki) {
    const nazwa = kodowanie.encode(plik.nazwa);
    const suma = crc32(plik.dane);
    const rozmiar = plik.dane.length;

    const naglowek = new Uint8Array(30 + nazwa.length);
    const l = new DataView(naglowek.buffer);
    l.setUint32(0, 0x04034b50, true); // sygnatura nagłówka lokalnego
    l.setUint16(4, 20, true);         // wersja potrzebna do rozpakowania
    l.setUint16(6, UTF8, true);
    l.setUint16(8, 0, true);          // metoda: bez kompresji
    l.setUint16(10, czas, true);
    l.setUint16(12, data, true);
    l.setUint32(14, suma, true);
    l.setUint32(18, rozmiar, true);   // rozmiar po kompresji
    l.setUint32(22, rozmiar, true);   // rozmiar oryginalny
    l.setUint16(26, nazwa.length, true);
    l.setUint16(28, 0, true);
    naglowek.set(nazwa, 30);
    lokalne.push(naglowek, plik.dane);

    const wpis = new Uint8Array(46 + nazwa.length);
    const c = new DataView(wpis.buffer);
    c.setUint32(0, 0x02014b50, true); // sygnatura wpisu katalogu centralnego
    c.setUint16(4, 20, true);         // wersja, w której utworzono
    c.setUint16(6, 20, true);
    c.setUint16(8, UTF8, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, czas, true);
    c.setUint16(14, data, true);
    c.setUint32(16, suma, true);
    c.setUint32(20, rozmiar, true);
    c.setUint32(24, rozmiar, true);
    c.setUint16(28, nazwa.length, true);
    // pola 30–40: dodatki, komentarz, dysk, atrybuty — zera
    c.setUint32(42, przesuniecie, true);
    wpis.set(nazwa, 46);
    centralne.push(wpis);

    przesuniecie += naglowek.length + rozmiar;
  }

  const rozmiarKatalogu = centralne.reduce((s, w) => s + w.length, 0);
  const koniec = new Uint8Array(22);
  const k = new DataView(koniec.buffer);
  k.setUint32(0, 0x06054b50, true);   // sygnatura końca katalogu
  k.setUint16(8, pliki.length, true);
  k.setUint16(10, pliki.length, true);
  k.setUint32(12, rozmiarKatalogu, true);
  k.setUint32(16, przesuniecie, true);

  const czesci = [...lokalne, ...centralne, koniec];
  const wynik = new Uint8Array(czesci.reduce((s, c) => s + c.length, 0));
  let i = 0;
  for (const cz of czesci) {
    wynik.set(cz, i);
    i += cz.length;
  }
  return wynik;
}
