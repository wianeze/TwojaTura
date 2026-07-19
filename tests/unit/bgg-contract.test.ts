import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanBggExpansionName,
  createBggExpansionDrafts,
  deduplicateBggExpansionSuggestions,
  deriveGameTypeFromBggData,
  extractBggGameId,
  getBggExpansionPreview,
  mergeBggAutofillValues,
  parseBggThingXml,
  type BggAutofillValues,
} from "../../src/features/games/bgg.ts";
import { fetchBggGameDetailsFromApi } from "../../src/features/games/bgg-server.ts";

const SAMPLE_XML = `
<items>
  <item type="boardgame" id="167355">
    <thumbnail>https://example.com/thumb.jpg</thumbnail>
    <image>https://example.com/image.jpg</image>
    <name type="primary" value="Nemesis &amp; Spółka" />
    <description>Kooperacyjna &lt;b&gt;gra&lt;/b&gt;&lt;br/&gt;z ukrytymi celami.</description>
    <yearpublished value="2018" />
    <minplayers value="1" />
    <maxplayers value="5" />
    <playingtime value="180" />
    <minage value="12" />
    <link type="boardgamecategory" id="1016" value="Science Fiction" />
    <link type="boardgamemechanic" id="2023" value="Cooperative Game" />
    <link type="boardgamemechanic" id="2891" value="Hidden Roles" />
    <link type="boardgamedesigner" id="123" value="Adam Kwapiński" />
    <link type="boardgamepublisher" id="456" value="Awaken Realms" />
    <link type="boardgameexpansion" id="789" value="Nemesis &amp; Spółka: Aftermath" />
    <statistics>
      <ratings>
        <ranks>
          <rank type="subtype" id="1" name="boardgame" value="20" />
        </ranks>
        <averageweight value="3.42" />
      </ratings>
    </statistics>
  </item>
</items>`;

test("extractBggGameId supports BGG game, expansion, thing and query links", () => {
  assert.equal(
    extractBggGameId("https://boardgamegeek.com/boardgame/167355/nemesis"),
    "167355",
  );
  assert.equal(
    extractBggGameId("https://www.boardgamegeek.com/boardgame/167355"),
    "167355",
  );
  assert.equal(
    extractBggGameId("https://boardgamegeek.com/boardgameexpansion/12345/name"),
    "12345",
  );
  assert.equal(
    extractBggGameId("https://boardgamegeek.com/thing/167355"),
    "167355",
  );
  assert.equal(
    extractBggGameId("https://api.geekdo.com/xmlapi2/thing?id=167355"),
    "167355",
  );
});

test("extractBggGameId rejects unsupported domains", () => {
  assert.equal(
    extractBggGameId("https://example.com/boardgame/167355/nemesis"),
    null,
  );
  assert.equal(
    extractBggGameId("https://boardgamegeek.com.example.com/thing/167355"),
    null,
  );
});

test("BGG XML parser maps game fields and removes raw HTML", () => {
  const game = parseBggThingXml(SAMPLE_XML);

  assert.equal(game.title, "Nemesis & Spółka");
  assert.equal(game.gameType, "Kooperacyjna");
  assert.equal(game.coverUrl, "https://example.com/image.jpg");
  assert.equal(game.minPlayers, 1);
  assert.equal(game.maxPlayers, 5);
  assert.equal(game.playTimeMinutes, 180);
  assert.equal(game.releaseYear, 2018);
  assert.equal(game.bggRank, 20);
  assert.equal(game.bggWeight, 3.42);
  assert.deepEqual(game.mechanics, ["Cooperative Game", "Hidden Roles"]);
  assert.deepEqual(game.categories, ["Science Fiction"]);
  assert.equal(game.designer, "Adam Kwapiński");
  assert.equal(game.publisher, "Awaken Realms");
  assert.equal(game.description, "Kooperacyjna gra\nz ukrytymi celami.");
  assert.deepEqual(game.expansionSuggestions, [
    { id: "789", name: "Aftermath" },
  ]);
});

test("BGG expansion names are shortened without losing a standalone name", () => {
  const heroesTitle = "Heroes of Might and Magic III: The Board Game";

  assert.equal(
    cleanBggExpansionName(
      "Heroes of Might and Magic III: The Board Game – Battlefield Expansion",
      heroesTitle,
    ),
    "Battlefield",
  );
  assert.equal(
    cleanBggExpansionName(
      "Heroes of Might and Magic III: The Board Game – Big Box Expansion",
      heroesTitle,
    ),
    "Big Box",
  );
  assert.equal(
    cleanBggExpansionName("Nemesis: Aftermath", "Nemesis"),
    "Aftermath",
  );
  assert.equal(
    cleanBggExpansionName("Terraforming Mars: Prelude", "Terraforming Mars"),
    "Prelude",
  );
  assert.equal(cleanBggExpansionName("Some Expansion", ""), "Some");
});

test("BGG expansion suggestions and previews use cleaned, deduplicated names", () => {
  const heroesTitle = "Heroes of Might and Magic III: The Board Game";
  const suggestions = deduplicateBggExpansionSuggestions([
    {
      id: "1",
      name: cleanBggExpansionName(
        "Heroes of Might and Magic III: The Board Game – Battlefield Expansion",
        heroesTitle,
      ),
    },
    { id: "2", name: "battlefield" },
    { id: "3", name: "Big Box" },
  ]);

  assert.deepEqual(suggestions, [
    { id: "1", name: "Battlefield" },
    { id: "3", name: "Big Box" },
  ]);
  assert.deepEqual(createBggExpansionDrafts([], suggestions), [
    { name: "Battlefield", isOwned: false },
    { name: "Big Box", isOwned: false },
  ]);
  assert.deepEqual(
    getBggExpansionPreview(
      ["Battlefield", "Big Box", "Conflux", "Cove", "Fortress", "Inferno"],
      heroesTitle,
    ),
    {
      names: ["Battlefield", "Big Box", "Conflux", "Cove"],
      remainingCount: 2,
    },
  );
});

test("BGG autofill preserves manual values unless overwrite is enabled", () => {
  const current: BggAutofillValues = {
    title: "Mój tytuł",
    gameType: "Własny typ",
    coverUrl: "",
    bggRank: "",
    minPlayers: "",
    maxPlayers: "",
    playTimeMinutes: "",
    releaseYear: "",
    mechanics: "Własna mechanika",
    categories: "",
    bggWeight: "",
    minAge: "",
    designer: "",
    publisher: "",
    description: "",
  };
  const details = parseBggThingXml(SAMPLE_XML);

  const safeMerge = mergeBggAutofillValues(current, details);
  assert.equal(safeMerge.title, "Mój tytuł");
  assert.equal(safeMerge.gameType, "Własny typ");
  assert.equal(safeMerge.mechanics, "Własna mechanika");
  assert.equal(safeMerge.coverUrl, "https://example.com/image.jpg");

  const overwritten = mergeBggAutofillValues(current, details, true);
  assert.equal(overwritten.title, "Nemesis & Spółka");
  assert.equal(overwritten.gameType, "Kooperacyjna");
  assert.equal(overwritten.mechanics, "Cooperative Game, Hidden Roles");
});

test("BGG expansion suggestions are deduplicated and added as not owned", () => {
  const suggestions = deduplicateBggExpansionSuggestions([
    { id: "1", name: "Aftermath" },
    { id: "2", name: " aftermath " },
    { id: "3", name: "Void Seeders" },
  ]);

  assert.deepEqual(suggestions, [
    { id: "1", name: "Aftermath" },
    { id: "3", name: "Void Seeders" },
  ]);
  assert.deepEqual(createBggExpansionDrafts(["Aftermath"], suggestions), [
    { name: "Void Seeders", isOwned: false },
  ]);
});

test("BGG game type heuristic recognizes cooperative, semi-cooperative and solo games", () => {
  assert.equal(
    deriveGameTypeFromBggData(["Cooperative Game"], []),
    "Kooperacyjna",
  );
  assert.equal(
    deriveGameTypeFromBggData(["Semi-Cooperative Game"], []),
    "Semi-kooperacyjna",
  );
  assert.equal(
    deriveGameTypeFromBggData(["Solo / Solitaire Game"], []),
    "Solo",
  );
  assert.equal(deriveGameTypeFromBggData(["Dice Rolling"], []), null);
});

test("BGG fetch reports a clear server token configuration error", async () => {
  await assert.rejects(
    fetchBggGameDetailsFromApi(
      "https://boardgamegeek.com/boardgame/167355/nemesis",
      { token: "" },
    ),
    /BGG_TOKEN/,
  );
});
