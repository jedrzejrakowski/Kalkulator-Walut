/**
 * Konta użytkowników: zasady, skróty haseł i plik, w którym leżą.
 *
 * Hasło nigdy nie jest zapisywane — tylko jego skrót scrypt z losową solą.
 * scrypt celowo zużywa pamięć i czas procesora, więc nawet ktoś, kto
 * wyniósłby plik z serwera, musiałby zgadywać każde hasło osobno i powoli.
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { readFile, rename, stat, writeFile } from 'node:fs/promises';

export interface Uzytkownik {
  /** Identyfikator do logowania: małe litery, cyfry, kropka, myślnik, podkreślnik. */
  login: string;
  /** Imię i nazwisko do wyświetlenia; może być puste. */
  nazwa: string;
  admin: boolean;
  /** Skrót hasła: `scrypt$N$r$p$sól$skrót`. */
  haslo: string;
  /** Hasło nadał administrator — przy pierwszym wejściu trzeba ustawić własne. */
  wymagaZmiany: boolean;
  utworzono: string;
  zmianaHasla: string;
}

/** To, co wolno pokazać w przeglądarce — bez skrótu hasła. */
export type OpisUzytkownika = Omit<Uzytkownik, 'haslo'>;

export function opis({ haslo: _pominiete, ...reszta }: Uzytkownik): OpisUzytkownika {
  return reszta;
}

export const NAJKROTSZE_HASLO = 12;
const NAJDLUZSZE_HASLO = 200;
const NAJDLUZSZA_NAZWA = 80;
const WZOR_LOGINU = /^[a-z0-9][a-z0-9._-]{1,31}$/;

/** Błąd, który można pokazać użytkownikowi wprost — z kodem odpowiedzi HTTP. */
export class BladKonta extends Error {
  constructor(
    readonly status: number,
    wiadomosc: string,
  ) {
    super(wiadomosc);
  }
}

export function normalizujLogin(login: string): string {
  return login.trim().toLowerCase();
}

export function sprawdzLogin(login: string): void {
  if (!WZOR_LOGINU.test(login)) {
    throw new BladKonta(
      400,
      'Identyfikator: od 2 do 32 znaków — małe litery bez polskich znaków, cyfry, kropka, myślnik albo podkreślnik.',
    );
  }
}

export function sprawdzHasloNowe(haslo: string, login: string): void {
  if ([...haslo].length < NAJKROTSZE_HASLO) {
    throw new BladKonta(400, `Hasło musi mieć co najmniej ${NAJKROTSZE_HASLO} znaków — najłatwiej z kilku słów.`);
  }
  if (haslo.length > NAJDLUZSZE_HASLO) throw new BladKonta(400, 'Hasło jest za długie.');
  if (haslo.toLowerCase().includes(login)) throw new BladKonta(400, 'Hasło nie może zawierać identyfikatora.');
}

export function sprawdzNazwe(nazwa: string): string {
  const czysta = nazwa.trim().replace(/\s+/g, ' ');
  // Znaki sterujące nie mają czego szukać w imieniu i nazwisku.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(czysta)) throw new BladKonta(400, 'Imię i nazwisko zawiera niedozwolone znaki.');
  if ([...czysta].length > NAJDLUZSZA_NAZWA) throw new BladKonta(400, 'Imię i nazwisko jest za długie.');
  return czysta;
}

// --- skróty haseł ---

/**
 * Parametry scrypt: 32 MiB pamięci na jedno sprawdzenie, równoważne
 * zaleceniom OWASP. Zapisane przy skrócie, więc można je kiedyś podnieść
 * bez unieważniania starych haseł.
 */
const PARAMETRY = { N: 32768, r: 8, p: 3 } as const;
const DLUGOSC_SKROTU = 32;

function wyprowadz(haslo: string, sol: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((dalej, blad) => {
    // Ten sam tekst wpisany na różnych systemach może mieć różny zapis
    // polskich liter; NFC sprowadza je do jednej postaci.
    scrypt(haslo.normalize('NFC'), sol, DLUGOSC_SKROTU, { N, r, p, maxmem: 2 * 128 * N * r }, (e, klucz) =>
      e ? blad(e) : dalej(klucz),
    );
  });
}

/**
 * Najwyżej dwa sprawdzenia hasła naraz i krótka kolejka.
 *
 * Każde sprawdzenie kosztuje ułamek sekundy procesora. Bez limitu zasypanie
 * formularza logowania zapytaniami zajęłoby cały serwer — a na nim działa
 * też n8n. Nadmiar dostaje „spróbuj za chwilę".
 */
export class Kolejka {
  private trwa = 0;
  private czekajace: (() => void)[] = [];

  constructor(
    private readonly naRaz: number,
    private readonly dlugosc: number,
  ) {}

  async wykonaj<T>(zadanie: () => Promise<T>): Promise<T> {
    if (this.trwa < this.naRaz) {
      this.trwa++;
    } else {
      if (this.czekajace.length >= this.dlugosc) {
        throw new BladKonta(503, 'Serwer jest chwilowo zajęty. Spróbuj za kilka sekund.');
      }
      // Miejsce przekazuje kończące zadanie — licznik się nie zmienia, więc
      // nikt z zewnątrz nie wskoczy w lukę między jednym a drugim.
      await new Promise<void>((r) => this.czekajace.push(r));
    }
    try {
      return await zadanie();
    } finally {
      const nastepne = this.czekajace.shift();
      if (nastepne) nastepne();
      else this.trwa--;
    }
  }
}

export const kolejka = new Kolejka(2, 16);

export function skrotHasla(haslo: string): Promise<string> {
  return kolejka.wykonaj(async () => {
    const sol = randomBytes(16);
    const { N, r, p } = PARAMETRY;
    const skrot = await wyprowadz(haslo, sol, N, r, p);
    return ['scrypt', N, r, p, sol.toString('base64url'), skrot.toString('base64url')].join('$');
  });
}

export function czyHasloPasuje(haslo: string, zapisany: string): Promise<boolean> {
  return kolejka.wykonaj(async () => {
    const [rodzaj, N, r, p, sol, skrot] = zapisany.split('$');
    if (rodzaj !== 'scrypt' || !sol || !skrot) return false;
    const oczekiwany = Buffer.from(skrot, 'base64url');
    const wyliczony = await wyprowadz(haslo, Buffer.from(sol, 'base64url'), Number(N), Number(r), Number(p));
    return wyliczony.length === oczekiwany.length && timingSafeEqual(wyliczony, oczekiwany);
  });
}

/**
 * Skrót do porównania, gdy identyfikatora nie ma na liście.
 *
 * Sprawdzamy wtedy hasło i tak — inaczej odpowiedź dla nieistniejącego
 * konta przychodziłaby wyraźnie szybciej i zdradzała, które konta istnieją.
 */
let zastepczy: Promise<string> | null = null;
export function skrotZastepczy(): Promise<string> {
  zastepczy ??= skrotHasla(randomBytes(24).toString('base64url'));
  return zastepczy;
}

// --- operacje na liście kont ---

function znajdzIndeks(lista: readonly Uzytkownik[], login: string): number {
  const i = lista.findIndex((u) => u.login === login);
  if (i < 0) throw new BladKonta(404, 'Nie ma takiego użytkownika.');
  return i;
}

function ileAdminow(lista: readonly Uzytkownik[]): number {
  return lista.filter((u) => u.admin).length;
}

export function dodaj(
  lista: readonly Uzytkownik[],
  nowy: { login: string; nazwa: string; admin: boolean; haslo: string; wymagaZmiany: boolean },
  teraz: Date,
): Uzytkownik[] {
  if (lista.some((u) => u.login === nowy.login)) {
    throw new BladKonta(409, `Identyfikator „${nowy.login}" jest już zajęty.`);
  }
  const czas = teraz.toISOString();
  return [...lista, { ...nowy, utworzono: czas, zmianaHasla: czas }];
}

export function ustawHaslo(
  lista: readonly Uzytkownik[],
  login: string,
  skrot: string,
  wymagaZmiany: boolean,
  teraz: Date,
): Uzytkownik[] {
  const i = znajdzIndeks(lista, login);
  return lista.map((u, j) => (j === i ? { ...u, haslo: skrot, wymagaZmiany, zmianaHasla: teraz.toISOString() } : u));
}

export function zmienDane(
  lista: readonly Uzytkownik[],
  login: string,
  zmiany: { nazwa?: string; admin?: boolean },
  kto: string,
): Uzytkownik[] {
  const i = znajdzIndeks(lista, login);
  const obecny = lista[i]!;
  if (zmiany.admin === false && obecny.admin) {
    if (login === kto) throw new BladKonta(400, 'Nie możesz odebrać uprawnień administratora samemu sobie.');
    if (ileAdminow(lista) <= 1) throw new BladKonta(400, 'Musi zostać przynajmniej jeden administrator.');
  }
  return lista.map((u, j) => (j === i ? { ...u, ...zmiany } : u));
}

export function usun(lista: readonly Uzytkownik[], login: string, kto: string): Uzytkownik[] {
  const i = znajdzIndeks(lista, login);
  if (login === kto) throw new BladKonta(400, 'Nie możesz usunąć własnego konta.');
  if (lista[i]!.admin && ileAdminow(lista) <= 1) throw new BladKonta(400, 'Musi zostać przynajmniej jeden administrator.');
  return lista.filter((_, j) => j !== i);
}

// --- plik z kontami ---

function poprawny(k: unknown): k is Uzytkownik {
  if (typeof k !== 'object' || k === null) return false;
  const u = k as Record<string, unknown>;
  return (
    typeof u.login === 'string' && WZOR_LOGINU.test(u.login) &&
    typeof u.nazwa === 'string' &&
    typeof u.admin === 'boolean' &&
    typeof u.haslo === 'string' && u.haslo.startsWith('scrypt$') &&
    typeof u.wymagaZmiany === 'boolean' &&
    typeof u.utworzono === 'string' &&
    typeof u.zmianaHasla === 'string'
  );
}

/**
 * Konta w jednym pliku JSON, czytelnym tylko dla usługi.
 *
 * Plik jest czytany ponownie, gdy zmieni się na dysku — konto założone
 * poleceniem w terminalu działa od razu, bez restartu. Zapisy idą po kolei
 * i przez plik tymczasowy: przerwany zapis nie zostawi połowy listy.
 */
export class Magazyn {
  private lista: Uzytkownik[] = [];
  private wersjaPliku = '';
  private zapisy: Promise<unknown> = Promise.resolve();

  constructor(readonly plik: string) {}

  private async odswiez(): Promise<void> {
    let info;
    try {
      info = await stat(this.plik);
    } catch {
      this.lista = [];
      this.wersjaPliku = '';
      return;
    }
    const wersja = `${info.mtimeMs}:${info.size}`;
    if (wersja === this.wersjaPliku) return;
    const dane: unknown = JSON.parse(await readFile(this.plik, 'utf8'));
    const surowe = (dane as { uzytkownicy?: unknown }).uzytkownicy;
    if (!Array.isArray(surowe) || !surowe.every(poprawny)) {
      throw new Error(`Plik kont ${this.plik} jest uszkodzony.`);
    }
    this.lista = surowe;
    this.wersjaPliku = wersja;
  }

  async wszyscy(): Promise<readonly Uzytkownik[]> {
    await this.odswiez();
    return this.lista;
  }

  async znajdz(login: string): Promise<Uzytkownik | undefined> {
    return (await this.wszyscy()).find((u) => u.login === login);
  }

  /** Zmiana listy kont: odczyt, przekształcenie i zapis bez wtrącenia innej zmiany. */
  zmien(przeksztalc: (lista: readonly Uzytkownik[]) => Uzytkownik[]): Promise<readonly Uzytkownik[]> {
    const wynik = this.zapisy.then(async () => {
      await this.odswiez();
      const nowa = przeksztalc(this.lista);
      const tymczasowy = `${this.plik}.${process.pid}.tmp`;
      await writeFile(tymczasowy, JSON.stringify({ uzytkownicy: nowa }, null, 2) + '\n', { mode: 0o600 });
      await rename(tymczasowy, this.plik);
      this.lista = nowa;
      const info = await stat(this.plik);
      this.wersjaPliku = `${info.mtimeMs}:${info.size}`;
      return nowa;
    });
    this.zapisy = wynik.catch(() => {});
    return wynik;
  }
}
