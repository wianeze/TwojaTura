type MeetingPointAwardRow = {
  awarded: boolean;
  points: number;
  point_event_id: string | null;
};

type MeetingPointAwardError = {
  code?: string | null;
  message?: string;
};

type MeetingPointAwardResponse = {
  data: MeetingPointAwardRow[] | null;
  error: MeetingPointAwardError | null;
};

async function requestMeetingPointAward(
  requestAward: () => PromiseLike<MeetingPointAwardResponse>,
) {
  const { data, error } = await requestAward();

  if (error) {
    return { ok: false as const, error };
  }

  const result = data?.[0];

  return {
    ok: true as const,
    awarded: result?.awarded ?? false,
    points: result?.points ?? 0,
    pointEventId: result?.point_event_id ?? null,
  };
}

export async function awardMeetingRsvpPointsAfterSave(
  requestAward: () => PromiseLike<MeetingPointAwardResponse>,
) {
  return requestMeetingPointAward(requestAward);
}

export async function awardMeetingVotePointsAfterSave(
  requestAward: () => PromiseLike<MeetingPointAwardResponse>,
) {
  return requestMeetingPointAward(requestAward);
}

export async function awardMeetingCreatedPointsAfterSave(
  wasCreated: boolean,
  requestAward: () => PromiseLike<MeetingPointAwardResponse>,
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

  const result = await requestMeetingPointAward(requestAward);

  return result.ok ? { ...result, skipped: false as const } : result;
}
