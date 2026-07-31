// Minimalny service worker dla instalowalności PWA i powiadomień Web Push.
// Celowo bez cache Cache API i bez trybu offline — czysty network passthrough.
// Nie przechwytuje: żądań spoza originu (m.in. Supabase), metod innych niż GET
// (obejmuje to Server Actions, zawsze POST), oraz stron Auth.
//
// Obsługa push: zdarzenia `push` i `notificationclick`. Cel kliknięcia jest
// walidowany tutaj jeszcze raz, mimo że pilnuje go już constraint w bazie
// i walidacja w Server Action — każdą z tych warstw da się ominąć osobno.

const NOTIFICATION_ICON = "/icons/pwa-startup-192.png";
const DEFAULT_NOTIFICATION_TITLE = "Twoja Tura!";
const MAX_TARGET_PATH_LENGTH = 300;

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

// Lustrzana implementacja isSafeInternalPath z
// src/features/push/validation.ts. Service worker jest zwykłym plikiem .js
// bez bundlera, więc nie da się jej zaimportować — obie muszą pozostać zgodne.
function isSafeInternalPath(value) {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > MAX_TARGET_PATH_LENGTH) return false;

  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x1f || codePoint === 0x7f) return false;
  }

  if (value === "/") return true;
  if (value[0] !== "/") return false;
  // Protocol-relative (//host) i backslash prowadzą do obcego originu.
  if (value[1] === "/" || value[1] === "\\") return false;
  if (value.includes("://")) return false;

  return true;
}

function resolveNotificationTarget(data) {
  if (!data || typeof data !== "object") return "/";
  return isSafeInternalPath(data.url) ? data.url : "/";
}

self.addEventListener("push", (event) => {
  let payload = {};

  // Payload jest szyfrowany i pochodzi z naszego serwera, ale service worker
  // musi przeżyć także śmieci — inaczej urządzenie zostaje bez powiadomienia.
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title =
    typeof payload.title === "string" && payload.title.trim().length > 0
      ? payload.title
      : DEFAULT_NOTIFICATION_TITLE;

  const options = {
    body: typeof payload.body === "string" ? payload.body : "",
    icon: NOTIFICATION_ICON,
    data: { url: resolveNotificationTarget(payload) },
  };

  // Ten sam tag przy ponowionej dostawie zastępuje poprzednie powiadomienie
  // zamiast układać stos duplikatów.
  if (typeof payload.tag === "string" && payload.tag.length > 0) {
    options.tag = payload.tag;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = resolveNotificationTarget(event.notification.data);

  event.waitUntil(
    (async () => {
      const targetUrl = new URL(target, self.location.origin).href;
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windowClients) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        if (!("focus" in client)) continue;

        await client.focus();

        if ("navigate" in client) {
          try {
            await client.navigate(targetUrl);
          } catch {
            // Część przeglądarek odmawia navigate na kliencie, którego nie
            // kontroluje. Karta jest już na wierzchu — to wystarczy.
          }
        }

        return;
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
