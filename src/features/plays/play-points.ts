type PlayPointAwardRow = {
  awarded: boolean;
  points: number;
  point_event_id: string | null;
};

type PlayPointAwardError = {
  code?: string | null;
  message?: string;
};

type PlayPointAwardResponse = {
  data: PlayPointAwardRow[] | null;
  error: PlayPointAwardError | null;
};

export async function awardPlayPointsAfterSave(
  wasCreated: boolean,
  requestAward: () => PromiseLike<PlayPointAwardResponse>,
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
