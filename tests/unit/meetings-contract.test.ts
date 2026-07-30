import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildCalendarMonthView,
  buildContinuationMonthView,
  buildTimelineMeetings,
  getCalendarDateRange,
  getMeetingVisualLabel,
  getNewMeetingPrefillHref,
  getTodayTimelineDateLabel,
  groupMeetingsByCalendarDay,
} from "../../src/features/meetings/calendar-view.ts";
import {
  buildMeetingConfirmationStatusPatch,
  canManageMeetingConfirmation,
  getMeetingConfirmationActionLabel,
  getMeetingConfirmationTargetStatus,
} from "../../src/features/meetings/meeting-status.ts";
import {
  awardMeetingCreatedPointsAfterSave,
  awardMeetingRsvpPointsAfterSave,
  awardMeetingVotePointsAfterSave,
} from "../../src/features/meetings/meeting-points.ts";
import {
  mapMeetingDeleteError,
  MEETING_WITH_CHRONICLE_DELETE_ERROR,
} from "../../src/features/meetings/meeting-deletion.ts";
import {
  DEFAULT_MEETING_STATUS,
  formatDateKeyForDisplay,
  formatMeetingGameResponseCounts,
  getMeetingFormValues,
  getMeetingPrefillDateValue,
  normalizeMeetingLocationSuggestions,
} from "../../src/features/meetings/formatting.ts";
import type { MeetingCardItem } from "../../src/features/meetings/types.ts";
import {
  buildMeetingSubmittedValues,
  countConfirmedResponses,
  hasMeetingAvailabilityGap,
  sortMeetingRanking,
  validateMeetingFormData,
} from "../../src/features/meetings/validation.ts";
import { getPolishPublicHolidays } from "../../src/lib/dates/polish-holidays.ts";

test("RSVP save follow-up requests meeting RSVP points", async () => {
  let requestCount = 0;
  const result = await awardMeetingRsvpPointsAfterSave(async () => {
    requestCount += 1;
    return {
      data: [{ awarded: true, points: 10, point_event_id: "point-event-1" }],
      error: null,
    };
  });

  assert.equal(requestCount, 1);
  assert.deepEqual(result, {
    ok: true,
    awarded: true,
    points: 10,
    pointEventId: "point-event-1",
  });
});

test("meeting vote follow-up requests vote points", async () => {
  let requestCount = 0;
  const result = await awardMeetingVotePointsAfterSave(async () => {
    requestCount += 1;
    return {
      data: [{ awarded: true, points: 10, point_event_id: "point-event-2" }],
      error: null,
    };
  });

  assert.equal(requestCount, 1);
  assert.deepEqual(result, {
    ok: true,
    awarded: true,
    points: 10,
    pointEventId: "point-event-2",
  });
});

test("an idempotent meeting point no-op does not fail the domain mutation", async () => {
  const rsvpResult = await awardMeetingRsvpPointsAfterSave(async () => ({
    data: [{ awarded: false, points: 10, point_event_id: null }],
    error: null,
  }));
  const voteResult = await awardMeetingVotePointsAfterSave(async () => ({
    data: [{ awarded: false, points: 10, point_event_id: null }],
    error: null,
  }));

  assert.equal(rsvpResult.ok, true);
  assert.equal(voteResult.ok, true);
});

test("new meeting requests meeting_created points", async () => {
  let requestCount = 0;
  const result = await awardMeetingCreatedPointsAfterSave(true, async () => {
    requestCount += 1;
    return {
      data: [{ awarded: true, points: 25, point_event_id: "point-event-3" }],
      error: null,
    };
  });

  assert.equal(requestCount, 1);
  assert.deepEqual(result, {
    ok: true,
    skipped: false,
    awarded: true,
    points: 25,
    pointEventId: "point-event-3",
  });
});

test("editing a meeting skips meeting_created award", async () => {
  let requestCount = 0;
  const result = await awardMeetingCreatedPointsAfterSave(false, async () => {
    requestCount += 1;
    return { data: null, error: null };
  });

  assert.equal(requestCount, 0);
  assert.deepEqual(result, {
    ok: true,
    skipped: true,
    awarded: false,
    points: 0,
    pointEventId: null,
  });
});

test("idempotent meeting_created no-op does not fail meeting create", async () => {
  const result = await awardMeetingCreatedPointsAfterSave(true, async () => ({
    data: [{ awarded: false, points: 25, point_event_id: null }],
    error: null,
  }));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.awarded, false);
});

test("meeting delete maps Chronicle protection to the product message", () => {
  assert.equal(
    mapMeetingDeleteError({
      code: "P0001",
      message: MEETING_WITH_CHRONICLE_DELETE_ERROR,
    }),
    MEETING_WITH_CHRONICLE_DELETE_ERROR,
  );
});

test("meeting delete action calls only the delete_meeting RPC", () => {
  const source = readFileSync(
    new URL("../../src/features/meetings/actions.ts", import.meta.url),
    "utf8",
  );
  const actionSource = source.slice(
    source.indexOf("export async function deleteMeetingAction"),
  );

  assert.match(actionSource, /\.rpc\("delete_meeting"/);
  assert.doesNotMatch(actionSource, /\.from\("meetings"\)\s*\.delete\(\)/);
});

test("meeting read model exposes deletion only to existing managers", () => {
  const source = readFileSync(
    new URL("../../src/features/meetings/queries.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /canDelete:\s*canEdit/);
  assert.match(source, /hasChroniclePlay:/);
});

test("all application meeting reads explicitly exclude soft-deleted rows", () => {
  const sources = [
    "../../src/features/meetings/queries.ts",
    "../../src/features/dashboard/queries.ts",
    "../../src/features/plays/queries.ts",
    "../../src/features/legendarium/queries.ts",
  ].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));

  for (const source of sources) {
    const meetingReads = source.split('.from("meetings")').slice(1);
    assert.ok(meetingReads.length > 0);
    for (const read of meetingReads) {
      assert.match(read.slice(0, 500), /\.is\("deleted_at", null\)/);
    }
  }
});

function buildFormData(
  overrides?: Partial<{
    title: string;
    description: string;
    location: string;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
  }>,
) {
  const formData = new FormData();
  formData.set("title", overrides?.title ?? "Lipcowe granie");
  formData.set("description", overrides?.description ?? "Próba ognia");
  formData.set("location", overrides?.location ?? "Górska Chata");
  formData.set("startDate", overrides?.startDate ?? "18/07/2026");
  formData.set("endDate", overrides?.endDate ?? "18/07/2026");
  formData.set("startTime", overrides?.startTime ?? "17:30");
  formData.set("endTime", overrides?.endTime ?? "21:00");
  return formData;
}

function createMeeting(overrides?: Partial<MeetingCardItem>): MeetingCardItem {
  return {
    id: overrides?.id ?? "meeting-1",
    title: overrides?.title ?? "Wieczór w chacie",
    description: overrides?.description ?? null,
    location: overrides?.location ?? "Zakopane",
    status: overrides?.status ?? "planned",
    startsAt: overrides?.startsAt ?? "2026-07-18T15:30:00.000Z",
    endsAt: overrides?.endsAt ?? "2026-07-18T19:00:00.000Z",
    confirmedAttendeesCount: overrides?.confirmedAttendeesCount ?? 0,
    createdAt: overrides?.createdAt ?? "2026-07-01T10:00:00.000Z",
    updatedAt: overrides?.updatedAt ?? "2026-07-01T10:00:00.000Z",
    createdBy: overrides?.createdBy ?? {
      id: "10000000-0000-0000-0000-000000000001",
      displayName: "Admin",
      avatarUrl: null,
    },
    ownResponse: overrides?.ownResponse ?? null,
  };
}

test("meeting validation rejects an empty title", () => {
  const validation = validateMeetingFormData(buildFormData({ title: "   " }));

  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.equal(validation.fieldErrors.title, "Tytuł spotkania jest wymagany.");
});

test("meeting validation rejects an end earlier than start", () => {
  const validation = validateMeetingFormData(
    buildFormData({
      startDate: "18/07/2026",
      endDate: "18/07/2026",
      startTime: "18:00",
      endTime: "17:00",
    }),
  );

  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.equal(
    validation.fieldErrors.endTime,
    "Koniec spotkania musi być późniejszy niż początek.",
  );
});

test("meeting validation preserves submitted values after a validation error", () => {
  const formData = buildFormData({
    title: "Wieczór testowy",
    location: "U Ani",
    startDate: "18/07/2026",
    endDate: "18/07/2026",
    startTime: "20:00",
    endTime: "18:00",
  });
  const validation = validateMeetingFormData(formData);

  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.deepEqual(
    validation.submittedValues,
    buildMeetingSubmittedValues(formData),
  );
});

test("new meetings default to planned status", () => {
  assert.equal(DEFAULT_MEETING_STATUS, "planned");
});

test("planned meeting transitions to confirmed", () => {
  assert.equal(getMeetingConfirmationTargetStatus("planned"), "confirmed");
});

test("confirmed meeting transitions back to planned", () => {
  assert.equal(getMeetingConfirmationTargetStatus("confirmed"), "planned");
});

test("confirmation patch changes only meeting status", () => {
  assert.deepEqual(buildMeetingConfirmationStatusPatch("confirmed"), {
    status: "planned",
  });
});

test("creator can manage meeting confirmation", () => {
  assert.equal(
    canManageMeetingConfirmation(
      { id: "user-1", role: "member" },
      { createdById: "user-1", status: "confirmed" },
    ),
    true,
  );
});

test("different member cannot manage meeting confirmation", () => {
  assert.equal(
    canManageMeetingConfirmation(
      { id: "user-2", role: "member" },
      { createdById: "user-1", status: "confirmed" },
    ),
    false,
  );
});

test("admin can manage meeting confirmation", () => {
  assert.equal(
    canManageMeetingConfirmation(
      { id: "admin-1", role: "admin" },
      { createdById: "user-1", status: "confirmed" },
    ),
    true,
  );
});

test("meeting confirmation action labels reflect current state", () => {
  assert.equal(
    getMeetingConfirmationActionLabel("planned"),
    "Potwierdź spotkanie",
  );
  assert.equal(
    getMeetingConfirmationActionLabel("confirmed"),
    "Cofnij potwierdzenie",
  );
});

test("location suggestions are unique, trimmed and non-empty", () => {
  assert.deepEqual(
    normalizeMeetingLocationSuggestions([
      " Górska Chata ",
      "U Ani",
      "",
      "u ani",
      null,
    ]),
    ["Górska Chata", "U Ani"],
  );
});

test("timeline attendee count includes only RSVP=true", () => {
  assert.equal(
    countConfirmedResponses([true, false, null, true, undefined]),
    2,
  );
});

test("timeline attendee count is 0 when nobody confirmed", () => {
  assert.equal(countConfirmedResponses([false, null, undefined]), 0);
});

test("ranking sort contract uses yes desc, then fewer no, then title", () => {
  const sorted = sortMeetingRanking([
    { title: "XCOM", yesCount: 2, noCount: 0 },
    { title: "Frostpunk", yesCount: 4, noCount: 3 },
    { title: "Anachrony", yesCount: 2, noCount: 2 },
  ]);

  assert.deepEqual(
    sorted.map((game) => game.title),
    ["Frostpunk", "XCOM", "Anachrony"],
  );
});

test("ranking sort falls back to title only when yes and no both tie", () => {
  const sorted = sortMeetingRanking([
    { title: "XCOM", yesCount: 2, noCount: 1 },
    { title: "Anachrony", yesCount: 2, noCount: 1 },
  ]);

  assert.deepEqual(
    sorted.map((game) => game.title),
    ["Anachrony", "XCOM"],
  );
});

test("timeline uses the single meeting interval", () => {
  const items = buildTimelineMeetings(
    [
      createMeeting({
        startsAt: "2026-07-12T17:30:00.000Z",
        endsAt: "2026-07-12T20:00:00.000Z",
      }),
    ],
    new Date("2026-07-10T12:00:00.000Z"),
  );

  assert.equal(items[0]?.startsAt, "2026-07-12T17:30:00.000Z");
});

test("completed meetings are excluded from timeline", () => {
  const items = buildTimelineMeetings(
    [
      createMeeting({
        status: "completed",
        startsAt: "2026-07-12T17:30:00.000Z",
      }),
    ],
    new Date("2026-07-10T12:00:00.000Z"),
  );

  assert.equal(items.length, 0);
});

test("planned meeting without RSVP is marked as needing action", () => {
  assert.equal(
    hasMeetingAvailabilityGap(
      createMeeting({
        status: "planned",
        ownResponse: null,
      }),
    ),
    true,
  );
});

test("calendar groups meetings by warsaw day", () => {
  const grouped = groupMeetingsByCalendarDay([
    createMeeting({
      title: "Sobota",
      startsAt: "2026-07-18T17:30:00.000Z",
      endsAt: "2026-07-18T20:00:00.000Z",
    }),
    createMeeting({
      id: "meeting-2",
      title: "Nocna sesja",
      startsAt: "2026-07-18T19:00:00.000Z",
      endsAt: "2026-07-18T22:00:00.000Z",
    }),
  ]);

  assert.equal(grouped.get("2026-07-18")?.length, 2);
});

test("calendar marker contract points an event to its meeting details page", () => {
  const grouped = groupMeetingsByCalendarDay([createMeeting()]);
  const marker = grouped.get("2026-07-18")?.[0];

  assert.equal(marker?.href, "/kalendarium/meeting-1");
});

test("holiday helper covers movable and fixed polish holidays", () => {
  const holidays = getPolishPublicHolidays(2026);

  assert.equal(
    holidays.some(
      (holiday) =>
        holiday.dateKey === "2026-12-24" &&
        holiday.name === "Wigilia Bożego Narodzenia",
    ),
    true,
  );
  assert.equal(
    holidays.some(
      (holiday) =>
        holiday.dateKey === "2026-04-06" &&
        holiday.name === "Poniedziałek Wielkanocny",
    ),
    true,
  );
});

test("calendar month view includes adjacent month days and holidays", () => {
  const month = buildCalendarMonthView([], "2026-07", new Date("2026-07-10"));

  assert.equal(month.weeks[0]?.length, 7);
  assert.equal(month.monthParam, "2026-07");
  assert.equal(
    month.weeks.flat().some((cell) => cell.holidayName === "Boże Ciało"),
    false,
  );
});

test("visual label maps confirmed, decision-required and awaiting-group states", () => {
  assert.equal(
    getMeetingVisualLabel(
      createMeeting({
        status: "confirmed",
        ownResponse: null,
      }),
    ),
    "Do decyzji",
  );

  assert.equal(
    getMeetingVisualLabel(
      createMeeting({
        status: "planned",
        ownResponse: null,
      }),
    ),
    "Do decyzji",
  );

  assert.equal(
    getMeetingVisualLabel(
      createMeeting({
        status: "confirmed",
        ownResponse: true,
      }),
    ),
    "Potwierdzone",
  );

  assert.equal(
    getMeetingVisualLabel(
      createMeeting({
        status: "confirmed",
        ownResponse: false,
      }),
    ),
    "Potwierdzone",
  );

  assert.equal(
    getMeetingVisualLabel(
      createMeeting({
        status: "planned",
        ownResponse: true,
      }),
    ),
    "Do ustalenia",
  );

  assert.equal(
    getMeetingVisualLabel(
      createMeeting({
        status: "planned",
        ownResponse: false,
      }),
    ),
    "Do ustalenia",
  );
});

test("meeting prefill helper maps date query to dd/MM/yyyy", () => {
  assert.equal(getMeetingPrefillDateValue("2026-07-17"), "17/07/2026");
  assert.equal(getMeetingPrefillDateValue("17-07-2026"), "");
});

test("date picker selection helper maps date key to dd/MM/yyyy", () => {
  assert.equal(formatDateKeyForDisplay("2026-08-03"), "03/08/2026");
});

test("calendar day link contract points to new meeting with date prefill", () => {
  assert.equal(
    getNewMeetingPrefillHref("2026-07-17"),
    "/kalendarium/nowe?date=2026-07-17",
  );
});

test("multi-day calendar range spans every day in the meeting window", () => {
  assert.deepEqual(
    getCalendarDateRange(
      "2026-07-21T18:00:00.000Z",
      "2026-07-25T10:00:00.000Z",
    ),
    ["2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24", "2026-07-25"],
  );
});

test("multi-day event is grouped into every calendar day in range", () => {
  const grouped = groupMeetingsByCalendarDay([
    createMeeting({
      title: "Wyjazd planszówkowy",
      startsAt: "2026-07-21T18:00:00.000Z",
      endsAt: "2026-07-25T10:00:00.000Z",
    }),
  ]);

  assert.equal(grouped.get("2026-07-21")?.length, 1);
  assert.equal(grouped.get("2026-07-22")?.length, 1);
  assert.equal(grouped.get("2026-07-23")?.length, 1);
  assert.equal(grouped.get("2026-07-24")?.length, 1);
  assert.equal(grouped.get("2026-07-25")?.length, 1);
});

test("today timeline label formats current date for the start tile", () => {
  assert.equal(
    getTodayTimelineDateLabel(new Date("2026-07-05T12:00:00.000Z")),
    "05 LIP",
  );
});

test("continuation month starts from the next calendar month", () => {
  const currentMonth = buildCalendarMonthView(
    [],
    "2026-07",
    new Date("2026-07-10"),
    { showOutsideMonthDays: false },
  );
  const continuation = buildContinuationMonthView(
    currentMonth,
    [],
    new Date("2026-07-10"),
  );

  const continuationFirstVisibleDateKey = continuation.weeks
    .flat()
    .find((day) => !day.isPlaceholder)?.dateKey;

  assert.equal(continuationFirstVisibleDateKey, "2026-08-01");
});

test("continuation month does not duplicate days already shown above", () => {
  const currentMonth = buildCalendarMonthView(
    [],
    "2026-07",
    new Date("2026-07-10"),
    { showOutsideMonthDays: false },
  );
  const continuation = buildContinuationMonthView(
    currentMonth,
    [],
    new Date("2026-07-10"),
  );

  const currentDays = new Set(
    currentMonth.weeks
      .flat()
      .filter((day) => !day.isPlaceholder)
      .map((day) => day.dateKey),
  );
  const overlap = continuation.weeks
    .flat()
    .filter((day) => !day.isPlaceholder)
    .filter((day) => currentDays.has(day.dateKey));

  assert.equal(overlap.length, 0);
});

test("month-only mode hides outside-month spillover days as placeholders", () => {
  const month = buildCalendarMonthView([], "2026-07", new Date("2026-07-10"), {
    showOutsideMonthDays: false,
  });

  assert.equal(month.weeks[0]?.[0]?.isPlaceholder, true);
  assert.equal(month.weeks[0]?.[2]?.dateKey, "2026-07-01");
  assert.equal(month.weeks.length, 5);
});

test("month view renders only the minimal number of calendar weeks", () => {
  const july = buildCalendarMonthView([], "2026-07", new Date("2026-07-10"), {
    showOutsideMonthDays: false,
  });
  const august = buildCalendarMonthView([], "2026-08", new Date("2026-08-10"), {
    showOutsideMonthDays: false,
  });

  assert.equal(july.weeks.length, 5);
  assert.equal(august.weeks.length, 6);
});

test("month view does not render a completely empty trailing week", () => {
  const july = buildCalendarMonthView([], "2026-07", new Date("2026-07-10"), {
    showOutsideMonthDays: false,
  });
  const lastWeek = july.weeks.at(-1) ?? [];

  assert.equal(
    lastWeek.every((day) => day.isPlaceholder),
    false,
  );
});

test("form values use the clicked day as both start and end date by default", () => {
  assert.deepEqual(getMeetingFormValues(undefined, "2026-07-17"), {
    title: "",
    description: "",
    location: "",
    startDate: "17/07/2026",
    endDate: "17/07/2026",
    startTime: "18:00",
    endTime: "23:00",
  });
});

test("response counts distinguish silence from a rejected candidate", () => {
  assert.equal(
    formatMeetingGameResponseCounts(0, 0),
    "Nikt jeszcze nie odpowiedział",
  );
  assert.equal(
    formatMeetingGameResponseCounts(0, 2),
    "0 chce grać · 2 nie chce grać",
  );
  assert.equal(
    formatMeetingGameResponseCounts(3, 1),
    "3 chce grać · 1 nie chce grać",
  );
});

test("a proposed game stays a candidate with no responses at all", () => {
  const sorted = sortMeetingRanking([
    { title: "Bez odpowiedzi", yesCount: 0, noCount: 0 },
    { title: "Odrzucona", yesCount: 0, noCount: 2 },
    { title: "Chciana", yesCount: 1, noCount: 0 },
  ]);

  assert.deepEqual(
    sorted.map((game) => game.title),
    ["Chciana", "Bez odpowiedzi", "Odrzucona"],
  );
});
