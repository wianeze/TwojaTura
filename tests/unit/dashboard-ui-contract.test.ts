import assert from "node:assert/strict";
import test from "node:test";
import {
  getQuestIconAsset,
  getQuestVisualCategory,
  getQuestVisualRarity,
  getQuestVisualVariant,
} from "../../src/features/dashboard/quest-variants.ts";
import type { DashboardQuest } from "../../src/features/dashboard/types.ts";

function buildQuest(overrides: Partial<DashboardQuest> = {}): DashboardQuest {
  return {
    id: "task-1",
    type: "action",
    title: "Zadanie",
    href: "/",
    ctaLabel: "Idź",
    priority: 1,
    renownPoints: 2,
    ...overrides,
  };
}

test("RSVP quest uses exclamation icon asset", () => {
  const asset = getQuestIconAsset(
    buildQuest({
      id: "missing-rsvp:meeting-1",
      type: "question",
      href: "/kalendarium/meeting-1",
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
    }),
  );

  assert.equal(asset, "/brand/Exclamation-magic.png");
});

test("chronicle quest uses exclamation icon asset", () => {
  const asset = getQuestIconAsset(
    buildQuest({
      id: "missing-play:meeting-1",
      href: "/kronika/nowa?meeting=meeting-1",
    }),
  );

  assert.equal(asset, "/brand/Exclamation-epic.png");
});

test("rating quest uses exclamation icon asset", () => {
  const asset = getQuestIconAsset(
    buildQuest({
      id: "rate-game:play-1:game-1",
      href: "/gry/game-1",
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
    }),
  );

  assert.equal(variant.rarity, "legendary");
  assert.equal(variant.exclamationAsset, "/brand/Exclamation-legendary.png");
});

test("shelf onboarding quests keep common styling and the common exclamation", () => {
  for (const id of [
    "add-first-game",
    "add-five-games",
    "add-ten-games",
    "add-fifteen-games",
  ]) {
    const quest = buildQuest({
      id,
      href: "/gry/nowa",
    });
    const variant = getQuestVisualVariant(quest);

    assert.equal(getQuestVisualCategory(quest), "shelf");
    assert.equal(variant.rarity, "common");
    assert.equal(variant.isMeetingQuest, false);
    assert.equal(variant.exclamationAsset, "/brand/Exclamation-common.png");
  }
});

test("meeting question quest keeps meeting emphasis", () => {
  const variant = getQuestVisualVariant(
    buildQuest({
      id: "missing-vote:meeting-1",
      type: "question",
      href: "/kalendarium/meeting-1",
    }),
  );

  assert.equal(variant.isMeetingQuest, true);
});

test("chronicle create link is not treated as meeting quest", () => {
  const variant = getQuestVisualVariant(
    buildQuest({
      id: "rate-game:play-1:game-1",
      href: "/kronika/nowa",
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
      }),
    ),
    "epic",
  );
});
