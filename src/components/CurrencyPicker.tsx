import { useMemo, useState } from 'react';
import { filtruj } from '../domain/szukaj';
import type { Tabela, Waluta } from '../domain/types';

type Filtr = Tabela | 'wszystkie';

const OPIS: Record<Filtr, string> = {
  wszystkie: 'Obie tabele razem',
  A: 'Tabela A — waluty wymienialne, ogłaszana w każdy dzień roboczy',
  B: 'Tabela B — pozostałe waluty, ogłaszana raz w tygodniu, w środy',
};

interface Props {
  waluty: Waluta[];
  wybrany: string;
  onWybor: (kod: string) => void;
}

/**
 * Wybór waluty z podziałem na tabele i wyszukiwarką.
 *
 * Przy czterech walutach wystarczała zwykła lista rozwijana. NBP ogłasza ich
 * ponad sto czterdzieści, więc potrzebne jest zawężanie: najpierw tabela,
 * potem szukanie po kodzie albo nazwie.
 */
export function CurrencyPicker({ waluty, wybrany, onWybor }: Props) {
  const [filtr, setFiltr] = useState<Filtr>('wszystkie');
  const [szukaj, setSzukaj] = useState('');

  const liczby = useMemo(
    () => ({
      A: waluty.filter((w) => w.tabela === 'A').length,
      B: waluty.filter((w) => w.tabela === 'B').length,
      wszystkie: waluty.length,
    }),
    [waluty],
  );

  const widoczne = useMemo(
    () => filtruj(filtr === 'wszystkie' ? waluty : waluty.filter((w) => w.tabela === filtr), szukaj),
    [waluty, filtr, szukaj],
  );

  const opis = waluty.find((w) => w.kod === wybrany);

  return (
    <div className="field">
      <span className="field-label">Waluta</span>

      <div className="segmented" role="group" aria-label="Tabela kursów">
        {(['wszystkie', 'A', 'B'] as Filtr[]).map((wartosc) => (
          <button
            key={wartosc}
            type="button"
            aria-pressed={filtr === wartosc}
            title={OPIS[wartosc]}
            onClick={() => setFiltr(wartosc)}
          >
            {wartosc === 'wszystkie' ? 'Wszystkie' : `Tabela ${wartosc}`}
            <span className="segmented__count">{liczby[wartosc]}</span>
          </button>
        ))}
      </div>

      <p className="field-hint" style={{ marginTop: 8 }}>
        {OPIS[filtr]}
      </p>

      <input
        type="search"
        className="picker__search"
        value={szukaj}
        placeholder="Szukaj po kodzie albo nazwie, na przykład dong"
        aria-label="Szukaj waluty"
        onChange={(e) => setSzukaj(e.target.value)}
      />

      <ul className="picker__list">
        {widoczne.length === 0 ? (
          <li className="picker__empty">Brak walut pasujących do „{szukaj}”.</li>
        ) : (
          widoczne.map((w) => (
            <li key={`${w.tabela}-${w.kod}`}>
              <button
                type="button"
                className={`picker__item${w.kod === wybrany ? ' picker__item--on' : ''}`}
                aria-pressed={w.kod === wybrany}
                onClick={() => onWybor(w.kod)}
              >
                <span className="picker__code">{w.kod}</span>
                <span className="picker__name">{w.nazwa}</span>
                <span className={`pill pill--${w.tabela.toLowerCase()}`}>{w.tabela}</span>
              </button>
            </li>
          ))
        )}
      </ul>

      <p className="field-hint">
        {opis ? (
          <>
            Wybrano <strong>{opis.kod}</strong> — {opis.nazwa}, tabela {opis.tabela}.
          </>
        ) : (
          'Wskaż walutę z listy powyżej.'
        )}
      </p>
    </div>
  );
}
