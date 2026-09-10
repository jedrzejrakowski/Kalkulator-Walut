/**
 * Renderuje ikony PNG ze źródeł SVG.
 *
 * Windows tworzy skrót do zainstalowanej aplikacji z ikony rastrowej, więc
 * sam SVG nie wystarczy. Skrypt uruchamia się ręcznie po zmianie rysunku:
 *
 *   npm i -D playwright && node scripts/build-icons.mjs && npm uninstall playwright
 *
 * Wygenerowane pliki są w repozytorium, żeby zwykły build ani wdrożenie
 * nie wymagały przeglądarki.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const katalog = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const zadania = [
  { zrodlo: 'icon.svg', wynik: 'icon-192.png', rozmiar: 192 },
  { zrodlo: 'icon.svg', wynik: 'icon-512.png', rozmiar: 512 },
  { zrodlo: 'icon-maskable.svg', wynik: 'icon-maskable-512.png', rozmiar: 512 },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
});

for (const { zrodlo, wynik, rozmiar } of zadania) {
  const svg = readFileSync(join(katalog, zrodlo), 'utf8')
    .replace(/width="64"/, `width="${rozmiar}"`)
    .replace(/height="64"/, `height="${rozmiar}"`);
  const page = await browser.newPage({ viewport: { width: rozmiar, height: rozmiar } });
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  writeFileSync(join(katalog, wynik), await page.locator('svg').screenshot());
  await page.close();
  console.log(`${wynik} — ${rozmiar}×${rozmiar}`);
}

await browser.close();
