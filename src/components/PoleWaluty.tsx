import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { filtruj } from '../domain/szukaj';
import type { Tabela } from '../domain/types';

/** Pozycja listy. Tabela pusta oznacza złotego — NBP ogłasza kursy względem niego. */
export interface PozycjaWaluty {
  kod: string;
  nazwa: string;
  tabela: Tabela | null;
}

interface Props {
  etykieta: string;
  pozycje: PozycjaWaluty[];
  wybrany: string;
  onWybor: (kod: string) => void;
  hint: ReactNode;
  /** Podpis wyszukiwarki dla czytnika ekranu — na stronie są dwa takie pola. */
  etykietaSzukania: string;
  /** Treść nad wyszukiwarką w rozwiniętym panelu, na przykład filtr tabel. */
  naglowek?: ReactNode;
  /** Komunikat zamiast listy, gdy nie ma z czego wybierać. */
  pusto?: ReactNode;
}

/**
 * Wybór waluty: pole pokazujące bieżący wybór, które otwiera wyszukiwarkę.
 *
 * NBP ogłasza ponad sto czterdzieści walut, więc lista rozwijana przeglądarki
 * nie wystarcza — trzeba szukać po kodzie albo nazwie. Lista rozwinięta na
 * stałe rozciągałaby jednak formularz: dwa takie bloki to ponad pół ekranu
 * zajęte przez wybór, który po ustawieniu rzadko się zmienia.
 *
 * Wspólne dla obu pól, bo różnią się tylko zawartością listy i tym, co stoi
 * nad wyszukiwarką.
 */
export function PoleWaluty({
  etykieta, pozycje, wybrany, onWybor, hint, etykietaSzukania, naglowek, pusto,
}: Props) {
  const [otwarty, setOtwarty] = useState(false);
  const [szukane, setSzukane] = useState('');
  const [aktywny, setAktywny] = useState(0);

  const id = useId();
  const idListy = `${id}-lista`;
  const idOpcji = (i: number) => `${id}-opcja-${i}`;

  const ramka = useRef<HTMLDivElement>(null);
  const przycisk = useRef<HTMLButtonElement>(null);
  const pole = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  const widoczne = useMemo(() => filtruj(pozycje, szukane), [pozycje, szukane]);
  const wybrana = pozycje.find((w) => w.kod === wybrany);

  function otworz() {
    setAktywny(Math.max(0, pozycje.findIndex((w) => w.kod === wybrany)));
    setOtwarty(true);
  }

  function zamknij(wrocFokusem: boolean) {
    setOtwarty(false);
    setSzukane('');
    if (wrocFokusem) przycisk.current?.focus();
  }

  function wybierz(kod: string) {
    onWybor(kod);
    zamknij(true);
  }

  // Fraza zmieniona od nowa układa listę, więc podświetlenie wraca na początek.
  useEffect(() => setAktywny(0), [szukane]);

  useEffect(() => {
    if (otwarty) pole.current?.focus();
  }, [otwarty]);

  // Kliknięcie poza polem zamyka listę, ale nie zabiera fokusu tam, gdzie
  // użytkownik właśnie kliknął.
  useEffect(() => {
    if (!otwarty) return;
    const naZewnatrz = (e: PointerEvent) => {
      if (!ramka.current?.contains(e.target as Node)) zamknij(false);
    };
    document.addEventListener('pointerdown', naZewnatrz);
    return () => document.removeEventListener('pointerdown', naZewnatrz);
  }, [otwarty]);

  // Podświetlenie prowadzone klawiszami musi samo wjeżdżać w widok.
  useEffect(() => {
    if (!otwarty) return;
    lista.current?.querySelector('[data-aktywna="tak"]')?.scrollIntoView({ block: 'nearest' });
  }, [otwarty, aktywny]);

  function klawisz(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && otwarty) {
      e.preventDefault();
      zamknij(true);
      return;
    }
    // Nagłówek ma własne przyciski — klawisze należą wtedy do nich.
    if (e.target instanceof HTMLElement && e.target.closest('.combo__naglowek')) return;

    if (!otwarty) {
      // Strzałka w dół otwiera listę — tak zachowuje się każda lista rozwijana.
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        otworz();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAktywny((i) => Math.min(widoczne.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAktywny((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setAktywny(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setAktywny(widoczne.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const trafiona = widoczne[aktywny];
      if (trafiona) wybierz(trafiona.kod);
    }
  }

  return (
    <div className="field" ref={ramka} onKeyDown={klawisz}>
      <span className="field-label" id={`${id}-etykieta`}>
        {etykieta}
      </span>

      <div className="combo">
        <button
          type="button"
          ref={przycisk}
          className="combo__pole"
          aria-haspopup="listbox"
          aria-expanded={otwarty}
          aria-labelledby={`${id}-etykieta ${id}-wybor`}
          onClick={() => (otwarty ? zamknij(true) : otworz())}
        >
          {wybrana ? (
            <>
              <span className="picker__code">{wybrana.kod}</span>
              <span className="picker__name" id={`${id}-wybor`}>
                {wybrana.nazwa}
              </span>
              {wybrana.tabela ? (
                <span className={`pill pill--${wybrana.tabela.toLowerCase()}`}>
                  {wybrana.tabela}
                </span>
              ) : null}
            </>
          ) : (
            <span className="combo__brak" id={`${id}-wybor`}>
              Wskaż walutę
            </span>
          )}
          <svg
            className="combo__strzalka" width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {otwarty ? (
          <div className="combo__panel">
            {naglowek ? <div className="combo__naglowek">{naglowek}</div> : null}

            <input
              type="search"
              ref={pole}
              value={szukane}
              role="combobox"
              aria-expanded
              aria-controls={idListy}
              aria-autocomplete="list"
              aria-activedescendant={widoczne[aktywny] ? idOpcji(aktywny) : undefined}
              aria-label={etykietaSzukania}
              placeholder="Szukaj po kodzie albo nazwie, na przykład dong"
              onChange={(e) => setSzukane(e.target.value)}
            />

            <ul className="picker__list combo__lista" id={idListy} role="listbox" ref={lista}>
              {widoczne.length === 0 ? (
                <li className="picker__empty">
                  {szukane.trim() === '' ? pusto ?? 'Brak walut.' : `Brak walut pasujących do „${szukane}”.`}
                </li>
              ) : (
                widoczne.map((w, i) => (
                  <li
                    key={`${w.tabela ?? 'pln'}-${w.kod}`}
                    id={idOpcji(i)}
                    role="option"
                    aria-selected={w.kod === wybrany}
                    data-aktywna={i === aktywny ? 'tak' : undefined}
                    className={
                      'picker__item' +
                      (w.kod === wybrany ? ' picker__item--on' : '') +
                      (i === aktywny ? ' picker__item--wskazana' : '')
                    }
                    // Fokus ma zostać w wyszukiwarce, żeby dało się pisać dalej.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => wybierz(w.kod)}
                  >
                    <span className="picker__code">{w.kod}</span>
                    <span className="picker__name">{w.nazwa}</span>
                    {w.tabela ? (
                      <span className={`pill pill--${w.tabela.toLowerCase()}`}>{w.tabela}</span>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>

      <span className="field-hint">{hint}</span>
    </div>
  );
}
