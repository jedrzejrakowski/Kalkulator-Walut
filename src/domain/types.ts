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
  kurs: Kurs;
  /** Data zdarzenia gospodarczego wskazana przez użytkownika. */
  dataZdarzenia: DataIso;
  /** Dzień, z którego kurs powinien pochodzić według przepisów. */
  dataWymagana: DataIso;
  /** Iloczyn kwoty i kursu, zaokrąglony do groszy. */
  wynikPln: number;
  /**
   * Prawda, gdy tabela pochodzi z wcześniejszego dnia niż wymagany — bo NBP
   * jej wtedy nie ogłosił. Przy tabeli B to sytuacja normalna, bo ogłaszana
   * jest raz w tygodniu.
   */
  kursStarszyNizWymagany: boolean;
}
