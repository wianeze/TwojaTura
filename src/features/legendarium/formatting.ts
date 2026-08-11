import {
  isPointActionType,
  pointActionLabels as catalogPointActionLabels,
} from "../points/action-catalog.ts";

export const pointActionLabels: Record<string, string> = {
  ...catalogPointActionLabels,
  admin_adjustment: "Korekta administratora",
  // Zdarzenia sprzed Economy V2. Nie ma ich w katalogu (nie da się ich już
  // przyznać), ale zostają w księdze i muszą mieć czytelną etykietę.
  play_logged: "Zapis partii w Kronice",
  meeting_created: "Utworzenie spotkania",
};

export function formatPointAction(actionType: string) {
  if (actionType.startsWith("admin_award:")) {
    const correctedAction = actionType.slice("admin_award:".length);
    const label = isPointActionType(correctedAction)
      ? catalogPointActionLabels[correctedAction]
      : "akcja punktowa";
    return `Korekta Mistrza Gry — ${label}`;
  }

  if (actionType.startsWith("admin_reversal:")) {
    const correctedAction = actionType.slice("admin_reversal:".length);
    const label = isPointActionType(correctedAction)
      ? catalogPointActionLabels[correctedAction]
      : "akcja punktowa";
    return `Wycofanie korekty — ${label}`;
  }

  return pointActionLabels[actionType] ?? "Zdarzenie punktowe";
}

export function formatPointEventDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatPoints(points: number) {
  return `${points > 0 ? "+" : ""}${points.toLocaleString("pl-PL")} pkt`;
}
