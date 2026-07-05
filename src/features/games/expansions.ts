import type {
  GameExpansion,
  GameExpansionFormValue,
  GameExpansionRecord,
} from "./types";

type ExpansionInputLike = {
  id?: string | null;
  name?: unknown;
  isOwned?: unknown;
};

type NormalizeExpansionResult =
  { ok: true; data: GameExpansionFormValue[] } | { ok: false; message: string };

function normalizeOwnedValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLocaleLowerCase("pl-PL");
    return normalized === "true" || normalized === "1" || normalized === "on";
  }

  return false;
}

export function normalizeGameExpansionDrafts(
  input: ExpansionInputLike[],
): NormalizeExpansionResult {
  const normalizedRows: GameExpansionFormValue[] = [];
  const seenNames = new Set<string>();

  for (const row of input) {
    const trimmedName = typeof row.name === "string" ? row.name.trim() : "";

    if (!trimmedName) {
      return {
        ok: false,
        message: "Każdy dodatek musi mieć nazwę albo zostać usunięty z listy.",
      };
    }

    const duplicateKey = trimmedName.toLocaleLowerCase("pl-PL");
    if (seenNames.has(duplicateKey)) {
      return {
        ok: false,
        message:
          "Lista dodatków zawiera zduplikowane nazwy. Zostaw każdą tylko raz.",
      };
    }

    seenNames.add(duplicateKey);
    normalizedRows.push({
      id: typeof row.id === "string" && row.id.trim() ? row.id : undefined,
      name: trimmedName,
      isOwned: normalizeOwnedValue(row.isOwned),
    });
  }

  return { ok: true, data: normalizedRows };
}

export function parseGameExpansionDrafts(
  rawValue: string,
): NormalizeExpansionResult {
  const normalized = rawValue.trim();
  if (!normalized) {
    return { ok: true, data: [] };
  }

  try {
    const parsed = JSON.parse(normalized);
    if (!Array.isArray(parsed)) {
      return {
        ok: false,
        message: "Lista dodatków ma nieprawidłowy format.",
      };
    }

    return normalizeGameExpansionDrafts(parsed as ExpansionInputLike[]);
  } catch {
    return {
      ok: false,
      message: "Lista dodatków ma nieprawidłowy format.",
    };
  }
}

export function mapGameExpansionRecord(
  record: Pick<GameExpansionRecord, "id" | "name" | "is_owned">,
): GameExpansion {
  return {
    id: record.id,
    name: record.name,
    isOwned: record.is_owned,
  };
}

export function getOwnedExpansionNames(expansions: GameExpansion[]) {
  return expansions
    .filter((expansion) => expansion.isOwned)
    .map((expansion) => expansion.name);
}
