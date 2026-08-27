import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  defaultPlayerPortraitFrameType,
  getPlayerPortraitFrameAssetPath,
  playerPortraitFrameCanvas,
  playerPortraitFrameAssetPaths,
  playerPortraitFrameTypes,
  resolvePlayerPortraitFrameType,
} from "../../src/components/ui/player-portrait-frame-config.ts";
import { buildPortraitFrameStoreData } from "../../src/features/profile/portrait-frame-view-model.ts";

const catalog = [
  {
    id: "common-1",
    frame_key: "common-frame-1",
    name: "Common",
    rarity: "common",
    asset_path: "/Frames/common-frame-1-dopasowanie.png",
    is_shop_available: false,
  },
  {
    id: "rare-1",
    frame_key: "magic-frame-1",
    name: "Rare",
    rarity: "rare",
    asset_path: "/Frames/magic-frame-1-dopasowanie.png",
    is_shop_available: true,
  },
  {
    id: "epic-1",
    frame_key: "epic-frame-1",
    name: "Epic",
    rarity: "epic",
    asset_path: "/Frames/epic-frame-1-dopasowanie.png",
    is_shop_available: true,
  },
];

test("portrait renderer supports every configured real frame asset", () => {
  assert.equal(playerPortraitFrameTypes.length, 13);
  assert.equal(Object.keys(playerPortraitFrameAssetPaths).length, 13);
  for (const assetPath of Object.values(playerPortraitFrameAssetPaths)) {
    assert.equal(
      existsSync(join(process.cwd(), "public", assetPath.replace(/^\//, ""))),
      true,
      `missing portrait frame asset: ${assetPath}`,
    );
  }
});

test("portrait and frame share the 850 x 1450 canvas contract", () => {
  assert.deepEqual(playerPortraitFrameCanvas, { width: 850, height: 1450 });
});

test("unknown or missing active frame falls back to the default common frame", () => {
  assert.equal(
    resolvePlayerPortraitFrameType(null),
    defaultPlayerPortraitFrameType,
  );
  assert.equal(
    resolvePlayerPortraitFrameType("unknown"),
    defaultPlayerPortraitFrameType,
  );
});

test("configured active frame is preserved", () => {
  assert.equal(resolvePlayerPortraitFrameType("epic-frame-3"), "epic-frame-3");
});

test("default frame uses the accepted adjusted asset", () => {
  assert.equal(
    getPlayerPortraitFrameAssetPath("common-frame-1"),
    "/Frames/common-frame-1-dopasowanie.png",
  );
});

test("catalog contains no fake legendary frame without an asset", () => {
  assert.equal(
    playerPortraitFrameTypes.some((key) => key.startsWith("legendary")),
    false,
  );
});

test("all common frames are implicitly owned", () => {
  const store = buildPortraitFrameStoreData(catalog, [], null);
  assert.deepEqual(
    store.ownedFrames.map((frame) => frame.key),
    ["common-frame-1"],
  );
});

test("unpurchased shop frames remain in the shop", () => {
  const store = buildPortraitFrameStoreData(catalog, [], null);
  assert.deepEqual(
    store.shopFrames.map((frame) => frame.key),
    ["magic-frame-1", "epic-frame-1"],
  );
});

test("purchased frame moves from shop to owned inventory", () => {
  const store = buildPortraitFrameStoreData(
    catalog,
    ["rare-1"],
    "magic-frame-1",
  );
  assert.equal(store.activeFrameKey, "magic-frame-1");
  assert.equal(
    store.ownedFrames.some((frame) => frame.key === "magic-frame-1"),
    true,
  );
  assert.equal(
    store.shopFrames.some((frame) => frame.key === "magic-frame-1"),
    false,
  );
});

test("shop is a preview without point prices or a purchase action", () => {
  const source = readFileSync(
    "src/features/profile/player-customization-store.tsx",
    "utf8",
  );
  assert.match(source, /Wkrótce/i);
  assert.doesNotMatch(
    source,
    /pricePoints|Brakuje .*pkt|purchasePortraitFrame/,
  );
});

test("server actions expose activation but no frame purchase", () => {
  const source = readFileSync(
    "src/features/profile/portrait-frame-actions.ts",
    "utf8",
  );
  assert.match(source, /setActivePortraitFrameAction/);
  assert.doesNotMatch(source, /purchasePortraitFrame|purchase_portrait_frame/);
});
