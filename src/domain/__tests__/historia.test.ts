import { beforeEach, describe, expect, it } from 'vitest';
import {
  LIMIT, UKLAD_DOMYSLNY, czyZmieniony, dopisz, opisDoSchowka, ulozHistorie, usun, uzyteWaluty,
  wczytaj, wyczysc, zapisz, type Uklad, type Wpis,
} from '../historia';
import type { Kurs, Przeliczenie } from '../types';

const kurs = (kod: string, wartosc: number, numer = '15/A/NBP/2026', data = '2026-09-11'): Kurs => ({
  kod, nazwa: kod.toLowerCase(), tabela: 'A', numerTabeli: numer, kurs: wartosc, dataTabeli: data,
});

const przeliczenie = (nadpisz: Partial<Przeliczenie> = {}): Przeliczenie => ({
  kwota: 1000,
  kurs: kurs('EUR', 4.3264),
  kursDocelowy: null,
  dataZdarzenia: '2026-09-12',
  dataWymagana: '2026-09-11',
  wynikPln: 4326.4,
  wynikDocelowy: null,
  kursKrzyzowy: null,
  kursStarszyNizWymagany: false,
  ...nadpisz,
});

describe('dopisywanie do historii', () => {
  it('kładzie nowy wpis na czele', () => {
    const jeden = dopisz([], przeliczenie(), 1);
    const dwa = dopisz(jeden, przeliczenie({ kwota: 2000 }), 2);
    expect(dwa.map((w) => w.przeliczenie.kwota)).toEqual([2000, 1000]);
  });

  it('nie dubluje powtórzonego przeliczenia tego samego zdarzenia', () => {
    // Przy zapisie automatycznym ponowne kliknięcie „Przelicz" nie może
    // zasypywać historii kopiami tej samej pozycji.
    const raz = dopisz([], przeliczenie(), 1);
    expect(dopisz(raz, przeliczenie(), 2)).toHaveLength(1);
  });

  it('zmiana kwoty, daty albo waluty to już inne zdarzenie', () => {
    const raz = dopisz([], przeliczenie(), 1);
    expect(dopisz(raz, przeliczenie({ kwota: 1001 }), 2)).toHaveLength(2);
    expect(dopisz(raz, przeliczenie({ dataZdarzenia: '2026-09-13' }), 3)).toHaveLength(2);
    expect(dopisz(raz, przeliczenie({ kurs: kurs('USD', 3.7111) }), 4)).toHaveLength(2);
  });

  it('rozróżnia przeliczenie na złote od przeliczenia na walutę obcą', () => {
    const naZlote = dopisz([], przeliczenie(), 1);
    const naDolary = dopisz(naZlote, przeliczenie({ kursDocelowy: kurs('USD', 3.7111) }), 2);
    expect(naDolary).toHaveLength(2);
  });

  it('duplikat cofa się tylko wobec ostatniego wpisu, nie całej historii', () => {
    const a = dopisz([], przeliczenie(), 1);
    const b = dopisz(a, przeliczenie({ kwota: 2000 }), 2);
    expect(dopisz(b, przeliczenie(), 3)).toHaveLength(3);
  });

  it('trzyma się limitu, odrzucając najstarsze', () => {
    let historia: Wpis[] = [];
    for (let i = 0; i < LIMIT + 25; i += 1) {
      historia = dopisz(historia, przeliczenie({ kwota: i + 1 }), i + 1);
    }
    expect(historia).toHaveLength(LIMIT);
    expect(historia[0]!.przeliczenie.kwota).toBe(LIMIT + 25);
  });
});

describe('usuwanie', () => {
  it('kasuje wskazany wpis, zostawiając resztę', () => {
    const dwa = dopisz(dopisz([], przeliczenie(), 1), przeliczenie({ kwota: 2000 }), 2);
    expect(usun(dwa, 1).map((w) => w.id)).toEqual([2]);
  });
});

describe('pamięć przeglądarki', () => {
  beforeEach(() => wyczysc());

  it('odczytuje to, co zapisano', () => {
    const historia = dopisz([], przeliczenie(), 1);
    zapisz(historia);
    expect(wczytaj()).toEqual(historia);
  });

  it('pusta pamięć daje pustą historię', () => {
    expect(wczytaj()).toEqual([]);
  });

  it('odrzuca zawartość, która nie jest listą', () => {
    localStorage.setItem('kalkulator-walut-historia', '{"a":1}');
    expect(wczytaj()).toEqual([]);
  });

  it('odrzuca uszkodzony wpis, zachowując zdrowe', () => {
    // Pamięć przeglądarki to dane spoza aplikacji — jeden zepsuty wpis
    // nie może wywrócić całego ekranu historii.
    const zdrowy = dopisz([], przeliczenie(), 1)[0];
    localStorage.setItem(
      'kalkulator-walut-historia',
      JSON.stringify([{ id: 9, przeliczenie: { kwota: 'dużo' } }, zdrowy, null, 42]),
    );
    expect(wczytaj()).toEqual([zdrowy]);
  });

  it('nie wywraca się na niepoprawnym JSON-ie', () => {
    localStorage.setItem('kalkulator-walut-historia', '{{{');
    expect(wczytaj()).toEqual([]);
  });
});

describe('opis do schowka', () => {
  // Intl rozdziela kwotę od „zł" spacją nierozdzielającą — w oczekiwaniach
  // musi stać ten sam znak, inaczej test przechodzi albo pada przypadkiem.
  const zl = (kwota: string) => `${kwota}\u00a0zł`;

  it('mieści rachunek, tabelę i obie daty w jednej linii', () => {
    const opis = opisDoSchowka(przeliczenie());
    expect(opis).toBe(
      `1000,00 EUR po kursie 4,3264 zł = ${zl('4326,40')}; ` +
        'tabela 15/A/NBP/2026 z 11.09.2026; zdarzenie gospodarcze 12.09.2026',
    );
    expect(opis).not.toContain('\n');
  });

  it('przy walucie obcej pokazuje drogę przez złotego', () => {
    const opis = opisDoSchowka(
      przeliczenie({
        kursDocelowy: kurs('USD', 3.7111, '15/A/NBP/2026'),
        wynikDocelowy: 1165.8,
        kursKrzyzowy: 1.1658,
      }),
    );
    expect(opis).toContain(`${zl('4326,40')} ÷ 3,7111 zł = 1165,80 USD`);
    expect(opis).toContain('tabela 15/A/NBP/2026');
  });

  it('wymienia obie tabele, gdy kursy pochodzą z różnych', () => {
    const opis = opisDoSchowka(
      przeliczenie({
        kursDocelowy: kurs('VND', 0.00014309, '37/B/NBP/2026', '2026-09-09'),
        wynikDocelowy: 30236012.3,
        kursKrzyzowy: 30236,
      }),
    );
    expect(opis).toContain('tabele 15/A/NBP/2026 z 11.09.2026 oraz 37/B/NBP/2026 z 09.09.2026');
  });

  it('podaje kurs waluty o małej wartości jednostkowej bez ucinania', () => {
    const opis = opisDoSchowka(przeliczenie({ kurs: kurs('VND', 0.00014309) }));
    expect(opis).toContain('0,00014309 zł');
  });
});

describe('układanie historii', () => {
  // Kolejność zapisu: najpierw EUR, potem VND, USD, na końcu EUR→USD.
  const historia: Wpis[] = [
    { id: 4, przeliczenie: przeliczenie({ kwota: 1000, kurs: kurs('EUR', 4.3264), kursDocelowy: kurs('USD', 3.7111), wynikDocelowy: 1165.8, dataZdarzenia: '2026-09-12', wynikPln: 4326.4 }) },
    { id: 3, przeliczenie: przeliczenie({ kwota: 250.5, kurs: kurs('USD', 3.7111), dataZdarzenia: '2026-09-10', wynikPln: 929.63 }) },
    { id: 2, przeliczenie: przeliczenie({ kwota: 1_000_000, kurs: kurs('VND', 0.00014309), dataZdarzenia: '2026-09-09', wynikPln: 143.09 }) },
    { id: 1, przeliczenie: przeliczenie({ kwota: 2000, kurs: kurs('EUR', 4.3264), dataZdarzenia: '2026-09-11', wynikPln: 8652.8 }) },
  ];
  const uklad = (n: Partial<Uklad>): Uklad => ({ ...UKLAD_DOMYSLNY, ...n });
  const ids = (u: Partial<Uklad>) => ulozHistorie(historia, uklad(u)).map((w) => w.id);

  it('domyślnie zachowuje kolejność liczenia, od najnowszego', () => {
    expect(ids({})).toEqual([4, 3, 2, 1]);
  });

  it('sortuje po dacie zdarzenia w obie strony', () => {
    expect(ids({ klucz: 'data', kierunek: 'rosnaco' })).toEqual([2, 3, 1, 4]);
    expect(ids({ klucz: 'data', kierunek: 'malejaco' })).toEqual([4, 1, 3, 2]);
  });

  it('sortuje po wyniku w złotych — jedynej liczbie wspólnej dla walut', () => {
    expect(ids({ klucz: 'wynik', kierunek: 'rosnaco' })).toEqual([2, 3, 4, 1]);
  });

  it('sortuje po kwocie w walucie obcej', () => {
    expect(ids({ klucz: 'kwota', kierunek: 'malejaco' })).toEqual([2, 1, 4, 3]);
  });

  it('filtruje po walucie źródłowej', () => {
    expect(ids({ waluta: 'EUR' })).toEqual([4, 1]);
    expect(ids({ waluta: 'VND' })).toEqual([2]);
  });

  it('filtr łapie też walutę docelową', () => {
    // Wpis 4 to EUR→USD, wpis 3 to USD na złote — oba dotyczą dolara.
    expect(ids({ waluta: 'USD' })).toEqual([4, 3]);
  });

  it('filtr i sortowanie działają razem', () => {
    expect(ids({ waluta: 'EUR', klucz: 'kwota', kierunek: 'rosnaco' })).toEqual([4, 1]);
  });

  it('zawęża do zakresu dat zdarzenia, z obu stron włącznie', () => {
    // Daty zdarzeń: 4 → 12.09, 3 → 10.09, 2 → 09.09, 1 → 11.09
    expect(ids({ od: '2026-09-10', doDnia: '2026-09-11' })).toEqual([3, 1]);
    expect(ids({ od: '2026-09-11' })).toEqual([4, 1]);
    expect(ids({ doDnia: '2026-09-09' })).toEqual([2]);
  });

  it('zakres dat działa razem z walutą i sortowaniem', () => {
    expect(ids({ waluta: 'EUR', od: '2026-09-11', klucz: 'data', kierunek: 'rosnaco' })).toEqual([1, 4]);
  });

  it('pusty zakres daje pustą listę', () => {
    expect(ids({ od: '2026-09-13' })).toEqual([]);
  });

  it('nieznana waluta daje pustą listę', () => {
    expect(ids({ waluta: 'CHF' })).toEqual([]);
  });

  it('nie przestawia wpisów o równej mierze', () => {
    const rowne: Wpis[] = [
      { id: 2, przeliczenie: przeliczenie({ dataZdarzenia: '2026-09-12' }) },
      { id: 1, przeliczenie: przeliczenie({ dataZdarzenia: '2026-09-12' }) },
    ];
    expect(ulozHistorie(rowne, uklad({ klucz: 'data' })).map((w) => w.id)).toEqual([2, 1]);
  });

  it('nie rusza listy wejściowej', () => {
    ulozHistorie(historia, uklad({ klucz: 'data', kierunek: 'rosnaco' }));
    expect(historia.map((w) => w.id)).toEqual([4, 3, 2, 1]);
  });
});

describe('waluty obecne w historii', () => {
  const historia: Wpis[] = [
    { id: 3, przeliczenie: przeliczenie({ kurs: kurs('EUR', 4.3), kursDocelowy: kurs('USD', 3.7) }) },
    { id: 2, przeliczenie: przeliczenie({ kurs: kurs('USD', 3.7) }) },
    { id: 1, przeliczenie: przeliczenie({ kurs: kurs('EUR', 4.3) }) },
  ];

  it('liczy wpisy dotyczące każdej waluty, po obu stronach przeliczenia', () => {
    expect(uzyteWaluty(historia)).toEqual([
      { kod: 'EUR', ile: 2 },
      { kod: 'USD', ile: 2 },
    ]);
  });

  it('nie liczy wpisu dwa razy, gdy ta sama waluta stoi po obu stronach', () => {
    const dziwny: Wpis[] = [
      { id: 1, przeliczenie: przeliczenie({ kurs: kurs('EUR', 4.3), kursDocelowy: kurs('EUR', 4.3) }) },
    ];
    expect(uzyteWaluty(dziwny)).toEqual([{ kod: 'EUR', ile: 1 }]);
  });

  it('pusta historia daje pustą listę', () => {
    expect(uzyteWaluty([])).toEqual([]);
  });
});

describe('czy układ odbiega od wyjściowego', () => {
  it('wyjściowy nie jest zmieniony', () => {
    expect(czyZmieniony(UKLAD_DOMYSLNY)).toBe(false);
  });

  it('każdy filtr i sortowanie liczą się jako zmiana', () => {
    expect(czyZmieniony({ ...UKLAD_DOMYSLNY, klucz: 'data' })).toBe(true);
    expect(czyZmieniony({ ...UKLAD_DOMYSLNY, waluta: 'EUR' })).toBe(true);
    expect(czyZmieniony({ ...UKLAD_DOMYSLNY, od: '2026-09-01' })).toBe(true);
    expect(czyZmieniony({ ...UKLAD_DOMYSLNY, doDnia: '2026-09-30' })).toBe(true);
  });
});
