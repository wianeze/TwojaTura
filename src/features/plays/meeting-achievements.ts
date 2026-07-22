type MeetingAchievementAwardRow = {
  awarded_count: number;
  points_awarded: number;
  awarded_keys: string[];
};

type MeetingAchievementAwardError = {
  code?: string | null;
  message?: string;
};

type MeetingAchievementAwardResponse = {
  data: MeetingAchievementAwardRow[] | null;
  error: MeetingAchievementAwardError | null;
};

export async function awardCampHostAfterPlaySave(
  hasMeeting: boolean,
  requestAward: () => PromiseLike<MeetingAchievementAwardResponse>,
) {
  if (!hasMeeting) {
    return {
      ok: true as const,
      skipped: true,
      awardedCount: 0,
      pointsAwarded: 0,
      awardedKeys: [] as string[],
    };
  }

  const { data, error } = await requestAward();

  if (error) {
    return { ok: false as const, error };
  }

  const result = data?.[0];

  return {
    ok: true as const,
    skipped: false,
    awardedCount: result?.awarded_count ?? 0,
    pointsAwarded: result?.points_awarded ?? 0,
    awardedKeys: result?.awarded_keys ?? [],
  };
}
