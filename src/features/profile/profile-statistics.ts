import type { CharacterClassView } from "@/features/legendarium/achievement-view-model";
import type { PlayMode, PlayTeamResult } from "@/features/plays/types";

export type ProfileGameSource = {
  id: string;
  title: string;
  coverUrl: string | null;
};

export type ProfilePlaySource = {
  id: string;
  playedAt: string;
  durationMinutes: number | null;
  mode: PlayMode;
  teamResult: PlayTeamResult | null;
  hasExplicitWinner: boolean;
  game: ProfileGameSource;
  ownResult: {
    isWinner: boolean;
    placement: number | null;
    score: number | null;
  };
  participantIds: string[];
};

export type ProfileRatingSource = {
  gameId: string;
  overall: number;
};

export type ProfilePlayResult = "win" | "loss" | "played";

export type ProfileRecentPlay = ProfilePlaySource & {
  result: ProfilePlayResult;
};

export type ProfileGameHighlight = {
  kind: "most-played" | "highest-rated" | "most-time";
  game: ProfileGameSource;
  value: number;
};

export type ProfileRecord = {
  kind: "longest-play" | "most-played" | "win-streak" | "busiest-month";
  game?: ProfileGameSource;
  value: number;
  label?: string;
};

export type PlayerProfileStatistics = {
  playsCount: number;
  wins: number;
  losses: number;
  winRate: number | null;
  totalMinutes: number | null;
  averageMinutes: number | null;
  uniqueGames: number;
  uniqueCoPlayers: number;
  averageRating: number | null;
  recentPlays: ProfileRecentPlay[];
  gameHighlights: ProfileGameHighlight[];
  records: ProfileRecord[];
};

const monthFormatter = new Intl.DateTimeFormat("pl-PL", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Warsaw",
});

function getPlayResult(play: ProfilePlaySource): ProfilePlayResult {
  if (play.mode === "cooperative") {
    if (play.teamResult === "win") return "win";
    if (play.teamResult === "loss") return "loss";
    return "played";
  }

  if (!play.hasExplicitWinner) return "played";
  return play.ownResult.isWinner ? "win" : "loss";
}

function sortMetricEntries(values: Map<string, number>) {
  return [...values.entries()].sort(
    ([leftId, leftValue], [rightId, rightValue]) =>
      rightValue - leftValue || leftId.localeCompare(rightId),
  );
}

function pickDistinctHighlight(
  kind: ProfileGameHighlight["kind"],
  entries: Array<[string, number]>,
  games: Map<string, ProfileGameSource>,
  usedGameIds: Set<string>,
) {
  const candidate =
    entries.find(([gameId]) => !usedGameIds.has(gameId)) ?? entries[0];
  if (!candidate) return null;

  const [gameId, value] = candidate;
  const game = games.get(gameId);
  if (!game) return null;

  usedGameIds.add(gameId);
  return { kind, game, value } satisfies ProfileGameHighlight;
}

function getWarsawMonthKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Europe/Warsaw",
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

export function buildPlayerProfileStatistics({
  userId,
  plays,
  ratings,
  games: gameCatalog = [],
}: {
  userId: string;
  plays: ProfilePlaySource[];
  ratings: ProfileRatingSource[];
  games?: ProfileGameSource[];
}): PlayerProfileStatistics {
  const ordered = [...plays].sort(
    (left, right) =>
      new Date(left.playedAt).getTime() - new Date(right.playedAt).getTime() ||
      left.id.localeCompare(right.id),
  );
  const results = ordered.map((play) => ({
    play,
    result: getPlayResult(play),
  }));
  const wins = results.filter(({ result }) => result === "win").length;
  const losses = results.filter(({ result }) => result === "loss").length;
  const durations = plays
    .map((play) => play.durationMinutes)
    .filter((value): value is number => value !== null && value > 0);
  const totalMinutes =
    durations.length > 0
      ? durations.reduce((total, duration) => total + duration, 0)
      : null;
  const ratedValues = ratings.map((rating) => rating.overall);
  const games = new Map([
    ...gameCatalog.map((game) => [game.id, game] as const),
    ...plays.map((play) => [play.game.id, play.game] as const),
  ]);
  const playsByGame = new Map<string, number>();
  const minutesByGame = new Map<string, number>();
  const ratingsByGame = new Map<string, number>();

  for (const play of plays) {
    playsByGame.set(play.game.id, (playsByGame.get(play.game.id) ?? 0) + 1);
    if (play.durationMinutes !== null && play.durationMinutes > 0) {
      minutesByGame.set(
        play.game.id,
        (minutesByGame.get(play.game.id) ?? 0) + play.durationMinutes,
      );
    }
  }
  for (const rating of ratings)
    ratingsByGame.set(rating.gameId, rating.overall);

  const usedHighlightGameIds = new Set<string>();
  const gameHighlights = [
    pickDistinctHighlight(
      "most-played",
      sortMetricEntries(playsByGame),
      games,
      usedHighlightGameIds,
    ),
    pickDistinctHighlight(
      "highest-rated",
      sortMetricEntries(ratingsByGame),
      games,
      usedHighlightGameIds,
    ),
    pickDistinctHighlight(
      "most-time",
      sortMetricEntries(minutesByGame),
      games,
      usedHighlightGameIds,
    ),
  ].filter((item): item is ProfileGameHighlight => item !== null);

  let currentWinStreak = 0;
  let longestWinStreak = 0;
  for (const { result } of results) {
    if (result === "played") continue;
    currentWinStreak = result === "win" ? currentWinStreak + 1 : 0;
    longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
  }

  const monthMinutes = new Map<string, number>();
  for (const play of plays) {
    if (play.durationMinutes === null || play.durationMinutes <= 0) continue;
    const key = getWarsawMonthKey(play.playedAt);
    monthMinutes.set(key, (monthMinutes.get(key) ?? 0) + play.durationMinutes);
  }

  const longestPlay = [...plays]
    .filter((play) => play.durationMinutes !== null && play.durationMinutes > 0)
    .sort(
      (left, right) =>
        (right.durationMinutes ?? 0) - (left.durationMinutes ?? 0),
    )[0];
  const mostPlayedEntry = sortMetricEntries(playsByGame)[0];
  const busiestMonthEntry = sortMetricEntries(monthMinutes)[0];
  const records: ProfileRecord[] = [];
  if (longestPlay?.durationMinutes) {
    records.push({
      kind: "longest-play",
      game: longestPlay.game,
      value: longestPlay.durationMinutes,
    });
  }
  if (mostPlayedEntry) {
    const game = games.get(mostPlayedEntry[0]);
    if (game) {
      records.push({ kind: "most-played", game, value: mostPlayedEntry[1] });
    }
  }
  if (longestWinStreak > 0) {
    records.push({ kind: "win-streak", value: longestWinStreak });
  }
  if (busiestMonthEntry) {
    const date = new Date(`${busiestMonthEntry[0]}-15T12:00:00Z`);
    records.push({
      kind: "busiest-month",
      value: busiestMonthEntry[1],
      label: monthFormatter.format(date),
    });
  }

  return {
    playsCount: plays.length,
    wins,
    losses,
    winRate:
      wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null,
    totalMinutes,
    averageMinutes:
      totalMinutes !== null
        ? Math.round(totalMinutes / durations.length)
        : null,
    uniqueGames: new Set(plays.map((play) => play.game.id)).size,
    uniqueCoPlayers: new Set(
      plays.flatMap((play) =>
        play.participantIds.filter((participantId) => participantId !== userId),
      ),
    ).size,
    averageRating:
      ratedValues.length > 0
        ? ratedValues.reduce((total, rating) => total + rating, 0) /
          ratedValues.length
        : null,
    recentPlays: [...results]
      .reverse()
      .slice(0, 5)
      .map(({ play, result }) => ({ ...play, result })),
    gameHighlights,
    records,
  };
}

export function selectTopProfileClasses(
  classes: CharacterClassView[],
  limit = 3,
) {
  return [...classes]
    .sort((left, right) => {
      const leftProgress =
        left.totalRequirements > 0
          ? left.acquiredRequirements / left.totalRequirements
          : 0;
      const rightProgress =
        right.totalRequirements > 0
          ? right.acquiredRequirements / right.totalRequirements
          : 0;
      return (
        rightProgress - leftProgress ||
        Number(right.unlocked) - Number(left.unlocked) ||
        right.acquiredRequirements - left.acquiredRequirements ||
        left.sortOrder - right.sortOrder
      );
    })
    .slice(0, limit);
}

export function formatProfileDuration(minutes: number | null) {
  if (minutes === null) return null;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} h`;
  return `${hours} h ${remainingMinutes} min`;
}
