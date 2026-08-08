export type MeetingRecommendationRating = {
  gameId: string;
  userId: string;
  overall: number;
  wantsToPlayAgain: boolean;
};

export type MeetingRecommendationHistory = {
  gameId: string;
  userId: string;
};

export type MeetingRecommendationCandidate = {
  gameId: string;
  title: string;
};

export type MeetingGameRecommendationScore = {
  gameId: string;
  label: "team-favorite" | "good-fit" | "team-sure-thing";
  participantCount: number;
  ratingCount: number;
  likedCount: number;
  wantsAgainCount: number;
  historicalPositiveCount: number;
  averageRating: number;
  coverage: number;
  score: number;
};

type BuildMeetingGameRecommendationsInput = {
  participantIds: string[];
  games: MeetingRecommendationCandidate[];
  ratings: MeetingRecommendationRating[];
  historicalPositiveResponses?: MeetingRecommendationHistory[];
  limit?: number;
};

const MIN_RATINGS = 2;
const MIN_AVERAGE_RATING = 6.5;

/**
 * V1 rekomendacji spotkania. Brak oceny nie jest zerem: średnia powstaje
 * wyłącznie z istniejących ocen. Pokrycie grupy wpływa osobno na pewność,
 * dzięki czemu pojedyncza wysoka ocena nie wygrywa z opinią większej części
 * drużyny.
 */
export function buildMeetingGameRecommendations({
  participantIds,
  games,
  ratings,
  historicalPositiveResponses = [],
  limit = 5,
}: BuildMeetingGameRecommendationsInput): MeetingGameRecommendationScore[] {
  const participants = new Set(participantIds);
  const participantCount = participants.size;
  if (participantCount < MIN_RATINGS) return [];

  const ratingsByGame = new Map<string, MeetingRecommendationRating[]>();
  for (const rating of ratings) {
    if (!participants.has(rating.userId)) continue;
    if (!Number.isFinite(rating.overall)) continue;

    const gameRatings = ratingsByGame.get(rating.gameId) ?? [];
    gameRatings.push(rating);
    ratingsByGame.set(rating.gameId, gameRatings);
  }

  const historyByGame = new Map<string, Set<string>>();
  for (const response of historicalPositiveResponses) {
    if (!participants.has(response.userId)) continue;
    const voters = historyByGame.get(response.gameId) ?? new Set<string>();
    voters.add(response.userId);
    historyByGame.set(response.gameId, voters);
  }

  const ranked: MeetingGameRecommendationScore[] = games.flatMap((game) => {
    const gameRatings = ratingsByGame.get(game.gameId) ?? [];
    const uniqueRatings = [
      ...new Map(gameRatings.map((rating) => [rating.userId, rating])).values(),
    ];
    const ratingCount = uniqueRatings.length;

    // Dwa głosy to minimalny sygnał drużynowy. Jedna ocena 10/10 nie tworzy
    // rekomendacji, niezależnie od liczby pozostałych uczestników.
    if (ratingCount < MIN_RATINGS) return [];

    const averageRating =
      uniqueRatings.reduce((sum, rating) => sum + rating.overall, 0) /
      ratingCount;
    if (averageRating < MIN_AVERAGE_RATING) return [];

    const likedCount = uniqueRatings.filter(
      (rating) => rating.overall >= 7,
    ).length;
    const wantsAgainCount = uniqueRatings.filter(
      (rating) => rating.wantsToPlayAgain,
    ).length;
    const historicalPositiveCount = historyByGame.get(game.gameId)?.size ?? 0;
    const coverage = ratingCount / participantCount;

    const ratingQuality = averageRating / 10;
    const replayAffinity = wantsAgainCount / ratingCount;
    const historicalAffinity = historicalPositiveCount / participantCount;
    const preference =
      ratingQuality * 0.7 + replayAffinity * 0.2 + historicalAffinity * 0.1;
    const confidenceMultiplier = 0.55 + coverage * 0.45;
    const score = preference * confidenceMultiplier;
    const isTeamSureThing =
      ratingCount >= 3 &&
      averageRating >= 8 &&
      uniqueRatings.every((rating) => rating.overall > 5);

    return [
      {
        gameId: game.gameId,
        label: isTeamSureThing ? "team-sure-thing" : "good-fit",
        participantCount,
        ratingCount,
        likedCount,
        wantsAgainCount,
        historicalPositiveCount,
        averageRating,
        coverage,
        score,
      } satisfies MeetingGameRecommendationScore,
    ];
  });

  ranked.sort(
    (left, right) =>
      right.score - left.score ||
      right.coverage - left.coverage ||
      right.ratingCount - left.ratingCount ||
      right.averageRating - left.averageRating ||
      left.gameId.localeCompare(right.gameId),
  );

  const result = ranked.slice(0, Math.max(0, limit));
  if (result[0] && result[0].label !== "team-sure-thing") {
    result[0] = { ...result[0], label: "team-favorite" };
  }

  return result;
}

export function getMeetingRecommendationLabel(
  label: MeetingGameRecommendationScore["label"],
) {
  if (label === "team-sure-thing") return "👑 Pewniak drużyny";
  if (label === "team-favorite") return "🔥 Faworyt drużyny";
  return "✨ Dobry wybór dla tej ekipy";
}
