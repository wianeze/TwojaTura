import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPlayerProfileStatistics,
  formatProfileDuration,
  selectTopProfileClasses,
  type ProfilePlaySource,
} from "../../src/features/profile/profile-statistics.ts";
import type { CharacterClassView } from "../../src/features/legendarium/achievement-view-model.ts";

function play(
  id: string,
  options: Partial<ProfilePlaySource> & {
    isWinner?: boolean;
  } = {},
): ProfilePlaySource {
  return {
    id,
    playedAt: `2026-07-${id.padStart(2, "0")}T18:00:00Z`,
    durationMinutes: 120,
    mode: "competitive",
    teamResult: null,
    hasExplicitWinner: true,
    game: { id: "game-1", title: "Nemesis", coverUrl: null },
    ownResult: {
      isWinner: options.isWinner ?? false,
      placement: options.isWinner ? 1 : 2,
      score: null,
    },
    participantIds: ["member-1", "member-2"],
    ...options,
  };
}

test("profile statistics aggregate competitive and cooperative results", () => {
  const stats = buildPlayerProfileStatistics({
    userId: "member-1",
    plays: [
      play("1", { isWinner: true }),
      play("2"),
      play("3", {
        mode: "cooperative",
        teamResult: "win",
        ownResult: { isWinner: true, placement: null, score: null },
      }),
      play("4", {
        mode: "cooperative",
        teamResult: "loss",
        ownResult: { isWinner: false, placement: null, score: null },
      }),
    ],
    ratings: [{ gameId: "game-1", overall: 8 }],
  });

  assert.equal(stats.playsCount, 4);
  assert.equal(stats.wins, 2);
  assert.equal(stats.losses, 2);
  assert.equal(stats.winRate, 50);
  assert.equal(stats.totalMinutes, 480);
  assert.equal(stats.averageMinutes, 120);
  assert.equal(stats.averageRating, 8);
});

test("profile statistics ignore missing durations instead of producing NaN", () => {
  const stats = buildPlayerProfileStatistics({
    userId: "member-1",
    plays: [play("1", { durationMinutes: null }), play("2")],
    ratings: [],
  });

  assert.equal(stats.totalMinutes, 120);
  assert.equal(stats.averageMinutes, 120);
  assert.equal(stats.averageRating, null);
});

test("an empty profile keeps optional statistics empty", () => {
  const stats = buildPlayerProfileStatistics({
    userId: "member-1",
    plays: [],
    ratings: [],
  });

  assert.equal(stats.playsCount, 0);
  assert.equal(stats.winRate, null);
  assert.equal(stats.totalMinutes, null);
  assert.deepEqual(stats.gameHighlights, []);
  assert.deepEqual(stats.records, []);
});

test("game highlights avoid repeating a game when alternatives exist", () => {
  const stats = buildPlayerProfileStatistics({
    userId: "member-1",
    plays: [
      play("1"),
      play("2"),
      play("3", {
        game: { id: "game-2", title: "Frostpunk", coverUrl: null },
        durationMinutes: 300,
      }),
      play("4", {
        game: { id: "game-3", title: "XCOM", coverUrl: null },
        durationMinutes: 180,
      }),
    ],
    ratings: [
      { gameId: "game-1", overall: 9 },
      { gameId: "game-2", overall: 8 },
    ],
  });

  assert.equal(
    new Set(stats.gameHighlights.map((item) => item.game.id)).size,
    3,
  );
});

test("top profile classes are selected by real requirement progress", () => {
  const makeClass = (
    key: string,
    acquiredRequirements: number,
    totalRequirements: number,
    sortOrder: number,
  ): CharacterClassView => ({
    key,
    name: key,
    description: "Opis",
    playstyle: "Styl",
    iconPath: null,
    acquiredRequirements,
    totalRequirements,
    unlocked: acquiredRequirements === totalRequirements,
    isActive: false,
    requirements: [],
    sortOrder,
  });
  const classes = [
    makeClass("two", 2, 5, 1),
    makeClass("five", 5, 5, 2),
    makeClass("four", 4, 5, 3),
    makeClass("three", 3, 5, 4),
  ];

  assert.deepEqual(
    selectTopProfileClasses(classes).map((item) => item.key),
    ["five", "four", "three"],
  );
  assert.equal(formatProfileDuration(163), "2 h 43 min");
});
