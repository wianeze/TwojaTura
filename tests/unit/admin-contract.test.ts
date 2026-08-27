import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  formatAdminDate,
  ROLE_LABELS,
} from "../../src/features/admin/formatting.ts";

const REPO_ROOT = resolve(import.meta.dirname, "../..");

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

test("admin dashboard is a module directory instead of mounting every management panel", () => {
  const dashboard = readFileSync(
    resolve(REPO_ROOT, "src/app/(app)/admin/page.tsx"),
    "utf8",
  );
  const modules = readFileSync(
    resolve(REPO_ROOT, "src/features/admin/admin-module-grid.tsx"),
    "utf8",
  );

  assert.match(dashboard, /Panel administratora/);
  assert.match(dashboard, /AdminModuleGrid/);
  assert.doesNotMatch(dashboard, /AdminAccountsPanel/);
  assert.doesNotMatch(dashboard, /FeedbackReviewPanel/);
  assert.doesNotMatch(dashboard, /AdminPointAdjustmentsPanel/);
  assert.doesNotMatch(dashboard, /AdminTukatAdjustmentsPanel/);

  for (const href of [
    "/admin/statystyki",
    "/admin/push",
    "/admin/konta",
    "/admin/korekty",
    "/admin/zgloszenia",
  ]) {
    assert.match(modules, new RegExp(`href: "${href}"`));
  }
  assert.match(modules, /aspect-square/);
});

test("admin correction page keeps Renown and Tukats in mutually exclusive tabs", () => {
  const tabs = readFileSync(
    resolve(REPO_ROOT, "src/features/admin/admin-adjustments-tabs.tsx"),
    "utf8",
  );

  assert.match(tabs, /Renoma/);
  assert.match(tabs, /Tukaty/);
  assert.match(tabs, /activeTab === "renown"/);
  assert.match(tabs, /activeTab === "tukats"/);
});
