import assert from "node:assert/strict";
import test from "node:test";
import {
  countAdvancedShelfFilters,
  hasAnySelectedTag,
  matchesPlayerCount,
  parseGameFilters,
} from "../../src/features/games/filters.ts";
import {
  mapGameExpansionRecord,
  normalizeGameExpansionDrafts,
} from "../../src/features/games/expansions.ts";
import {
  getGameFormValues,
  getRatingEditorMode,
} from "../../src/features/games/formatting.ts";
import {
  validateGameFormData,
  validateRatingFormData,
} from "../../src/features/games/validation.ts";
import { awardShelfOnboardingPointsAfterGameCreate } from "../../src/features/games/shelf-points.ts";
import { awardRatingPointsAfterSave } from "../../src/features/games/rating-points.ts";

const actor = {
  id: "10000000-0000-0000-0000-000000000002",
  role: "member" as const,
};

const activeMemberIds = [
  "10000000-0000-0000-0000-000000000001",
  "10000000-0000-0000-0000-000000000002",
  "10000000-0000-0000-0000-000000000003",
];

test("game create follow-up requests shelf onboarding milestone points", async () => {
  let requestCount = 0;
  const result = await awardShelfOnboardingPointsAfterGameCreate(async () => {
    requestCount += 1;
    return {
      data: [{ awarded_count: 1, awarded_points: 40 }],
      error: null,
    };
  });

  assert.equal(requestCount, 1);
  assert.deepEqual(result, {
    ok: true,
    awardedCount: 1,
    awardedPoints: 40,
  });
});

test("an idempotent shelf award no-op does not fail game creation follow-up", async () => {
  const result = await awardShelfOnboardingPointsAfterGameCreate(async () => ({
    data: [{ awarded_count: 0, awarded_points: 0 }],
    error: null,
  }));

  assert.deepEqual(result, {
    ok: true,
    awardedCount: 0,
    awardedPoints: 0,
  });
});

test("new rating requests rating_created points", async () => {
  let requestCount = 0;
  const result = await awardRatingPointsAfterSave(true, async () => {
    requestCount += 1;
    return {
      data: [{ awarded: true, points: 30, point_event_id: "event-rating" }],
      error: null,
    };
  });

  assert.equal(requestCount, 1);
  assert.deepEqual(result, {
    ok: true,
    skipped: false,
    awarded: true,
    points: 30,
    pointEventId: "event-rating",
  });
});

test("editing an existing rating skips rating_created award", async () => {
  let requestCount = 0;
  const result = await awardRatingPointsAfterSave(false, async () => {
    requestCount += 1;
    return { data: null, error: null };
  });

  assert.equal(requestCount, 0);
  assert.deepEqual(result, {
    ok: true,
    skipped: true,
    awarded: false,
    points: 0,
    pointEventId: null,
  });
});

test("idempotent rating award no-op does not fail rating save", async () => {
  const result = await awardRatingPointsAfterSave(true, async () => ({
    data: [{ awarded: false, points: 30, point_event_id: null }],
    error: null,
  }));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.awarded, false);
});

function buildGameFormData(
  overrides: Record<string, string> = {},
  mode: "create" | "update" = "create",
) {
  const formData = new FormData();
  const values = {
    title: " Nemesis ",
    coverUrl: "/games/nemezis.webp",
    bggUrl: "https://boardgamegeek.com/boardgame/167355/nemesis",
    bggRank: "20",
    gameType: "Półkooperacyjna",
    minPlayers: "1",
    maxPlayers: "5",
    playTimeMinutes: "120",
    releaseYear: "2018",
    mechanics: "Ukryte cele, Eksploracja, ukryte cele",
    categories: "Science fiction, Horror, science fiction",
    bggWeight: "3,42",
    minAge: "12",
    designer: "Adam Kwapiński",
    publisher: "Awaken Realms",
    expansions: JSON.stringify([{ name: "Carnomorphs", isOwned: true }]),
    description: "  Klimatyczny horror w kosmosie.  ",
    status: "available",
    currentHolderId: actor.id,
    ownerId: actor.id,
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return validateGameFormData(formData, actor, activeMemberIds, mode);
}

function buildRatingFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  const values = {
    overall: "8",
    replayability: "9",
    theme: "10",
    wantsToPlayAgain: "true",
    comment: "  Chętnie wrócę do tej gry.  ",
    ...overrides,
  };

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return validateRatingFormData(formData);
}

test("game validation rejects an empty title", () => {
  const result = buildGameFormData({ title: "   " });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.fieldErrors.title, "Podaj tytuł gry.");
  }
});

test("game validation trims title and description", () => {
  const result = buildGameFormData();
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.title, "Nemesis");
    assert.equal(result.data.description, "Klimatyczny horror w kosmosie.");
  }
});

test("game validation rejects min players larger than max players", () => {
  const result = buildGameFormData({ minPlayers: "5", maxPlayers: "4" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(
      result.fieldErrors.maxPlayers ?? "",
      /Maksymalna liczba graczy/,
    );
  }
});

test("game validation rejects non-positive BGG rank", () => {
  const result = buildGameFormData({ bggRank: "0" });
  assert.equal(result.ok, false);
});

test("game validation rejects non-positive play time", () => {
  const result = buildGameFormData({ playTimeMinutes: "0" });
  assert.equal(result.ok, false);
});

test("game validation rejects bgg weight below 1", () => {
  const result = buildGameFormData({ bggWeight: "0,9" });
  assert.equal(result.ok, false);
});

test("game validation rejects bgg weight above 5", () => {
  const result = buildGameFormData({ bggWeight: "5,1" });
  assert.equal(result.ok, false);
});

test("game validation normalizes decimal comma in bgg weight", () => {
  const result = buildGameFormData({ bggWeight: "3,42" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.bggWeight, 3.42);
  }
});

test("game validation trims and deduplicates mechanics", () => {
  const result = buildGameFormData({
    mechanics: " Kooperacja, Eksploracja, kooperacja ",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.data.mechanics, ["Kooperacja", "Eksploracja"]);
  }
});

test("game validation trims and deduplicates categories", () => {
  const result = buildGameFormData({
    categories: " Horror, Science fiction, horror ",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.data.categories, ["Horror", "Science fiction"]);
  }
});

test("loaned game requires current holder", () => {
  const result = buildGameFormData({
    status: "loaned",
    currentHolderId: "",
  });
  assert.equal(result.ok, false);
});

test("loaned game cannot keep owner as current holder", () => {
  const result = buildGameFormData({
    status: "loaned",
    currentHolderId: actor.id,
  });
  assert.equal(result.ok, false);
});

test("game validation rejects invalid bgg url", () => {
  const result = buildGameFormData({ bggUrl: "javascript:alert(1)" });
  assert.equal(result.ok, false);
});

test("game validation normalizes expansions payload", () => {
  const result = buildGameFormData({
    expansions: JSON.stringify([{ name: "  Evolution  ", isOwned: true }]),
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.data.expansions, [
      { id: undefined, name: "Evolution", isOwned: true },
    ]);
  }
});

test("rating validation accepts the lower bound", () => {
  const result = buildRatingFormData({
    overall: "1",
    replayability: "1",
    theme: "1",
  });
  assert.equal(result.ok, true);
});

test("rating validation accepts the upper bound", () => {
  const result = buildRatingFormData({
    overall: "10",
    replayability: "10",
    theme: "10",
  });
  assert.equal(result.ok, true);
});

test("rating validation rejects 0", () => {
  const result = buildRatingFormData({ overall: "0" });
  assert.equal(result.ok, false);
});

test("rating validation rejects 11", () => {
  const result = buildRatingFormData({ theme: "11" });
  assert.equal(result.ok, false);
});

test("rating validation rejects decimals", () => {
  const result = buildRatingFormData({ replayability: "7.5" });
  assert.equal(result.ok, false);
});

test("rating validation rejects missing required rating component", () => {
  const result = buildRatingFormData({ overall: "" });
  assert.equal(result.ok, false);
});

test("rating validation normalizes empty comment to null", () => {
  const result = buildRatingFormData({ comment: "   " });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.comment, null);
  }
});

test("filter parser returns defaults for empty params", () => {
  assert.deepEqual(parseGameFilters(new URLSearchParams()), {
    q: "",
    owner: undefined,
    status: undefined,
    players: undefined,
    maxTime: undefined,
    type: undefined,
    mechanics: [],
    categories: [],
  });
});

test("filter parser ignores invalid status safely", () => {
  const result = parseGameFilters(new URLSearchParams("status=broken"));
  assert.equal(result.status, undefined);
});

test("filter parser ignores invalid numeric filters", () => {
  const result = parseGameFilters(
    new URLSearchParams("players=abc&maxTime=-10"),
  );
  assert.equal(result.players, undefined);
  assert.equal(result.maxTime, undefined);
});

test("filter parser normalizes player count", () => {
  const result = parseGameFilters(new URLSearchParams("players=4"));
  assert.equal(result.players, 4);
});

test("filter parser deduplicates mechanics", () => {
  const result = parseGameFilters(
    new URLSearchParams(
      "mechanic=Deck%20Building&mechanic=deck%20building&mechanic=Worker%20Placement",
    ),
  );
  assert.deepEqual(result.mechanics, ["Deck Building", "Worker Placement"]);
});

test("filter parser deduplicates categories", () => {
  const result = parseGameFilters(
    new URLSearchParams("category=Horror&category=horror&category=Fantasy"),
  );
  assert.deepEqual(result.categories, ["Horror", "Fantasy"]);
});

test("unknown filter params do not crash parser", () => {
  const result = parseGameFilters(
    new URLSearchParams("q=nemesis&unknown=1&another=test"),
  );
  assert.equal(result.q, "nemesis");
});

test("compact advanced filter count reflects type mechanics and categories", () => {
  assert.equal(
    countAdvancedShelfFilters({
      q: "nemesis",
      owner: undefined,
      status: undefined,
      players: undefined,
      maxTime: undefined,
      type: "Kooperacyjna",
      mechanics: ["Draft", "Area Control"],
      categories: ["Fantasy"],
    }),
    4,
  );
});

test("player semantics means min <= X <= max", () => {
  assert.equal(matchesPlayerCount(2, 5, 4), true);
  assert.equal(matchesPlayerCount(2, 5, 1), false);
});

test("multiple selected mechanics use OR semantics", () => {
  assert.equal(
    hasAnySelectedTag(
      ["Deck Building", "Worker Placement"],
      ["Area Control", "Worker Placement"],
    ),
    true,
  );
  assert.equal(
    hasAnySelectedTag(
      ["Deck Building", "Worker Placement"],
      ["Area Control", "Draft"],
    ),
    false,
  );
});

test("empty expansion name is rejected", () => {
  const result = normalizeGameExpansionDrafts([{ name: "   ", isOwned: true }]);
  assert.equal(result.ok, false);
});

test("duplicate expansion names are rejected case-insensitively", () => {
  const result = normalizeGameExpansionDrafts([
    { name: "Evolution", isOwned: true },
    { name: " evolution ", isOwned: false },
  ]);
  assert.equal(result.ok, false);
});

test("owned true is normalized in expansion drafts", () => {
  const result = normalizeGameExpansionDrafts([
    { name: "Lodowe Kry", isOwned: "true" },
  ]);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data[0]?.isOwned, true);
  }
});

test("owned false is normalized in expansion drafts", () => {
  const result = normalizeGameExpansionDrafts([
    { name: "Timber City", isOwned: "false" },
  ]);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data[0]?.isOwned, false);
  }
});

test("game form values preserve expansion editor state", () => {
  const values = getGameFormValues({
    id: "game-1",
    title: "Frostpunk",
    owner_id: actor.id,
    current_holder_id: actor.id,
    cover_url: "/games/frostpunk.webp",
    bgg_url: null,
    bgg_rank: 310,
    game_type: "Strategiczna",
    min_players: 1,
    max_players: 4,
    play_time_minutes: 135,
    release_year: 2022,
    mechanics: ["Budowanie miasta"],
    categories: ["Strategia"],
    bgg_weight: 4.2,
    min_age: 16,
    designer: "Adam Kwapiński",
    publisher: "Glass Cannon Unplugged",
    description: "Ostatnie miasto musi przetrwać.",
    status: "available",
    created_at: "2026-07-05T10:00:00.000Z",
    updated_at: "2026-07-05T10:00:00.000Z",
    archived_at: null,
    expansions: [
      { id: "exp-1", name: "Lodowe Kry", isOwned: true },
      { id: "exp-2", name: "Timber City", isOwned: false },
    ],
  });

  assert.deepEqual(values.expansions, [
    { id: "exp-1", name: "Lodowe Kry", isOwned: true },
    { id: "exp-2", name: "Timber City", isOwned: false },
  ]);
});

test("game details expansion mapping converts database shape to UI shape", () => {
  assert.deepEqual(
    mapGameExpansionRecord({
      id: "exp-1",
      name: "Playing with Fire",
      is_owned: false,
    }),
    { id: "exp-1", name: "Playing with Fire", isOwned: false },
  );
});

test("existing own rating maps to edit state", () => {
  assert.equal(
    getRatingEditorMode({
      id: "rating-1",
      overall: 8,
      replayability: 7,
      theme: 9,
      wantsToPlayAgain: true,
      comment: null,
    }),
    "edit",
  );
});

test("missing own rating maps to create state", () => {
  assert.equal(getRatingEditorMode(null), "create");
});
