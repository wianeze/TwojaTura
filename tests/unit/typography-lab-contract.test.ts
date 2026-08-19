import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL(
    "../../src/app/(app)/lab/typografia/page.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("Typography Lab is available to active members in development only", () => {
  assert.match(page, /process\.env\.NODE_ENV === "production"/);
  assert.match(page, /redirect\("\/"\)/);
  assert.doesNotMatch(page, /member\.role !== "admin"/);
  assert.doesNotMatch(page, /getCurrentMember/);
});

