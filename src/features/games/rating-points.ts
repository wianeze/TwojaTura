type RatingPointAwardRow = {
  awarded: boolean;
  points: number;
  point_event_id: string | null;
};

type RatingPointAwardError = {
  code?: string | null;
  message?: string;
};

type RatingPointAwardResponse = {
  data: RatingPointAwardRow[] | null;
  error: RatingPointAwardError | null;
};

export async function awardRatingPointsAfterSave(
  wasCreated: boolean,
  requestAward: () => PromiseLike<RatingPointAwardResponse>,
) {
  if (!wasCreated) {
    return {
      ok: true as const,
      skipped: true as const,
      awarded: false,
      points: 0,
      pointEventId: null,
    };
  }

  const { data, error } = await requestAward();

  if (error) {
    return { ok: false as const, error };
  }

  const result = data?.[0];

  return {
    ok: true as const,
    skipped: false as const,
    awarded: result?.awarded ?? false,
    points: result?.points ?? 0,
    pointEventId: result?.point_event_id ?? null,
  };
}
