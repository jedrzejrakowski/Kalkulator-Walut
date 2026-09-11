import { useEffect, useState } from 'react';
import { poPolsku, przesun, type DataIso } from '../domain/dates';
import { pobierzSerie, type Seria } from '../domain/nbp';
import { Wykres } from './Wykres';

const ZAKRESY = [
  { dni: 30, nazwa: '30 dni' },
  { dni: 90, nazwa: '90 dni' },
  { dni: 365, nazwa: 'Rok' },
] as const;

const formatKursu = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 8,
});

interface Props {
  kod: string;
  /** Koniec okresu: dzień, z którego pochodzi kurs użyty do księgowania. */
  doDnia: DataIso;
  dataKsiegowania: DataIso;
}

export function KartaWykresu({ kod, doDnia, dataKsiegowania }: Props) {
  const [dni, setDni] = useState<number>(90);
  const [seria, setSeria] = useState<Seria | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [ladowanie, setLadowanie] = useState(false);

  useEffect(() => {
    let aktualne = true;
    setLadowanie(true);
    setBlad(null);
    pobierzSerie(kod, przesun(doDnia, -dni), doDnia)
      .then((s) => aktualne && setSeria(s))
      .catch((e: Error) => {
        if (!aktualne) return;
        setSeria(null);
        setBlad(e.message);
      })
      .finally(() => aktualne && setLadowanie(false));
    return () => {
      aktualne = false;
    };
  }, [kod, doDnia, dni]);

  return (
    <section className="card">
      <h2>Kurs {kod} w czasie</h2>

      <div className="zakresy" role="group" aria-label="Zakres okresu">
        {ZAKRESY.map((z) => (
          <button
            key={z.dni}
            type="button"
            aria-pressed={dni === z.dni}
            onClick={() => setDni(z.dni)}
          >
            {z.nazwa}
          </button>
        ))}
      </div>

      {blad ? (
        <p className="error" role="alert">
          {blad}
        </p>
      ) : ladowanie && !seria ? (
        <p className="placeholder">Pobieranie notowań z NBP…</p>
      ) : seria ? (
        <>
          <Wykres seria={seria} dataKsiegowania={dataKsiegowania} />

          <p className="field-hint" style={{ marginTop: 10 }}>
            {seria.punkty.length} notowań z tabeli {seria.tabela}
            {seria.tabela === 'B'
              ? ' — ogłaszanej raz w tygodniu, stąd rzadsze punkty.'
              : ' — ogłaszanej w każdy dzień roboczy.'}{' '}
            Przerywana pionowa kreska wskazuje kurs użyty do księgowania.
          </p>

          <details className="legal-box">
            <summary>Notowania w tabeli</summary>
            <div className="szereg-box">
              <table className="szereg">
                <thead>
                  <tr>
                    <th scope="col">Data tabeli</th>
                    <th scope="col" style={{ textAlign: 'right' }}>
                      Kurs
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...seria.punkty].reverse().map((p) => (
                    <tr key={p.data}>
                      <th scope="row">{poPolsku(p.data)}</th>
                      <td>{formatKursu.format(p.kurs)} zł</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : null}
    </section>
  );
}
