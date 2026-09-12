import { useMemo, type ReactNode } from 'react';
import { ZLOTY } from '../domain/convert';
import { PoleWaluty, type PozycjaWaluty } from './PoleWaluty';
import type { Waluta } from '../domain/types';

/** Złoty nie występuje w tabelach NBP — kursy są ogłaszane właśnie względem niego. */
const ZLOTOWKA: PozycjaWaluty = { kod: ZLOTY, nazwa: 'złoty polski', tabela: null };

interface Props {
  waluty: Waluta[];
  /** Waluta źródłowa — jako cel nie miałaby sensu, więc wypada z listy. */
  pomin: string;
  wybrany: string;
  onWybor: (kod: string) => void;
  hint: ReactNode;
}

/** Wybór waluty docelowej: te same waluty co po lewej, plus złoty na czele. */
export function WalutaDocelowa({ waluty, pomin, wybrany, onWybor, hint }: Props) {
  const pozycje = useMemo(
    () => [ZLOTOWKA, ...waluty.filter((w) => w.kod !== pomin)],
    [waluty, pomin],
  );

  return (
    <PoleWaluty
      etykieta="Przelicz na"
      pozycje={pozycje}
      wybrany={wybrany}
      onWybor={onWybor}
      etykietaSzukania="Szukaj waluty docelowej"
      hint={hint}
    />
  );
}
