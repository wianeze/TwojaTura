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

/*
 * Nagroda za organizację spotkania nie ma już odpowiednika po stronie TS.
 * Od Economy V2 nalicza ją public.complete_meeting — w tej samej transakcji, w
 * której spotkanie dostaje status 'completed'. Klient nie ma tu nic do
 * zrobienia, więc świadomie nie ma tu wrappera: byłby wyłącznie okazją do
 * przyznania Renomy za spotkanie, które się nie odbyło.
 */
