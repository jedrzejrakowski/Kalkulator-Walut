import { przesun, type DataIso } from './dates';
import type { Kurs, Tabela, Waluta } from './types';
import type { Punkt } from './wykres';

const BAZA = 'https://api.nbp.pl/api/exchangerates';

/**
 * Ile dni wstecz wolno szukać ogłoszonej tabeli.
 *
 * Tabela A wypada w każdy dzień roboczy, więc wystarczyłby tydzień. Tabela B
 * ogłaszana jest w środy, a gdy środa jest świętem, przesuwa się dalej —
 * dwa tygodnie z zapasem pokrywają nawet okres świąteczno-noworoczny.
 */
const OKNO_DNI = 16;

export class BladNbp extends Error {}

type Pobieracz = typeof fetch;

interface PozycjaTabeli {
  code: string;
  currency: string;
  mid: number;
}

interface OdpowiedzTabeli {
  table: Tabela;
  no: string;
  effectiveDate: DataIso;
  rates: PozycjaTabeli[];
}

interface OdpowiedzKursu {
  table: Tabela;
  currency: string;
  code: string;
  rates: { no: string; effectiveDate: DataIso; mid: number }[];
}

async function pobierzJson<T>(url: string, pobierz: Pobieracz): Promise<T | null> {
  let odpowiedz: Response;
  try {
    odpowiedz = await pobierz(url);
  } catch {
    throw new BladNbp('Brak połączenia z serwisem NBP. Sprawdź dostęp do sieci.');
  }
  // Brak tabeli w danym dniu NBP sygnalizuje kodem 404 — to nie jest awaria.
  if (odpowiedz.status === 404) return null;
  if (!odpowiedz.ok) {
    throw new BladNbp(`Serwis NBP odpowiedział błędem ${odpowiedz.status}.`);
  }
  return (await odpowiedz.json()) as T;
}

/**
 * Lista walut prosto z obu tabel NBP.
 *
 * Świadomie nie ma tu wpisanej na stałe listy kodów. NBP przenosi waluty
 * między tabelami i dopisuje nowe, więc każdy spis w kodzie zdezaktualizuje
 * się bez ostrzeżenia.
 */
export async function pobierzWaluty(pobierz: Pobieracz = fetch): Promise<Waluta[]> {
  const tabele: Tabela[] = ['A', 'B'];
  const zebrane: Waluta[] = [];

  for (const tabela of tabele) {
    const dane = await pobierzJson<OdpowiedzTabeli[]>(
      `${BAZA}/tables/${tabela.toLowerCase()}/?format=json`,
      pobierz,
    );
    if (!dane?.[0]) continue;
    for (const pozycja of dane[0].rates) {
      zebrane.push({ kod: pozycja.code, nazwa: pozycja.currency, tabela });
    }
  }

  if (zebrane.length === 0) {
    throw new BladNbp('Nie udało się pobrać listy walut z serwisu NBP.');
  }
  return zebrane.sort((a, b) => a.kod.localeCompare(b.kod, 'pl'));
}

/**
 * Ostatni kurs ogłoszony nie później niż wskazanego dnia.
 *
 * Zamiast odpytywać API dzień po dniu, pobieramy cały zakres i bierzemy
 * ostatnią pozycję. Jedno zapytanie zamiast kilkunastu, a przy okazji
 * poprawnie obsługuje święta i tygodniowy rytm tabeli B.
 */
async function kursZTabeli(
  kod: string,
  tabela: Tabela,
  doDnia: DataIso,
  pobierz: Pobieracz,
): Promise<Kurs | null> {
  const od = przesun(doDnia, -OKNO_DNI);
  const dane = await pobierzJson<OdpowiedzKursu>(
    `${BAZA}/rates/${tabela.toLowerCase()}/${kod.toLowerCase()}/${od}/${doDnia}/?format=json`,
    pobierz,
  );
  const ostatni = dane?.rates?.at(-1);
  if (!dane || !ostatni) return null;

  return {
    kod: dane.code,
    nazwa: dane.currency,
    tabela: dane.table,
    numerTabeli: ostatni.no,
    kurs: ostatni.mid,
    dataTabeli: ostatni.effectiveDate,
  };
}

/**
 * Kurs waluty na wskazany dzień, z tabeli A albo B.
 *
 * Kolejność ma znaczenie: waluty wymienialne siedzą w tabeli A i tam trzeba
 * szukać najpierw. Dopiero gdy NBP nie ogłasza waluty w tabeli A, sięgamy do B.
 */
export async function pobierzKurs(
  kod: string,
  doDnia: DataIso,
  pobierz: Pobieracz = fetch,
): Promise<Kurs> {
  for (const tabela of ['A', 'B'] as Tabela[]) {
    const kurs = await kursZTabeli(kod, tabela, doDnia, pobierz);
    if (kurs) return kurs;
  }
  throw new BladNbp(
    `NBP nie ogłosił kursu ${kod.toUpperCase()} w ciągu ${OKNO_DNI} dni przed ${doDnia}. ` +
      'Sprawdź, czy kod waluty jest poprawny i czy data nie wypada przed jej pierwszym notowaniem.',
  );
}

export interface Seria {
  kod: string;
  nazwa: string;
  tabela: Tabela;
  punkty: Punkt[];
}

/**
 * Szereg kursów z zakresu dat.
 *
 * NBP przyjmuje zakres do 367 dni w jednym zapytaniu, więc rok mieści się
 * w jednym wywołaniu. Tabela B da mniej punktów niż A, bo ogłaszana jest raz
 * w tygodniu — i to jest informacja sama w sobie, a nie brak danych.
 */
export async function pobierzSerie(
  kod: string,
  od: DataIso,
  doDnia: DataIso,
  pobierz: Pobieracz = fetch,
): Promise<Seria> {
  for (const tabela of ['A', 'B'] as Tabela[]) {
    const dane = await pobierzJson<OdpowiedzKursu>(
      `${BAZA}/rates/${tabela.toLowerCase()}/${kod.toLowerCase()}/${od}/${doDnia}/?format=json`,
      pobierz,
    );
    if (dane?.rates?.length) {
      return {
        kod: dane.code,
        nazwa: dane.currency,
        tabela: dane.table,
        punkty: dane.rates.map((r) => ({ data: r.effectiveDate, kurs: r.mid })),
      };
    }
  }
  throw new BladNbp(`NBP nie ogłosił kursów ${kod.toUpperCase()} w okresie od ${od} do ${doDnia}.`);
}
