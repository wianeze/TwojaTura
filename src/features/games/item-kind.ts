/**
 * Typ pozycji na Półce: gra samodzielna vs dodatek.
 *
 * Baza trzyma to jako `games.is_expansion boolean` z TRZEMA stanami:
 *
 *   false — gra samodzielna, dopuszczona do Misji „Pierwszy Rozdział”,
 *   true  — dodatek albo inna pozycja niesamodzielna,
 *   null  — jeszcze nierozstrzygnięte.
 *
 * `null` jest fail-safe: warunek kwalifikacji w `private.mission_candidates`
 * brzmi ściśle `is_expansion = false`, więc pozycja bez klasyfikacji nigdy nie
 * wygeneruje Misji. Trzeci stan jest więc realną wartością domenową, a nie
 * brakiem danych do ukrycia — dlatego formularz dostaje listę wyboru, a nie
 * checkbox, którego dwa stany nie umiałyby go wyrazić.
 */
export const GAME_ITEM_KINDS = ["standalone", "expansion", "unknown"] as const;

export type GameItemKind = (typeof GAME_ITEM_KINDS)[number];

export const GAME_ITEM_KIND_LABELS: Record<GameItemKind, string> = {
  standalone: "Gra samodzielna",
  expansion: "Dodatek",
  unknown: "Nierozstrzygnięte",
};

const kindSet = new Set<string>(GAME_ITEM_KINDS);

export function isGameItemKind(value: string): value is GameItemKind {
  return kindSet.has(value);
}

/** Stan z bazy → wartość pola formularza. */
export function toGameItemKind(
  isExpansion: boolean | null | undefined,
): GameItemKind {
  if (isExpansion === true) return "expansion";
  if (isExpansion === false) return "standalone";
  return "unknown";
}

/** Wartość pola formularza → stan zapisywany w bazie. */
export function toIsExpansion(kind: GameItemKind): boolean | null {
  if (kind === "expansion") return true;
  if (kind === "standalone") return false;
  return null;
}

/**
 * Odpowiedź BGG → wartość pola formularza.
 *
 * BGG rozstrzyga to atrybutem `type` elementu `<item>`, więc `null` oznacza
 * wyłącznie „BGG nie powiedziało”, a nie „to gra samodzielna”. Podpowiedź jest
 * zawsze poprawialna ręcznie: standalone expansion (np. samodzielna odsłona
 * grywalna bez bazy) bywa w BGG oznaczony jako dodatek, mimo że w praktyce
 * kwalifikuje się do Pierwszego Rozdziału.
 */
export function toGameItemKindFromBgg(
  isExpansion: boolean | null,
): GameItemKind {
  return toGameItemKind(isExpansion);
}
