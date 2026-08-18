import { getPlayTablePhase, listTableSessions } from "../meetings/live-play.ts";
import { isUnfinishedPlay } from "../meetings/continuation.ts";

export type PlayActiveTableMeeting = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "planned" | "confirmed" | "completed";
  continuedPlayId: string | null;
  deletedAt: string | null;
};

type PlayActiveTableState = {
  id: string;
  meetingId: string | null;
  status: "in_progress" | "completed";
  liveStartedAt: string | null;
  liveEndedAt: string | null;
  resultPending: boolean;
};

/**
 * Znajduje spotkanie, które dla danego użytkownika faktycznie zajmuje teraz
 * Stół i jest powiązane z tą partią. Korzysta z tej samej maszyny czasowej co
 * dashboard: spotkanie przed startem nie jest jeszcze Stołem, a biegnąca
 * partia utrzymuje go po planowanym końcu.
 */
export function findActiveTableMeetingForPlay(input: {
  play: PlayActiveTableState;
  meetings: PlayActiveTableMeeting[];
  viewerMeetingIds: ReadonlySet<string>;
  now: Date;
}) {
  if (!isUnfinishedPlay(input.play)) return null;

  const linkedMeetings = input.meetings.filter(
    (meeting) =>
      meeting.deletedAt === null &&
      meeting.status !== "completed" &&
      input.viewerMeetingIds.has(meeting.id) &&
      (meeting.id === input.play.meetingId ||
        meeting.continuedPlayId === input.play.id),
  );

  const currentContinuationIds = new Set(
    linkedMeetings
      .filter(
        (meeting) =>
          meeting.continuedPlayId === input.play.id &&
          new Date(meeting.startsAt).getTime() <= input.now.getTime(),
      )
      .sort(
        (left, right) =>
          new Date(right.startsAt).getTime() -
          new Date(left.startsAt).getTime(),
      )
      .slice(0, 1)
      .map((meeting) => meeting.id),
  );
  const isRunning = getPlayTablePhase(input.play) === "running";

  const candidates = linkedMeetings.map((meeting) => ({
    ...meeting,
    hasLivePlay:
      isRunning &&
      (currentContinuationIds.size > 0
        ? currentContinuationIds.has(meeting.id)
        : meeting.id === input.play.meetingId),
    hasFinishedPlay: input.play.liveEndedAt !== null,
  }));

  return listTableSessions(candidates, input.now)[0]?.meeting.id ?? null;
}
