import assert from "node:assert/strict";
import test from "node:test";
import {
  assertQaEnvironment,
  qaBadgeEmail,
} from "../../scripts/qa-badges-contract.mts";

test("QA badges uses deterministic local emails", () => {
  assert.equal(
    qaBadgeEmail("secret-unlocked"),
    "qa-badge-secret-unlocked@twojatura.local",
  );
});

test("QA badges retains the production guard", () => {
  assert.throws(
    () => assertQaEnvironment({ NODE_ENV: "production" }),
    /zablokowane w środowisku produkcyjnym/,
  );
});
