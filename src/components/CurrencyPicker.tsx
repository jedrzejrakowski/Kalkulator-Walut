import { useMemo, useState } from 'react';
import { PoleWaluty } from './PoleWaluty';
import type { Tabela, Waluta } from '../domain/types';

type Filtr = Tabela | 'wszystkie';

const OPIS: Record<Filtr, string> = {
  wszystkie: 'Obie tabele razem',
  A: 'Tabela A — waluty wymienialne, ogłaszana w każdy dzień roboczy',
  B: 'Tabela B — pozostałe waluty, ogłaszana raz w tygodniu, w środy',
};

/** Rytm ogłaszania tabeli — to on decyduje, czy kurs będzie z wymaganego dnia. */
const RYTM: Record<Tabela, string> = {
  A: 'tabeli A, ogłaszanej w każdy dzień roboczy',
  B: 'tabeli B, ogłaszanej raz w tygodniu, w środy',
};

interface Props {
  waluty: Waluta[];
  wybrany: string;
  onWybor: (kod: string) => void;
}

/**
 * Wybór waluty źródłowej: filtr tabel i wyszukiwarka w rozwijanym panelu.
 *
 * Podział na tabele stoi nad wyszukiwarką, bo zawęża inaczej niż ona — po
 * rytmie ogłaszania, a nie po nazwie. Dla księgowego to rozróżnienie istotne:
 * kurs z tabeli B bywa starszy od wymaganego dnia, bo NBP ogłasza ją w środy.
 */
export function CurrencyPicker({ waluty, wybrany, onWybor }: Props) {
  const [filtr, setFiltr] = useState<Filtr>('wszystkie');

  const liczby = useMemo(
    () => ({
      A: waluty.filter((w) => w.tabela === 'A').length,
      B: waluty.filter((w) => w.tabela === 'B').length,
      wszystkie: waluty.length,
    }),
    [waluty],
  );

  const pozycje = useMemo(
    () => (filtr === 'wszystkie' ? waluty : waluty.filter((w) => w.tabela === filtr)),
    [waluty, filtr],
  );

  const opis = waluty.find((w) => w.kod === wybrany);

  return (
    <PoleWaluty
      etykieta="Waluta"
      pozycje={pozycje}
      wybrany={wybrany}
      onWybor={onWybor}
      etykietaSzukania="Szukaj waluty"
      pusto={filtr === 'wszystkie' ? 'Lista walut jest pusta.' : `Tabela ${filtr} nie zawiera żadnej waluty.`}
      naglowek={
        <>
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
          <p className="field-hint">{OPIS[filtr]}</p>
        </>
      }
      hint={
        opis ? (
          <>
            Kurs {opis.kod} pochodzi z {RYTM[opis.tabela]}.
          </>
        ) : (
          'Wskaż walutę, w której wyrażona jest kwota.'
        )
      }
    />
  );
}
