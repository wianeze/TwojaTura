import { isSafeInternalPath } from "./validation.ts";

/**
 * Referencyjna implementacja rozstrzygania celu kliknięcia w powiadomienie.
 *
 * Service worker (`public/sw.js`) jest zwykłym plikiem `.js` bez bundlera,
 * więc nie może tego zaimportować i ma własną, lustrzaną kopię. Ta wersja
 * istnieje po to, żeby regułę dało się przetestować jednostkowo; test
 * dodatkowo sprawdza, czy `sw.js` nie rozjechał się z tym zachowaniem.
 *
 * Wszystko, co nie jest bezpieczną ścieżką wewnętrzną, ląduje na „/” —
 * powiadomienie nigdy nie otworzy obcego originu.
 */
export function resolveNotificationTarget(data: unknown): string {
  if (typeof data !== "object" || data === null) return "/";

  const url = (data as { url?: unknown }).url;
  if (typeof url !== "string") return "/";

  return isSafeInternalPath(url) ? url : "/";
}
