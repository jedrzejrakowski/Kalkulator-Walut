/** Wspólne przygotowanie testów serwera: katalog z kontami i gotowe skróty haseł. */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontekst } from '../ochrona';
import { Magazyn, skrotHasla, type Uzytkownik } from '../uzytkownicy';

export const HASLO_ADMINA = 'jesienne-liscie-nad-wisla';
export const HASLO_ANNY = 'zielona-herbata-o-poranku';

let skroty: Promise<[string, string]> | null = null;

/** Skróty liczone raz — scrypt celowo jest wolny. */
export function gotoweSkroty(): Promise<[string, string]> {
  skroty ??= Promise.all([skrotHasla(HASLO_ADMINA), skrotHasla(HASLO_ANNY)]);
  return skroty;
}

export async function konta(): Promise<Uzytkownik[]> {
  const [admin, anna] = await gotoweSkroty();
  return [
    { login: 'jedrzej', admin: true, haslo: admin, wymagaZmiany: false },
    { login: 'anna.nowak', admin: false, haslo: anna, wymagaZmiany: false },
  ];
}

export interface Srodowisko {
  katalog: string;
  magazyn: Magazyn;
  kontekst: Kontekst;
  sprzataj: () => Promise<void>;
}

export async function srodowisko(lista?: Uzytkownik[], teraz?: () => number): Promise<Srodowisko> {
  const katalog = await mkdtemp(path.join(tmpdir(), 'kalkulator-konta-'));
  const plik = path.join(katalog, 'uzytkownicy.json');
  await writeFile(plik, JSON.stringify({ uzytkownicy: lista ?? (await konta()) }));
  const magazyn = new Magazyn(plik);
  const kontekst: Kontekst = { magazyn, klucz: Buffer.alloc(32, 7), czekaj: async () => {} };
  if (teraz) kontekst.teraz = teraz;
  return { katalog, magazyn, kontekst, sprzataj: () => rm(katalog, { recursive: true, force: true }) };
}
