import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_MEETING_FALLBACK_DURATION_MS,
  formatActiveMeetingsCount,
  getEffectiveMeetingEnd,
  getNextMeetingBoundaryMs,
  isMeetingActiveNow,
  pickActiveMeetings,
} from "../../src/features/dashboard/active-meeting.ts";
import type { ActiveMeetingCandidate } from "../../src/features/dashboard/active-meeting.ts";

const START = "2026-07-20T16:00:00.000Z";
const END = "2026-07-20T21:00:00.000Z";

function at(iso: string, offsetMs = 0) {
  return new Date(new Date(iso).getTime() + offsetMs);
}

function buildCandidate(
  overrides: Partial<ActiveMeetingCandidate> = {},
): ActiveMeetingCandidate {
  return {
    id: "meeting-1",
    title: "Strategiczna sobota",
    location: "Chata",
    startsAt: START,
    endsAt: END,
    confirmedAttendeesCount: 3,
    ...overrides,
  };
}

test("spotkanie przed rozpoczęciem nie jest aktywne", () => {
  assert.equal(
    isMeetingActiveNow({ startsAt: START, endsAt: END }, at(START, -1)),
    false,
  );
  assert.equal(
    isMeetingActiveNow(
      { startsAt: START, endsAt: END },
      at(START, -60 * 60 * 1000),
    ),
    false,
  );
});

test("spotkanie jest aktywne dokładnie od godziny rozpoczęcia", () => {
  assert.equal(
    isMeetingActiveNow({ startsAt: START, endsAt: END }, at(START)),
    true,
  );
});

test("spotkanie jest aktywne w trakcie trwania", () => {
  assert.equal(
    isMeetingActiveNow(
      { startsAt: START, endsAt: END },
      at(START, 2 * 60 * 60 * 1000),
    ),
    true,
  );
});

test("spotkanie z godziną końcową znika dokładnie w momencie końca", () => {
  assert.equal(
    isMeetingActiveNow({ startsAt: START, endsAt: END }, at(END)),
    false,
  );
  assert.equal(
    isMeetingActiveNow({ startsAt: START, endsAt: END }, at(END, 1)),
    false,
  );
  assert.equal(
    isMeetingActiveNow({ startsAt: START, endsAt: END }, at(END, -1)),
    true,
  );
});

test("bez godziny końcowej spotkanie trwa maksymalnie 5 godzin", () => {
  const withoutEnd = { startsAt: START, endsAt: null };

  assert.equal(
    isMeetingActiveNow(
      withoutEnd,
      at(START, ACTIVE_MEETING_FALLBACK_DURATION_MS - 60 * 1000),
    ),
    true,
  );
  assert.equal(
    isMeetingActiveNow(
      withoutEnd,
      at(START, ACTIVE_MEETING_FALLBACK_DURATION_MS),
    ),
    false,
  );
  assert.equal(
    isMeetingActiveNow(
      withoutEnd,
      at(START, ACTIVE_MEETING_FALLBACK_DURATION_MS + 60 * 1000),
    ),
    false,
  );
});

test("getEffectiveMeetingEnd zwraca zapisany koniec albo fallback 5h", () => {
  assert.equal(getEffectiveMeetingEnd({ startsAt: START, endsAt: END }), END);
  assert.equal(
    getEffectiveMeetingEnd({ startsAt: START, endsAt: null }),
    new Date(
      new Date(START).getTime() + ACTIVE_MEETING_FALLBACK_DURATION_MS,
    ).toISOString(),
  );
});

test("spotkanie przechodzące przez północ jest aktywne po zmianie doby", () => {
  const nightStart = "2026-07-20T21:00:00.000Z";
  const nightEnd = "2026-07-21T01:30:00.000Z";
  const meeting = { startsAt: nightStart, endsAt: nightEnd };

  assert.equal(
    isMeetingActiveNow(meeting, at("2026-07-21T00:59:00.000Z")),
    true,
  );
  assert.equal(
    isMeetingActiveNow(meeting, at("2026-07-21T01:29:59.000Z")),
    true,
  );
  assert.equal(isMeetingActiveNow(meeting, at(nightEnd)), false);
});

test("strefa Europe/Warsaw: wieczorne spotkanie lokalne przechodzi przez północ", () => {
  // 2026-07-20 22:00 → 2026-07-21 02:00 czasu warszawskiego (UTC+2 latem).
  const meeting = {
    startsAt: "2026-07-20T20:00:00.000Z",
    endsAt: "2026-07-21T00:00:00.000Z",
  };

  // 01:30 czasu warszawskiego następnego dnia — nadal w trakcie.
  assert.equal(
    isMeetingActiveNow(meeting, at("2026-07-20T23:30:00.000Z")),
    true,
  );
  // 02:00 czasu warszawskiego — koniec.
  assert.equal(
    isMeetingActiveNow(meeting, at("2026-07-21T00:00:00.000Z")),
    false,
  );
});

test("zmiana czasu w Polsce nie psuje wyliczenia (porównanie na epoce)", () => {
  // Nocna zmiana czasu 2026-03-29: 02:00 → 03:00 czasu lokalnego.
  const meeting = {
    startsAt: "2026-03-28T22:00:00.000Z",
    endsAt: "2026-03-29T02:00:00.000Z",
  };

  assert.equal(
    isMeetingActiveNow(meeting, at("2026-03-29T01:00:00.000Z")),
    true,
  );
  assert.equal(
    isMeetingActiveNow(meeting, at("2026-03-29T02:00:00.000Z")),
    false,
  );
});

test("pickActiveMeetings zwraca puste dla braku kandydatów", () => {
  assert.deepEqual(pickActiveMeetings([], at(START, 60 * 1000)), []);
});

test("pickActiveMeetings odfiltrowuje spotkania zakończone i przyszłe", () => {
  const now = at(START, 60 * 60 * 1000);
  const result = pickActiveMeetings(
    [
      buildCandidate(),
      buildCandidate({
        id: "meeting-past",
        startsAt: "2026-07-19T16:00:00.000Z",
        endsAt: "2026-07-19T21:00:00.000Z",
      }),
      buildCandidate({
        id: "meeting-future",
        startsAt: "2026-07-25T16:00:00.000Z",
        endsAt: "2026-07-25T21:00:00.000Z",
      }),
    ],
    now,
  );

  assert.deepEqual(
    result.map((meeting) => meeting.id),
    ["meeting-1"],
  );
});

test("dwa równoczesne aktywne spotkania są zwracane i posortowane po starcie", () => {
  const now = at(START, 90 * 60 * 1000);
  const result = pickActiveMeetings(
    [
      buildCandidate({
        id: "meeting-later",
        startsAt: "2026-07-20T17:00:00.000Z",
        endsAt: "2026-07-20T22:00:00.000Z",
      }),
      buildCandidate({ id: "meeting-earlier" }),
    ],
    now,
  );

  assert.deepEqual(
    result.map((meeting) => meeting.id),
    ["meeting-earlier", "meeting-later"],
  );
  assert.equal(result[0].href, "/kalendarium/meeting-earlier");
  assert.equal(result[0].effectiveEndsAt, END);
  assert.equal(result[1].effectiveEndsAt, "2026-07-20T22:00:00.000Z");
});

test("pickActiveMeetings domapowuje fallback 5h do effectiveEndsAt", () => {
  const result = pickActiveMeetings(
    [buildCandidate({ endsAt: null })],
    at(START, 60 * 1000),
  );

  assert.equal(
    result[0].effectiveEndsAt,
    new Date(
      new Date(START).getTime() + ACTIVE_MEETING_FALLBACK_DURATION_MS,
    ).toISOString(),
  );
});

test("formatActiveMeetingsCount odmienia rzeczownik spotkanie po polsku", () => {
  assert.equal(formatActiveMeetingsCount(1), "1 spotkanie");
  assert.equal(formatActiveMeetingsCount(2), "2 spotkania");
  assert.equal(formatActiveMeetingsCount(3), "3 spotkania");
  assert.equal(formatActiveMeetingsCount(4), "4 spotkania");
  assert.equal(formatActiveMeetingsCount(5), "5 spotkań");
  assert.equal(formatActiveMeetingsCount(11), "11 spotkań");
  // 12-14 to wyjątek: mimo końcówki 2-4 wymagają dopełniacza.
  assert.equal(formatActiveMeetingsCount(12), "12 spotkań");
  assert.equal(formatActiveMeetingsCount(13), "13 spotkań");
  assert.equal(formatActiveMeetingsCount(14), "14 spotkań");
  assert.equal(formatActiveMeetingsCount(22), "22 spotkania");
  assert.equal(formatActiveMeetingsCount(25), "25 spotkań");
});

test("getNextMeetingBoundaryMs wybiera koniec trwającego spotkania", () => {
  const nowMs = at(START, 60 * 60 * 1000).getTime();

  assert.equal(
    getNextMeetingBoundaryMs(
      { activeMeetingEffectiveEnds: [END], nextMeetingStartsAt: null },
      nowMs,
    ),
    new Date(END).getTime(),
  );
});

test("getNextMeetingBoundaryMs wybiera najbliższą granicę z końców i startu", () => {
  const nowMs = at(START, 60 * 60 * 1000).getTime();
  const soonerStart = "2026-07-20T18:00:00.000Z";

  assert.equal(
    getNextMeetingBoundaryMs(
      {
        activeMeetingEffectiveEnds: [END, "2026-07-20T22:00:00.000Z"],
        nextMeetingStartsAt: soonerStart,
      },
      nowMs,
    ),
    new Date(soonerStart).getTime(),
  );
});

test("getNextMeetingBoundaryMs zwraca null, gdy nie ma przyszłych granic", () => {
  const nowMs = at(END, 60 * 60 * 1000).getTime();

  assert.equal(
    getNextMeetingBoundaryMs(
      { activeMeetingEffectiveEnds: [END], nextMeetingStartsAt: START },
      nowMs,
    ),
    null,
  );
  assert.equal(
    getNextMeetingBoundaryMs(
      { activeMeetingEffectiveEnds: [], nextMeetingStartsAt: null },
      nowMs,
    ),
    null,
  );
});
