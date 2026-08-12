import assert from "node:assert/strict";
import test from "node:test";
import { canUseNextImageOptimization } from "../../src/lib/image-sources.ts";

test("local assets and configured BGG covers use Next image optimization", () => {
  assert.equal(canUseNextImageOptimization("/games/frostpunk.webp"), true);
  assert.equal(
    canUseNextImageOptimization(
      "https://cf.geekdo-images.com/example/original/img.jpg",
    ),
    true,
  );
});

test("arbitrary and malformed cover URLs keep the safe image fallback", () => {
  assert.equal(
    canUseNextImageOptimization("https://example.com/cover.jpg"),
    false,
  );
  assert.equal(canUseNextImageOptimization("not-a-url"), false);
  assert.equal(canUseNextImageOptimization("//example.com/cover.jpg"), false);
});
