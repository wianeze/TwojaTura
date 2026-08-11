/**
 * Cennik Renomy (Economy V2).
 *
 * Musi odpowiadać `private.point_reward_for` z migracji
 * 20260810120000_economy_v2_price_list.sql — baza jest źródłem prawdy, ta
 * lista służy wyłącznie prezentacji i panelowi korekt administratora.
 *
 * Historyczne `play_logged` (40 Renomy dla osoby wpisującej partię) oraz
 * `meeting_created` (25 Renomy za wypełnienie formularza)
 * celowo NIE figurują w katalogu: po Economy V2 nie da się ich już ani
 * przyznać, ani odwrócić. Zdarzenia z tamtej ery zostają w księdze i mają
 * własne etykiety w `features/legendarium/formatting.ts`.
 */
export const pointActionCatalog = [
  {
    value: "shelf_first_game",
    label: "Dodanie pierwszej gry do Półki",
    points: 10,
  },
  {
    value: "shelf_5_games",
    label: "Dodanie 5 gier do wspólnej Półki",
    points: 15,
  },
  {
    value: "shelf_10_games",
    label: "Dodanie 10 gier do wspólnej Półki",
    points: 20,
  },
  {
    value: "shelf_15_games",
    label: "Dodanie 15 gier do wspólnej Półki",
    points: 25,
  },
  { value: "meeting_hosted", label: "Zorganizowane spotkanie", points: 5 },
  { value: "meeting_rsvp", label: "Odpowiedź na spotkanie", points: 2 },
  { value: "meeting_vote", label: "Głos na grę", points: 1 },
  { value: "rating_created", label: "Ocena gry", points: 3 },
  { value: "play_participated", label: "Udział w partii", points: 5 },
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
