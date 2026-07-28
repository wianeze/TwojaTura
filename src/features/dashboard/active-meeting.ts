// Schemat wymusia `meetings.ends_at` NOT NULL, więc fallback poniżej jest
// zabezpieczeniem na dane nietypowane / przyszłą zmianę schematu, a nie
// ścieżką używaną na produkcji.
export const ACTIVE_MEETING_FALLBACK_DURATION_MS = 5 * 60 * 60 * 1000;

// setTimeout zawija się powyżej ~24.8 dnia (32-bit) i odpaliłby się
// natychmiast, więc granice dalsze niż doba przeliczamy ponownie po 24h.
export const MAX_REFRESH_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export type ActiveMeetingTimes = {
  startsAt: string;
  endsAt: string | null;
};

export type ActiveMeetingCandidate = ActiveMeetingTimes & {
  id: string;
  title: string;
  location: string | null;
  confirmedAttendeesCount: number;
};

export type DashboardActiveMeeting = ActiveMeetingCandidate & {
  effectiveEndsAt: string;
  href: string;
};

export function getEffectiveMeetingEnd(meeting: ActiveMeetingTimes) {
  if (meeting.endsAt) return meeting.endsAt;

  return new Date(
    new Date(meeting.startsAt).getTime() + ACTIVE_MEETING_FALLBACK_DURATION_MS,
  ).toISOString();
}

export function isMeetingActiveNow(
  meeting: ActiveMeetingTimes,
  now = new Date(),
) {
  const startsAtMs = new Date(meeting.startsAt).getTime();
  const effectiveEndMs = new Date(getEffectiveMeetingEnd(meeting)).getTime();
  const nowMs = now.getTime();

  return startsAtMs <= nowMs && nowMs < effectiveEndMs;
}

export function pickActiveMeetings(
  candidates: ActiveMeetingCandidate[],
  now = new Date(),
): DashboardActiveMeeting[] {
  return candidates
    .filter((meeting) => isMeetingActiveNow(meeting, now))
    .map((meeting) => ({
      ...meeting,
      effectiveEndsAt: getEffectiveMeetingEnd(meeting),
      href: `/kalendarium/${meeting.id}`,
    }))
    .sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    );
}

// Odmiana rzeczownika „spotkanie" wg tych samych reguł co pluralizeQuests
// w ./formatting: 2-4 (poza 12-14) → „spotkania", reszta → „spotkań".
export function formatActiveMeetingsCount(count: number) {
  if (count === 1) return `${count} spotkanie`;

  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return `${count} spotkania`;
  }

  return `${count} spotkań`;
}

export function getNextMeetingBoundaryMs(
  input: {
    activeMeetingEffectiveEnds: string[];
    nextMeetingStartsAt: string | null;
  },
  nowMs: number,
) {
  const boundaries = [
    ...input.activeMeetingEffectiveEnds,
    ...(input.nextMeetingStartsAt ? [input.nextMeetingStartsAt] : []),
  ]
    .map((iso) => new Date(iso).getTime())
    .filter((timestamp) => Number.isFinite(timestamp) && timestamp > nowMs);

  if (boundaries.length === 0) return null;

  return Math.min(...boundaries);
}
