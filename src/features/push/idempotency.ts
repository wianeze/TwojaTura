/**
 * Token idempotencji ręcznej kampanii.
 *
 * Powstaje w formularzu PRZED otwarciem modala potwierdzenia i wędruje razem
 * z żądaniem, więc dwa kliknięcia tego samego formularza trafiają na ten sam
 * `dedupe_key` i dają jedną kampanię. Nowy token generujemy dopiero po
 * udanym wysłaniu.
 */
export function createIdempotencyKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  // Zapasowa ścieżka dla środowisk bez Web Crypto. Unikalność jest tu
  // wymagana tylko w obrębie jednej sesji formularza.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
