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
  awardMeetingRsvpPointsAfterSave,
  awardMeetingVotePointsAfterSave,
} from "../../src/features/meetings/meeting-points.ts";
import { enqueueMeetingConfirmationReminderAfterRsvp } from "../../src/features/meetings/meeting-confirmation-reminder.ts";
import {
  mapMeetingDeleteError,
  MEETING_CONTINUATION_DELETE_ERROR,
  MEETING_WITH_CHRONICLE_DELETE_ERROR,
} from "../../src/features/meetings/meeting-deletion.ts";
import {
  hasUsableContinuationContext,
  isMeetingContinuationCandidate,
} from "../../src/features/meetings/continuation.ts";
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
  shouldRenderContinuationField,
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

test("meeting confirmation reminder failure never turns a saved RSVP into a failed mutation", async () => {
  const logged: Array<{ message: string; details: Record<string, unknown> }> =
    [];
  const result = await enqueueMeetingConfirmationReminderAfterRsvp(
    async () => ({
      data: null,
      error: { code: "PUSH_DOWN", message: "temporary failure" },
    }),
    (message, details) => logged.push({ message, details }),
  );

  assert.deepEqual(result, { ok: false, queued: false });
  assert.equal(logged.length, 1);
  assert.deepEqual(logged[0]?.details, {
    code: "PUSH_DOWN",
    message: "temporary failure",
  });
});

test("meeting confirmation reminder reports whether the outbox needs dispatch", async () => {
  const queued = await enqueueMeetingConfirmationReminderAfterRsvp(
    async () => ({
      data: true,
      error: null,
    }),
  );
  const belowThreshold = await enqueueMeetingConfirmationReminderAfterRsvp(
    async () => ({ data: false, error: null }),
  );

  assert.deepEqual(queued, { ok: true, queued: true });
  assert.deepEqual(belowThreshold, { ok: true, queued: false });
});

test("RSVP action checks the confirmation reminder only after a successful upsert", () => {
  const source = readFileSync(
    new URL("../../src/features/meetings/actions.ts", import.meta.url),
    "utf8",
  );
  const actionSource = source.slice(
    source.indexOf("export async function saveMeetingAvailabilityAction"),
    source.indexOf("export async function confirmMeetingAction"),
  );

  const upsertIndex = actionSource.indexOf(
    '.from("meeting_availability").upsert',
  );
  const errorGuardIndex = actionSource.indexOf("if (error)", upsertIndex);
  const reminderIndex = actionSource.indexOf(
    "enqueueMeetingConfirmationReminderAfterRsvp",
  );

  assert.ok(upsertIndex >= 0);
  assert.ok(errorGuardIndex > upsertIndex);
  assert.ok(reminderIndex > errorGuardIndex);
  assert.match(actionSource, /rpc\(\s*"enqueue_meeting_confirmation_reminder"/);
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

/*
 * Economy V2: nagroda za organizację przeniosła się w całości do bazy —
 * public.complete_meeting nalicza ją przy domknięciu spotkania, więc po
 * stronie TS nie ma już czego testować. Warunek "tylko za spotkanie, które
 * się odbyło" pokrywa pgTAP 016_economy_v2.
 */

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
    "../../src/features/meetings/participation.ts",
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
    continuesPlay: string;
    continuedPlayId: string;
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

  if (overrides?.continuesPlay !== undefined) {
    formData.set("continuesPlay", overrides.continuesPlay);
  }

  if (overrides?.continuedPlayId !== undefined) {
    formData.set("continuedPlayId", overrides.continuedPlayId);
  }

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

test("meeting validation accepts native time values in HH:mm format", () => {
  const validation = validateMeetingFormData(
    buildFormData({
      startDate: "18/07/2026",
      endDate: "18/07/2026",
      startTime: "18:00",
      endTime: "23:00",
    }),
  );

  assert.equal(validation.ok, true);
  if (!validation.ok) return;

  assert.equal(validation.data.startsAt, "2026-07-18T16:00:00.000Z");
  assert.equal(validation.data.endsAt, "2026-07-18T21:00:00.000Z");
});

test("all clock fields use the shared native minute picker", () => {
  const timeInput = readFileSync(
    new URL("../../src/components/ui/time-input.tsx", import.meta.url),
    "utf8",
  );
  const meetingForm = readFileSync(
    new URL("../../src/features/meetings/meeting-form.tsx", import.meta.url),
    "utf8",
  );
  const playForm = readFileSync(
    new URL("../../src/features/plays/play-form.tsx", import.meta.url),
    "utf8",
  );

  assert.match(timeInput, /type="time"/);
  assert.match(timeInput, /step=\{60\}/);
  assert.match(timeInput, /min-w-0 max-w-full/);
  assert.equal((meetingForm.match(/<TimeInput/g) ?? []).length, 2);
  assert.match(meetingForm, /name="startTime"/);
  assert.match(meetingForm, /name="endTime"/);
  assert.equal((playForm.match(/<TimeInput/g) ?? []).length, 1);
  assert.match(playForm, /name="playedOnTime"/);
  assert.doesNotMatch(meetingForm, /placeholder="HH:mm"/);
  assert.doesNotMatch(playForm, /placeholder="HH:mm"/);
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
    invitedUserIds: [],
    continuedPlayId: "",
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

// --- Propozycja dokończenia i późniejszy wybór przy Stole -----------------

const CONTINUED_PLAY_ID = "9f6f1d0c-3b3a-4d63-9c1e-2f0a5b7c8d91";

test("meeting without the continuation checkbox saves no play pointer", () => {
  const validation = validateMeetingFormData(buildFormData());

  assert.equal(validation.ok, true);
  if (!validation.ok) return;
  assert.equal(validation.data.continuedPlayId, null);
});

test("meeting continuation carries the selected play id as a proposal", () => {
  const validation = validateMeetingFormData(
    buildFormData({ continuesPlay: "1", continuedPlayId: CONTINUED_PLAY_ID }),
  );

  assert.equal(validation.ok, true);
  if (!validation.ok) return;
  assert.equal(validation.data.continuedPlayId, CONTINUED_PLAY_ID);
});

test("meeting mutations save a proposal through plan RPCs, never as the active pointer", () => {
  const actions = readFileSync(
    new URL("../../src/features/meetings/actions.ts", import.meta.url),
    "utf8",
  );
  const createAction = actions.slice(
    actions.indexOf("export async function createMeetingAction"),
    actions.indexOf("export async function updateMeetingAction"),
  );
  const updateAction = actions.slice(
    actions.indexOf("export async function updateMeetingAction"),
    actions.indexOf("export async function saveMeetingAvailabilityAction"),
  );

  assert.match(createAction, /create_meeting_plan_with_invitations/);
  assert.match(createAction, /p_proposed_continued_play_id/);
  assert.doesNotMatch(createAction, /p_continued_play_id:/);
  assert.match(updateAction, /update_meeting_plan_with_invitations/);
  assert.match(updateAction, /p_proposed_continued_play_id/);
  assert.doesNotMatch(updateAction, /p_continued_play_id:/);
});

test("continuation metadata never changes the meeting interval", () => {
  const formData = buildFormData({
    continuesPlay: "1",
    continuedPlayId: CONTINUED_PLAY_ID,
    startDate: "20/08/2026",
    endDate: "20/08/2026",
    startTime: "18:15",
    endTime: "22:45",
  });

  formData.set("playedAt", "2024-01-01T05:00:00.000Z");
  formData.set("durationMinutes", "9999");
  formData.set("liveStartedAt", "2024-01-01T05:00:00.000Z");
  formData.set("resultPending", "true");

  const validation = validateMeetingFormData(formData);
  assert.equal(validation.ok, true);
  if (!validation.ok) return;

  assert.equal(validation.data.startsAt, "2026-08-20T16:15:00.000Z");
  assert.equal(validation.data.endsAt, "2026-08-20T20:45:00.000Z");
  assert.equal(validation.data.continuedPlayId, CONTINUED_PLAY_ID);
});

test("clearing continued_play_id leaves the meeting interval unchanged", () => {
  const withContinuation = validateMeetingFormData(
    buildFormData({
      continuesPlay: "1",
      continuedPlayId: CONTINUED_PLAY_ID,
      startDate: "20/08/2026",
      endDate: "20/08/2026",
      startTime: "18:15",
      endTime: "22:45",
    }),
  );
  const cleared = validateMeetingFormData(
    buildFormData({
      continuesPlay: "",
      continuedPlayId: "",
      startDate: "20/08/2026",
      endDate: "20/08/2026",
      startTime: "18:15",
      endTime: "22:45",
    }),
  );

  assert.equal(withContinuation.ok, true);
  assert.equal(cleared.ok, true);
  if (!withContinuation.ok || !cleared.ok) return;

  assert.equal(cleared.data.startsAt, withContinuation.data.startsAt);
  assert.equal(cleared.data.endsAt, withContinuation.data.endsAt);
  assert.equal(cleared.data.continuedPlayId, null);
});

test("manual and Table-created in-progress plays are both continuation candidates", () => {
  const common = {
    id: CONTINUED_PLAY_ID,
    status: "in_progress" as const,
    resultPending: false,
    liveEndedAt: null,
  };

  assert.equal(
    isMeetingContinuationCandidate({
      ...common,
      meetingId: null,
      liveStartedAt: null,
    }),
    true,
  );
  assert.equal(
    isMeetingContinuationCandidate({
      ...common,
      meetingId: "20000000-0000-0000-0000-000000000001",
      liveStartedAt: "2026-08-17T17:00:00.000Z",
    }),
    true,
  );
});

test("completed plays are excluded, while result-pending plays remain continuable", () => {
  assert.equal(
    isMeetingContinuationCandidate({
      id: CONTINUED_PLAY_ID,
      meetingId: null,
      status: "completed",
      resultPending: false,
      liveStartedAt: null,
      liveEndedAt: null,
    }),
    false,
  );
  assert.equal(
    isMeetingContinuationCandidate({
      id: CONTINUED_PLAY_ID,
      meetingId: "20000000-0000-0000-0000-000000000001",
      status: "in_progress",
      resultPending: true,
      liveStartedAt: "2026-08-17T17:00:00.000Z",
      liveEndedAt: "2026-08-17T19:00:00.000Z",
    }),
    true,
  );
});

test("a play tied only to a soft-deleted meeting is hidden from continuation UI", () => {
  assert.equal(
    hasUsableContinuationContext({
      startMeetingId: "20000000-0000-0000-0000-000000000001",
      startMeetingExists: false,
      hasAssignedMeeting: false,
    }),
    false,
  );
  assert.equal(
    hasUsableContinuationContext({
      startMeetingId: "20000000-0000-0000-0000-000000000001",
      startMeetingExists: false,
      hasAssignedMeeting: true,
    }),
    true,
  );
});

test("continuation checked without a chosen play is a field error, not a silent save", () => {
  const validation = validateMeetingFormData(
    buildFormData({ continuesPlay: "1", continuedPlayId: "" }),
  );

  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.equal(
    validation.fieldErrors.continuedPlayId,
    "Wybierz odłożoną partię albo wyczyść propozycję.",
  );
});

test("a play id that is not an identifier never reaches the RPC", () => {
  const values = buildMeetingSubmittedValues(
    buildFormData({ continuesPlay: "1", continuedPlayId: "1; drop table" }),
  );

  assert.equal(values.continuedPlayId, "");
});

test("meeting form does not turn an already selected continuation into a proposal", () => {
  const values = getMeetingFormValues({
    ...createMeeting({ id: "meeting-1" }),
    canEdit: true,
    canDelete: true,
    hasChroniclePlay: false,
    continuedPlay: {
      playId: CONTINUED_PLAY_ID,
      gameId: "game-1",
      gameTitle: "Gloomhaven",
      coverUrl: null,
      status: "in_progress",
      startMeetingId: null,
      isRunning: false,
      assignedMeeting: null,
      playedAt: "2026-08-01T16:00:00.000Z",
      stateNote: "Runda 3 z 5",
      accumulatedMinutes: 180,
    },
    canConfirm: false,
    hasResponded: false,
    attendanceRows: [],
    invitedUserIds: [],
    gameVotes: [],
    continuationVotes: [],
    availableGames: [],
    recommendedGames: [],
  });

  assert.equal(values.continuedPlayId, "");
});

test("continuation deletion guard keeps the message coming from the database", () => {
  assert.equal(
    mapMeetingDeleteError({
      code: "P0001",
      message: MEETING_CONTINUATION_DELETE_ERROR,
    }),
    MEETING_CONTINUATION_DELETE_ERROR,
  );
});

test("the finished-meeting quest source skips meetings that continue a play", () => {
  const source = readFileSync(
    new URL("../../src/features/dashboard/queries.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /!meeting\.continued_play_id/);
});

/*
 * Regresja scenariusza: spotkanie A rozpoczyna partię, spotkanie B ją
 * kontynuuje, na B partia zostaje zamknięta, a potem ktoś edytuje w B samą
 * godzinę. Przypisana kontynuacja ma przetrwać taką edycję, mimo że lista
 * kandydatów pokazuje wyłącznie partie `in_progress`.
 */

test("a finished continuation still renders the field when no candidates are left", () => {
  assert.equal(shouldRenderContinuationField(0, CONTINUED_PLAY_ID), true);

  // Sama funkcja nie wystarczy — ukryte pola znikają razem z sekcją, więc to
  // komponent musi pytać o widoczność właśnie w ten sposób.
  const source = readFileSync(
    new URL(
      "../../src/features/meetings/meeting-continuation-field.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    source,
    /shouldRenderContinuationField\(plays\.length, defaultValue\)/,
  );
  assert.doesNotMatch(source, /plays\.length === 0\) return null/);
});

test("no candidates and no assigned play hides the whole section", () => {
  assert.equal(shouldRenderContinuationField(0, ""), false);
});

test("available candidates render the field even without an assigned play", () => {
  assert.equal(shouldRenderContinuationField(2, ""), true);
});

test("the edit form keeps the selected play out of the proposal picker", () => {
  const source = readFileSync(
    new URL("../../src/features/meetings/queries.ts", import.meta.url),
    "utf8",
  );

  // Karta spotkania czyta kontynuację bez filtra po statusie...
  const continuedPlayRead = source.slice(
    source.indexOf("if (meeting.continued_play_id)"),
  );
  assert.doesNotMatch(
    continuedPlayRead.slice(0, 400),
    /\.eq\("status", "in_progress"\)/,
  );

  // Ogólny read helper potrafi jawnie dołączyć wskazany wpis dla zgodności
  // legacy, ale formularz nie zapisuje aktywnego wyboru drugi raz jako
  // propozycji.
  assert.match(
    source,
    /playsQuery\.or\(`status\.eq\.in_progress,id\.eq\.\$\{includePlayId\}`\)/,
  );
  assert.match(
    source,
    /\{ includePlayId, includeRunning: options\.includeRunning \}/,
  );
  const editFormData = source.slice(
    source.indexOf("export async function getMeetingFormData"),
    source.indexOf("export async function getMeetingCreateFormData"),
  );
  assert.match(editFormData, /listContinuablePlays\(\)/);
  assert.doesNotMatch(editFormData, /details\.continuedPlay\?\.playId/);
});

test("a new meeting can only pick plays that are still in progress", () => {
  const source = readFileSync(
    new URL("../../src/features/meetings/queries.ts", import.meta.url),
    "utf8",
  );
  const createFormData = source.slice(
    source.indexOf("export async function getMeetingCreateFormData"),
  );

  // Brak argumentu = gałąź .eq("status", "in_progress"), więc zakończona partia
  // nie może zostać wybrana dla nowego spotkania.
  assert.match(createFormData, /listContinuablePlays\(\)/);
  assert.doesNotMatch(createFormData, /listContinuablePlays\([^)]+\)/);
});

test("continuable play query includes Table-created rows and filters deleted context", () => {
  const source = readFileSync(
    new URL("../../src/features/meetings/queries.ts", import.meta.url),
    "utf8",
  );
  const query = source.slice(
    source.indexOf("export async function listContinuablePlays"),
    source.indexOf("export async function listMeetings"),
  );

  assert.match(query, /meeting_id/);
  assert.match(query, /live_started_at/);
  assert.match(query, /isMeetingContinuationCandidate/);
  assert.match(query, /hasUsableContinuationContext/);
  assert.doesNotMatch(query, /\.eq\("result_pending", false\)/);
  assert.doesNotMatch(
    query,
    /live_started_at\.is\.null,live_ended_at\.not\.is\.null/,
  );
  assert.doesNotMatch(query, /\.is\("meeting_id", null\)/);
  assert.doesNotMatch(query, /\.eq\("meeting_id", null\)/);
});

test("the resume action never describes result-pending as a blocking state", () => {
  const actions = readFileSync(
    new URL("../../src/features/meetings/actions.ts", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL(
      "../../supabase/migrations/20260817121000_meeting_continuation_result_pending_fix.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.doesNotMatch(actions, /czeka tylko na wynik/);
  assert.match(migration, /play\.status = 'in_progress'/);
  assert.doesNotMatch(migration, /play\.result_pending\s*=\s*false/);
});

test("pausing preserves the selected continuation and resume can switch play_id", () => {
  const switchMigration = readFileSync(
    new URL(
      "../../supabase/migrations/20260817123000_pause_and_switch_meeting_continuation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const planFlowMigration = readFileSync(
    new URL(
      "../../supabase/migrations/20260817124000_meeting_continuation_plan_flow.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    planFlowMigration,
    /create or replace function public\.pause_meeting_play/,
  );
  assert.match(planFlowMigration, /perform public\.finish_meeting_play/);
  assert.doesNotMatch(planFlowMigration, /set continued_play_id = null/);
  assert.match(switchMigration, /set continued_play_id = p_play_id/);
  assert.doesNotMatch(
    switchMigration,
    /This meeting already continues another play/,
  );
  assert.doesNotMatch(planFlowMigration, /insert into public\.plays/);
});

test("meeting action maps the time error only from the actual time constraint", () => {
  const actions = readFileSync(
    new URL("../../src/features/meetings/actions.ts", import.meta.url),
    "utf8",
  );

  assert.match(actions, /message\.includes\("meetings_time_check"\)/);
  assert.doesNotMatch(
    actions,
    /case "23514":\s*return "Koniec spotkania musi być późniejszy niż początek\."/,
  );
});

test("same-game continuations stay as separate play_id choices in form and modal", () => {
  const field = readFileSync(
    new URL(
      "../../src/features/meetings/meeting-continuation-field.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const modal = readFileSync(
    new URL(
      "../../src/features/meetings/meeting-game-proposals.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const formatting = readFileSync(
    new URL("../../src/features/meetings/formatting.ts", import.meta.url),
    "utf8",
  );

  assert.match(field, /plays\.map\(\(play\) =>/);
  assert.match(field, /key=\{play\.playId\}/);
  assert.match(modal, /filteredContinuablePlays\.map\(\(play\) =>/);
  assert.match(modal, /key=\{play\.playId\}/);
  assert.match(formatting, /continuationDateTimeFormatter/);
  assert.match(formatting, /stateNote/);
});

test("unchecking the continuation clears the hidden play id", () => {
  const source = readFileSync(
    new URL(
      "../../src/features/meetings/meeting-continuation-field.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /if \(!event\.target\.checked\) setSelectedId\(""\)/);
  assert.match(source, /value=\{isOpen \? selectedId : ""\}/);
});

/* Sekcja planu zawsze łączy zwykłe gry i odłożone partie. */

function readMeetingDetailsPage() {
  return readFileSync(
    new URL("../../src/app/(app)/kalendarium/[id]/page.tsx", import.meta.url),
    "utf8",
  );
}

test("the meeting always renders one shared plan for games and continuations", () => {
  const source = readMeetingDetailsPage();

  assert.match(source, /selectedContinuation=\{meeting\.continuedPlay\}/);
  assert.equal(source.match(/<MeetingGameProposals/g)?.length, 1);
  assert.doesNotMatch(source, /<MeetingContinuationSummary/);
});

test("a plain meeting keeps proposals, voting and the propose button", () => {
  const proposals = readFileSync(
    new URL(
      "../../src/features/meetings/meeting-game-proposals.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(proposals, /Plan wieczoru/);
  assert.match(proposals, /Proponuj grę/);
  assert.match(proposals, /<MeetingGameResponseToggle/);
});

test("the propose-game modal records a continuation proposal instead of finishing the play", () => {
  const proposals = readFileSync(
    new URL(
      "../../src/features/meetings/meeting-game-proposals.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const page = readMeetingDetailsPage();

  assert.match(proposals, /filteredContinuablePlays/);
  assert.match(proposals, /Odłożone partie/);
  assert.match(
    proposals,
    /proposeMeetingContinuationAction\(meetingId, playId\)/,
  );
  assert.match(proposals, /Zaproponuj/);
  assert.doesNotMatch(proposals, /resumeMeetingPlayAction/);
  assert.doesNotMatch(proposals, /`\/kronika\/\$\{play\.playId\}\/edytuj`/);
  assert.doesNotMatch(proposals, /startMeetingPlayAction/);
  assert.match(page, /continuablePlays=\{continuablePlays\}/);
  assert.match(page, /continuationVotes=\{meeting\.continuationVotes\}/);
});

test("continuation proposals render beside games with the same yes/no control", () => {
  const proposals = readFileSync(
    new URL(
      "../../src/features/meetings/meeting-game-proposals.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const toggle = readFileSync(
    new URL(
      "../../src/features/meetings/meeting-game-response-toggle.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(proposals, /continuationVotes\.map/);
  assert.match(proposals, /continuedPlayId=\{proposal\.playId\}/);
  assert.match(proposals, /Odłożona partia/);
  assert.match(toggle, /setMeetingContinuationResponseAction/);
  assert.match(toggle, /label="Chcę grać"/);
  assert.match(toggle, /label="Nie chcę grać"/);
});

test("continuation proposal actions use play_id and never create a Chronicle row", () => {
  const actions = readFileSync(
    new URL("../../src/features/meetings/actions.ts", import.meta.url),
    "utf8",
  );
  const proposalAction = actions.slice(
    actions.indexOf("export async function proposeMeetingContinuationAction"),
    actions.indexOf("export async function setMeetingGameResponseAction"),
  );

  assert.match(proposalAction, /propose_meeting_continuation/);
  assert.match(proposalAction, /p_continued_play_id: playId/);
  assert.doesNotMatch(proposalAction, /from\("plays"\)/);
  assert.doesNotMatch(proposalAction, /startMeetingPlayAction/);
  assert.doesNotMatch(proposalAction, /redirect\(/);
});

// Asercje negatywne patrzą na sam kod: komentarze w tych plikach z natury
// wymieniają rzeczy, których w danym wariancie NIE ma („bez głosowania”,
// „zamiast Proponuj grę”), więc bez odsiania trafiałyby we własne uzasadnienia.
function withoutComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

test("a selected continuation is shown inside the shared plan without a large Chronicle CTA", () => {
  const proposals = readFileSync(
    new URL(
      "../../src/features/meetings/meeting-game-proposals.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const page = readMeetingDetailsPage();
  const code = withoutComments(proposals);

  assert.match(code, /selectedContinuation/);
  assert.match(code, /Wybrana kontynuacja/);
  assert.match(code, /formatMeetingContinuationSubtitle\(selectedContinuation\)/);
  assert.match(page, /selectedContinuation=\{meeting\.continuedPlay\}/);
  assert.doesNotMatch(code, /Dokończ partię z Kroniki/);
  assert.doesNotMatch(code, /kronika\/nowa/);
});

test("a legacy selected continuation stays readable without replacing voting", () => {
  const proposals = readFileSync(
    new URL(
      "../../src/features/meetings/meeting-game-proposals.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const code = withoutComments(proposals);

  assert.match(code, /selectedContinuation && !selectedContinuationIsProposed/);
  assert.match(code, /continuationVotes\.map/);
  assert.match(code, /games\.map/);
  assert.match(code, /<MeetingGameResponseToggle/);
});

test("the continuation summary reads existing data and mutates nothing", () => {
  const summary = readFileSync(
    new URL(
      "../../src/features/meetings/meeting-continuation-summary.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const code = withoutComments(summary);

  // Brak akcji serwerowych i brak stanu klienta: sekcja jest czystym odczytem,
  // więc nie ma jak stworzyć ani skasować żadnego wiersza.
  assert.doesNotMatch(code, /"use client"/);
  assert.doesNotMatch(code, /Action\(/);
  assert.doesNotMatch(code, /supabase/i);
});

test("a continuation meeting offers no CTA for logging the same game again", () => {
  const source = readMeetingDetailsPage();
  const actionRow = withoutComments(
    source.slice(
      source.indexOf("{canLogPlay ? ("),
      source.indexOf("Pasek akcji NAD kartką"),
    ),
  );

  // Jeden link w pasku i prowadzi wyłącznie do formularza INNEJ partii —
  // powrót do kontynuowanej rozgrywki należy do sekcji gier niżej, więc nie ma
  // go tu w postaci drugiego, konkurencyjnego CTA.
  assert.match(actionRow, /Zapisz inną partię/);
  assert.equal(actionRow.match(/<ActionLink/g)?.length, 1);
  assert.equal(actionRow.match(/href=/g)?.length, 1);
  assert.match(
    actionRow,
    /href=\{`\/kronika\/nowa\?meeting=\$\{meeting\.id\}`\}/,
  );
});
