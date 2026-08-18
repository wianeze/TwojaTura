export type MeetingContinuationCandidateState = {
  id: string;
  meetingId: string | null;
  status: "in_progress" | "completed";
  resultPending: boolean;
  liveStartedAt: string | null;
  liveEndedAt: string | null;
};

/**
 * Jedno źródło prawdy dla UI: dopóki wpis Kroniki ma status `in_progress`,
 * pozostaje partią do dokończenia. `resultPending` mówi tylko, że po ostatniej
 * sesji nie zapisano wyniku; nie zamyka istniejącej rozgrywki.
 */
export function isUnfinishedPlay(
  play: Pick<MeetingContinuationCandidateState, "status">,
) {
  return play.status === "in_progress";
}

/**
 * Kandydat formularza to istniejący wpis Kroniki, nie nowa partia. Pochodzenie
 * (ręczne albo Stół/meeting_id) nie zmienia tej decyzji. Picker samego Stołu
 * może dodatkowo wyłączyć wpisy aktualnie biegnące, bo tych nie wolno wznowić
 * równolegle przy drugim stole.
 */
export function isMeetingContinuationCandidate(
  play: MeetingContinuationCandidateState,
  options: { includePlayId?: string | null; includeRunning?: boolean } = {},
) {
  const hasAllowedStatus =
    isUnfinishedPlay(play) || play.id === options.includePlayId;
  const isRunning = play.liveStartedAt !== null && play.liveEndedAt === null;

  return (
    hasAllowedStatus &&
    (options.includeRunning !== false || !isRunning)
  );
}

/**
 * Wpis ręczny nie potrzebuje spotkania. Wpis z meeting_id musi mieć nadal
 * istniejące spotkanie startowe albo inną, nieusuniętą kontynuację — dzięki
 * temu legacyjny wpis przywiązany wyłącznie do soft-delete nie wraca do UI.
 */
export function hasUsableContinuationContext(input: {
  startMeetingId: string | null;
  startMeetingExists: boolean;
  hasAssignedMeeting: boolean;
}) {
  return (
    input.startMeetingId === null ||
    input.startMeetingExists ||
    input.hasAssignedMeeting
  );
}
