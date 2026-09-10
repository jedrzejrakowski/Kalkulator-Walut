import { poPolsku } from '../domain/dates';
import { formatPln } from '../domain/money';
import type { Przeliczenie } from '../domain/types';

const formatKursu = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});

export function ResultPanel({ wynik }: { wynik: Przeliczenie }) {
  const { kurs } = wynik;

  return (
    <section className="card">
      <h2>Wynik przeliczenia</h2>

      <div className="big-result">
        <span className="big-result__value">{formatPln(wynik.wynikPln)}</span>
        <span className="big-result__label">
          za {formatKursu.format(wynik.kwota)} {kurs.kod}
        </span>
      </div>

      <table className="figures">
        <tbody>
          <tr>
            <th scope="row">Kurs średni NBP</th>
            <td>{formatKursu.format(kurs.kurs)} zł</td>
          </tr>
          <tr>
            <th scope="row">
              Tabela
              <span className={`pill pill--${kurs.tabela.toLowerCase()}`}>{kurs.numerTabeli}</span>
            </th>
            <td>{poPolsku(kurs.dataTabeli)}</td>
          </tr>
          <tr>
            <th scope="row">Data zdarzenia gospodarczego</th>
            <td>{poPolsku(wynik.dataZdarzenia)}</td>
          </tr>
          <tr>
            <th scope="row">
              Wymagany dzień kursu
              <span className="row-note">ostatni dzień roboczy przed zdarzeniem</span>
            </th>
            <td>{poPolsku(wynik.dataWymagana)}</td>
          </tr>
          <tr className="row-total">
            <th scope="row">Kwota w złotych</th>
            <td>{formatPln(wynik.wynikPln)}</td>
          </tr>
        </tbody>
      </table>

      {wynik.kursStarszyNizWymagany ? (
        <p className="warning" style={{ marginTop: 14 }}>
          {kurs.tabela === 'B'
            ? `Tabela B jest ogłaszana raz w tygodniu, w środy. Najbliższy kurs poprzedzający ${poPolsku(wynik.dataWymagana)} pochodzi z ${poPolsku(kurs.dataTabeli)} i to on obowiązuje.`
            : `W dniu ${poPolsku(wynik.dataWymagana)} NBP nie ogłosił tabeli — prawdopodobnie było to święto. Zastosowano kurs z ${poPolsku(kurs.dataTabeli)}.`}
        </p>
      ) : null}

      <h3 className="subhead">Jak to zaksięgować</h3>
      <ul className="notes">
        <li>
          Do księgowania przyjmij <strong>{formatPln(wynik.wynikPln)}</strong> jako równowartość{' '}
          {formatKursu.format(wynik.kwota)} {kurs.kod}.
        </li>
        <li>
          Na dowodzie opisz kurs: {formatKursu.format(kurs.kurs)} zł za 1 {kurs.kod}, tabela{' '}
          {kurs.numerTabeli} z {poPolsku(kurs.dataTabeli)}.
        </li>
        <li>
          Różnice kursowe rozliczysz przy zapłacie, według kursu z dnia poprzedzającego tamto
          zdarzenie.
        </li>
      </ul>

      <h3 className="subhead">Podstawa prawna</h3>
      <ul className="legal">
        <li>
          art. 11a ust. 2 ustawy o PIT oraz art. 15 ust. 1 ustawy o CIT — przeliczenie według kursu
          średniego NBP z ostatniego dnia roboczego poprzedzającego dzień poniesienia kosztu
        </li>
        <li>
          art. 31a ust. 1 ustawy o VAT — ten sam kurs stosuje się do podstawy opodatkowania
          wyrażonej w walucie obcej
        </li>
      </ul>
    </section>
  );
}
