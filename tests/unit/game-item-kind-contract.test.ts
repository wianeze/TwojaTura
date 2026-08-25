import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeBggAutofillValues,
  parseBggThingXml,
  toBggAutofillValues,
  type BggAutofillValues,
} from "../../src/features/games/bgg.ts";
import {
  toGameItemKind,
  toIsExpansion,
} from "../../src/features/games/item-kind.ts";
import { validateGameFormData } from "../../src/features/games/validation.ts";

const actor = {
  id: "10000000-0000-0000-0000-000000000002",
  role: "member" as const,
};

const activeMemberIds = [actor.id];

function buildThingXml(itemAttributes: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
  <item ${itemAttributes}>
    <name type="primary" sortindex="1" value="Planet Unknown" />
    <yearpublished value="2022" />
    <minplayers value="1" />
    <maxplayers value="6" />
  </item>
</items>`;
}

function buildGameForm(
  overrides: Record<string, string> = {},
  mode: "create" | "update" = "create",
) {
  const formData = new FormData();
  const values: Record<string, string> = {
    title: "Planet Unknown",
    itemKind: "standalone",
    coverUrl: "",
    bggUrl: "",
    bggRank: "",
    gameType: "",
    minPlayers: "",
    maxPlayers: "",
    playTimeMinutes: "",
    releaseYear: "",
    mechanics: "",
    categories: "",
    bggWeight: "",
    minAge: "",
    designer: "",
    publisher: "",
    expansions: "[]",
    description: "",
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

test("BGG oznacza dodatek atrybutem type elementu <item>", () => {
  const details = parseBggThingXml(
    buildThingXml('type="boardgameexpansion" id="368793"'),
  );

  assert.equal(details.isExpansion, true);
  assert.equal(toBggAutofillValues(details).itemKind, "expansion");
});

test("BGG oznacza grę bazową jako boardgame", () => {
  const details = parseBggThingXml(
    buildThingXml('type="boardgame" id="258779"'),
  );

  assert.equal(details.isExpansion, false);
  assert.equal(toBggAutofillValues(details).itemKind, "standalone");
});

test("brak albo nieznany typ pozycji zostaje nierozstrzygnięty", () => {
  for (const attributes of [
    'id="1"',
    'type="videogame" id="1"',
    'type="" id="1"',
  ]) {
    const details = parseBggThingXml(buildThingXml(attributes));

    assert.equal(
      details.isExpansion,
      null,
      `atrybuty "${attributes}" nie powinny niczego rozstrzygać`,
    );
    assert.equal(toBggAutofillValues(details).itemKind, "unknown");
  }
});

test("korzeń <items> nie jest mylony z elementem <item>", () => {
  // Gdyby wyszukiwanie tagu łapało też `<items>`, pierwszym trafieniem byłby
  // korzeń bez atrybutu type i KAŻDA pozycja wracałaby jako nierozstrzygnięta.
  const details = parseBggThingXml(
    buildThingXml('type="boardgameexpansion" id="368793"'),
  );

  assert.equal(details.isExpansion, true);
});

test("podpowiedź BGG wchodzi w miejsce pozycji nierozstrzygniętej", () => {
  // Dla listy wyboru „pustką” jest `unknown`, a nie pusty string — bez tego
  // podpowiedź nigdy nie trafiłaby do formularza.
  const current = toBggAutofillValues(
    parseBggThingXml(buildThingXml('type="videogame" id="1"')),
  );
  assert.equal(current.itemKind, "unknown");

  const merged = mergeBggAutofillValues(
    current,
    parseBggThingXml(buildThingXml('type="boardgameexpansion" id="368793"')),
  );

  assert.equal(merged.itemKind, "expansion");
});

test("ręczny wybór wygrywa z podpowiedzią BGG", () => {
  const manual: BggAutofillValues = {
    ...toBggAutofillValues(
      parseBggThingXml(buildThingXml('type="boardgame" id="1"')),
    ),
    itemKind: "standalone",
  };

  // Standalone expansion: BGG mówi „dodatek”, człowiek wie lepiej.
  const details = parseBggThingXml(
    buildThingXml('type="boardgameexpansion" id="2"'),
  );

  assert.equal(mergeBggAutofillValues(manual, details).itemKind, "standalone");
  assert.equal(
    mergeBggAutofillValues(manual, details, true).itemKind,
    "expansion",
  );
});

test("mapowanie stanu bazy na pole formularza obsługuje trzy stany", () => {
  assert.equal(toGameItemKind(true), "expansion");
  assert.equal(toGameItemKind(false), "standalone");
  assert.equal(toGameItemKind(null), "unknown");
  assert.equal(toGameItemKind(undefined), "unknown");

  assert.equal(toIsExpansion("expansion"), true);
  assert.equal(toIsExpansion("standalone"), false);
  assert.equal(toIsExpansion("unknown"), null);
});

test("nowa gra wymaga świadomego wyboru typu pozycji", () => {
  const result = buildGameForm({ itemKind: "unknown" }, "create");

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(
      result.fieldErrors.itemKind ?? "",
      /gra samodzielna, czy dodatek/,
    );
  }
});

test("nowa gra zapisuje wybraną klasyfikację", () => {
  const asExpansion = buildGameForm({ itemKind: "expansion" }, "create");
  assert.equal(asExpansion.ok, true);
  if (asExpansion.ok) {
    assert.equal(asExpansion.data.isExpansion, true);
  }

  const asStandalone = buildGameForm({ itemKind: "standalone" }, "create");
  assert.equal(asStandalone.ok, true);
  if (asStandalone.ok) {
    assert.equal(asStandalone.data.isExpansion, false);
  }
});

test("edycja starego wpisu może zostawić pozycję nierozstrzygniętą", () => {
  // Inaczej poprawka literówki w tytule blokowałaby się na decyzji, której
  // autor edycji może w tej chwili nie umieć podjąć. Taka pozycja i tak nie
  // wygeneruje Pierwszego Rozdziału — pilnuje tego warunek w bazie.
  const result = buildGameForm({ itemKind: "unknown" }, "update");

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.isExpansion, null);
  }
});

test("nieznana wartość pola typu pozycji jest odrzucana", () => {
  for (const rawValue of ["", "   ", "base-game", "true"]) {
    const result = buildGameForm({ itemKind: rawValue }, "update");

    assert.equal(
      result.ok,
      false,
      `wartość "${rawValue}" powinna być odrzucona`,
    );
  }
});
