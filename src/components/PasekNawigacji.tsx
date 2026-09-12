export type Ekran = 'kalkulator' | 'historia';

interface Props {
  ekran: Ekran;
  onZmiana: (ekran: Ekran) => void;
  /** Liczba zapisanych przeliczeń — pasek ma informować, nie tylko przenosić. */
  ile: number;
}

const IKONA = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round',
  strokeLinejoin: 'round', 'aria-hidden': true } as const;

export function PasekNawigacji({ ekran, onZmiana, ile }: Props) {
  return (
    <nav className="pasek" aria-label="Ekrany">
      <button
        type="button"
        className={`pasek__ikona${ekran === 'kalkulator' ? ' pasek__ikona--na' : ''}`}
        aria-current={ekran === 'kalkulator' ? 'page' : undefined}
        title="Przeliczanie"
        onClick={() => onZmiana('kalkulator')}
      >
        {/* Kalkulator: kwota u góry, klawisze pod spodem. */}
        <svg {...IKONA}>
          <rect x="4" y="3" width="16" height="18" rx="2.5" />
          <path d="M8 7h8" />
          <path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" />
        </svg>
        <span className="pasek__podpis">Przelicz</span>
      </button>

      <button
        type="button"
        className={`pasek__ikona${ekran === 'historia' ? ' pasek__ikona--na' : ''}`}
        aria-current={ekran === 'historia' ? 'page' : undefined}
        title={ile > 0 ? `Historia — zapisanych przeliczeń: ${ile}` : 'Historia — pusta'}
        onClick={() => onZmiana('historia')}
      >
        {/* Zegar ze strzałką wstecz — powrót do tego, co już policzone. */}
        <svg {...IKONA}>
          <path d="M3.2 9.5A9 9 0 1 1 3 12" />
          <path d="M3 4.5V9.5H8" />
          <path d="M12 7.5V12l3 1.8" />
        </svg>
        <span className="pasek__podpis">Historia</span>
        {ile > 0 ? <span className="pasek__licznik">{ile > 99 ? '99+' : ile}</span> : null}
      </button>
    </nav>
  );
}
