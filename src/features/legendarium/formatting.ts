export const pointActionLabels: Record<string, string> = {
  shelf_first_game: "Dodanie pierwszej gry do Półki",
  shelf_5_games: "Dodanie 5 gier do wspólnej Półki",
  shelf_10_games: "Dodanie 10 gier do wspólnej Półki",
  shelf_15_games: "Dodanie 15 gier do wspólnej Półki",
  meeting_created: "Zaproponowanie spotkania",
  meeting_rsvp: "Odpowiedź na spotkanie",
  meeting_vote: "Głos na grę",
  rating_created: "Ocena gry",
  play_logged: "Zapis partii w Kronice",
  admin_adjustment: "Korekta administratora",
};

export function formatPointAction(actionType: string) {
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
