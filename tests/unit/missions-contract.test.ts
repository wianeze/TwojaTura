import assert from "node:assert/strict";
import test from "node:test";
import {
  getQuestVisualCategory,
  getQuestVisualRarity,
} from "../../src/features/dashboard/quest-variants.ts";
import {
  formatMissionExpiryLabel,
  isMissionActive,
} from "../../src/features/missions/formatting.ts";
import {
  MISSIONS_EMPTY_STATE,
  MISSION_COPY,
  MISSION_PRIORITY,
  getMissionQuestId,
  sortDashboardMissions,
  toMissionQuestCard,
} from "../../src/features/missions/mission-catalog.ts";
import type {
  DashboardMission,
  MissionType,
} from "../../src/features/missions/types.ts";

const NOW = new Date("2026-08-24T12:00:00.000Z");

function buildMission(
  overrides: Partial<DashboardMission> = {},
): DashboardMission {
  return {
    id: "mission-1",
    missionType: "revenge",
    gameId: "game-1",
    gameTitle: "Frostpunk",
    generatedAt: "2026-08-20T12:00:00.000Z",
    expiresAt: "2026-09-19T12:00:00.000Z",
    rewardTukats: 15,
    ...overrides,
  };
}

const MISSION_TYPES: MissionType[] = [
  "revenge",
  "resurrection",
  "first_chapter",
  "continue_story",
];

test("każdy typ Misji ma nazwę i opis wyzwania", () => {
  for (const missionType of MISSION_TYPES) {
    const copy = MISSION_COPY[missionType];

    assert.ok(copy.name.length > 0, `${missionType} bez nazwy`);
    assert.ok(copy.challenge.length > 0, `${missionType} bez opisu`);
  }
});

test("opis wyzwania nie zdradza technicznych wyzwalaczy ani cooldownów", () => {
  for (const missionType of MISSION_TYPES) {
    const text =
      `${MISSION_COPY[missionType].name} ${MISSION_COPY[missionType].challenge}`.toLowerCase();

    for (const forbidden of ["cooldown", "trigger", "ttl", "180", "60 dni"]) {
      assert.ok(
        !text.includes(forbidden),
        `${missionType} pokazuje techniczny szczegół: ${forbidden}`,
      );
    }
  }
});

test("priorytety Misji odwzorowują kolejność z private.mission_policy", () => {
  assert.deepEqual(MISSION_PRIORITY, {
    revenge: 1,
    resurrection: 2,
    first_chapter: 3,
    continue_story: 4,
  });
});

test("karta Misji niesie nazwę Misji, tytuł gry i wyzwanie", () => {
  const card = toMissionQuestCard(
    buildMission({ missionType: "resurrection", gameTitle: "Nemesis" }),
  );

  assert.equal(card.title, "Wskrzeszenie: Nemesis");
  assert.equal(card.description, MISSION_COPY.resurrection.challenge);
  assert.equal(card.href, "/gry/game-1");
  assert.equal(card.expiresAt, "2026-09-19T12:00:00.000Z");
});

test("karta Misji nigdy nie obiecuje Renomy", () => {
  for (const missionType of MISSION_TYPES) {
    const card = toMissionQuestCard(buildMission({ missionType }));

    assert.equal(
      card.renownPoints,
      undefined,
      `${missionType} obiecuje Renomę zamiast Tukatów`,
    );
  }
});

test("identyfikator karty pozwala telemetrii rozpoznać Misję i grę", () => {
  const questId = getMissionQuestId(
    buildMission({ missionType: "first_chapter", gameId: "game-42" }),
  );

  assert.equal(questId, "mission-first_chapter:game-42");

  const [questType, gameId] = questId.split(":");
  assert.equal(questType, "mission-first_chapter");
  assert.equal(gameId, "game-42");
});

test("każdy typ Misji dostaje własny wariant wizualny karty", () => {
  const rarities = MISSION_TYPES.map((missionType) =>
    getQuestVisualRarity(toMissionQuestCard(buildMission({ missionType }))),
  );

  assert.deepEqual(rarities, ["epic", "legendary", "magic", "uncommon"]);
});

test("Misja nie jest klasyfikowana jako Zlecenie z Półki", () => {
  const card = toMissionQuestCard(buildMission());

  assert.equal(getQuestVisualCategory(card), "mission");
});

test("Misje na Stole układają się wg priorytetu, potem wg wieku", () => {
  const sorted = sortDashboardMissions([
    buildMission({ id: "c", missionType: "continue_story" }),
    buildMission({
      id: "b",
      missionType: "first_chapter",
      generatedAt: "2026-08-22T12:00:00.000Z",
    }),
    buildMission({
      id: "a",
      missionType: "first_chapter",
      generatedAt: "2026-08-01T12:00:00.000Z",
    }),
    buildMission({ id: "r", missionType: "revenge" }),
  ]);

  assert.deepEqual(
    sorted.map((mission) => mission.id),
    ["r", "a", "b", "c"],
  );
});

test("termin Misji nie jest opisany jako strata", () => {
  const label = formatMissionExpiryLabel(
    "2026-09-05T12:00:00.000Z",
    NOW,
  ) as string;

  assert.equal(label, "Ważna jeszcze 12 dni");
  assert.ok(!label.toLowerCase().includes("przepada"));
});

test("ostatnia doba Misji ma własną, spokojną etykietę", () => {
  assert.equal(
    formatMissionExpiryLabel("2026-08-25T06:00:00.000Z", NOW),
    "Ostatni dzień",
  );
  assert.equal(
    formatMissionExpiryLabel("2026-08-26T06:00:00.000Z", NOW),
    "Ważna jeszcze 1 dzień",
  );
});

test("Misja po terminie nie ma etykiety i nie jest aktywna", () => {
  assert.equal(formatMissionExpiryLabel("2026-08-24T11:59:00.000Z", NOW), null);
  assert.equal(
    isMissionActive({ expiresAt: "2026-08-24T11:59:00.000Z" }, NOW),
    false,
  );
  assert.equal(
    isMissionActive({ expiresAt: "2026-08-24T12:01:00.000Z" }, NOW),
    true,
  );
});

test("pusty stan Misji nie popycha do sztucznej aktywności", () => {
  assert.ok(MISSIONS_EMPTY_STATE.length > 0);

  for (const pushy of ["zaloguj", "codzienn", "nie przegap", "pospiesz"]) {
    assert.ok(
      !MISSIONS_EMPTY_STATE.toLowerCase().includes(pushy),
      `pusty stan nakłania: ${pushy}`,
    );
  }
});
