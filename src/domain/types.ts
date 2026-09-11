import type { DataIso } from './dates';

/** Tabela kursów NBP. A jest ogłaszana w każdy dzień roboczy, B tylko w środy. */
export type Tabela = 'A' | 'B';

export interface Waluta {
  kod: string;
  nazwa: string;
  tabela: Tabela;
}

export interface Kurs {
  kod: string;
  nazwa: string;
  tabela: Tabela;
  /** Oznaczenie tabeli nadane przez NBP, na przykład 174/A/NBP/2026. */
  numerTabeli: string;
  /** Kurs średni za jedną jednostkę waluty. */
  kurs: number;
  /** Dzień, z którego pochodzi tabela. */
  dataTabeli: DataIso;
}

export interface Przeliczenie {
  kwota: number;
  /** Kurs waluty, w której wyrażona jest kwota wejściowa. */
  kurs: Kurs;
  /**
   * Kurs waluty docelowej; null, gdy celem jest złoty.
   *
   * NBP ogłasza wszystkie kursy względem złotego, więc przeliczenie między
   * dwiema walutami obcymi prowadzi przez złotego. Tej samej drogi wymaga
   * art. 11a ust. 2 ustawy o PIT, więc metoda najprostsza technicznie jest
   * zarazem jedyną poprawną podatkowo.
   */
  kursDocelowy: Kurs | null;
  /** Data zdarzenia gospodarczego wskazana przez użytkownika. */
  dataZdarzenia: DataIso;
  /** Dzień, z którego kurs powinien pochodzić według przepisów. */
  dataWymagana: DataIso;
  /** Wartość w złotych — zawsze wyliczana, bo to ona trafia do ksiąg. */
  wynikPln: number;
  /** Wartość w walucie docelowej; null, gdy celem jest złoty. */
  wynikDocelowy: number | null;
  /** Ile jednostek waluty docelowej przypada na jednostkę źródłowej. */
  kursKrzyzowy: number | null;
  /**
   * Prawda, gdy którakolwiek tabela pochodzi z wcześniejszego dnia niż
   * wymagany — bo NBP jej wtedy nie ogłosił. Przy tabeli B to sytuacja
   * normalna, bo ogłaszana jest raz w tygodniu.
   */
  kursStarszyNizWymagany: boolean;
}
