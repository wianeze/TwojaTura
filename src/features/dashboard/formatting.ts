import { getWinnerSummary } from "../plays/formatting.ts";
import type { PlayMember } from "../plays/types";
import type {
  DashboardHeroSummary,
  DashboardLeaderboardEntry,
  DashboardLeaderboardPreview,
  DashboardPointsSummary,
  DashboardQuest,
  DashboardRecentPlayPreview,
  DashboardUpcomingMeeting,
} from "./types";

const compactDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Warsaw",
});

const compactTimeFormatter = new Intl.DateTimeFormat("pl-PL", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Warsaw",
});

function pluralizeQuests(count: number) {
  if (count === 1) return "quest czeka";
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return "questy czekają";
  }

  return "questów czeka";
}

export function formatDashboardDate(iso: string) {
  return compactDateFormatter.format(new Date(iso));
}

export function formatDashboardTime(iso: string) {
  return compactTimeFormatter.format(new Date(iso));
}

export function formatDashboardDateTime(iso: string) {
  return `${formatDashboardDate(iso)} • ${formatDashboardTime(iso)}`;
}

export function formatDashboardQuestDateTime(iso: string) {
  return `${formatDashboardDate(iso)} · ${formatDashboardTime(iso)}`;
}

export function formatQuestRewardPreview(
  quest: Pick<DashboardQuest, "reward">,
) {
  const immediateLabel = quest.reward.immediateLabel ?? "pkt";
  const followUpLabel =
    quest.reward.followUpPoints && quest.reward.followUpLabel
      ? ` · +${quest.reward.followUpPoints} ${quest.reward.followUpLabel}`
      : "";

  return `+${quest.reward.immediatePoints} ${immediateLabel}${followUpLabel}`;
}

function getQuestBucket(quest: DashboardQuest) {
  if (quest.id.startsWith("missing-play:")) return 0;
  if (quest.id.startsWith("missing-rsvp:")) return 1;
  if (quest.id.startsWith("missing-vote:")) return 2;
  if (quest.id === "schedule-meeting") return 3;
  if (quest.id.startsWith("rate-game:")) return 4;
  if (
    quest.id === "add-first-game" ||
    quest.id === "add-five-games" ||
    quest.id === "add-ten-games" ||
    quest.id === "add-fifteen-games"
  ) {
    return 5;
  }
  return 6;
}

export function sortDashboardQuests(quests: DashboardQuest[]) {
  return [...quests].sort((left, right) => {
    const leftBucket = getQuestBucket(left);
    const rightBucket = getQuestBucket(right);

    if (leftBucket !== rightBucket) {
      return leftBucket - rightBucket;
    }

    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;

    if (leftBucket <= 2) {
      return leftTime - rightTime;
    }

    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    return rightTime - leftTime;
  });
}

export function sumQuestOptionalPoints(quests: DashboardQuest[]) {
  return quests.reduce((sum, quest) => sum + (quest.optionalPoints ?? 0), 0);
}

export function sumQuestImmediatePoints(quests: DashboardQuest[]) {
  return quests.reduce((sum, quest) => sum + quest.reward.immediatePoints, 0);
}

export function sumQuestFollowUpPoints(quests: DashboardQuest[]) {
  return quests.reduce(
    (sum, quest) => sum + (quest.reward.followUpPoints ?? 0),
    0,
  );
}

export function buildDashboardPointsSummary(
  currentPoints: number,
  quests: DashboardQuest[],
): DashboardPointsSummary {
  return {
    currentPoints,
    availablePoints: sumQuestImmediatePoints(quests),
    followUpPoints: sumQuestFollowUpPoints(quests),
  };
}

export function buildDashboardHeroSummary(input: {
  memberName: string;
  quests: DashboardQuest[];
  hasFutureMeeting: boolean;
}): DashboardHeroSummary {
  const questCount = input.quests.length;
  const availablePoints = sumQuestImmediatePoints(input.quests);
  const followUpPoints = sumQuestFollowUpPoints(input.quests);

  if (questCount === 0) {
    return {
      title: "Stół czysty",
      subtitle: "Nie masz teraz żadnych zadań.",
      emptyCtaHref: input.hasFutureMeeting ? "/gry/nowa" : "/kalendarium/nowe",
      emptyCtaLabel: input.hasFutureMeeting
        ? "Dodaj grę do Półki"
        : "Zorganizuj spotkanie",
      questCount,
      availablePoints,
      followUpPoints,
    };
  }

  const followUpLabel =
    followUpPoints > 0 ? ` · ${followUpPoints} pkt później` : "";

  return {
    title: `Witaj przy stole, ${input.memberName}`,
    subtitle: `${questCount} ${pluralizeQuests(questCount)} · ${availablePoints} pkt teraz${followUpLabel}`,
    emptyCtaHref: "/kalendarium/nowe",
    emptyCtaLabel: "Zorganizuj spotkanie",
    questCount,
    availablePoints,
    followUpPoints,
  };
}

export function pickUpcomingMeeting(
  meetings: DashboardUpcomingMeeting[],
  now = new Date(),
) {
  const futureMeetings = meetings.filter(
    (meeting) => new Date(meeting.startsAt).getTime() >= now.getTime(),
  );

  const nearestConfirmed = futureMeetings
    .filter((meeting) => meeting.status === "confirmed")
    .sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    )[0];

  if (nearestConfirmed) return nearestConfirmed;

  return (
    futureMeetings.sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    )[0] ?? null
  );
}

export function buildLeaderboardPreview(input: {
  currentPoints: number;
  entries: DashboardLeaderboardEntry[];
  currentUserId: string;
}): DashboardLeaderboardPreview {
  const sorted = [...input.entries].sort(
    (left, right) => left.rank - right.rank,
  );
  const viewer =
    sorted.find((entry) => entry.userId === input.currentUserId) ?? null;

  return {
    currentPoints: input.currentPoints,
    entries: sorted.slice(0, 5),
    viewerRank: viewer?.rank ?? null,
  };
}

export function buildRecentPlayPreviews(
  items: DashboardRecentPlayPreview[],
  limit = 5,
) {
  return [...items]
    .sort(
      (left, right) =>
        new Date(right.playedAt).getTime() - new Date(left.playedAt).getTime(),
    )
    .slice(0, limit);
}

export function formatDashboardWinnerSummary(winners: PlayMember[]) {
  return getWinnerSummary(winners);
}
