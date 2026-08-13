/*
 * Semantyczne warianty przycisków akcji. Barwa jest przypisana do akcji,
 * nie do miejsca w interfejsie — ta sama akcja wygląda tak samo na Stole,
 * w Kalendarium, w Kronice, na Półce i na karcie gry.
 *
 * Wygląd wariantów żyje w globals.css (klasy .action-btn / .act-* /
 * .action-size-*). Tutaj jest tylko składanie nazw klas.
 */

export type ActionVariant =
  | "meeting"
  | "vote"
  | "chronicle"
  | "rating"
  | "shelf"
  | "neutral"
  | "danger"
  | "library"
  | "play"
  | "finish"
  | "session"
  | "newPlay"
  | "endPlay"
  | "replay";

export type ActionSize = "compact" | "default" | "large" | "hero";

/*
 * Poziom prezentacji jest niezależny od barwy domenowej — ta sama akcja
 * może być główna na jednym ekranie i drugorzędna na innym, nie zmieniając
 * przy tym koloru.
 *   primary   — wypełnienie, główna akcja na danej powierzchni,
 *   secondary — jasna pergaminowa płytka, akcja drugorzędna,
 *   ghost     — sam tekst w jasnym odcieniu barwy.
 *
 * Uwaga: ghost jest przeznaczony wyłącznie na ciemne tło (drewno, panele
 * hero). Na pergaminie jego jasny tekst przestaje być czytelny — tam
 * właściwym wyborem dla akcji drugorzędnej jest secondary.
 */
export type ActionEmphasis = "primary" | "secondary" | "ghost";

export function actionButtonClasses({
  action,
  size = "default",
  emphasis = "primary",
  pill = false,
  fullWidth = false,
  className = "",
}: {
  action: ActionVariant;
  size?: ActionSize;
  emphasis?: ActionEmphasis;
  // Kapsułka tylko tam, gdzie naturalnie pasuje: małe kontrolki
  // nawigacyjne i filtry.
  pill?: boolean;
  fullWidth?: boolean;
  className?: string;
}) {
  return [
    "action-btn",
    `act-${action}`,
    `action-size-${size}`,
    emphasis === "primary" ? "" : `action-emph-${emphasis}`,
    pill ? "action-pill" : "",
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}
