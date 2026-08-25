/**
 * JEDNORAZOWE NARZĘDZIE OPERATORSKIE — zapis zaakceptowanej klasyfikacji.
 *
 * Wejściem jest WYŁĄCZNIE plik CSV przejrzany i zaakceptowany przez człowieka
 * (domyślnie ten z backfill-expansion-classification.mts). Skrypt nie zgaduje,
 * nie sięga do BGG i nie patrzy na tytuły ani adresy — czyta mapowanie
 * `game_id → is_expansion` i zapisuje dokładnie je.
 *
 * Przepływ:
 *
 *   1. pnpm backfill:expansions            (podgląd, zero zapisów)
 *   2. przejrzyj outputs/expansion-classification-preview.csv,
 *      popraw kolumnę proposed_is_expansion tam, gdzie
 *      requires_manual_review = true, usuń wiersze, których nie akceptujesz
 *   3. pnpm backfill:expansions:apply -- --file <ścieżka> --dry-run
 *   4. pnpm backfill:expansions:apply -- --file <ścieżka> --confirm
 *
 * Bez `--confirm` skrypt niczego nie zapisuje. Wiersze z pustą wartością
 * proposed_is_expansion są POMIJANE — pozycja zostaje nierozstrzygnięta, co
 * jest bezpiecznym stanem: nie wygeneruje Misji „Pierwszy Rozdział”.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createOperatorSupabaseClient,
  describeOperatorConnection,
  readOperatorSupabaseConfig,
} from "./operator-supabase.mts";

const DEFAULT_INPUT = resolve("outputs/expansion-classification-preview.csv");

type Decision = { gameId: string; isExpansion: boolean; title: string };

function readFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function readOption(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/** Minimalny czytnik CSV — obsługuje cudzysłowy i przecinki w polach. */
function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (inQuotes) {
      if (char === '"' && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entries) => entries.some((entry) => entry.trim()));
}

function parseDecisions(content: string): Decision[] {
  const rows = parseCsv(content);
  const header = rows.shift();

  if (!header) {
    throw new Error("Plik wejściowy jest pusty.");
  }

  const gameIdIndex = header.indexOf("game_id");
  const valueIndex = header.indexOf("proposed_is_expansion");
  const titleIndex = header.indexOf("local_title");

  if (gameIdIndex < 0 || valueIndex < 0) {
    throw new Error(
      "Plik musi mieć kolumny game_id oraz proposed_is_expansion.",
    );
  }

  const decisions: Decision[] = [];

  for (const [lineNumber, entries] of rows.entries()) {
    const gameId = entries[gameIdIndex]?.trim() ?? "";
    const rawValue = entries[valueIndex]?.trim().toLowerCase() ?? "";
    const title = (titleIndex >= 0 ? entries[titleIndex]?.trim() : "") ?? "";

    if (!gameId) continue;

    // Pusta wartość = świadome „jeszcze nie wiem”. Pomijamy, zamiast zgadywać.
    if (!rawValue) continue;

    if (rawValue !== "true" && rawValue !== "false") {
      throw new Error(
        `Wiersz ${lineNumber + 2}: proposed_is_expansion musi być true, false albo puste (jest „${rawValue}”).`,
      );
    }

    decisions.push({ gameId, isExpansion: rawValue === "true", title });
  }

  return decisions;
}

async function main() {
  const inputPath = resolve(readOption("file") ?? DEFAULT_INPUT);
  const confirmed = readFlag("confirm");
  const decisions = parseDecisions(readFileSync(inputPath, "utf8"));

  const expansions = decisions.filter((decision) => decision.isExpansion);
  const standalone = decisions.filter((decision) => !decision.isExpansion);

  console.log(`Wejście: ${inputPath}`);
  console.log(`  pozycji do zapisania:   ${decisions.length}`);
  console.log(`  jako dodatek (true):    ${expansions.length}`);
  console.log(`  jako samodzielna:       ${standalone.length}`);
  console.log("");

  if (!confirmed) {
    console.log(
      "TRYB PODGLĄDU — nic nie zostało zapisane. Dodaj --confirm, żeby zapisać.",
    );
    return;
  }

  const config = readOperatorSupabaseConfig();
  const supabase = createOperatorSupabaseClient(config);

  console.log(describeOperatorConnection(config));

  let updated = 0;

  for (const decision of decisions) {
    const { error } = await supabase
      .from("games")
      .update({ is_expansion: decision.isExpansion })
      .eq("id", decision.gameId);

    if (error) {
      throw new Error(
        `Nie udało się zapisać „${decision.title || decision.gameId}”: ${error.message}`,
      );
    }

    updated += 1;
  }

  console.log(`Zapisano klasyfikację dla ${updated} pozycji.`);
  console.log(
    "Misje „Pierwszy Rozdział” wrócą do puli przy najbliższym reconcile.",
  );
}

await main();
