import type {
  PlayMode,
  PlayParticipantDraft,
  PlayStatus,
  PlayTeamResult,
} from "./types";

export function addParticipantDraft(
  drafts: PlayParticipantDraft[],
  userId: string,
  status: PlayStatus,
  mode: PlayMode = "competitive",
  teamResult: PlayTeamResult | "" = "",
): PlayParticipantDraft[] {
  return [
    ...drafts,
    {
      userId,
      // W kooperacji o zwycięstwie decyduje wynik drużyny, więc nowy uczestnik
      // od razu dziedziczy stan reszty ekipy. W rywalizacji zostaje dotychczasowe
      // zachowanie: pierwszy dodany gracz ukończonej partii jest zwycięzcą.
      isWinner:
        mode === "cooperative"
          ? status === "completed" && teamResult === "win"
          : status === "completed" && drafts.length === 0,
      placement: "",
      score: "",
    },
  ];
}

/**
 * Kooperacja nie zna miejsc — przy przejściu z trybu rywalizacyjnego trzeba je
 * wyzerować, inaczej walidacja odrzuci zapis (miejsca w coopie są zabronione).
 */
export function clearParticipantPlacements(
  drafts: PlayParticipantDraft[],
): PlayParticipantDraft[] {
  if (!drafts.some((draft) => draft.placement !== "")) return drafts;
  return drafts.map((draft) => ({ ...draft, placement: "" }));
}

/**
 * W kooperacji wszyscy dzielą wynik drużyny: albo wszyscy wygrali, albo nikt.
 */
export function applyTeamResultToDrafts(
  drafts: PlayParticipantDraft[],
  status: PlayStatus,
  teamResult: PlayTeamResult | "",
): PlayParticipantDraft[] {
  const isWinner = status === "completed" && teamResult === "win";
  if (drafts.every((draft) => draft.isWinner === isWinner)) return drafts;
  return drafts.map((draft) => ({ ...draft, isWinner }));
}

export function clearParticipantWinners(
  drafts: PlayParticipantDraft[],
): PlayParticipantDraft[] {
  if (!drafts.some((draft) => draft.isWinner)) return drafts;
  return drafts.map((draft) => ({ ...draft, isWinner: false }));
}
