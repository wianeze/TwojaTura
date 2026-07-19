import assert from "node:assert/strict";
import test from "node:test";
import {
  getQuestIconAsset,
  getQuestVisualCategory,
  getQuestVisualRarity,
  getQuestRarityFromPoints,
  getQuestVisualVariant,
} from "../../src/features/dashboard/quest-variants.ts";
import type { DashboardQuest } from "../../src/features/dashboard/types.ts";

function buildQuest(overrides: Partial<DashboardQuest> = {}): DashboardQuest {
  return {
    id: "quest-1",
    type: "action",
    title: "Quest",
    href: "/",
    ctaLabel: "Idź",
    optionalPoints: 10,
    priority: 1,
    reward: {
      immediatePoints: 10,
      immediateLabel: "teraz",
    },
    ...overrides,
  };
}

test("40 points maps to legendary rarity", () => {
  assert.equal(getQuestRarityFromPoints(40), "legendary");
});

test("30 points maps to epic rarity", () => {
  assert.equal(getQuestRarityFromPoints(30), "epic");
});

test("25 points maps to magic rarity", () => {
  assert.equal(getQuestRarityFromPoints(25), "magic");
});

test("20 points maps to uncommon rarity", () => {
  assert.equal(getQuestRarityFromPoints(20), "uncommon");
});

test("10 points maps to common rarity", () => {
  assert.equal(getQuestRarityFromPoints(10), "common");
});

test("RSVP quest uses exclamation icon asset", () => {
  const asset = getQuestIconAsset(
    buildQuest({
      id: "missing-rsvp:meeting-1",
      type: "question",
      href: "/kalendarium/meeting-1",
      reward: {
        immediatePoints: 10,
        immediateLabel: "teraz",
        followUpPoints: 30,
        followUpLabel: "po udziale",
      },
    }),
  );

  assert.equal(asset, "/brand/Exclamation-legendary.png");
});

test("vote quest uses exclamation icon asset", () => {
  const asset = getQuestIconAsset(
    buildQuest({
      id: "missing-vote:meeting-1",
      type: "question",
      href: "/kalendarium/meeting-1",
      reward: {
        immediatePoints: 10,
        immediateLabel: "teraz",
        followUpPoints: 10,
        followUpLabel: "jeśli trafi na stół",
      },
    }),
  );

  assert.equal(asset, "/brand/Exclamation-magic.png");
});

test("chronicle quest uses exclamation icon asset", () => {
  const asset = getQuestIconAsset(
    buildQuest({
      id: "missing-play:meeting-1",
      href: "/kronika/nowa?meeting=meeting-1",
      reward: {
        immediatePoints: 40,
        immediateLabel: "za Kronikę",
      },
    }),
  );

  assert.equal(asset, "/brand/Exclamation-epic.png");
});

test("rating quest uses exclamation icon asset", () => {
  const asset = getQuestIconAsset(
    buildQuest({
      id: "rate-game:play-1:game-1",
      href: "/gry/game-1",
      reward: {
        immediatePoints: 30,
        immediateLabel: "za opinię",
      },
    }),
  );

  assert.equal(asset, "/brand/Exclamation-uncommon.png");
});

test("point thresholds helper still maps raw numbers to rarity bands", () => {
  const variant = getQuestVisualVariant(
    buildQuest({
      id: "missing-rsvp:meeting-1",
      type: "question",
      href: "/kalendarium/meeting-1",
      reward: {
        immediatePoints: 10,
        immediateLabel: "teraz",
        followUpPoints: 30,
        followUpLabel: "po udziale",
        totalPreviewPoints: 40,
      },
    }),
  );

  assert.equal(variant.rarity, "legendary");
  assert.equal(variant.exclamationAsset, "/brand/Exclamation-legendary.png");
});

test("game adding quest keeps common visual rarity despite 40 points", () => {
  const variant = getQuestVisualVariant(
    buildQuest({
      id: "add-game",
      href: "/gry/nowa",
      reward: {
        immediatePoints: 40,
        immediateLabel: "pierwsza gra",
      },
    }),
  );

  assert.equal(variant.rarity, "common");
  assert.equal(variant.isMeetingQuest, false);
});

test("meeting question quest keeps meeting emphasis", () => {
  const variant = getQuestVisualVariant(
    buildQuest({
      id: "missing-vote:meeting-1",
      type: "question",
      href: "/kalendarium/meeting-1",
      reward: {
        immediatePoints: 10,
        immediateLabel: "teraz",
        followUpPoints: 10,
        followUpLabel: "jeśli trafi na stół",
      },
    }),
  );

  assert.equal(variant.isMeetingQuest, true);
});

test("chronicle create link is not treated as meeting quest", () => {
  const variant = getQuestVisualVariant(
    buildQuest({
      id: "rate-game:play-1:game-1",
      href: "/kronika/nowa",
      reward: {
        immediatePoints: 30,
        immediateLabel: "za opinię",
      },
    }),
  );

  assert.equal(variant.isMeetingQuest, false);
});

test("visual category and rarity come from quest category instead of points", () => {
  assert.equal(
    getQuestVisualCategory(
      buildQuest({
        id: "missing-play:meeting-1",
        href: "/kronika/nowa?meeting=meeting-1",
      }),
    ),
    "chronicle",
  );

  assert.equal(
    getQuestVisualRarity(
      buildQuest({
        id: "missing-play:meeting-1",
        href: "/kronika/nowa?meeting=meeting-1",
        reward: {
          immediatePoints: 40,
          immediateLabel: "za Kronikę",
        },
      }),
    ),
    "epic",
  );
});
