/**
 * Znak firmowy rysowany wprost w kodzie.
 *
 * Wcześniej był wstawiany jako <img> wskazujący plik obok. Działało po
 * wdrożeniu, ale w wersji zbudowanej do jednego pliku HTML nie miał czego
 * wczytać i zostawał symbol uszkodzonego obrazu.
 *
 * Kolor kafelka bierze się ze zmiennej paska tytułu, a nie z koloru wiodącego.
 * Ta pierwsza jest ciemna w obu motywach, więc białe „zł" zawsze ma kontrast —
 * kolor wiodący w motywie ciemnym jaśnieje i napis by na nim zniknął.
 */
export function Logo({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Kalkulator walut NBP"
    >
      <rect width="64" height="64" rx="14" fill="var(--titlebar-bg, #166b5c)" />
      <path
        d="M14 22 H44 L38 16"
        fill="none"
        stroke="rgba(255, 255, 255, 0.62)"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="32"
        y="49"
        textAnchor="middle"
        fontFamily="'IBM Plex Sans', Verdana, Arial, sans-serif"
        fontSize="27"
        fontWeight="700"
        fill="#ffffff"
      >
        zł
      </text>
    </svg>
  );
}
