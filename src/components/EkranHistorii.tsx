import { useState } from 'react';
import { poPolsku } from '../domain/dates';
import { LIMIT, opisDoSchowka, type Wpis } from '../domain/historia';
import { formatAmount, formatKurs, formatPln } from '../domain/money';

interface Props {
  historia: Wpis[];
  onUsun: (id: number) => void;
  onWyczysc: () => void;
  onPowrot: () => void;
}

export function EkranHistorii({ historia, onUsun, onWyczysc, onPowrot }: Props) {
  // Potwierdzenie przy czyszczeniu całości: pojedynczy wpis da się odtworzyć
  // jednym przeliczeniem, całej historii już nie.
  const [pytamOCzyszczenie, setPytamOCzyszczenie] = useState(false);
  const [skopiowany, setSkopiowany] = useState<number | null>(null);

  async function kopiuj(wpis: Wpis) {
    try {
      await navigator.clipboard.writeText(opisDoSchowka(wpis.przeliczenie));
      setSkopiowany(wpis.id);
      window.setTimeout(() => setSkopiowany((n) => (n === wpis.id ? null : n)), 2000);
    } catch {
      // Schowek bywa zablokowany przez politykę przeglądarki — tekst zostaje
      // widoczny w wierszu, więc da się go zaznaczyć ręcznie.
      setSkopiowany(null);
    }
  }

  return (
    <section className="card kol-historia">
      <div className="historia__belka">
        <h2>Historia przeliczeń</h2>
        {historia.length > 0 ? (
          pytamOCzyszczenie ? (
            <span className="historia__pytanie">
              Usunąć wszystkie {historia.length}?
              <button type="button" className="link link--ostrzegawczy" onClick={onWyczysc}>
                Tak, wyczyść
              </button>
              <button type="button" className="link" onClick={() => setPytamOCzyszczenie(false)}>
                Anuluj
              </button>
            </span>
          ) : (
            <button type="button" className="link" onClick={() => setPytamOCzyszczenie(true)}>
              Wyczyść historię
            </button>
          )
        ) : null}
      </div>

      {historia.length === 0 ? (
        <p className="placeholder">
          Tu trafią przeliczenia, które wykonasz.{' '}
          <button type="button" className="link" onClick={onPowrot}>
            Wróć do przeliczania
          </button>
          .
        </p>
      ) : (
        <>
          <div className="historia__box">
            <table className="historia">
              <thead>
                <tr>
                  <th scope="col">Zdarzenie</th>
                  <th scope="col">Kwota</th>
                  <th scope="col">Kurs</th>
                  <th scope="col">Tabela</th>
                  <th scope="col" className="historia__prawa">Wynik</th>
                  <th scope="col"><span className="sr-only">Działania</span></th>
                </tr>
              </thead>
              <tbody>
                {historia.map((w) => {
                  const { przeliczenie: p } = w;
                  const cel = p.kursDocelowy;
                  return (
                    <tr key={w.id}>
                      <td className="historia__data" data-etykieta="Zdarzenie">
                        <span className="historia__wartosc">{poPolsku(p.dataZdarzenia)}</span>
                      </td>
                      <td data-etykieta="Kwota">
                        <span className="historia__wartosc">
                          {formatAmount(p.kwota)} <strong>{p.kurs.kod}</strong>
                          {cel ? <span className="historia__cel"> → {cel.kod}</span> : null}
                        </span>
                      </td>
                      <td className="historia__kurs" data-etykieta="Kurs">
                        <span className="historia__wartosc">
                          {formatKurs(p.kurs.kurs)} zł
                          {cel ? (
                            <span className="historia__cel"> / {formatKurs(cel.kurs)} zł</span>
                          ) : null}
                        </span>
                      </td>
                      <td className="historia__tabela" data-etykieta="Tabela">
                        <span className="historia__wartosc">
                          {p.kurs.numerTabeli}
                          {cel && cel.numerTabeli !== p.kurs.numerTabeli ? (
                            <span className="historia__cel"> + {cel.numerTabeli}</span>
                          ) : null}
                          <span className="historia__zdnia">z {poPolsku(p.kurs.dataTabeli)}</span>
                        </span>
                      </td>
                      <td className="historia__prawa historia__wynik" data-etykieta="Wynik">
                        <span className="historia__wartosc">
                          {cel && p.wynikDocelowy !== null ? (
                            <>
                              <strong>
                                {formatAmount(p.wynikDocelowy)} {cel.kod}
                              </strong>
                              <span className="historia__zdnia">{formatPln(p.wynikPln)}</span>
                            </>
                          ) : (
                            <strong>{formatPln(p.wynikPln)}</strong>
                          )}
                        </span>
                      </td>
                      <td className="historia__prawa">
                        <button
                          type="button"
                          className="link"
                          onClick={() => void kopiuj(w)}
                          title="Kopiuje opis gotowy do wklejenia na dowód"
                        >
                          {skopiowany === w.id ? 'Skopiowano' : 'Kopiuj opis'}
                        </button>
                        <button
                          type="button"
                          className="link link--ostrzegawczy"
                          onClick={() => onUsun(w.id)}
                          aria-label={`Usuń przeliczenie z ${poPolsku(p.dataZdarzenia)}`}
                        >
                          Usuń
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="field-hint">
            Najnowsze przeliczenia na górze; przechowujemy najwyżej {LIMIT} ostatnich, teraz
            jest ich {historia.length}. Historia siedzi w tej przeglądarce, na tym komputerze —
            nigdzie nie jest wysyłana i zniknie razem z danymi witryny. To notatnik pomocniczy,
            a nie dokumentacja księgowa.
          </p>
        </>
      )}
    </section>
  );
}
