import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPointAction,
  pointActionLabels,
} from "../../src/features/legendarium/formatting.ts";
import { createLegendariumReadPlan } from "../../src/features/legendarium/read-plan.ts";
import {
  getCurrentLegendariumRank,
  hasRecentPointEvents,
  mapLegendariumLeaderboard,
} from "../../src/features/legendarium/view-model.ts";

test("Legendarium formats supported point actions in Polish", () => {
  assert.equal(
    formatPointAction("shelf_first_game"),
    "Dodanie pierwszej gry do Półki",
  );
  assert.equal(formatPointAction("meeting_vote"), "Głos na grę");
  assert.equal(formatPointAction("play_logged"), "Zapis partii w Kronice");
  assert.equal(pointActionLabels.admin_adjustment, "Korekta administratora");
});

test("Legendarium uses a safe fallback for unknown point actions", () => {
  assert.equal(formatPointAction("future_action"), "Zdarzenie punktowe");
});

test("Legendarium read plan uses the leaderboard RPC and only current member point events", () => {
  const plan = createLegendariumReadPlan("member-1");

  assert.equal(plan.leaderboardRpc, "get_leaderboard");
  assert.equal(plan.balance.table, "user_point_balances");
  assert.equal(plan.balance.userId, "member-1");
  assert.equal(plan.recentEvents.table, "point_events");
  assert.equal(plan.recentEvents.userId, "member-1");
  assert.equal(plan.recentEvents.limit, 8);
});

test("Legendarium highlights the current member and derives their ranking place", () => {
  const leaderboard = mapLegendariumLeaderboard(
    [
      {
        userId: "member-2",
        displayName: "Ania",
        avatarUrl: "",
        totalPoints: 120,
        rank: 1,
      },
      {
        userId: "member-1",
        displayName: "Marta",
        avatarUrl: "",
        totalPoints: 90,
        rank: 2,
      },
    ],
    "member-1",
  );

  assert.equal(leaderboard[1]?.isCurrentMember, true);
  assert.equal(leaderboard[0]?.isCurrentMember, false);
  assert.equal(getCurrentLegendariumRank(leaderboard), 2);
});

test("Legendarium supports the empty state for recent point events", () => {
  assert.equal(hasRecentPointEvents([]), false);
  assert.equal(hasRecentPointEvents([{ id: "event-1" }]), true);
});
