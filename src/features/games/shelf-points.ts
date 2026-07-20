type ShelfOnboardingAwardRow = {
  awarded_count: number;
  awarded_points: number;
};

type ShelfOnboardingAwardError = {
  code?: string | null;
  message?: string;
};

type ShelfOnboardingAwardResponse = {
  data: ShelfOnboardingAwardRow[] | null;
  error: ShelfOnboardingAwardError | null;
};

export async function awardShelfOnboardingPointsAfterGameCreate(
  requestAward: () => PromiseLike<ShelfOnboardingAwardResponse>,
) {
  const { data, error } = await requestAward();

  if (error) {
    return { ok: false as const, error };
  }

  const result = data?.[0];

  return {
    ok: true as const,
    awardedCount: result?.awarded_count ?? 0,
    awardedPoints: result?.awarded_points ?? 0,
  };
}
