import assert from "node:assert/strict";
import test from "node:test";
import {
  mapPathnameToRouteKey,
  parseUsageEventPayload,
} from "../../src/lib/analytics/catalog.ts";
import { classifyUserAgent } from "../../src/lib/analytics/user-agent.ts";
import {
  calculateCompletionRate,
  formatDaysSince,
} from "../../src/features/admin/analytics-formatting.ts";

test("main application paths map to a closed route catalog", () => {
  assert.equal(mapPathnameToRouteKey("/"), "table");
  assert.equal(mapPathnameToRouteKey("/gry/abc?owner=1"), "shelf");
  assert.equal(mapPathnameToRouteKey("/legendarium"), "legendarium");
  assert.equal(mapPathnameToRouteKey("/kalendarium/123"), "calendar");
  assert.equal(mapPathnameToRouteKey("/kronika/123/edytuj"), "chronicle");
  assert.equal(mapPathnameToRouteKey("/profil"), "profile");
  assert.equal(mapPathnameToRouteKey("/admin"), "admin");
  assert.equal(mapPathnameToRouteKey("/admin/statystyki"), "admin.statistics");
  assert.equal(mapPathnameToRouteKey("/logowanie"), null);
});

test("known telemetry payload is accepted without user identity", () => {
  const parsed = parseUsageEventPayload({
    eventId: "27000000-0000-4000-8000-000000000001",
    eventName: "meeting.vote.submitted",
    routeKey: "calendar",
    componentKey: "meeting.vote",
    action: "submitted",
    entityType: "meeting",
    entityId: "27000000-0000-4000-8000-000000000002",
    metadata: {
      meeting_id: "27000000-0000-4000-8000-000000000002",
    },
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal("userId" in parsed.data, false);
});

test("unknown event, catalog value and metadata are rejected", () => {
  assert.deepEqual(parseUsageEventPayload({ eventName: "ad.clicked" }), {
    ok: false,
    error: "unknown_event",
  });
  assert.deepEqual(
    parseUsageEventPayload({
      eventName: "route.viewed",
      routeKey: "private-note",
    }),
    { ok: false, error: "unknown_catalog_value" },
  );
  assert.deepEqual(
    parseUsageEventPayload({
      eventName: "route.viewed",
      metadata: { comment: "sekretna treść" },
    }),
    { ok: false, error: "unsupported_metadata" },
  );
});

test("oversized telemetry body is rejected", () => {
  const result = parseUsageEventPayload({
    eventName: "route.viewed",
    padding: "x".repeat(5000),
  });
  assert.deepEqual(result, { ok: false, error: "payload_too_large" });
});

test("user agent is reduced to device and browser families", () => {
  assert.deepEqual(
    classifyUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
    ),
    { deviceClass: "mobile", browserFamily: "Safari" },
  );
  assert.deepEqual(
    classifyUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 Edg/126.0",
    ),
    { deviceClass: "desktop", browserFamily: "Edge" },
  );
});

test("admin statistics formatting is stable for empty and bounded values", () => {
  assert.equal(calculateCompletionRate(3, 4), 75);
  assert.equal(calculateCompletionRate(1, 0), 0);
  assert.equal(calculateCompletionRate(8, 4), 100);
  assert.equal(
    formatDaysSince("2026-08-20T12:00:00.000Z", new Date("2026-08-23T12:00:00.000Z")),
    "3 dni",
  );
  assert.equal(formatDaysSince(null), "Brak aktywności");
});
