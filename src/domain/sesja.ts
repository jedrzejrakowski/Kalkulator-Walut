/**
 * Sesja logowania widziana od strony przeglądarki.
 *
 * Właściwe ciasteczko sesji jest niedostępne dla skryptów (HttpOnly). Serwer
 * stawia obok jawne ciasteczko z identyfikatorem: aplikacja wie z niego, czy
 * pokazać konto i czyją historię wczytać. Nic więcej ono nie daje — bez
 * podpisanej sesji serwer i tak nie wyda aplikacji.
 */

export const ADRES_WYLOGOWANIA = '/api/wyloguj';
/** Nagłówek dołączany do każdego zapytania API — serwer bez niego odmawia. */
export const NAGLOWEK_API = 'X-Kalkulator';

const WZOR_LOGINU = /^[a-z0-9][a-z0-9._-]{1,31}$/;

/** Identyfikator zalogowanej osoby; null w wersji lokalnej i jednoplikowej. */
export function zalogowanyJako(ciasteczka: string): string | null {
  for (const para of ciasteczka.split(';')) {
    const [k, ...v] = para.trim().split('=');
    if (k === 'kw_zalogowany') {
      const login = v.join('=');
      return WZOR_LOGINU.test(login) ? login : null;
    }
  }
  return null;
}

/**
 * Wylogowanie: najpierw kopia offline, potem ciasteczka.
 *
 * Bez skasowania kopii aplikacja otworzyłaby się dalej z pamięci
 * przeglądarki, gdy zabraknie sieci — już po wylogowaniu.
 */
export async function wyloguj(): Promise<void> {
  try {
    if ('caches' in window) {
      const klucze = await caches.keys();
      await Promise.all(klucze.map((k) => caches.delete(k)));
    }
  } catch {
    // Brak dostępu do pamięci podręcznej nie może zablokować wylogowania.
  }
  window.location.assign(ADRES_WYLOGOWANIA);
}
