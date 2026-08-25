/**
 * JEDNORAZOWE NARZĘDZIE OPERATORSKIE — podgląd klasyfikacji dodatków.
 *
 * Czyta całą Półkę i dla każdej pozycji z linkiem BGG pyta o nią przez TEN SAM
 * helper, którego używa autofill formularza — `fetchBggGameDetailsFromApi`.
 * Oznacza to ten sam endpoint (api.geekdo.com), ten sam BGG_TOKEN, ten sam
 * nagłówek Authorization i tę samą obsługę 202/429. Skrypt nie ma własnego
 * klienta HTTP do BGG i nie zna nazwy zmiennej z tokenem.
 *
 * NIC NIE ZAPISUJE DO BAZY.
 *
 * To NIE jest część runtime.u aplikacji — narzędzie istnieje wyłącznie po to,
 * żeby jednorazowo nadgonić rekordy dodane, zanim powstała kolumna
 * games.is_expansion.
 *
 * Uruchomienie (odczyt produkcji jest bezpieczny — brak jakiegokolwiek zapisu):
 *
 *   pnpm backfill:expansions
 *
 * Wynik: outputs/expansion-classification-preview.csv + podsumowanie na stdout.
 * Zaakceptowany plik jest wejściem dla scripts/apply-expansion-classification.mts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { extractBggGameId } from "../src/features/games/bgg.ts";
import { fetchBggGameDetailsFromApi } from "../src/features/games/bgg-server.ts";
import {
  createOperatorSupabaseClient,
  describeOperatorConnection,
  readOperatorSupabaseConfig,
} from "./operator-supabase.mts";

const OUTPUT_PATH = resolve("outputs/expansion-classification-preview.csv");

/**
 * Odstęp między zapytaniami. Sam helper aplikacyjny ma własne ponowienia dla
 * 202/429, ale robi jedno zapytanie na akcję użytkownika — tutaj lecimy przez
 * całą Półkę pod rząd, więc dokładamy uprzejmą przerwę, żeby w ogóle nie
 * wchodzić w limity.
 */
const REQUEST_DELAY_MS = 1_200;

type GameRow = {
  id: string;
  title: string;
  bgg_url: string | null;
  categories: string[];
  is_expansion: boolean | null;
};

type Confidence = "high" | "medium" | "none";

type PreviewRow = {
  gameId: string;
  localTitle: string;
  bggId: string | null;
  bggPrimaryName: string | null;
  bggItemType: string;
  proposedIsExpansion: boolean | null;
  currentUrlKind: string;
  hasExpansionCategory: boolean;
  currentIsExpansion: boolean | null;
  confidence: Confidence;
  requiresManualReview: boolean;
  reason: string;
};

function describeUrlKind(bggUrl: string | null) {
  if (!bggUrl) return "brak linku";
  if (/\/boardgameexpansion\//i.test(bggUrl)) return "boardgameexpansion";
  if (/\/boardgame\//i.test(bggUrl)) return "boardgame";
  return "inny kształt linku";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Etykieta typu pozycji do kolumny CSV.
 *
 * Helper aplikacyjny oddaje już zinterpretowany `isExpansion`, więc surowy
 * atrybut `type` nie wraca tutaj jako string. Odwzorowanie jest dosłownie
 * odwrotnością mapowania z `parseBggItemKind` — nie ma tu drugiej reguły,
 * tylko jej opis dla człowieka czytającego CSV.
 */
function describeItemType(isExpansion: boolean | null) {
  if (isExpansion === true) return "boardgameexpansion";
  if (isExpansion === false) return "boardgame";
  return "(brak)";
}

function classify(input: {
  game: GameRow;
  bggId: string | null;
  primaryName: string | null;
  isExpansion: boolean | null;
  failure: string | null;
}): PreviewRow {
  const { game, bggId, primaryName, isExpansion, failure } = input;
  const urlKind = describeUrlKind(game.bgg_url);
  const hasExpansionCategory = game.categories.some(
    (category) => category.trim().toLowerCase() === "expansion for base-game",
  );

  const flags: string[] = [];

  if (isExpansion === null) {
    flags.push(
      failure ??
        (bggId
          ? "BGG nie podało typu pozycji"
          : "nie udało się wyciągnąć identyfikatora BGG z linku"),
    );
  }

  // Rozbieżność nazw jest WYŁĄCZNIE flagą do przejrzenia. Nigdy nie zmienia
  // proponowanej wartości — dokładnie tak wychodzą na jaw anomalie w rodzaju
  // „Big Box wskazuje wpis podstawowej gry”.
  if (
    primaryName &&
    !game.title.toLowerCase().includes(primaryName.toLowerCase()) &&
    !primaryName.toLowerCase().includes(game.title.toLowerCase())
  ) {
    flags.push(
      `lokalny tytuł „${game.title}” nie pokrywa się z pozycją BGG „${primaryName}”`,
    );
  }

  if (isExpansion === false && hasExpansionCategory) {
    flags.push(
      "BGG mówi boardgame, ale pozycja ma kategorię „Expansion for Base-game”",
    );
  }

  if (isExpansion === false && urlKind === "boardgameexpansion") {
    flags.push("BGG mówi boardgame, ale zapisany link wskazuje na dodatek");
  }

  if (isExpansion === true && urlKind === "boardgame") {
    flags.push("BGG mówi boardgameexpansion, mimo linku /boardgame/");
  }

  const confidence: Confidence =
    isExpansion === null ? "none" : flags.length === 0 ? "high" : "medium";

  return {
    gameId: game.id,
    localTitle: game.title,
    bggId,
    bggPrimaryName: primaryName,
    bggItemType: describeItemType(isExpansion),
    proposedIsExpansion: isExpansion,
    currentUrlKind: urlKind,
    hasExpansionCategory,
    currentIsExpansion: game.is_expansion,
    confidence,
    requiresManualReview: confidence !== "high",
    reason:
      flags.length > 0
        ? flags.join(" | ")
        : isExpansion
          ? "BGG jednoznacznie: boardgameexpansion"
          : "BGG jednoznacznie: boardgame",
  };
}

function toCsv(rows: PreviewRow[]) {
  const header = [
    "game_id",
    "local_title",
    "bgg_id",
    "bgg_primary_name",
    "bgg_item_type",
    "proposed_is_expansion",
    "current_url_kind",
    "has_expansion_category",
    "current_is_expansion",
    "confidence",
    "requires_manual_review",
    "reason",
  ];

  const escape = (value: string | boolean | null) => {
    if (value === null) return "";
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };

  const lines = rows.map((row) =>
    [
      row.gameId,
      row.localTitle,
      row.bggId,
      row.bggPrimaryName,
      row.bggItemType,
      row.proposedIsExpansion,
      row.currentUrlKind,
      row.hasExpansionCategory,
      row.currentIsExpansion,
      row.confidence,
      row.requiresManualReview,
      row.reason,
    ]
      .map(escape)
      .join(","),
  );

  return [header.join(","), ...lines].join("\n");
}

async function main() {
  const config = readOperatorSupabaseConfig();
  const supabase = createOperatorSupabaseClient(config);

  console.log(describeOperatorConnection(config));

  const { data, error } = await supabase
    .from("games")
    .select("id, title, bgg_url, categories, is_expansion")
    .order("title", { ascending: true });

  if (error) {
    throw new Error(`Nie udało się odczytać Półki: ${error.message}`);
  }

  const games = (data ?? []) as GameRow[];
  console.log(`Wczytano ${games.length} gier z Półki.`);

  const withLink = games.filter((game) => Boolean(game.bgg_url));
  console.log(
    `Do odpytania w BGG: ${withLink.length} pozycji z linkiem ` +
      `(przerwa ${REQUEST_DELAY_MS} ms między zapytaniami).`,
  );

  const rows: PreviewRow[] = [];
  let requests = 0;

  for (const game of games) {
    const bggId = game.bgg_url ? extractBggGameId(game.bgg_url) : null;

    if (!game.bgg_url) {
      rows.push(
        classify({
          game,
          bggId,
          primaryName: null,
          isExpansion: null,
          failure: "pozycja nie ma zapisanego linku do BGG",
        }),
      );
      continue;
    }

    if (requests > 0) {
      await sleep(REQUEST_DELAY_MS);
    }

    requests += 1;

    try {
      // Ten sam helper, którego używa autofill formularza: bierze BGG_TOKEN,
      // dokłada nagłówek Authorization i User-Agent, ponawia 202/429 i pilnuje
      // timeoutu. Skrypt nie ma własnego klienta HTTP do BGG.
      const details = await fetchBggGameDetailsFromApi(game.bgg_url);

      rows.push(
        classify({
          game,
          bggId,
          primaryName: details.title,
          isExpansion: details.isExpansion,
          failure: null,
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "nieznany błąd BGG";

      // Pierwsze zapytanie odsiewa problemy konfiguracyjne (brak BGG_TOKEN,
      // zły token, brak sieci). Nie ma sensu przemielić przez nie całej Półki
      // — przerywamy i pokazujemy operatorowi dokładny powód.
      if (requests === 1) {
        throw new Error(
          `Pierwsze zapytanie do BGG nie powiodło się, przerywam: ${message}`,
        );
      }

      console.warn(`  ! ${game.title}: ${message}`);

      rows.push(
        classify({
          game,
          bggId,
          primaryName: null,
          isExpansion: null,
          failure: `BGG nie odpowiedziało poprawnie: ${message}`,
        }),
      );
    }
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${toCsv(rows)}\n`, "utf8");

  const expansions = rows.filter((row) => row.proposedIsExpansion === true);
  const standalone = rows.filter((row) => row.proposedIsExpansion === false);
  const unresolved = rows.filter((row) => row.proposedIsExpansion === null);
  const manual = rows.filter((row) => row.requiresManualReview);

  console.log("");
  console.log("=== PODSUMOWANIE ===");
  console.log(`  wszystkie pozycje:          ${rows.length}`);
  console.log(`  BGG: boardgameexpansion:    ${expansions.length}`);
  console.log(`  BGG: boardgame:             ${standalone.length}`);
  console.log(`  bez rozstrzygnięcia:        ${unresolved.length}`);
  console.log(`  do ręcznej decyzji:         ${manual.length}`);
  console.log("");

  if (manual.length > 0) {
    console.log("=== WYMAGAJĄ RĘCZNEJ DECYZJI ===");
    for (const row of manual) {
      console.log(
        `  ${row.localTitle} [${row.bggItemType}] → ${
          row.proposedIsExpansion === null
            ? "?"
            : String(row.proposedIsExpansion)
        }`,
      );
      console.log(`      ${row.reason}`);
    }
    console.log("");
  }

  console.log(`Podgląd zapisany: ${OUTPUT_PATH}`);
  console.log("Do bazy NIE zapisano niczego.");
}

await main();
