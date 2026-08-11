import assert from "node:assert/strict";
import test from "node:test";
import {
  formatAdminPointAdjustmentTitle,
  validateAdminPointAward,
  validateAdminPointReversal,
} from "../../src/features/admin/point-adjustments.ts";
import { buildDashboardQuests } from "../../src/features/dashboard/quests.ts";
import { formatPointAction } from "../../src/features/legendarium/formatting.ts";
import {
  getPointAction,
  pointActionCatalog,
} from "../../src/features/points/action-catalog.ts";

const TARGET_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

test("admin correction catalog exposes only known actions with fixed rewards", () => {
  assert.equal(pointActionCatalog.length, 9);
  assert.equal(getPointAction("meeting_rsvp").points, 2);
  assert.equal(getPointAction("meeting_vote").points, 1);
  assert.equal(getPointAction("rating_created").points, 3);
  assert.equal(getPointAction("meeting_hosted").points, 5);
  assert.equal(getPointAction("play_participated").points, 5);
});

test("admin cannot award any reward retired by Economy V2", () => {
  // `play_logged` = 40 (creator-only) i `meeting_created` = 25 (za wypełnienie
  // formularza) zniknęły z cennika. Katalog jest allow-listą panelu korekt,
  // więc brak wpisu to jedyna potrzebna blokada.
  for (const retired of ["play_logged", "meeting_created"]) {
    assert.equal(
      pointActionCatalog.some((action) => (action.value as string) === retired),
      false,
    );

    const result = validateAdminPointAward({
      targetUserId: TARGET_ID,
      actionType: retired,
      reason: "stara nagroda",
      requestId: REQUEST_ID,
    });

    assert.equal(result.ok, false);
  }
});

test("admin award validation accepts a known action and trims the reason", () => {
  const result = validateAdminPointAward({
    targetUserId: TARGET_ID,
    actionType: "meeting_hosted",
    reason: "  brak automatycznej nagrody  ",
    requestId: REQUEST_ID,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.reason, "brak automatycznej nagrody");
    assert.equal(result.value.actionType, "meeting_hosted");
  }
});

test("admin correction validation rejects unknown actions and malformed reversal events", () => {
  assert.equal(
    validateAdminPointAward({
      targetUserId: TARGET_ID,
      actionType: "arbitrary_points",
      requestId: REQUEST_ID,
    }).ok,
    false,
  );
  assert.equal(
    validateAdminPointReversal({
      pointEventId: "not-an-event",
      requestId: REQUEST_ID,
    }).ok,
    false,
  );
  assert.equal(
    validateAdminPointReversal({
      pointEventId: EVENT_ID,
      requestId: REQUEST_ID,
    }).ok,
    true,
  );
});

test("admin correction history and Legendarium use readable labels", () => {
  assert.equal(
    formatAdminPointAdjustmentTitle({
      targetDisplayName: "Marta",
      actionType: "meeting_vote",
    }),
    "Marta · Głos na grę",
  );
  assert.equal(
    formatPointAction("admin_award:meeting_vote"),
    "Korekta Mistrza Gry — Głos na grę",
  );
  assert.equal(
    formatPointAction("admin_reversal:meeting_vote"),
    "Wycofanie korekty — Głos na grę",
  );
});

test("dashboard quests remain derived from domain state, not point corrections", () => {
  const quests = buildDashboardQuests({
    futureMeetings: [],
    unratedGames: [],
    finishedMeetingsWithoutPlay: [],
    ownGamesCount: 0,
    totalActiveGames: 5,
    now: new Date("2026-08-08T12:00:00.000Z"),
  });

  // Milestone Półki przestał być zadaniem na Stole (mieszka w pustym stanie
  // /gry), ale sekcja nadal wynika wyłącznie ze stanu domeny: bez spotkania w
  // kalendarzu zostaje zachęta do jego zwołania, a nie ślad po korekcie punktów.
  assert.deepEqual(
    quests.map((quest) => quest.id),
    ["schedule-meeting"],
  );
});
