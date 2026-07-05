import type { GameFilters, GameStatus } from "./types";

const VALID_STATUSES = new Set<GameStatus>([
  "available",
  "unavailable",
  "loaned",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SearchParamsInput =
  URLSearchParams | Record<string, string | string[] | undefined>;

function getValues(searchParams: SearchParamsInput, key: string) {
  if (searchParams instanceof URLSearchParams) {
    return searchParams.getAll(key);
  }

  const value = searchParams[key];
  if (Array.isArray(value)) return value;
  return typeof value === "string" ? [value] : [];
}

function getFirst(searchParams: SearchParamsInput, key: string) {
  return getValues(searchParams, key)[0] ?? "";
}

function parsePositiveInteger(value: string) {
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (!/^\d+$/.test(normalized)) return undefined;

  const parsed = Number.parseInt(normalized, 10);
  return parsed > 0 ? parsed : undefined;
}

function normalizeTextList(values: string[]) {
  const unique = new Map<string, string>();

  for (const rawValue of values) {
    const value = rawValue.trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase("pl-PL");
    if (!unique.has(key)) {
      unique.set(key, value);
    }
  }

  return [...unique.values()];
}

export function parseGameFilters(searchParams: SearchParamsInput): GameFilters {
  const q = getFirst(searchParams, "q").trim();
  const ownerValue = getFirst(searchParams, "owner").trim();
  const statusValue = getFirst(searchParams, "status").trim();
  const type = getFirst(searchParams, "type").trim();
  const players = parsePositiveInteger(getFirst(searchParams, "players"));
  const maxTime = parsePositiveInteger(getFirst(searchParams, "maxTime"));
  const mechanics = normalizeTextList(getValues(searchParams, "mechanic"));
  const categories = normalizeTextList(getValues(searchParams, "category"));

  return {
    q,
    owner: UUID_PATTERN.test(ownerValue) ? ownerValue : undefined,
    status: VALID_STATUSES.has(statusValue as GameStatus)
      ? (statusValue as GameStatus)
      : undefined,
    players,
    maxTime,
    type: type || undefined,
    mechanics,
    categories,
  };
}

export function hasActiveFilters(filters: GameFilters) {
  return Boolean(
    filters.q ||
    filters.owner ||
    filters.status ||
    filters.players ||
    filters.maxTime ||
    filters.type ||
    filters.mechanics.length > 0 ||
    filters.categories.length > 0,
  );
}

export function countAdvancedShelfFilters(filters: GameFilters) {
  return [
    filters.type ? 1 : 0,
    filters.mechanics.length,
    filters.categories.length,
  ].reduce((total, value) => total + value, 0);
}

export function matchesPlayerCount(
  minPlayers: number | null,
  maxPlayers: number | null,
  targetPlayers: number,
) {
  if (!minPlayers || !maxPlayers) return false;
  return minPlayers <= targetPlayers && maxPlayers >= targetPlayers;
}

export function hasAnySelectedTag(
  selectedValues: string[],
  availableValues: string[],
) {
  if (selectedValues.length === 0) return true;

  const available = new Set(
    availableValues.map((value) => value.toLocaleLowerCase("pl-PL")),
  );

  return selectedValues.some((value) =>
    available.has(value.toLocaleLowerCase("pl-PL")),
  );
}
