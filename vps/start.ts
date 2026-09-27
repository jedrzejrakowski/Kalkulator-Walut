/**
 * Uruchomienie serwera i polecenia administracyjne.
 *
 *   node serwer.mjs                 serwer
 *   node serwer.mjs admin <login>   załóż administratora albo nadaj mu nowe hasło
 *                                   (hasło w zmiennej NOWE_HASLO)
 *   node serwer.mjs lista           konta
 *
 * Polecenie `admin` to też droga ratunkowa, gdy administrator zapomni hasła.
 * Konta i klucz sesji leżą w katalogu stanu: systemd podaje go w
 * STATE_DIRECTORY, a przy próbach na własnym komputerze — zmienna STAN.
 */
import { randomBytes } from 'node:crypto';
import { watchFile } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { utworzSerwer } from './serwer';
import {
  BladKonta,
  dodaj,
  Magazyn,
  normalizujLogin,
  skrotHasla,
  sprawdzHasloNowe,
  sprawdzLogin,
  ustawHaslo,
  ustawUprawnienia,
} from './uzytkownicy';

const stan = process.env.STATE_DIRECTORY?.split(':')[0] ?? process.env.STAN ?? path.resolve('stan');
const magazyn = new Magazyn(path.join(stan, 'uzytkownicy.json'));

/** Klucz podpisu sesji: losowy, tworzony przy pierwszym starcie. */
async function kluczSesji(): Promise<Buffer> {
  const plik = path.join(stan, 'klucz');
  try {
    const k = await readFile(plik);
    if (k.length >= 32) return k;
  } catch {
    // Nie ma jeszcze — tworzymy.
  }
  const k = randomBytes(32);
  await writeFile(plik, k, { mode: 0o600 });
  return k;
}

async function admin(surowy: string | undefined): Promise<void> {
  const login = normalizujLogin(surowy ?? '');
  sprawdzLogin(login);
  const haslo = process.env.NOWE_HASLO ?? '';
  sprawdzHasloNowe(haslo, login);
  const skrot = await skrotHasla(haslo);
  let bylo = false;
  await magazyn.zmien((lista) => {
    bylo = lista.some((u) => u.login === login);
    if (!bylo) return dodaj(lista, { login, admin: true, haslo: skrot, wymagaZmiany: false });
    return ustawUprawnienia(ustawHaslo(lista, login, skrot, false), login, true, '');
  });
  console.log(bylo ? `Konto ${login}: nowe hasło, uprawnienia administratora.` : `Założono administratora ${login}.`);
}

async function lista(): Promise<void> {
  const konta = await magazyn.wszyscy();
  if (konta.length === 0) console.log('Brak kont.');
  for (const u of konta) {
    const rola = u.admin ? 'administrator' : 'użytkownik';
    const haslo = u.wymagaZmiany ? ', hasło startowe' : '';
    console.log(`${u.login.padEnd(20)} ${rola}${haslo}`);
  }
}

async function serwer(): Promise<void> {
  const klucz = await kluczSesji();
  const katalog = process.env.KATALOG ?? fileURLToPath(new URL('../dist', import.meta.url));
  const port = Number(process.env.PORT ?? 8080);
  const host = process.env.HOST ?? '127.0.0.1';

  if ((await magazyn.wszyscy()).length === 0) {
    console.error('Brak kont — kalkulator będzie odmawiał dostępu. Załóż administratora: sudo bash vps/admin.sh <login>');
  }

  const s = utworzSerwer({ katalog, kontekst: { magazyn, klucz } });
  s.listen(port, host, () => {
    console.log(`Kalkulator walut: http://${host}:${port}, pliki z ${katalog}, konta w ${magazyn.plik}`);
  });
  const zakoncz = () => s.close(() => process.exit(0));
  for (const sygnal of ['SIGTERM', 'SIGINT'] as const) process.on(sygnal, zakoncz);

  // Nową wersję wgrywa GitHub Actions jako użytkownik bez prawa do
  // restartu usług. Serwer sam zauważa podmianę swojego pliku i kończy
  // pracę, a Docker (restart: unless-stopped) uruchamia go od nowa.
  if (process.env.KONIEC_PRZY_ZMIANIE === '1') {
    const plik = fileURLToPath(import.meta.url);
    watchFile(plik, { interval: 3000 }, (teraz, przedtem) => {
      if (teraz.mtimeMs !== przedtem.mtimeMs || teraz.ino !== przedtem.ino) {
        console.log('Nowa wersja serwera — uruchamiam ponownie.');
        zakoncz();
      }
    });
  }
}

await mkdir(stan, { recursive: true, mode: 0o700 });
const [polecenie, argument] = process.argv.slice(2);
try {
  if (polecenie === 'admin') await admin(argument);
  else if (polecenie === 'lista') await lista();
  else if (polecenie === undefined) await serwer();
  else throw new BladKonta(1, `Nieznane polecenie: ${polecenie}. Dostępne: admin <login>, lista.`);
} catch (e) {
  if (!(e instanceof BladKonta)) throw e;
  console.error(e.message);
  process.exitCode = 1;
}
