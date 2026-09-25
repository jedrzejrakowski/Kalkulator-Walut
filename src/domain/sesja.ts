/**
 * Sesja logowania widziana od strony przeglądarki.
 *
 * Właściwe ciasteczko sesji jest niedostępne dla skryptów (HttpOnly), więc
 * aplikacja nie wie, czy ktoś jest zalogowany. Serwer stawia obok jawny
 * znacznik — tylko po to, żeby było wiadomo, czy pokazać „Wyloguj". Nic więcej
 * on nie daje: bez podpisanego ciasteczka serwer i tak nie wyda aplikacji.
 */

export const ADRES_WYLOGOWANIA = '/api/wyloguj';

/** Czy stoi znacznik logowania. W wersji lokalnej i jednoplikowej nie stoi nigdy. */
export function czyZalogowany(ciasteczka: string): boolean {
  return ciasteczka.split(';').some((c) => c.trim() === 'kw_zalogowany=1');
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
