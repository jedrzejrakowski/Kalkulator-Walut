/** Zaokrąglenie do pełnych groszy, odporne na błąd reprezentacji zmiennoprzecinkowej. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const currency = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const plain = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPln(value: number): string {
  return currency.format(value);
}

export function formatAmount(value: number): string {
  return plain.format(value);
}

/** Wskaźnik jako procent z maksymalnie dwoma miejscami, np. 0.25 -> "25%". */
export function formatRate(rate: number): string {
  const percent = rate * 100;
  const rounded = Math.round(percent * 100) / 100;
  return `${plain.format(rounded).replace(/,00$/, '')}%`;
}

/**
 * Parsuje kwotę wpisaną ręcznie, w zapisie polskim i angielskim.
 *
 * Przecinek jest separatorem dziesiętnym, a kropka i spacja separatorami
 * tysięcy. Wyjątkiem jest pojedyncza kropka przed najwyżej dwiema cyframi
 * przy braku przecinka — tak kwoty wpisuje się na klawiaturze numerycznej
 * i tak wyglądają po skopiowaniu z systemów anglojęzycznych, więc "80775.00"
 * to osiemdziesiąt tysięcy, a nie osiem milionów.
 */
export function parseAmount(raw: string): number {
  const trimmed = raw.replace(/[\s\u00a0]/g, '');
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : /^\d*\.\d{1,2}$/.test(trimmed)
      ? trimmed
      : trimmed.replace(/\./g, '');
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Parsuje procent wpisany ręcznie i przycina go do zakresu od 0 do 100. */
export function parsePercent(raw: string): number | null {
  const trimmed = raw.replace(/[\s\u00a0]/g, '').replace(',', '.');
  if (trimmed === '' || trimmed === '.') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

/** Procent do wyświetlenia: bez zbędnych zer, z polskim przecinkiem. */
export function formatPercent(value: number): string {
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 4 }).format(value);
}
