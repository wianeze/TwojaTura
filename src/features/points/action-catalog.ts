export const pointActionCatalog = [
  {
    value: "shelf_first_game",
    label: "Dodanie pierwszej gry do Półki",
    points: 40,
  },
  {
    value: "shelf_5_games",
    label: "Dodanie 5 gier do wspólnej Półki",
    points: 30,
  },
  {
    value: "shelf_10_games",
    label: "Dodanie 10 gier do wspólnej Półki",
    points: 20,
  },
  {
    value: "shelf_15_games",
    label: "Dodanie 15 gier do wspólnej Półki",
    points: 15,
  },
  { value: "meeting_created", label: "Zaproponowanie spotkania", points: 25 },
  { value: "meeting_rsvp", label: "Odpowiedź na spotkanie", points: 10 },
  { value: "meeting_vote", label: "Głos na grę", points: 10 },
  { value: "rating_created", label: "Ocena gry", points: 30 },
  { value: "play_logged", label: "Zapis partii w Kronice", points: 40 },
] as const;

export type PointActionType = (typeof pointActionCatalog)[number]["value"];

export const pointActionLabels: Record<PointActionType, string> =
  Object.fromEntries(
    pointActionCatalog.map((action) => [action.value, action.label]),
  ) as Record<PointActionType, string>;

export function isPointActionType(value: string): value is PointActionType {
  return pointActionCatalog.some((action) => action.value === value);
}

export function getPointAction(value: PointActionType) {
  return pointActionCatalog.find((action) => action.value === value)!;
}
