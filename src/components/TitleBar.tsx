import { Logo } from './Logo';

/**
 * Pasek tytułu widoczny wyłącznie w zainstalowanej aplikacji.
 * W karcie przeglądarki pozostaje ukryty.
 */
export function TitleBar() {
  return (
    <header className="app-titlebar">
      <Logo size={16} className="app-titlebar__mark" />
      <span className="app-titlebar__name">Kalkulator walut NBP</span>
    </header>
  );
}
