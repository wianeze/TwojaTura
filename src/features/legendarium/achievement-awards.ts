type SimpleAchievementAwardRow = {
  awarded_count: number;
  points_awarded: number;
  awarded_keys: string[];
};

type SimpleAchievementAwardError = {
  code?: string | null;
  message?: string;
};

type SimpleAchievementAwardResponse = {
  data: SimpleAchievementAwardRow[] | null;
  error: SimpleAchievementAwardError | null;
};

export async function awardSimpleAchievementsAfterMutation(
  requestAward: () => PromiseLike<SimpleAchievementAwardResponse>,
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
    awardedKeys: result?.awarded_keys ?? [],
  };
}

export const awardSimpleAchievementsAfterGameCreate =
  awardSimpleAchievementsAfterMutation;
export const awardSimpleAchievementsAfterMeetingCreate =
  awardSimpleAchievementsAfterMutation;
export const awardSimpleAchievementsAfterRsvpSave =
  awardSimpleAchievementsAfterMutation;
export const awardSimpleAchievementsAfterRatingSave =
  awardSimpleAchievementsAfterMutation;
export const awardSimpleAchievementsAfterPlayCreate =
  awardSimpleAchievementsAfterMutation;
