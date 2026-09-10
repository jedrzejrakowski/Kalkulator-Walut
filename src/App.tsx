import { useEffect, useState } from 'react';
import { CurrencyPicker } from './components/CurrencyPicker';
import { Logo } from './components/Logo';
import { DateField, NumberField } from './components/fields';
import { ResultPanel } from './components/ResultPanel';
import { TitleBar } from './components/TitleBar';
import { przelicz } from './domain/convert';
import { dzisiaj, poPolsku, poprzedniDzienRoboczy } from './domain/dates';
import { pobierzWaluty } from './domain/nbp';
import type { Przeliczenie, Waluta } from './domain/types';

export default function App() {
  const [waluty, setWaluty] = useState<Waluta[]>([]);
  const [bladWalut, setBladWalut] = useState<string | null>(null);
  const [kod, setKod] = useState('EUR');
  const [kwota, setKwota] = useState(0);
  const [data, setData] = useState(() => dzisiaj());

  const [wynik, setWynik] = useState<Przeliczenie | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [liczenie, setLiczenie] = useState(false);

  useEffect(() => {
    let aktualne = true;
    pobierzWaluty()
      .then((lista) => aktualne && setWaluty(lista))
      .catch((e: Error) => aktualne && setBladWalut(e.message));
    return () => {
      aktualne = false;
    };
  }, []);

  const gotowe = kwota > 0 && kod.trim().length === 3 && data !== '';

  async function policz() {
    setLiczenie(true);
    setBlad(null);
    try {
      setWynik(await przelicz(kwota, kod.trim().toUpperCase(), data));
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
        </header>

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
            {liczenie ? 'Pobieranie kursu z NBP…' : 'Przelicz na złote'}
          </button>
        </section>

        {blad ? (
          <section className="card">
            <p className="error" role="alert">
              {blad}
            </p>
          </section>
        ) : null}

        {wynik ? <ResultPanel wynik={wynik} /> : null}

        <p className="disclaimer">
          Kursy pochodzą bezpośrednio z serwisu NBP. Wynik jest wyliczeniem pomocniczym, nie poradą
          podatkową — przy transakcjach nietypowych, zaliczkach i różnicach kursowych sprawdź zasady
          właściwe dla danego zdarzenia.
        </p>
      </div>
    </>
  );
}
