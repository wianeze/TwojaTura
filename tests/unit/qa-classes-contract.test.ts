import assert from "node:assert/strict";
import test from "node:test";
import {
  assertQaEnvironment,
  qaClassEmail,
} from "../../scripts/qa-classes-contract.mts";

test("QA classes uses a deterministic local email for a class key", () => {
  assert.equal(
    qaClassEmail("bard_stolu"),
    "qa-class-bard_stolu@twojatura.local",
  );
});

test("QA classes keeps the local-only guard", () => {
  assert.throws(
    () => assertQaEnvironment({ NODE_ENV: "production" }),
    /zablokowane w środowisku produkcyjnym/,
  );
});
