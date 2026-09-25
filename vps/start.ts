/**
 * Uruchomienie serwera: `node dist-vps/serwer.mjs`.
 *
 * Hasło bierzemy z pliku przekazanego przez systemd (LoadCredential) —
 * plik może czytać tylko administrator, a usługa dostaje własną kopię.
 * Zmienna KALKULATOR_HASLO działa jako zapas, np. przy próbie na laptopie.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { utworzSerwer } from './serwer';

async function wczytajHaslo(): Promise<string | undefined> {
  const katalog = process.env.CREDENTIALS_DIRECTORY;
  if (katalog) {
    try {
      // Tylko końcowy znak nowej linii — spacje mogą być częścią hasła.
      return (await readFile(path.join(katalog, 'haslo'), 'utf8')).replace(/\r?\n$/, '');
    } catch {
      // Brak pliku — spróbujemy zmiennej.
    }
  }
  return process.env.KALKULATOR_HASLO;
}

const haslo = await wczytajHaslo();
const katalog = process.env.KATALOG ?? fileURLToPath(new URL('../dist', import.meta.url));
const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '127.0.0.1';

if (!haslo) {
  console.error('Brak hasła — kalkulator będzie odmawiał dostępu. Ustaw je: sudo bash vps/haslo.sh');
}

const serwer = utworzSerwer({ katalog, haslo });
serwer.listen(port, host, () => {
  console.log(`Kalkulator walut: http://${host}:${port}, pliki z ${katalog}`);
});

for (const sygnal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sygnal, () => serwer.close(() => process.exit(0)));
}
