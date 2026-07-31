import type { PushFailureOutcome } from "./types";

/** Dostawca potwierdził, że endpoint już nie istnieje. */
const EXPIRED_STATUS_CODES = new Set([404, 410]);

/** Przeciążenie albo awaria po stronie dostawcy — warto spróbować później. */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/**
 * Błędy żądania: zły payload, zły VAPID, za duży payload. Ponawianie nic tu
 * nie zmieni, ale — inaczej niż przy 404/410 — subskrypcja NIE jest wyłączana:
 * 403 to najczęściej niezgodny klucz VAPID, czyli błąd konfiguracji serwera.
 * Automatyczne kasowanie subskrypcji przy literówce w VAPID_PRIVATE_KEY
 * skasowałoby powiadomienia wszystkim naraz.
 */
const PERMANENT_STATUS_CODES = new Set([400, 401, 403, 413]);

const SAFE_ERROR_CODE = /[^a-zA-Z0-9_:-]/g;

function sanitizeErrorCode(value: string): string {
  const sanitized = value.replace(SAFE_ERROR_CODE, "").slice(0, 40);
  return sanitized.length > 0 ? sanitized : "unknown_error";
}

function readStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;

  const statusCode = (error as { statusCode?: unknown }).statusCode;

  return typeof statusCode === "number" && Number.isFinite(statusCode)
    ? statusCode
    : null;
}

function readNetworkErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.length > 0) {
      return sanitizeErrorCode(`network_${code.toLowerCase()}`);
    }
  }

  return "network_error";
}

/**
 * Klasyfikator obsługuje WYŁĄCZNIE błędy. Sukces rozpoznaje adapter po tym,
 * że `webpush.sendNotification()` rozwiązał Promise — nie po własnej liście
 * kodów 2xx, bo dostawcy zwracają różne (200, 201, 202) i nasza lista mogłaby
 * rozjechać się z biblioteką.
 */
export function classifyWebPushError(error: unknown): PushFailureOutcome {
  const statusCode = readStatusCode(error);

  if (statusCode === null) {
    return {
      kind: "retryable_failure",
      errorCode: readNetworkErrorCode(error),
    };
  }

  const errorCode = `http_${statusCode}`;

  if (EXPIRED_STATUS_CODES.has(statusCode)) {
    return { kind: "expired_subscription", errorCode };
  }

  if (RETRYABLE_STATUS_CODES.has(statusCode)) {
    return { kind: "retryable_failure", errorCode };
  }

  if (PERMANENT_STATUS_CODES.has(statusCode)) {
    return { kind: "permanent_failure", errorCode };
  }

  // Nieznany kod: konserwatywnie kończymy, zamiast zapętlać ponawianie.
  return { kind: "permanent_failure", errorCode };
}
