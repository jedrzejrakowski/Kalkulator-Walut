/**
 * Składa produkcyjny build w jeden samodzielny plik HTML.
 *
 * Hosting artefaktów podaje własne <head> i <body>, a polityka bezpieczeństwa
 * wpuszcza skrypty wyłącznie z kilku CDN-ów. Bundle aplikacji musi więc trafić
 * do pliku w całości, bez odwołań do plików obok.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'dist', 'assets');
const files = readdirSync(assets);

const pick = (extension) => {
  const name = files.find((file) => file.endsWith(extension));
  if (!name) throw new Error(`Brak pliku ${extension} w dist/assets — uruchom najpierw npm run build.`);
  return readFileSync(join(assets, name), 'utf8');
};

const css = pick('.css');
const js = pick('.js');

const title = readFileSync(join(root, 'index.html'), 'utf8').match(/<title>(.*?)<\/title>/s)?.[1];
const fonts = readFileSync(join(root, 'index.html'), 'utf8').match(
  /href="(https:\/\/fonts\.googleapis\.com\/css2[^"]*)"/,
)?.[1];

const html = `<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;

const out = join(root, 'dist-artifact');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'kalkulator.html'), html);
console.log(`Zapisano ${join(out, 'kalkulator.html')} — ${(html.length / 1024).toFixed(0)} kB`);
