import { useMemo, useState } from 'react';
import { dzisiaj, poPolsku } from '../domain/dates';
import { TYP_XLSX, plikXlsx } from '../domain/xlsx';
import {
  TYTUL_DOMYSLNY, kolejnoscZestawienia, nazwaPliku, zestawienie,
} from '../domain/zestawienie';
import { ZestawienieDruk, drukujZestawienie } from './ZestawienieDruk';
import {
  LIMIT, UKLAD_DOMYSLNY, czyZmieniony, opisDoSchowka, ulozHistorie, uzyteWaluty,
  type Klucz, type Uklad, type Wpis,
} from '../domain/historia';
import { formatAmount, formatKurs, formatPln } from '../domain/money';

interface Props {
  historia: Wpis[];
  onUsun: (id: number) => void;
  onWyczysc: () => void;
  onPowrot: () => void;
}

const KLUCZ_ORIENTACJI = 'kalkulator-walut-orientacja-pdf';

/** Ostatnio wybrana orientacja PDF — domyślnie pion, bo mieści więcej wierszy. */
function czytajOrientacje(): boolean {
  try {
    return localStorage.getItem(KLUCZ_ORIENTACJI) === 'poziom';
  } catch {
    return false;
  }
}

export function EkranHistorii({ historia, onUsun, onWyczysc, onPowrot }: Props) {
  // Potwierdzenie przy czyszczeniu całości: pojedynczy wpis da się odtworzyć
  // jednym przeliczeniem, całej historii już nie.
  const [pytamOCzyszczenie, setPytamOCzyszczenie] = useState(false);
  const [skopiowany, setSkopiowany] = useState<number | null>(null);
  const [uklad, setUklad] = useState<Uklad>(UKLAD_DOMYSLNY);
  const [tytul, setTytul] = useState('');
  const [poziomo, setPoziomo] = useState(czytajOrientacje);

  function ustawOrientacje(nowa: boolean) {
    setPoziomo(nowa);
    try {
      localStorage.setItem(KLUCZ_ORIENTACJI, nowa ? 'poziom' : 'pion');
    } catch {
      // Bez zapisu wybór i tak działa do zamknięcia okna.
    }
  }

  const waluty = useMemo(() => uzyteWaluty(historia), [historia]);
  const widoczne = useMemo(() => ulozHistorie(historia, uklad), [historia, uklad]);

  // Zestawienie obejmuje dokładnie to, co widać po filtrach — tak wyodrębnia
  // się jeden wyjazd: waluty, zakres dat, i gotowe.
  const dokument = useMemo(
    () => zestawienie(kolejnoscZestawienia(widoczne, uklad), tytul, dzisiaj()),
    [widoczne, uklad, tytul],
  );

  function pobierzExcel() {
    const url = URL.createObjectURL(new Blob([plikXlsx(dokument).slice()], { type: TYP_XLSX }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nazwaPliku(dokument, 'xlsx');
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Adres zwalniamy z opóźnieniem — część przeglądarek zaczyna pobieranie
    // dopiero po powrocie z obsługi kliknięcia.
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /**
   * Kliknięcie w nagłówek: rosnąco, malejąco, a za trzecim razem z powrotem
   * do kolejności liczenia. Bez trzeciego kroku nie dałoby się wrócić do stanu
   * wyjściowego inaczej niż przez przeładowanie.
   */
  function sortuj(klucz: Klucz) {
    setUklad((p) => {
      if (p.klucz !== klucz) return { ...p, klucz, kierunek: 'rosnaco' };
      if (p.kierunek === 'rosnaco') return { ...p, kierunek: 'malejaco' };
      return { ...p, klucz: 'zapis', kierunek: 'malejaco' };
    });
  }

  const kierunekOpisowo = (klucz: Klucz) =>
    uklad.klucz !== klucz ? 'none' : uklad.kierunek === 'rosnaco' ? 'ascending' : 'descending';

  function Naglowek({ klucz, children }: { klucz: Klucz; children: React.ReactNode }) {
    const czynny = uklad.klucz === klucz;
    return (
      <th scope="col" aria-sort={kierunekOpisowo(klucz)} className={klucz === 'wynik' ? 'historia__prawa' : undefined}>
        <button
          type="button"
          className={`historia__sort${czynny ? ' historia__sort--czynny' : ''}`}
          onClick={() => sortuj(klucz)}
        >
          {children}
          <span className="historia__strzalka" aria-hidden="true">
            {czynny ? (uklad.kierunek === 'rosnaco' ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    );
  }

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

      {historia.length > 0 ? (
        <div className="historia__narzedzia">
          <label className="historia__filtr">
            <span>Waluta</span>
            <select
              value={uklad.waluta ?? ''}
              onChange={(e) => setUklad((p) => ({ ...p, waluta: e.target.value || null }))}
            >
              <option value="">Wszystkie ({historia.length})</option>
              {waluty.map((w) => (
                <option key={w.kod} value={w.kod}>
                  {w.kod} ({w.ile})
                </option>
              ))}
            </select>
          </label>
          {/* Zakres dat po dacie zdarzenia — tak wyodrębnia się jeden wyjazd. */}
          <div className="historia__zakres">
            <label className="historia__filtr">
              <span>Od</span>
              <input
                type="date"
                value={uklad.od ?? ''}
                max={uklad.doDnia ?? undefined}
                onChange={(e) => setUklad((p) => ({ ...p, od: e.target.value || null }))}
              />
            </label>
            <label className="historia__filtr">
              <span>do</span>
              <input
                type="date"
                value={uklad.doDnia ?? ''}
                min={uklad.od ?? undefined}
                onChange={(e) => setUklad((p) => ({ ...p, doDnia: e.target.value || null }))}
              />
            </label>
          </div>

          {/* Na wąskim ekranie wiersze stają się kafelkami, więc nagłówków
              tabeli nie ma w co kliknąć — sortowanie dostaje własne pole. */}
          <label className="historia__sortuj">
            <span>Kolejność</span>
            <select
              value={uklad.klucz === 'zapis' ? 'zapis' : `${uklad.klucz}:${uklad.kierunek}`}
              onChange={(e) => {
                const [klucz, kierunek] = e.target.value.split(':');
                setUklad((p) => ({
                  ...p,
                  klucz: klucz as Klucz,
                  kierunek: (kierunek as Uklad['kierunek']) ?? 'malejaco',
                }));
              }}
            >
              <option value="zapis">Kolejność liczenia</option>
              <option value="data:malejaco">Zdarzenie — od najnowszego</option>
              <option value="data:rosnaco">Zdarzenie — od najstarszego</option>
              <option value="kwota:malejaco">Kwota — malejąco</option>
              <option value="kwota:rosnaco">Kwota — rosnąco</option>
              <option value="wynik:malejaco">Wynik w zł — malejąco</option>
              <option value="wynik:rosnaco">Wynik w zł — rosnąco</option>
            </select>
          </label>

          {czyZmieniony(uklad) ? (
            <button type="button" className="link" onClick={() => setUklad(UKLAD_DOMYSLNY)}>
              Wyczyść układ
            </button>
          ) : null}
        </div>
      ) : null}

      {widoczne.length > 0 ? (
        <div className="eksport">
          <label className="eksport__tytul">
            <span>Tytuł zestawienia</span>
            <input
              type="text"
              value={tytul}
              placeholder={TYTUL_DOMYSLNY}
              maxLength={120}
              onChange={(e) => setTytul(e.target.value)}
            />
          </label>
          <div className="eksport__przyciski">
            <div className="orientacja" role="group" aria-label="Orientacja strony PDF">
              <button
                type="button"
                aria-pressed={!poziomo}
                title="Pionowo — więcej wierszy na stronie, mniej kartek"
                onClick={() => ustawOrientacje(false)}
              >
                <svg width="11" height="14" viewBox="0 0 11 14" aria-hidden="true">
                  <rect x="0.75" y="0.75" width="9.5" height="12.5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Pionowo
              </button>
              <button
                type="button"
                aria-pressed={poziomo}
                title="Poziomo — szersze kolumny i większa czcionka"
                onClick={() => ustawOrientacje(true)}
              >
                <svg width="14" height="11" viewBox="0 0 14 11" aria-hidden="true">
                  <rect x="0.75" y="0.75" width="12.5" height="9.5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Poziomo
              </button>
            </div>
            <button type="button" className="eksport__przycisk" onClick={() => drukujZestawienie(dokument)}>
              PDF
            </button>
            <button type="button" className="eksport__przycisk" onClick={pobierzExcel}>
              Excel
            </button>
          </div>
          <p className="eksport__opis">
            {widoczne.length === historia.length
              ? `Zestawienie obejmie wszystkie ${widoczne.length} pozycji — zawęź je walutą i zakresem dat, żeby wyodrębnić jeden wyjazd.`
              : `Zestawienie obejmie ${widoczne.length} widocznych pozycji.`}
            {uklad.klucz === 'zapis' ? ' Kolejność chronologiczna, po dacie zdarzenia.' : ' W wybranej kolejności.'}
            {' '}PDF zapisuje się w oknie drukowania: „Zapisz jako PDF".
          </p>
          <ZestawienieDruk z={dokument} poziomo={poziomo} />
        </div>
      ) : null}

      {historia.length === 0 ? (
        <p className="placeholder">
          Tu trafią przeliczenia, które wykonasz.{' '}
          <button type="button" className="link" onClick={onPowrot}>
            Wróć do przeliczania
          </button>
          .
        </p>
      ) : widoczne.length === 0 ? (
        <p className="placeholder">
          Żadne przeliczenie nie pasuje do wybranych filtrów.{' '}
          <button type="button" className="link" onClick={() => setUklad(UKLAD_DOMYSLNY)}>
            Pokaż wszystkie
          </button>
          .
        </p>
      ) : (
        <>
          <div className="historia__box">
            <table className="historia">
              <thead>
                <tr>
                  <Naglowek klucz="data">Zdarzenie</Naglowek>
                  <Naglowek klucz="kwota">Kwota</Naglowek>
                  <th scope="col">Kurs</th>
                  <th scope="col">Tabela</th>
                  <Naglowek klucz="wynik">Wynik</Naglowek>
                  <th scope="col"><span className="sr-only">Działania</span></th>
                </tr>
              </thead>
              <tbody>
                {widoczne.map((w) => {
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
            {widoczne.length < historia.length
              ? `Pokazujemy ${widoczne.length} z ${historia.length} przeliczeń. `
              : `Przechowujemy najwyżej ${LIMIT} ostatnich przeliczeń, teraz jest ich ${historia.length}. `}
            {uklad.klucz === 'kwota'
              ? 'Kwoty w różnych walutach porównują się tylko po zawężeniu do jednej z nich. '
              : uklad.klucz === 'wynik'
                ? 'Sortowanie po wyniku idzie po wartości w złotych — to jedyna liczba wspólna dla wszystkich walut. '
                : ''}
            Historia siedzi w tej przeglądarce, na tym komputerze —
            nigdzie nie jest wysyłana i zniknie razem z danymi witryny. To notatnik pomocniczy,
            a nie dokumentacja księgowa.
          </p>
        </>
      )}
    </section>
  );
}
