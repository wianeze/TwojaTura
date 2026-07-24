import {
  formatDateKeyForDisplay,
  formatMeetingDateRange,
  parseMeetingDisplayDateToDateKey,
} from "../meetings/formatting.ts";
import type {
  ChronicleMonthGroup,
  PlayDetails,
  PlayFormMeetingOption,
  PlayFormValues,
  PlayListItem,
  PlayMember,
  PlayParticipantResult,
  PlayStatus,
  RecentPlaySummary,
} from "./types";

export const PLAY_STATUS_LABELS: Record<PlayStatus, string> = {
  in_progress: "W toku",
  completed: "Zakończona",
};

const dateTimeFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Warsaw",
});

const monthFormatter = new Intl.DateTimeFormat("pl-PL", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Warsaw",
});

const shortDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Warsaw",
});

const warsawPartsFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Warsaw",
});

function capitalize(label: string) {
  return label.replace(/^\p{Ll}/u, (value) => value.toUpperCase());
}

function readZonedParts(iso: string) {
  const parts = warsawPartsFormatter.formatToParts(new Date(iso));

  return {
    day: parts.find((part) => part.type === "day")?.value ?? "",
    month: parts.find((part) => part.type === "month")?.value ?? "",
    year: parts.find((part) => part.type === "year")?.value ?? "",
    hour: parts.find((part) => part.type === "hour")?.value ?? "",
    minute: parts.find((part) => part.type === "minute")?.value ?? "",
  };
}

function getWarsawMonthKey(iso: string) {
  const { year, month } = readZonedParts(iso);
  return `${year}-${month}`;
}

export function formatPlayDateTime(playedAt: string) {
  return capitalize(dateTimeFormatter.format(new Date(playedAt)));
}

export function formatPlayShortDate(playedAt: string) {
  return shortDateFormatter.format(new Date(playedAt)).replace(".", "");
}

export function formatPlayCompactDateTime(playedAt: string) {
  const { day, month, year, hour, minute } = readZonedParts(playedAt);
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

export function getPlayDateBadgeParts(playedAt: string) {
  const { day, month, year, hour, minute } = readZonedParts(playedAt);

  return {
    day,
    month,
    year,
    time: `${hour}:${minute}`,
    compactDate: `${day}/${month}/${year}`,
  };
}

export function formatPlayDuration(durationMinutes: number | null) {
  if (!durationMinutes) return null;
  return `${durationMinutes} min`;
}

export function formatPlayScore(score: number | null) {
  if (score === null) return null;
  return Number.isInteger(score) ? `${score} pkt` : `${score.toFixed(2)} pkt`;
}

export function formatChronicleChipScore(score: number | null) {
  if (score === null) return null;
  return Number.isInteger(score) ? String(score) : score.toFixed(2);
}

export function sortPlayParticipants(
  participants: PlayParticipantResult[],
): PlayParticipantResult[] {
  return [...participants].sort((left, right) => {
    if (left.isWinner !== right.isWinner) {
      return left.isWinner ? -1 : 1;
    }

    if (left.placement !== right.placement) {
      if (left.placement === null) return 1;
      if (right.placement === null) return -1;
      return left.placement - right.placement;
    }

    return left.member.displayName.localeCompare(
      right.member.displayName,
      "pl",
      {
        sensitivity: "base",
      },
    );
  });
}

export function getWinnerSummary(winners: PlayMember[]) {
  if (winners.length === 0) return "Brak zwycięzcy";
  if (winners.length === 1) return winners[0]!.displayName;
  return winners.map((winner) => winner.displayName).join(", ");
}

export function getPlayResultLabel(status: PlayStatus, winners: PlayMember[]) {
  if (status === "in_progress") return PLAY_STATUS_LABELS.in_progress;
  return getWinnerSummary(winners);
}

export function getPlayPodium(participants: PlayParticipantResult[]): Array<{
  rank: 1 | 2 | 3;
  members: PlayMember[];
}> {
  const placements = new Map<1 | 2 | 3, PlayMember[]>();

  for (const participant of participants) {
    if (
      participant.placement !== 1 &&
      participant.placement !== 2 &&
      participant.placement !== 3
    ) {
      continue;
    }

    const rank = participant.placement;
    if (!placements.has(rank)) {
      placements.set(rank, []);
    }

    placements.get(rank)?.push(participant.member);
  }

  return ([1, 2, 3] as const)
    .filter((rank) => placements.has(rank))
    .map((rank) => ({
      rank,
      members: placements.get(rank) ?? [],
    }));
}

export function getChronicleParticipantChips(
  participants: PlayParticipantResult[],
): Array<{
  participant: PlayParticipantResult;
  medalRank: 1 | 2 | 3 | null;
}> {
  const podiumParticipants = participants.filter(
    (participant) =>
      participant.placement === 1 ||
      participant.placement === 2 ||
      participant.placement === 3,
  );

  if (podiumParticipants.length > 0) {
    const podiumIds = new Set(
      podiumParticipants.map((participant) => participant.member.id),
    );

    return [
      ...podiumParticipants.map((participant) => {
        const medalRank = participant.placement as 1 | 2 | 3;

        return {
          participant,
          medalRank,
        };
      }),
      ...participants
        .filter((participant) => !podiumIds.has(participant.member.id))
        .map((participant) => ({
          participant,
          medalRank: null,
        })),
    ];
  }

  const winnerParticipants = participants.filter(
    (participant) => participant.isWinner,
  );

  if (winnerParticipants.length > 0) {
    const winnerIds = new Set(
      winnerParticipants.map((participant) => participant.member.id),
    );

    return [
      ...winnerParticipants.map((participant) => ({
        participant,
        medalRank: 1 as const,
      })),
      ...participants
        .filter((participant) => !winnerIds.has(participant.member.id))
        .map((participant) => ({
          participant,
          medalRank: null,
        })),
    ];
  }

  return participants.map((participant) => ({
    participant,
    medalRank: null,
  }));
}

export function groupPlaysByMonth(
  items: PlayListItem[],
): ChronicleMonthGroup[] {
  const groups = new Map<string, PlayListItem[]>();

  for (const item of items) {
    const key = getWarsawMonthKey(item.playedAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(item);
  }

  return [...groups.entries()].map(([key, groupItems]) => ({
    key,
    label: capitalize(monthFormatter.format(new Date(groupItems[0]!.playedAt))),
    items: groupItems,
  }));
}

export function sortPlaysByPlayedAtDesc<T extends { playedAt: string }>(
  items: T[],
) {
  return [...items].sort(
    (left, right) =>
      new Date(right.playedAt).getTime() - new Date(left.playedAt).getTime(),
  );
}

export function getPlayFormValues(
  play?: Pick<
    PlayDetails,
    | "playedAt"
    | "durationMinutes"
    | "comment"
    | "status"
    | "stateNote"
    | "participants"
  > & {
    game: { id: string };
    meeting: { id: string } | null;
  },
  prefilledMeeting?: PlayFormMeetingOption | null,
): PlayFormValues {
  if (!play) {
    const prefillIso = prefilledMeeting?.startsAt;
    const zoned = prefillIso ? readZonedParts(prefillIso) : null;

    return {
      gameId: "",
      meetingId: prefilledMeeting?.id ?? "",
      playedOnDate: zoned ? `${zoned.day}/${zoned.month}/${zoned.year}` : "",
      playedOnTime: zoned ? `${zoned.hour}:${zoned.minute}` : "18:00",
      durationMinutes: "",
      comment: "",
      status: "completed",
      stateNote: "",
      participants: [],
    };
  }

  const zoned = readZonedParts(play.playedAt);

  return {
    gameId: play.game.id,
    meetingId: play.meeting?.id ?? "",
    playedOnDate: `${zoned.day}/${zoned.month}/${zoned.year}`,
    playedOnTime: `${zoned.hour}:${zoned.minute}`,
    durationMinutes: play.durationMinutes ? String(play.durationMinutes) : "",
    comment: play.comment ?? "",
    status: play.status,
    stateNote: play.stateNote ?? "",
    participants: play.participants.map((participant) => ({
      userId: participant.member.id,
      isWinner: participant.isWinner,
      placement:
        participant.placement === null ? "" : String(participant.placement),
      score: participant.score === null ? "" : String(participant.score),
    })),
  };
}

export function formatMeetingOptionLabel(meeting: PlayFormMeetingOption) {
  const formatted = formatMeetingDateRange({
    startsAt: meeting.startsAt,
    endsAt: meeting.endsAt,
  });

  return `${meeting.title} · ${formatted.compactStartDate} · ${formatted.startTime}`;
}

export function getPlayMeetingPrefillValues(
  meeting?: PlayFormMeetingOption | null,
) {
  return getPlayFormValues(undefined, meeting);
}

export function getPlayDateKeyValue(displayValue: string) {
  return parseMeetingDisplayDateToDateKey(displayValue);
}

export function formatPlayDateKey(dateKey?: string | null) {
  return formatDateKeyForDisplay(dateKey);
}

export function toRecentPlaySummary(
  play: PlayListItem,
  userId: string,
): RecentPlaySummary {
  const ownResult =
    play.participants.find((participant) => participant.member.id === userId) ??
    null;

  return {
    id: play.id,
    playedAt: play.playedAt,
    game: play.game,
    meeting: play.meeting,
    isWinner: ownResult?.isWinner ?? false,
    placement: ownResult?.placement ?? null,
    score: ownResult?.score ?? null,
    winners: play.winners,
    status: play.status,
  };
}

export function getMeetingOptionDisplayLabel(meeting: PlayFormMeetingOption) {
  return formatMeetingOptionLabel(meeting);
}
