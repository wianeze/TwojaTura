import type { LegendariumLeaderboardEntry } from "./queries";

type LeaderboardSourceEntry = Omit<
  LegendariumLeaderboardEntry,
  "isCurrentMember" | "badges"
> &
  Partial<Pick<LegendariumLeaderboardEntry, "badges">>;

export function mapLegendariumLeaderboard(
  entries: LeaderboardSourceEntry[],
  currentMemberId: string,
): LegendariumLeaderboardEntry[] {
  return entries.map((entry) => ({
    ...entry,
    badges: entry.badges ?? [],
    isCurrentMember: entry.userId === currentMemberId,
  }));
}

export function getCurrentLegendariumRank(
  entries: LegendariumLeaderboardEntry[],
) {
  return entries.find((entry) => entry.isCurrentMember)?.rank ?? null;
}

export function hasRecentPointEvents(events: readonly { id: string }[]) {
  return events.length > 0;
}
