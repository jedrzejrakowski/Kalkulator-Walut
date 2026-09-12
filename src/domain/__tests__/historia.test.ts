import { beforeEach, describe, expect, it } from 'vitest';
import { LIMIT, dopisz, opisDoSchowka, usun, wczytaj, wyczysc, zapisz, type Wpis } from '../historia';
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
