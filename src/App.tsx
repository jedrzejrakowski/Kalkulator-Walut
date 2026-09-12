import { useEffect, useState } from 'react';
import { CurrencyPicker } from './components/CurrencyPicker';
import { Logo } from './components/Logo';
import { PanelUstawien } from './components/PanelUstawien';
import { DateField, NumberField } from './components/fields';
import { KartaWykresu } from './components/KartaWykresu';
import { ResultPanel } from './components/ResultPanel';
import { WalutaDocelowa } from './components/WalutaDocelowa';
import { TitleBar } from './components/TitleBar';
import { przelicz, ZLOTY } from './domain/convert';
import { dzisiaj, poPolsku, poprzedniDzienRoboczy } from './domain/dates';
import { pobierzWaluty } from './domain/nbp';
import { wczytaj, zapisz, zastosuj, type Ustawienia } from './domain/ustawienia';
import type { Przeliczenie, Waluta } from './domain/types';

export default function App() {
  const [waluty, setWaluty] = useState<Waluta[]>([]);
  const [bladWalut, setBladWalut] = useState<string | null>(null);
  const [kod, setKod] = useState('EUR');
  const [kodDocelowy, setKodDocelowy] = useState(ZLOTY);
  const [kwota, setKwota] = useState(0);
  const [data, setData] = useState(() => dzisiaj());

  const [ustawienia, setUstawienia] = useState<Ustawienia>(wczytaj);
  const [panelOtwarty, setPanelOtwarty] = useState(false);

  const [wynik, setWynik] = useState<Przeliczenie | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [liczenie, setLiczenie] = useState(false);

  // Ustawienia przenosimy do zmiennych CSS i nasłuchujemy zmiany motywu systemu,
  // bo przy wyborze „jak w systemie" paleta musi za nim podążać.
  useEffect(() => {
    const pytanie = window.matchMedia('(prefers-color-scheme: dark)');
    const nanieś = () => zastosuj(ustawienia, document.documentElement, pytanie.matches);
    nanieś();
    zapisz(ustawienia);
    pytanie.addEventListener('change', nanieś);
    return () => pytanie.removeEventListener('change', nanieś);
  }, [ustawienia]);

  useEffect(() => {
    let aktualne = true;
    pobierzWaluty()
      .then((lista) => aktualne && setWaluty(lista))
      .catch((e: Error) => aktualne && setBladWalut(e.message));
    return () => {
      aktualne = false;
    };
  }, []);

  // Ta sama waluta po obu stronach nie ma sensu — cel wraca wtedy do złotego.
  useEffect(() => {
    if (kodDocelowy === kod) setKodDocelowy(ZLOTY);
  }, [kod, kodDocelowy]);

  const gotowe = kwota > 0 && kod.trim().length === 3 && data !== '';

  async function policz() {
    setLiczenie(true);
    setBlad(null);
    try {
      setWynik(await przelicz(kwota, kod.trim().toUpperCase(), data, kodDocelowy));
    } catch (e) {
      setWynik(null);
      setBlad(e instanceof Error ? e.message : 'Nie udało się pobrać kursu.');
    } finally {
      setLiczenie(false);
    }
  }

  return (
    <>
      <TitleBar />
      <div className="page">
        <header className="page-header">
          <Logo size={64} className="page-header__mark" />
          <h1>Kalkulator walut</h1>
          <span className="page-header__sub">Kursy średnie NBP</span>
          <button
            type="button"
            className="zebatka"
            onClick={() => setPanelOtwarty(true)}
            aria-label="Ustawienia wyglądu"
            title="Ustawienia wyglądu"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .33 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.33 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.53 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.33-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.53 1.7 1.7 0 0 0 10 2.98V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.33 1.87V10a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
            </svg>
          </button>
        </header>

        <PanelUstawien
          otwarty={panelOtwarty}
          ustawienia={ustawienia}
          onZmiana={setUstawienia}
          onZamknij={() => setPanelOtwarty(false)}
        />

        <div className="layout">
          <div className="kol-formularz">
        <section className="card">
          <h2>Transakcja</h2>

          <NumberField
            label="Kwota w walucie obcej"
            value={kwota}
            onChange={setKwota}
            suffix={kod || '—'}
          />

          {waluty.length > 0 ? (
            <CurrencyPicker waluty={waluty} wybrany={kod} onWybor={setKod} />
          ) : (
            <label className="field">
              <span className="field-label">Waluta</span>
              <input
                type="text"
                value={kod}
                maxLength={3}
                placeholder="EUR"
                onChange={(e) => setKod(e.target.value.toUpperCase())}
              />
              <span className="field-hint">
                {bladWalut
                  ? 'Lista walut niedostępna — wpisz trzyliterowy kod ręcznie.'
                  : 'Pobieranie listy walut z NBP…'}
              </span>
            </label>
          )}

          <WalutaDocelowa
            waluty={waluty}
            pomin={kod}
            wybrany={kodDocelowy}
            onWybor={setKodDocelowy}
            hint={
              kodDocelowy === ZLOTY
                ? 'Wynik w złotych, tak jak wymaga tego dowód księgowy.'
                : `Przeliczenie ${kod} na ${kodDocelowy} prowadzi przez złotego — tak ogłasza kursy NBP i tego wymaga art. 11a ust. 2 ustawy o PIT.`
            }
          />

          <DateField
            label="Data zdarzenia gospodarczego"
            value={data}
            max={dzisiaj()}
            onChange={setData}
            hint={
              data
                ? `Kurs zostanie pobrany z ${poPolsku(poprzedniDzienRoboczy(data))} lub z ostatniej wcześniejszej tabeli.`
                : undefined
            }
          />

          <button type="button" className="primary" disabled={!gotowe || liczenie} onClick={policz}>
            {liczenie
              ? 'Pobieranie kursu z NBP…'
              : `Przelicz na ${kodDocelowy === ZLOTY ? 'złote' : kodDocelowy}`}
          </button>
        </section>
          </div>

          <div className="kol-wynik results">
            {blad ? (
              <section className="card">
                <p className="error" role="alert">
                  {blad}
                </p>
              </section>
            ) : wynik ? (
              <ResultPanel wynik={wynik} />
            ) : (
              <section className="card">
                <h2>Wynik przeliczenia</h2>
                <p className="placeholder">
                  Wpisz kwotę, wskaż walutę i datę, a następnie kliknij „Przelicz na złote”.
                </p>
              </section>
            )}
          </div>

          {/* Wykres w osobnej kolumnie, a nie pod wynikiem: inaczej strona rośnie
              na dwa ekrany i trzeba przewijać, żeby go w ogóle zobaczyć. */}
          <div className="kol-wykres">
            {wynik ? (
              <KartaWykresu
                kod={wynik.kurs.kod}
                doDnia={wynik.dataWymagana}
                dataKsiegowania={wynik.kurs.dataTabeli}
              />
            ) : (
              <section className="card">
                <h2>Kurs w czasie</h2>
                <p className="placeholder">
                  Po przeliczeniu pojawi się tu przebieg kursu z ostatnich miesięcy.
                </p>
              </section>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
