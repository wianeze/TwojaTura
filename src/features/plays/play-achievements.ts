type PlayResultAchievementAwardRow = {
  awarded_count: number;
  points_awarded: number;
  awarded_user_ids: string[];
};

type PlayResultAchievementAwardError = {
  code?: string | null;
  message?: string;
};

type PlayResultAchievementAwardResponse = {
  data: PlayResultAchievementAwardRow[] | null;
  error: PlayResultAchievementAwardError | null;
};

export async function awardPlayResultAchievementsAfterSave(
  requestAward: () => PromiseLike<PlayResultAchievementAwardResponse>,
) {
  const { data, error } = await requestAward();

  if (error) {
    return { ok: false as const, error };
  }

  const result = data?.[0];

  return {
    ok: true as const,
    awardedCount: result?.awarded_count ?? 0,
    pointsAwarded: result?.points_awarded ?? 0,
    awardedUserIds: result?.awarded_user_ids ?? [],
  };
}
