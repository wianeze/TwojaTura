import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPointAction,
  pointActionLabels,
} from "../../src/features/legendarium/formatting.ts";
import {
  awardSimpleAchievementsAfterGameCreate,
  awardSimpleAchievementsAfterMeetingCreate,
  awardSimpleAchievementsAfterMutation,
  awardSimpleAchievementsAfterPlayCreate,
  awardSimpleAchievementsAfterRatingSave,
  awardSimpleAchievementsAfterRsvpSave,
} from "../../src/features/legendarium/achievement-awards.ts";
import { createLegendariumReadPlan } from "../../src/features/legendarium/read-plan.ts";
import {
  mapAchievementCatalog,
  mapActiveClassesByUser,
  mapCharacterClasses,
  selectTopAchievementBadges,
  type AchievementDefinitionSource,
} from "../../src/features/legendarium/achievement-view-model.ts";
import {
  normalizeActiveClassKey,
  persistActiveClassSelection,
} from "../../src/features/legendarium/active-class-selection.ts";
import {
  buildAchievementProgressMap,
  isRealLastPlace,
} from "../../src/features/legendarium/achievement-progress.ts";
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
        activeClass: {
          key: "bard_stolu",
          name: "Bard Stołu",
          description: "Opis",
          playstyle: "Styl",
          iconPath: "/Classes/Bard.png",
        },
      },
    ],
    "member-1",
  );

  assert.equal(leaderboard[1]?.isCurrentMember, true);
  assert.equal(leaderboard[0]?.isCurrentMember, false);
  assert.equal(leaderboard[1]?.activeClass?.name, "Bard Stołu");
  assert.equal(getCurrentLegendariumRank(leaderboard), 2);
});

test("Legendarium supports the empty state for recent point events", () => {
  assert.equal(hasRecentPointEvents([]), false);
  assert.equal(hasRecentPointEvents([{ id: "event-1" }]), true);
});

test("successful mutation can award simple achievements through the shared RPC contract", async () => {
  let calls = 0;
  const result = await awardSimpleAchievementsAfterMutation(async () => {
    calls += 1;
    return {
      data: [
        {
          awarded_count: 2,
          points_awarded: 15,
          awarded_keys: ["critical_roll", "short_rest"],
        },
      ],
      error: null,
    };
  });

  assert.equal(calls, 1);
  assert.deepEqual(result, {
    ok: true,
    awardedCount: 2,
    pointsAwarded: 15,
    awardedKeys: ["critical_roll", "short_rest"],
  });
});

test("no new or duplicate achievement remains a successful post-mutation result", async () => {
  const result = await awardSimpleAchievementsAfterMutation(async () => ({
    data: [{ awarded_count: 0, points_awarded: 0, awarded_keys: [] }],
    error: null,
  }));

  assert.deepEqual(result, {
    ok: true,
    awardedCount: 0,
    pointsAwarded: 0,
    awardedKeys: [],
  });
});

test("real simple-achievement RPC errors remain visible to the server action", async () => {
  const error = { code: "42501", message: "Active membership is required" };
  const result = await awardSimpleAchievementsAfterMutation(async () => ({
    data: null,
    error,
  }));

  assert.deepEqual(result, { ok: false, error });
});

test("all five qualifying server-action flows use the simple achievement award contract", async () => {
  const integrations = [
    awardSimpleAchievementsAfterGameCreate,
    awardSimpleAchievementsAfterMeetingCreate,
    awardSimpleAchievementsAfterRsvpSave,
    awardSimpleAchievementsAfterRatingSave,
    awardSimpleAchievementsAfterPlayCreate,
  ];
  let calls = 0;

  for (const integration of integrations) {
    const result = await integration(async () => {
      calls += 1;
      return {
        data: [{ awarded_count: 0, points_awarded: 0, awarded_keys: [] }],
        error: null,
      };
    });
    assert.equal(result.ok, true);
  }

  assert.equal(calls, 5);
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

test("achievement progress maps the supported read-only counters", () => {
  const progress = buildAchievementProgressMap({
    meetingsCreated: 3,
    completedMeetingsHosted: 5,
    ratingComments: 2,
    playsCreated: 24,
    meetingResponses: 10,
    activeOwnedGames: 27,
    perfectRatings: 5,
    replayRatings: 7,
    hasFirstWin: true,
    lastPlaceFinishes: 2,
    hasFullParty: true,
    hasSoloPlay: false,
    hasSideQuest: true,
    currentWinStreak: 2,
  });

  assert.deepEqual(progress.initiative_master, {
    current: 3,
    target: 5,
    label: "3/5",
    isComplete: false,
  });
  assert.deepEqual(progress.camp_host, {
    current: 5,
    target: 5,
    label: "5/5",
    isComplete: true,
  });
  assert.deepEqual(progress.dark_urge, {
    current: 2,
    target: 3,
    label: "2/3",
    isComplete: false,
  });
  assert.deepEqual(progress.natural_one, {
    current: 2,
    target: 3,
    label: "2/3",
    isComplete: false,
  });
});

test("natural_one progress requires three last-place finishes", () => {
  const metrics = {
    meetingsCreated: 0,
    completedMeetingsHosted: 0,
    ratingComments: 0,
    playsCreated: 0,
    meetingResponses: 0,
    activeOwnedGames: 0,
    perfectRatings: 0,
    replayRatings: 0,
    hasFirstWin: false,
    hasFullParty: false,
    hasSoloPlay: false,
    hasSideQuest: false,
    currentWinStreak: 0,
  };

  assert.equal(
    buildAchievementProgressMap({ ...metrics, lastPlaceFinishes: 1 })
      .natural_one?.label,
    "1/3",
  );
  assert.equal(
    buildAchievementProgressMap({ ...metrics, lastPlaceFinishes: 2 })
      .natural_one?.isComplete,
    false,
  );
  assert.deepEqual(
    buildAchievementProgressMap({ ...metrics, lastPlaceFinishes: 3 })
      .natural_one,
    { current: 3, target: 3, label: "3/3", isComplete: true },
  );
});

test("natural_one progress ignores cooperative ties without a real ranking", () => {
  assert.equal(isRealLastPlace([1, 1, 1], 1), false);
  assert.equal(isRealLastPlace([1, 2, 3], 3), true);
  assert.equal(isRealLastPlace([1, 2, 2], 2), true);
  assert.equal(isRealLastPlace([1, 2, null], 2), false);
});

test("achievement catalog keeps secrets hidden and manual achievements without synthetic progress", () => {
  const definitions: AchievementDefinitionSource[] = [
    {
      achievementKey: "manual-one",
      name: "Ręczna",
      description: "Opis",
      conditionText: "Warunek",
      rarity: "common",
      points: 5,
      iconPath: null,
      isSecret: false,
      isManual: true,
      sortOrder: 1,
    },
    {
      achievementKey: "secret-one",
      name: "Sekret",
      description: "Opis",
      conditionText: "Warunek",
      rarity: "secret",
      points: 5,
      iconPath: null,
      isSecret: true,
      isManual: false,
      sortOrder: 2,
    },
  ];
  const catalog = mapAchievementCatalog(definitions, [], "member-1", 2, {
    "manual-one": { current: 0, target: 1, label: "0/1", isComplete: false },
    "secret-one": { current: 1, target: 1, label: "1/1", isComplete: true },
  });

  assert.equal(catalog[0]?.progress, null);
  assert.equal(catalog[0]?.isManual, true);
  assert.equal(catalog[1]?.name, "Sekretna odznaka");
  assert.equal(catalog[1]?.progress, null);
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
    "warrior",
  )[0];

  assert.equal(inProgress?.acquiredRequirements, 1);
  assert.equal(inProgress?.unlocked, false);
  assert.equal(inProgress?.isActive, false);
  assert.equal(unlocked?.acquiredRequirements, 2);
  assert.equal(unlocked?.unlocked, true);
  assert.equal(unlocked?.isActive, true);
});

test("active class mapping joins profile selections in one bulk map", () => {
  const activeClasses = mapActiveClassesByUser(
    [
      {
        classKey: "warrior",
        name: "Wojownik",
        description: "Opis",
        playstyle: "Waleczny",
        iconPath: "/Classes/warrior.png",
        sortOrder: 1,
      },
    ],
    [
      { userId: "member-1", activeClassKey: "warrior" },
      { userId: "member-2", activeClassKey: null },
    ],
  );

  assert.equal(activeClasses["member-1"]?.name, "Wojownik");
  assert.equal(activeClasses["member-2"], undefined);
});

test("active class selection normalizes clear requests and calls the narrow RPC adapter", async () => {
  const calls: Array<string | null> = [];

  assert.equal(normalizeActiveClassKey(" warrior "), "warrior");
  assert.equal(normalizeActiveClassKey(""), null);

  await persistActiveClassSelection(async (classKey) => {
    calls.push(classKey);
    return { error: null };
  }, "warrior");

  assert.deepEqual(calls, ["warrior"]);
});

test("active class selection exposes real RPC failures", async () => {
  await assert.rejects(
    persistActiveClassSelection(
      async () => ({ error: { message: "locked" } }),
      "locked-class",
    ),
    /Nie udało się ustawić aktywnej klasy/,
  );
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
