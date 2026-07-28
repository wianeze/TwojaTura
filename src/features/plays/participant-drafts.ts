import type { PlayParticipantDraft, PlayStatus } from "./types";

export function addParticipantDraft(
  drafts: PlayParticipantDraft[],
  userId: string,
  status: PlayStatus,
): PlayParticipantDraft[] {
  return [
    ...drafts,
    {
      userId,
      isWinner: status === "completed" && drafts.length === 0,
      placement: "",
      score: "",
    },
  ];
}

export function clearParticipantWinners(
  drafts: PlayParticipantDraft[],
): PlayParticipantDraft[] {
  if (!drafts.some((draft) => draft.isWinner)) return drafts;
  return drafts.map((draft) => ({ ...draft, isWinner: false }));
}
