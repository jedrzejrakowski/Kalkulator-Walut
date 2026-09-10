/**
 * Składa produkcyjny build w samodzielne pliki HTML.
 *
 * Powstają dwa, bo służą do różnych rzeczy:
 *
 *   kalkulator.html          pełny dokument do otwarcia z dysku — ma deklarację
 *                            typu, kodowanie i znacznik viewport, bez którego
 *                            telefon renderuje stronę na 980 pikselach
 *                            i pomniejsza ją do nieczytelności;
 *
 *   kalkulator-fragment.html sama treść strony, do hostingu podstawiającego
 *                            własny szkielet dokumentu.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const NAZWA = 'kalkulator-walut';

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

const zrodlo = readFileSync(join(root, 'index.html'), 'utf8');
const title = zrodlo.match(/<title>(.*?)<\/title>/s)?.[1] ?? NAZWA;
const fonts = zrodlo.match(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]*)"/)?.[1];

const glowa = [
  `<title>${title}</title>`,
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  fonts ? `<link rel="stylesheet" href="${fonts}">` : '',
  `<style>\n${css}\n</style>`,
].filter(Boolean).join('\n');

const cialo = `<div id="root"></div>\n<script type="module">\n${js}\n</script>`;

const dokument = `<!doctype html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${glowa}
</head>
<body>
${cialo}
</body>
</html>
`;

const out = join(root, 'dist-artifact');
mkdirSync(out, { recursive: true });

for (const [plik, tresc] of [
  [`${NAZWA}.html`, dokument],
  [`${NAZWA}-fragment.html`, `${glowa}\n${cialo}\n`],
]) {
  writeFileSync(join(out, plik), tresc);
  console.log(`${plik} — ${(tresc.length / 1024).toFixed(0)} kB`);
}
