import assert from "node:assert/strict";
import test from "node:test";
import {
  assertQaEnvironment,
  QA_SCENARIOS,
} from "../../scripts/qa-achievements-contract.mts";

test("QA achievements rejects production and remote Supabase", () => {
  assert.throws(
    () => assertQaEnvironment({ NODE_ENV: "production" }),
    /zablokowane w środowisku produkcyjnym/,
  );
  assert.throws(
    () =>
      assertQaEnvironment(
        { NODE_ENV: "development" },
        "https://project.supabase.co",
      ),
    /wyłącznie z lokalnym Supabase/,
  );
  assert.doesNotThrow(() =>
    assertQaEnvironment({ NODE_ENV: "development" }, "http://127.0.0.1:54321"),
  );
});

test("QA achievements defines boundary and class fixture scenarios", () => {
  const expected = QA_SCENARIOS.flatMap((scenario) => scenario.expected).join(
    " ",
  );
  assert.match(expected, /natural_one 1\/3/);
  assert.match(expected, /natural_one 2\/3/);
  assert.match(expected, /natural_one 3\/3/);
  assert.match(expected, /natural_one 0\/3/);
  assert.match(expected, /dark_urge 2\/3/);
  assert.match(expected, /dark_urge 3\/3/);
  assert.match(expected, /loot_goblin 24\/25/);
  assert.match(expected, /camp_host 4\/5/);
  assert.match(expected, /camp_host 5\/5/);
  assert.match(expected, /Bard Stołu 4\/5/);
  assert.match(expected, /Bard Stołu 5\/5/);
});
