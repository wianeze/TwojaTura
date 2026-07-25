import assert from "node:assert/strict";
import test from "node:test";
import {
  formatAdminDate,
  ROLE_LABELS,
} from "../../src/features/admin/formatting.ts";

test("role labels cover every member role", () => {
  assert.equal(ROLE_LABELS.member, "Członek");
  assert.equal(ROLE_LABELS.admin, "Administrator");
  assert.equal(ROLE_LABELS.observer, "Obserwator");
});

test("formatAdminDate renders a null timestamp as a dash", () => {
  assert.equal(formatAdminDate(null), "—");
});

test("formatAdminDate renders an ISO timestamp in Polish locale", () => {
  assert.equal(formatAdminDate("2026-07-01T12:00:00+00:00"), "1 lip 2026");
});
