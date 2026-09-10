/**
 * Pamięć podręczna aplikacji.
 *
 * Strategia: najpierw sieć, kopia lokalna dopiero gdy sieci brak. Odwrotna
 * kolejność byłaby tu niebezpieczna — poprawka reguł podatkowych mogłaby
 * utknąć w pamięci przeglądarki i kalkulator liczyłby po staremu.
 */
const PAMIEC = 'kalkulator-walut-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (zdarzenie) => {
  zdarzenie.waitUntil(
    caches
      .keys()
      .then((klucze) => Promise.all(klucze.filter((k) => k !== PAMIEC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (zdarzenie) => {
  const zapytanie = zdarzenie.request;
  if (zapytanie.method !== 'GET') return;
  if (new URL(zapytanie.url).origin !== self.location.origin) return;

  zdarzenie.respondWith(
    fetch(zapytanie)
      .then((odpowiedz) => {
        if (odpowiedz.ok) {
          const kopia = odpowiedz.clone();
          caches.open(PAMIEC).then((pamiec) => pamiec.put(zapytanie, kopia));
        }
        return odpowiedz;
      })
      .catch(async () => {
        const zapamietane = await caches.match(zapytanie);
        if (zapamietane) return zapamietane;
        if (zapytanie.mode === 'navigate') {
          const powloka = await caches.match('./index.html');
          if (powloka) return powloka;
        }
        return new Response('Brak połączenia i brak zapisanej kopii.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }),
  );
});
