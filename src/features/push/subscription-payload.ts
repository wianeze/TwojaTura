/**
 * `applicationServerKey` w `pushManager.subscribe()` przyjmuje surowe bajty,
 * a klucz VAPID jest publikowany w base64url. Konwersja musi odtworzyć
 * padding (`=`) i zamienić alfabet URL-safe na standardowy, inaczej `atob`
 * odrzuci wejście albo — gorzej — zwróci krótszy klucz i subskrypcja powstanie
 * dla cudzego serwera aplikacji.
 */
export function urlBase64ToUint8Array(
  base64String: string,
): Uint8Array<ArrayBuffer> {
  const trimmed = base64String.trim();

  if (trimmed.length === 0) {
    throw new Error("Publiczny klucz VAPID jest pusty.");
  }

  const padding = "=".repeat((4 - (trimmed.length % 4)) % 4);
  const base64 = (trimmed + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = atob(base64);
  // Jawny ArrayBuffer, a nie ArrayBufferLike: `applicationServerKey` przyjmuje
  // BufferSource, który nie dopuszcza SharedArrayBuffer.
  const output = new Uint8Array(new ArrayBuffer(rawData.length));

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}

export type SerializedPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushSubscriptionLike = {
  toJSON: () => {
    endpoint?: string | null;
    keys?: { p256dh?: string | null; auth?: string | null } | null;
  };
};

/**
 * `PushSubscription.toJSON()` może zwrócić obiekt bez `keys`, jeśli
 * subskrypcja powstała bez `userVisibleOnly` albo została unieważniona.
 * Wtedy lepiej dostać czytelny błąd tutaj niż `null` w kolumnie `p256dh`
 * i niewysyłalną subskrypcję odkrytą dopiero przy pierwszej kampanii.
 */
export function serializePushSubscription(
  subscription: PushSubscriptionLike,
): SerializedPushSubscription {
  const payload = subscription.toJSON();
  const endpoint = payload.endpoint?.trim() ?? "";
  const p256dh = payload.keys?.p256dh?.trim() ?? "";
  const auth = payload.keys?.auth?.trim() ?? "";

  if (endpoint.length === 0) {
    throw new Error("Subskrypcja push nie ma adresu endpointu.");
  }

  if (p256dh.length === 0 || auth.length === 0) {
    throw new Error("Subskrypcja push nie zawiera kluczy szyfrujących.");
  }

  return { endpoint, p256dh, auth };
}
