import assert from "node:assert/strict";
import test from "node:test";
import { buildMeetingGameRecommendations } from "../../src/features/meetings/game-recommendations.ts";

const participants = ["user-1", "user-2", "user-3", "user-4", "user-5"];
const games = [
  { gameId: "game-a", title: "Gra A" },
  { gameId: "game-b", title: "Gra B" },
];

function rating(
  gameId: string,
  userId: string,
  overall: number,
  wantsToPlayAgain = false,
) {
  return { gameId, userId, overall, wantsToPlayAgain };
}

test("high ratings across the group produce a team recommendation", () => {
  const result = buildMeetingGameRecommendations({
    participantIds: participants,
    games,
    ratings: participants.map((userId, index) =>
      rating("game-a", userId, 8 + (index % 2), true),
    ),
  });

  assert.equal(result[0]?.gameId, "game-a");
  assert.equal(result[0]?.ratingCount, 5);
  assert.equal(result[0]?.label, "team-sure-thing");
});

test("a single 10/10 rating does not create a recommendation", () => {
  const result = buildMeetingGameRecommendations({
    participantIds: participants,
    games,
    ratings: [rating("game-a", "user-1", 10, true)],
  });

  assert.deepEqual(result, []);
});

test("missing ratings keep the recommendation section empty", () => {
  const result = buildMeetingGameRecommendations({
    participantIds: participants,
    games,
    ratings: [],
  });

  assert.deepEqual(result, []);
});

test("wants_to_play_again improves ranking between equally rated games", () => {
  const result = buildMeetingGameRecommendations({
    participantIds: ["user-1", "user-2", "user-3"],
    games,
    ratings: [
      rating("game-a", "user-1", 8),
      rating("game-a", "user-2", 8),
      rating("game-b", "user-1", 8, true),
      rating("game-b", "user-2", 8, true),
    ],
  });

  assert.equal(result[0]?.gameId, "game-b");
  assert.ok((result[0]?.score ?? 0) > (result[1]?.score ?? 0));
});

test("similar quality prefers a game rated by more of the group", () => {
  const result = buildMeetingGameRecommendations({
    participantIds: participants,
    games,
    ratings: [
      rating("game-a", "user-1", 9, true),
      rating("game-a", "user-2", 9, true),
      rating("game-b", "user-1", 8.8, true),
      rating("game-b", "user-2", 8.8, true),
      rating("game-b", "user-3", 8.8, true),
      rating("game-b", "user-4", 8.8, true),
    ],
  });

  assert.equal(result[0]?.gameId, "game-b");
  assert.equal(result[0]?.ratingCount, 4);
});

test("team sure thing requires three ratings, average 8 and no rating at or below 5", () => {
  const sureThing = buildMeetingGameRecommendations({
    participantIds: ["user-1", "user-2", "user-3"],
    games: [games[0]],
    ratings: [
      rating("game-a", "user-1", 8),
      rating("game-a", "user-2", 9),
      rating("game-a", "user-3", 8),
    ],
  });
  const rejectedSureThing = buildMeetingGameRecommendations({
    participantIds: ["user-1", "user-2", "user-3"],
    games: [games[0]],
    ratings: [
      rating("game-a", "user-1", 10),
      rating("game-a", "user-2", 9),
      rating("game-a", "user-3", 5),
    ],
  });

  assert.equal(sureThing[0]?.label, "team-sure-thing");
  assert.equal(rejectedSureThing[0]?.label, "team-favorite");
});
