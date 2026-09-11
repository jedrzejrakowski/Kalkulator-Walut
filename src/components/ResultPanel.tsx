import { poPolsku } from '../domain/dates';
import { formatAmount, formatPln } from '../domain/money';
import type { Przeliczenie } from '../domain/types';

/**
 * Kurs pokazujemy z pełną dokładnością, jaką podaje NBP.
 *
 * Przy sześciu miejscach po przecinku kurs dongu wyświetlał się jako
 * 0,000143, a wyliczenie szło na dokładniejszej liczbie z API — przez co
 * pomnożenie kwoty przez kurs widoczny na ekranie nie odtwarzało wyniku.
 * Na dowodzie księgowym rachunek musi się zgadzać co do grosza.
 */
const formatKursu = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 10,
});

/**
 * Kurs krzyżowy podajemy w cyfrach znaczących, nie w miejscach po przecinku.
 *
 * Miejsca po przecinku sprawdzają się źle przy obu krańcach: dla kursu koło
 * jedności dawały ścianę zer i cyfr, a dla walut o małej wartości jednostkowej
 * ucinały wynik do zera. Osiem cyfr znaczących wystarcza, żeby pomnożenie
 * kwoty przez ten kurs odtworzyło wynik, i czyta się w obu przypadkach.
 */
const formatKrzyzowego = new Intl.NumberFormat('pl-PL', { maximumSignificantDigits: 8 });

export function ResultPanel({ wynik }: { wynik: Przeliczenie }) {
  const { kurs, kursDocelowy } = wynik;
  const przezZlotego = kursDocelowy !== null;

  return (
    <section className="card">
      <h2>Wynik przeliczenia</h2>

      <div className="big-result">
        <span className="big-result__value">
          {przezZlotego
            ? `${formatAmount(wynik.wynikDocelowy!)} ${kursDocelowy.kod}`
            : formatPln(wynik.wynikPln)}
        </span>
        <span className="big-result__label">
          za {formatAmount(wynik.kwota)} {kurs.kod}
        </span>
      </div>

      <table className="figures">
        <tbody>
          <tr>
            <th scope="row">
              Kurs {kurs.kod}
              <span className={`pill pill--${kurs.tabela.toLowerCase()}`}>{kurs.numerTabeli}</span>
              <span className="row-note">tabela z {poPolsku(kurs.dataTabeli)}</span>
            </th>
            <td>{formatKursu.format(kurs.kurs)} zł</td>
          </tr>

          {przezZlotego ? (
            <>
              <tr className="row-total">
                <th scope="row">
                  Wartość w złotych
                  <span className="row-note">ta kwota trafia do ksiąg</span>
                </th>
                <td>{formatPln(wynik.wynikPln)}</td>
              </tr>
              <tr>
                <th scope="row">
                  Kurs {kursDocelowy.kod}
                  <span className={`pill pill--${kursDocelowy.tabela.toLowerCase()}`}>
                    {kursDocelowy.numerTabeli}
                  </span>
                  <span className="row-note">tabela z {poPolsku(kursDocelowy.dataTabeli)}</span>
                </th>
                <td>{formatKursu.format(kursDocelowy.kurs)} zł</td>
              </tr>
              <tr>
                <th scope="row">
                  Kurs krzyżowy
                  <span className="row-note">
                    {kurs.kod} na {kursDocelowy.kod}, wyliczony przez złotego
                  </span>
                </th>
                <td>{formatKrzyzowego.format(wynik.kursKrzyzowy!)}</td>
              </tr>
            </>
          ) : null}
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
            <th scope="row">{przezZlotego ? `Kwota w ${kursDocelowy.kod}` : 'Kwota w złotych'}</th>
            <td>
              {przezZlotego
                ? `${formatAmount(wynik.wynikDocelowy!)} ${kursDocelowy.kod}`
                : formatPln(wynik.wynikPln)}
            </td>
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
          {formatAmount(wynik.kwota)} {kurs.kod}.
        </li>
        <li>
          Na dowodzie opisz kurs: {formatKursu.format(kurs.kurs)} zł za 1 {kurs.kod}, tabela{' '}
          {kurs.numerTabeli} z {poPolsku(kurs.dataTabeli)}.
        </li>
        {przezZlotego ? (
          <li>
            Przeliczenie na {kursDocelowy.kod} prowadzi przez złotego: {formatPln(wynik.wynikPln)}{' '}
            podzielone przez {formatKursu.format(kursDocelowy.kurs)} zł daje{' '}
            <strong>
              {formatAmount(wynik.wynikDocelowy!)} {kursDocelowy.kod}
            </strong>
            .{' '}
            {kurs.numerTabeli === kursDocelowy.numerTabeli
              ? `Obie waluty pochodzą z tej samej tabeli ${kurs.numerTabeli}.`
              : `Opisz obie tabele — ${kurs.numerTabeli} oraz ${kursDocelowy.numerTabeli}.`}
          </li>
        ) : null}
        <li>
          Różnice kursowe rozliczysz przy zapłacie, według kursu z dnia poprzedzającego tamto
          zdarzenie.
        </li>
      </ul>

      <details className="legal-box">
        <summary>Podstawa prawna</summary>
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
        <p className="legal-box__note">
          Kursy pochodzą bezpośrednio z serwisu NBP. Wynik jest wyliczeniem pomocniczym, nie poradą
          podatkową — przy transakcjach nietypowych, zaliczkach i różnicach kursowych obowiązują
          zasady właściwe dla danego zdarzenia.
        </p>
      </details>
    </section>
  );
}
