/**
 * Wejście dla Vercel: ten plik uruchamia się przed każdym żądaniem do
 * wdrożenia. Cała logika jest w `src/serwer/ochrona.ts`, gdzie da się ją
 * przetestować; tu tylko podajemy hasło z ustawień projektu.
 *
 * Hasło ustawia się w panelu Vercel: Settings → Environment Variables,
 * zmienna KALKULATOR_HASLO. Po zmianie trzeba wdrożyć projekt ponownie.
 */
import { obsluz } from './src/serwer/ochrona';

// Vercel podaje zmienne środowiskowe przez `process.env` także w tym środowisku.
declare const process: { env: Record<string, string | undefined> };

export default function middleware(zapytanie: Request): Promise<Response> {
  return obsluz(zapytanie, process.env.KALKULATOR_HASLO);
}
