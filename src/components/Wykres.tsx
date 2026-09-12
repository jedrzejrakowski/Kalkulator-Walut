import { useEffect, useId, useRef, useState } from 'react';
import { poPolsku } from '../domain/dates';
import type { Seria } from '../domain/nbp';
import {
  ileKresek, najblizszy, osPionowa, podpisyOsi, pionowo, poziomo, ramka, sciezka, wypelnienie,
} from '../domain/wykres';

/**
 * Wymiary pola rysowania w pikselach. Bez nich rysowalibyśmy w stałej ramce,
 * a przeglądarka przeskalowałaby wykres razem z podpisami osi.
 *
 * Wysokość pola wynika z układu, nie z rysunku: w kolumnie karta rozciąga się
 * do wysokości sąsiadek, a wykres ma tę wysokość wypełnić. Rysunek nie wpływa
 * na wymiar pola, więc pomiar nie zapętla się z rysowaniem.
 */
function useRozmiar(): [React.RefObject<HTMLDivElement | null>, { szerokosc: number; wysokosc: number }] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [rozmiar, setRozmiar] = useState({ szerokosc: 620, wysokosc: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const obserwator = new ResizeObserver(([wpis]) => {
      if (!wpis) return;
      const { width, height } = wpis.contentRect;
      setRozmiar((poprzedni) =>
        Math.abs(poprzedni.szerokosc - width) < 1 && Math.abs(poprzedni.wysokosc - height) < 1
          ? poprzedni
          : { szerokosc: width, wysokosc: height },
      );
    });
    obserwator.observe(element);
    return () => obserwator.disconnect();
  }, []);

  return [ref, rozmiar];
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
  const [ref, rozmiar] = useRozmiar();
  const idWypelnienia = useId();
  const { punkty } = seria;

  const RAMKA = ramka(rozmiar.szerokosc, rozmiar.wysokosc);
  // Wysokość wyjściowa pola: tyle zajmie wykres, dopóki układ go nie rozciągnie.
  const wysokoscWyjsciowa = ramka(rozmiar.szerokosc).wysokosc;

  const { kreski, zakres } = osPionowa(punkty, ileKresek(RAMKA));
  const indeksKsiegowania = dataKsiegowania
    ? punkty.findIndex((p) => p.data === dataKsiegowania)
    : -1;

  const aktywny = wskazany ?? (indeksKsiegowania >= 0 ? indeksKsiegowania : punkty.length - 1);
  const punktAktywny = punkty[aktywny];

  const x = (i: number) => poziomo(i, punkty.length, RAMKA);
  const y = (v: number) => pionowo(v, zakres, RAMKA);

  return (
    <div className="wykres">
      <div
        className="wykres__pole"
        ref={ref}
        style={{ '--wys-wykresu': `${wysokoscWyjsciowa}px` } as React.CSSProperties}
      >
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
      </div>

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
