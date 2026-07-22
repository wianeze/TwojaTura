import assert from "node:assert/strict";
import test from "node:test";
import {
  getActiveClassBackdropGradient,
  getLeaderboardRankAsset,
  getLeaderboardRankLabel,
} from "../../src/features/legendarium/leaderboard-presentation.ts";

test("Legendarium uses dedicated place art through rank 20", () => {
  assert.equal(getLeaderboardRankAsset(1), "/brand/1st-place-nobg.png");
  assert.equal(getLeaderboardRankAsset(5), "/brand/5th-place-nobg.png");
  assert.equal(getLeaderboardRankAsset(6), "/brand/player6.png");
  assert.equal(getLeaderboardRankAsset(20), "/brand/player20.png");
});

test("Legendarium keeps a neutral fallback after rank 20", () => {
  assert.equal(getLeaderboardRankAsset(21), null);
  assert.equal(getLeaderboardRankLabel(21), "21. miejsce");
});

test("Legendarium assigns class-specific backdrop gradients", () => {
  assert.match(getActiveClassBackdropGradient("bard_stolu"), /139, 92, 246/);
  assert.match(
    getActiveClassBackdropGradient("barbarzynca_kosci"),
    /220, 38, 38/,
  );
  assert.match(
    getActiveClassBackdropGradient("nekromanta_figurek"),
    /20, 184, 166/,
  );
  assert.match(getActiveClassBackdropGradient(null), /238, 193, 118/);
});
