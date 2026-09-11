/**
 * Ustawienia wyglądu wybierane przez użytkownika.
 *
 * Cała kolorystyka i typografia aplikacji siedzi w zmiennych CSS, więc panel
 * ustawień nie musi nic przerysowywać — podmienia wartości tych samych
 * zmiennych, których używa motyw jasny i ciemny.
 */

export type Motyw = 'system' | 'jasny' | 'ciemny';
export type Paleta = 'morski' | 'granatowy' | 'grafitowy' | 'bordowy';
export type Krój = 'plex' | 'systemowy' | 'verdana' | 'georgia';

export interface Ustawienia {
  motyw: Motyw;
  paleta: Paleta;
  krój: Krój;
  /** Skala pisma: 1 oznacza rozmiar podstawowy. */
  skala: number;
}

export const DOMYŚLNE: Ustawienia = {
  motyw: 'system',
  paleta: 'morski',
  krój: 'plex',
  skala: 1,
};

export const SKALE = [0.9, 1, 1.1, 1.25] as const;

interface Odcienie {
  accent: string;
  accentSoft: string;
  titlebarBg: string;
}

interface OpisPalety {
  nazwa: string;
  jasny: Odcienie;
  ciemny: Odcienie;
}

/**
 * Każda paleta niesie komplet odcieni dla obu motywów.
 *
 * Sam kolor wiodący nie wystarczy: na jasnym tle potrzebny jest ciemny odcień
 * z dobrym kontrastem, na ciemnym jaśniejszy, a do tego pasujące tło
 * podświetleń i paska tytułu.
 */
export const PALETY: Record<Paleta, OpisPalety> = {
  morski: {
    nazwa: 'Morski',
    jasny: { accent: '#166b5c', accentSoft: '#e2f1ed', titlebarBg: '#166b5c' },
    ciemny: { accent: '#6ecab4', accentSoft: '#132c27', titlebarBg: '#114036' },
  },
  granatowy: {
    nazwa: 'Granatowy',
    jasny: { accent: '#1f5f8b', accentSoft: '#e7f0f7', titlebarBg: '#1f5f8b' },
    ciemny: { accent: '#6fb3e0', accentSoft: '#1b2b38', titlebarBg: '#163b52' },
  },
  grafitowy: {
    nazwa: 'Grafitowy',
    jasny: { accent: '#3f4654', accentSoft: '#ecedf1', titlebarBg: '#3f4654' },
    ciemny: { accent: '#aab3c4', accentSoft: '#272c35', titlebarBg: '#2b313c' },
  },
  bordowy: {
    nazwa: 'Bordowy',
    jasny: { accent: '#8a3245', accentSoft: '#f8e9ec', titlebarBg: '#8a3245' },
    ciemny: { accent: '#e094a4', accentSoft: '#332227', titlebarBg: '#4a222c' },
  },
};

export const KROJE: Record<Krój, { nazwa: string; stos: string }> = {
  plex: {
    nazwa: 'IBM Plex Sans',
    stos: "'IBM Plex Sans', ui-sans-serif, system-ui, 'Segoe UI', Roboto, Arial, sans-serif",
  },
  systemowy: {
    nazwa: 'Systemowy',
    stos: "system-ui, 'Segoe UI', Roboto, -apple-system, Arial, sans-serif",
  },
  verdana: { nazwa: 'Verdana', stos: "Verdana, Geneva, 'DejaVu Sans', sans-serif" },
  georgia: { nazwa: 'Georgia', stos: "Georgia, 'Times New Roman', 'DejaVu Serif', serif" },
};

const KLUCZ = 'kalkulator-walut:ustawienia';

function poprawne(dane: unknown): Ustawienia {
  const u = (dane ?? {}) as Partial<Ustawienia>;
  return {
    motyw: (['system', 'jasny', 'ciemny'] as const).includes(u.motyw as Motyw)
      ? (u.motyw as Motyw)
      : DOMYŚLNE.motyw,
    paleta: u.paleta && u.paleta in PALETY ? u.paleta : DOMYŚLNE.paleta,
    krój: u.krój && u.krój in KROJE ? u.krój : DOMYŚLNE.krój,
    skala: SKALE.includes(u.skala as (typeof SKALE)[number]) ? (u.skala as number) : DOMYŚLNE.skala,
  };
}

export function wczytaj(): Ustawienia {
  try {
    const zapisane = localStorage.getItem(KLUCZ);
    return poprawne(zapisane ? JSON.parse(zapisane) : null);
  } catch {
    // Tryb prywatny albo zablokowane dane witryny — aplikacja ma działać mimo to.
    return DOMYŚLNE;
  }
}

export function zapisz(ustawienia: Ustawienia): void {
  try {
    localStorage.setItem(KLUCZ, JSON.stringify(ustawienia));
  } catch {
    // Brak zapisu nie może przerwać działania; ustawienia zadziałają do zamknięcia okna.
  }
}

/** Czy przy tych ustawieniach obowiązuje wariant ciemny. */
export function czyCiemny(ustawienia: Ustawienia, systemCiemny: boolean): boolean {
  if (ustawienia.motyw === 'ciemny') return true;
  if (ustawienia.motyw === 'jasny') return false;
  return systemCiemny;
}

/** Przenosi ustawienia do zmiennych CSS na elemencie html. */
export function zastosuj(ustawienia: Ustawienia, korzeń: HTMLElement, systemCiemny: boolean): void {
  const ciemny = czyCiemny(ustawienia, systemCiemny);
  const odcienie = PALETY[ustawienia.paleta][ciemny ? 'ciemny' : 'jasny'];

  korzeń.dataset.theme = ustawienia.motyw === 'system' ? '' : ciemny ? 'dark' : 'light';
  if (ustawienia.motyw === 'system') delete korzeń.dataset.theme;

  korzeń.style.setProperty('--skala', String(ustawienia.skala));
  korzeń.style.setProperty('--font-sans', KROJE[ustawienia.krój].stos);
  korzeń.style.setProperty('--accent', odcienie.accent);
  korzeń.style.setProperty('--accent-soft', odcienie.accentSoft);
  korzeń.style.setProperty('--titlebar-bg', odcienie.titlebarBg);
}
