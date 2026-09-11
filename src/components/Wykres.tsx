import { useEffect, useId, useRef, useState } from 'react';
import { poPolsku } from '../domain/dates';
import type { Seria } from '../domain/nbp';
import {
  najblizszy, osPionowa, podpisyOsi, pionowo, poziomo, ramka, sciezka, wypelnienie,
} from '../domain/wykres';

/**
 * Szerokość kontenera w pikselach. Bez niej rysowalibyśmy w stałej ramce,
 * a przeglądarka przeskalowałaby wykres razem z podpisami osi.
 */
function useSzerokosc(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [szerokosc, setSzerokosc] = useState(620);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const obserwator = new ResizeObserver(([wpis]) => {
      if (wpis) setSzerokosc(wpis.contentRect.width);
    });
    obserwator.observe(element);
    return () => obserwator.disconnect();
  }, []);

  return [ref, szerokosc];
}

const formatKursu = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 8,
});

/** Krótszy podpis osi: sam dzień i miesiąc, bo rok powtarza się w każdym punkcie. */
const dzienMiesiac = (data: string) => data.slice(8) + '.' + data.slice(5, 7);

interface Props {
  seria: Seria;
  /** Dzień, z którego pochodzi kurs użyty do księgowania. */
  dataKsiegowania?: string;
}

export function Wykres({ seria, dataKsiegowania }: Props) {
  const [wskazany, setWskazany] = useState<number | null>(null);
  const [ref, szerokosc] = useSzerokosc();
  const idWypelnienia = useId();
  const { punkty } = seria;

  const RAMKA = ramka(szerokosc);

  const { kreski, zakres } = osPionowa(punkty);
  const indeksKsiegowania = dataKsiegowania
    ? punkty.findIndex((p) => p.data === dataKsiegowania)
    : -1;

  const aktywny = wskazany ?? (indeksKsiegowania >= 0 ? indeksKsiegowania : punkty.length - 1);
  const punktAktywny = punkty[aktywny];

  const x = (i: number) => poziomo(i, punkty.length, RAMKA);
  const y = (v: number) => pionowo(v, zakres, RAMKA);

  return (
    <div className="wykres" ref={ref}>
      <svg
        viewBox={`0 0 ${RAMKA.szerokosc} ${RAMKA.wysokosc}`}
        role="img"
        aria-label={`Przebieg kursu ${seria.kod} w złotych, ${punkty.length} notowań`}
        onMouseLeave={() => setWskazany(null)}
        onMouseMove={(e) => {
          const pole = e.currentTarget.getBoundingClientRect();
          const wX = ((e.clientX - pole.left) / pole.width) * RAMKA.szerokosc;
          setWskazany(najblizszy(wX, punkty.length, RAMKA));
        }}
      >
        <defs>
          <linearGradient id={idWypelnienia} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.20" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Siatka recesywna — ma orientować, nie rywalizować z danymi. */}
        {kreski.map((k) => (
          <g key={k}>
            <line
              x1={RAMKA.lewo} y1={y(k)} x2={RAMKA.szerokosc - RAMKA.prawo} y2={y(k)}
              className="wykres__siatka"
            />
            <text x={RAMKA.lewo - 8} y={y(k)} className="wykres__opis wykres__opis--y">
              {formatKursu.format(k)}
            </text>
          </g>
        ))}

        {podpisyOsi(punkty.length, RAMKA.szerokosc < 420 ? 3 : 5).map((i) => (
          <text
            key={i}
            x={x(i)}
            y={RAMKA.wysokosc - 10}
            className="wykres__opis wykres__opis--x"
            // Skrajne podpisy kotwiczymy do krawędzi pola, bo wyśrodkowane
            // wychodziłyby poza rysunek i przeglądarka by je ucięła.
            textAnchor={i === 0 ? 'start' : i === punkty.length - 1 ? 'end' : 'middle'}
          >
            {dzienMiesiac(punkty[i]!.data)}
          </text>
        ))}

        <path d={wypelnienie(punkty, zakres, RAMKA)} fill={`url(#${idWypelnienia})`} />
        <path d={sciezka(punkty, zakres, RAMKA)} className="wykres__linia" />

        {indeksKsiegowania >= 0 ? (
          <g>
            <line
              x1={x(indeksKsiegowania)} y1={RAMKA.gora}
              x2={x(indeksKsiegowania)} y2={RAMKA.wysokosc - RAMKA.dol}
              className="wykres__ksiegowanie"
            />
            <circle
              cx={x(indeksKsiegowania)} cy={y(punkty[indeksKsiegowania]!.kurs)} r="5.5"
              className="wykres__punkt wykres__punkt--ksiegowanie"
            />
          </g>
        ) : null}

        {punktAktywny && wskazany !== null ? (
          <g>
            <line
              x1={x(aktywny)} y1={RAMKA.gora} x2={x(aktywny)} y2={RAMKA.wysokosc - RAMKA.dol}
              className="wykres__celownik"
            />
            <circle cx={x(aktywny)} cy={y(punktAktywny.kurs)} r="5" className="wykres__punkt" />
          </g>
        ) : null}
      </svg>

      {punktAktywny ? (
        <p className="wykres__odczyt">
          <strong>{formatKursu.format(punktAktywny.kurs)} zł</strong> za 1 {seria.kod} —{' '}
          {poPolsku(punktAktywny.data)}
          {aktywny === indeksKsiegowania && wskazany === null ? (
            <span className="wykres__znacznik">kurs użyty do księgowania</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
