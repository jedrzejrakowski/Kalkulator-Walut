import { createPortal } from 'react-dom';
import { poPolsku } from '../domain/dates';
import { formatAmount, formatKurs, formatPln } from '../domain/money';
import { METODA, PODSTAWA, nazwaPliku, type Zestawienie } from '../domain/zestawienie';

/**
 * Zestawienie w postaci do druku i do zapisu jako PDF.
 *
 * Renderowane poza drzewem aplikacji, prosto do `body`: przy drukowaniu
 * zestawienia chowamy całą resztę strony, a to łatwe tylko wtedy, gdy
 * dokument jest jej rodzeństwem, a nie potomkiem.
 */
export function ZestawienieDruk({ z }: { z: Zestawienie }) {
  const zakres = z.od && z.doDnia ? `zdarzenia od ${poPolsku(z.od)} do ${poPolsku(z.doDnia)} · ` : '';

  return createPortal(
    <div className="druk" aria-hidden="true">
      <header className="druk__naglowek">
        <h1>{z.tytul}</h1>
        <p>
          Sporządzono {poPolsku(z.sporzadzono)} · {zakres}pozycji: {z.wiersze.length}
        </p>
      </header>

      <table className="druk__tabela">
        <thead>
          <tr>
            <th className="druk__lp">Lp.</th>
            <th>Data zdarzenia</th>
            <th className="druk__liczba">Kwota</th>
            <th>Waluta</th>
            <th className="druk__liczba">Kurs NBP (zł)</th>
            <th>Tabela NBP</th>
            <th>Data tabeli</th>
            <th className="druk__liczba">Wartość (zł)</th>
          </tr>
        </thead>
        <tbody>
          {z.wiersze.map((w) => (
            <tr key={w.lp}>
              <td className="druk__lp">{w.lp}</td>
              <td>{poPolsku(w.data)}</td>
              <td className="druk__liczba">{formatAmount(w.kwota)}</td>
              <td>{w.waluta}</td>
              <td className="druk__liczba">{formatKurs(w.kurs)}</td>
              <td>{w.numerTabeli}</td>
              <td>{poPolsku(w.dataTabeli)}</td>
              <td className="druk__liczba">{formatAmount(w.wartoscPln)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Podsumowanie trzymane w całości na jednej stronie — rozerwane
          między strony traci sens jako zamknięcie dokumentu. */}
      <section className="druk__podsumowanie">
        <h2>Podsumowanie według walut</h2>
        <table className="druk__tabela druk__tabela--sumy">
          <thead>
            <tr>
              <th>Waluta</th>
              <th className="druk__liczba">Pozycji</th>
              <th className="druk__liczba">Kwota w walucie</th>
              <th className="druk__liczba">Wartość (zł)</th>
            </tr>
          </thead>
          <tbody>
            {z.sumy.map((s) => (
              <tr key={s.waluta}>
                <td>{s.waluta}</td>
                <td className="druk__liczba">{s.liczba}</td>
                <td className="druk__liczba">{formatAmount(s.kwota)}</td>
                <td className="druk__liczba">{formatAmount(s.wartoscPln)}</td>
              </tr>
            ))}
            {/* Zwykły wiersz, a nie <tfoot>: stopkę tabeli Chromium przy druku
                przenosił na osobną stronę razem z powtórzonym nagłówkiem. */}
            <tr className="druk__razem">
              <th colSpan={3}>Razem</th>
              <th className="druk__liczba">{formatPln(z.razemPln)}</th>
            </tr>
          </tbody>
        </table>

        <p className="druk__przypis">{PODSTAWA}</p>
        <p className="druk__przypis">{METODA}</p>
      </section>
    </div>,
    document.body,
  );
}

/**
 * Otwiera okno drukowania z samym zestawieniem.
 *
 * Tytuł strony podmieniamy na czas drukowania, bo z niego przeglądarka bierze
 * domyślną nazwę pliku przy „Zapisz jako PDF" — zamiast „Kalkulator walut.pdf"
 * dostaje Pan nazwę z tytułu zestawienia i datą.
 */
export function drukujZestawienie(z: Zestawienie) {
  const tytulStrony = document.title;
  const posprzataj = () => {
    document.body.classList.remove('drukuje-zestawienie');
    document.title = tytulStrony;
    window.removeEventListener('afterprint', posprzataj);
  };
  document.title = nazwaPliku(z, 'pdf').replace(/\.pdf$/, '');
  document.body.classList.add('drukuje-zestawienie');
  window.addEventListener('afterprint', posprzataj);
  window.print();
}
