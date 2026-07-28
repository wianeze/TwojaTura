// Minimalny service worker dla instalowalności PWA.
// Celowo bez cache Cache API i bez trybu offline — czysty network passthrough.
// Nie przechwytuje: żądań spoza originu (m.in. Supabase), metod innych niż GET
// (obejmuje to Server Actions, zawsze POST), oraz stron Auth.

const AUTH_PATH_PREFIXES = [
  "/logowanie",
  "/ustaw-haslo",
  "/potwierdz-reset",
  "/brak-dostepu",
  "/auth/",
];

function isAuthPath(pathname) {
  return AUTH_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (isAuthPath(url.pathname)) {
    return;
  }

  event.respondWith(fetch(request));
});
