/**
 * Pasek tytułu widoczny wyłącznie w zainstalowanej aplikacji.
 * W karcie przeglądarki pozostaje ukryty.
 */
export function TitleBar() {
  return (
    <header className="app-titlebar">
      <img className="app-titlebar__mark" src="./icons/icon.svg" alt="" width="16" height="16" />
      <span className="app-titlebar__name">Kalkulator walut NBP</span>
    </header>
  );
}
