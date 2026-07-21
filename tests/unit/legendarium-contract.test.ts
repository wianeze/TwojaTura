import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPointAction,
  pointActionLabels,
} from "../../src/features/legendarium/formatting.ts";
import { createLegendariumReadPlan } from "../../src/features/legendarium/read-plan.ts";
import {
  mapAchievementCatalog,
  mapCharacterClasses,
  selectTopAchievementBadges,
  type AchievementDefinitionSource,
} from "../../src/features/legendarium/achievement-view-model.ts";
import {
  getCurrentLegendariumRank,
  hasRecentPointEvents,
  mapLegendariumLeaderboard,
} from "../../src/features/legendarium/view-model.ts";

test("Legendarium formats supported point actions in Polish", () => {
  assert.equal(
    formatPointAction("shelf_first_game"),
    "Dodanie pierwszej gry do Półki",
  );
  assert.equal(formatPointAction("meeting_vote"), "Głos na grę");
  assert.equal(formatPointAction("play_logged"), "Zapis partii w Kronice");
  assert.equal(pointActionLabels.admin_adjustment, "Korekta administratora");
});

test("Legendarium uses a safe fallback for unknown point actions", () => {
  assert.equal(formatPointAction("future_action"), "Zdarzenie punktowe");
});

test("Legendarium read plan uses the leaderboard RPC and only current member point events", () => {
  const plan = createLegendariumReadPlan("member-1");

  assert.equal(plan.leaderboardRpc, "get_leaderboard");
  assert.equal(plan.balance.table, "user_point_balances");
  assert.equal(plan.balance.userId, "member-1");
  assert.equal(plan.recentEvents.table, "point_events");
  assert.equal(plan.recentEvents.userId, "member-1");
  assert.equal(plan.recentEvents.limit, 8);
  assert.equal(plan.achievements.definitionsTable, "achievement_definitions");
  assert.equal(plan.achievements.awardsTable, "user_achievements");
  assert.equal(plan.achievements.userId, "member-1");
  assert.equal(plan.classes.definitionsTable, "class_definitions");
  assert.equal(plan.classes.requirementsTable, "class_requirements");
});

test("Legendarium highlights the current member and derives their ranking place", () => {
  const leaderboard = mapLegendariumLeaderboard(
    [
      {
        userId: "member-2",
        displayName: "Ania",
        avatarUrl: "",
        totalPoints: 120,
        rank: 1,
      },
      {
        userId: "member-1",
        displayName: "Marta",
        avatarUrl: "",
        totalPoints: 90,
        rank: 2,
      },
    ],
    "member-1",
  );

  assert.equal(leaderboard[1]?.isCurrentMember, true);
  assert.equal(leaderboard[0]?.isCurrentMember, false);
  assert.equal(getCurrentLegendariumRank(leaderboard), 2);
});

test("Legendarium supports the empty state for recent point events", () => {
  assert.equal(hasRecentPointEvents([]), false);
  assert.equal(hasRecentPointEvents([{ id: "event-1" }]), true);
});

const achievementDefinitions: AchievementDefinitionSource[] = [
  {
    achievementKey: "common-one",
    name: "Pierwsza",
    description: "Opis pierwszej",
    conditionText: "Warunek pierwszej",
    rarity: "common",
    points: 10,
    iconPath: "/badges/common.png",
    isSecret: false,
    sortOrder: 1,
  },
  {
    achievementKey: "epic-one",
    name: "Epicka",
    description: "Opis epickiej",
    conditionText: "Warunek epickiej",
    rarity: "epic",
    points: 30,
    iconPath: "/badges/epic.png",
    isSecret: false,
    sortOrder: 2,
  },
];

test("achievement catalog maps acquired and locked definitions", () => {
  const catalog = mapAchievementCatalog(
    achievementDefinitions,
    [
      {
        userId: "member-1",
        achievementKey: "common-one",
        awardedAt: "2026-07-20T10:00:00Z",
      },
    ],
    "member-1",
    2,
  );

  assert.equal(catalog[0]?.state, "acquired");
  assert.equal(catalog[0]?.awardedAt, "2026-07-20T10:00:00Z");
  assert.equal(catalog[1]?.state, "locked");
});

test("unearned secret achievement becomes a safe placeholder", () => {
  const catalog = mapAchievementCatalog(
    achievementDefinitions,
    [],
    "member-1",
    3,
  );
  const secret = catalog[2];

  assert.equal(secret?.state, "secret");
  assert.equal(secret?.name, "Sekretna odznaka");
  assert.equal(secret?.conditionText, "Ukryty warunek");
  assert.equal(secret?.iconPath, null);
});

test("class progress counts earned requirements and unlocks at completion", () => {
  const classes = [
    {
      classKey: "warrior",
      name: "Wojownik",
      description: "Opis",
      playstyle: "Waleczny",
      iconPath: "/Classes/warrior.png",
      sortOrder: 1,
    },
  ];
  const requirements = [
    { classKey: "warrior", achievementKey: "common-one" },
    { classKey: "warrior", achievementKey: "epic-one" },
  ];
  const oneAward = [
    {
      userId: "member-1",
      achievementKey: "common-one",
      awardedAt: "2026-07-20T10:00:00Z",
    },
  ];

  const inProgress = mapCharacterClasses(
    classes,
    requirements,
    achievementDefinitions,
    oneAward,
    "member-1",
    2,
  )[0];
  const unlocked = mapCharacterClasses(
    classes,
    requirements,
    achievementDefinitions,
    [
      ...oneAward,
      {
        userId: "member-1",
        achievementKey: "epic-one",
        awardedAt: "2026-07-20T11:00:00Z",
      },
    ],
    "member-1",
    2,
  )[0];

  assert.equal(inProgress?.acquiredRequirements, 1);
  assert.equal(inProgress?.unlocked, false);
  assert.equal(unlocked?.acquiredRequirements, 2);
  assert.equal(unlocked?.unlocked, true);
});

test("leaderboard selects at most three real badges by rarity and date", () => {
  const definitions: AchievementDefinitionSource[] = [
    ...achievementDefinitions,
    {
      ...achievementDefinitions[0]!,
      achievementKey: "legendary-one",
      name: "Legendarna",
      rarity: "legendary",
      sortOrder: 3,
    },
    {
      ...achievementDefinitions[0]!,
      achievementKey: "rare-one",
      name: "Rzadka",
      rarity: "rare",
      sortOrder: 4,
    },
  ];
  const badges = selectTopAchievementBadges(
    definitions,
    definitions.map((definition, index) => ({
      userId: "member-1",
      achievementKey: definition.achievementKey,
      awardedAt: `2026-07-${String(10 + index).padStart(2, "0")}T10:00:00Z`,
    })),
    "member-1",
  );

  assert.equal(badges.length, 3);
  assert.deepEqual(
    badges.map((badge) => badge.rarity),
    ["legendary", "epic", "rare"],
  );
});

test("leaderboard badge selection has an empty fallback", () => {
  assert.deepEqual(
    selectTopAchievementBadges(achievementDefinitions, [], "member-1"),
    [],
  );
});
