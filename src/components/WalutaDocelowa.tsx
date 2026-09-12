import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ZLOTY } from '../domain/convert';
import { filtruj } from '../domain/szukaj';
import type { Tabela, Waluta } from '../domain/types';

/** Pozycja listy. Złoty nie ma tabeli — NBP ogłasza kursy właśnie względem niego. */
interface Pozycja {
  kod: string;
  nazwa: string;
  tabela: Tabela | null;
}

const ZLOTOWKA: Pozycja = { kod: ZLOTY, nazwa: 'złoty polski', tabela: null };

interface Props {
  waluty: Waluta[];
  /** Waluta źródłowa — jako cel nie miałaby sensu, więc wypada z listy. */
  pomin: string;
  wybrany: string;
  onWybor: (kod: string) => void;
  hint: ReactNode;
}

/**
 * Wybór waluty docelowej: ta sama wyszukiwarka co przy walucie źródłowej,
 * ale zwinięta do jednego pola.
 *
 * Lista rozwijana przeglądarki nie radzi sobie ze stu pięćdziesięcioma
 * pozycjami — trzeba przewijać w poszukiwaniu kodu, którego się nie pamięta.
 * Rozwinięta na stałe lista rozciągnęłaby jednak formularz na dwa ekrany,
 * a złoty jako cel wystarcza w większości przeliczeń. Stąd pole, które
 * otwiera wyszukiwarkę dopiero na żądanie.
 */
export function WalutaDocelowa({ waluty, pomin, wybrany, onWybor, hint }: Props) {
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

  const wszystkie = useMemo<Pozycja[]>(
    () => [ZLOTOWKA, ...waluty.filter((w) => w.kod !== pomin)],
    [waluty, pomin],
  );
  const widoczne = useMemo(() => filtruj(wszystkie, szukane), [wszystkie, szukane]);
  const wybrana = wszystkie.find((w) => w.kod === wybrany) ?? ZLOTOWKA;

  function otworz() {
    setAktywny(Math.max(0, wszystkie.findIndex((w) => w.kod === wybrany)));
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
        Przelicz na
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
          <span className="picker__code">{wybrana.kod}</span>
          <span className="picker__name" id={`${id}-wybor`}>
            {wybrana.nazwa}
          </span>
          {wybrana.tabela ? (
            <span className={`pill pill--${wybrana.tabela.toLowerCase()}`}>{wybrana.tabela}</span>
          ) : null}
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
            <input
              type="search"
              ref={pole}
              value={szukane}
              role="combobox"
              aria-expanded
              aria-controls={idListy}
              aria-autocomplete="list"
              aria-activedescendant={widoczne[aktywny] ? idOpcji(aktywny) : undefined}
              aria-label="Szukaj waluty docelowej"
              placeholder="Szukaj po kodzie albo nazwie, na przykład dong"
              onChange={(e) => setSzukane(e.target.value)}
            />

            <ul className="picker__list combo__lista" id={idListy} role="listbox" ref={lista}>
              {widoczne.length === 0 ? (
                <li className="picker__empty">Brak walut pasujących do „{szukane}”.</li>
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
