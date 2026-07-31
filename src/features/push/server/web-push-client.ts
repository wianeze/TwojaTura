import "server-only";

import webpush from "web-push";
import { classifyWebPushError } from "../error-classification";
import { isSafeInternalPath } from "../validation";
import type { PushSendOutcome } from "../types";

/**
 * Jedyne miejsce w repo importujące `web-push`.
 *
 * Adapter izoluje bibliotekę od reszty aplikacji i udostępnia własny typ
 * wyniku, więc akcje serwerowe, Route Handler i panel administratora nie
 * znają ani `WebPushError`, ani kształtu jej odpowiedzi. Wymiana biblioteki
 * to zmiana wyłącznie w tym pliku.
 *
 * Node runtime jest obowiązkowy: `web-push` używa `node:crypto`.
 */
export type WebPushTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type WebPushPayload = {
  title: string;
  body: string;
  url: string;
  /**
   * Tożsamość powiadomienia dla systemu. Ponowiona dostawa ma ten sam tag,
   * więc zastępuje poprzednie powiadomienie zamiast układać stos duplikatów.
   */
  tag?: string;
};

let vapidConfigured = false;

function configureVapid(): void {
  if (vapidConfigured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "Brakuje konfiguracji VAPID. Uzupełnij NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY i VAPID_SUBJECT.",
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT,
  );
}

export async function sendWebPush(
  target: WebPushTarget,
  payload: WebPushPayload,
): Promise<PushSendOutcome> {
  configureVapid();

  // Ostatnia bramka przed wysyłką: cel kliknięcia zawsze musi być ścieżką
  // wewnętrzną. Baza pilnuje tego constraintem, ale payload składamy tutaj.
  const url = isSafeInternalPath(payload.url) ? payload.url : "/";

  try {
    await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url,
        tag: payload.tag ?? null,
      }),
      { TTL: 60 * 60 * 24 },
    );

    // Rozwiązany Promise oznacza sukces. Świadomie nie sprawdzamy własnej
    // listy kodów 2xx — dostawcy zwracają różne (200, 201, 202), a biblioteka
    // już zdecydowała, że żądanie się powiodło.
    return { kind: "sent" };
  } catch (error) {
    return classifyWebPushError(error);
  }
}
