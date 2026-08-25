import { toGameItemKind } from "./item-kind.ts";
import type {
  GameExpansionFormValue,
  GameFormValues,
  GameRecord,
  GameRecordWithExpansions,
  GameStatus,
  OwnGameRating,
} from "./types";

export const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  available: "Dostępna",
  unavailable: "Niedostępna",
  loaned: "Pożyczona",
};

export function formatDecimal(value: number | null, fractionDigits = 1) {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toFixed(fractionDigits).replace(".", ",");
}

export function formatPlayerRange(
  minPlayers: number | null,
  maxPlayers: number | null,
) {
  if (minPlayers && maxPlayers) return `${minPlayers}–${maxPlayers}`;
  if (minPlayers) return `od ${minPlayers}`;
  if (maxPlayers) return `do ${maxPlayers}`;
  return "—";
}

export function formatPlayTime(playTimeMinutes: number | null) {
  return playTimeMinutes ? `${playTimeMinutes} min` : "—";
}

export function formatOptionalText(value: string | null) {
  return value?.trim() ? value : null;
}

function mapExpansionFormValues(
  expansions: GameRecordWithExpansions["expansions"] = [],
): GameExpansionFormValue[] {
  return expansions.map((expansion) => ({
    id: expansion.id,
    name: expansion.name,
    isOwned: expansion.isOwned,
  }));
}

export function getGameFormValues(
  game?: GameRecord | GameRecordWithExpansions,
): GameFormValues {
  const expansions =
    game && "expansions" in game && Array.isArray(game.expansions)
      ? mapExpansionFormValues(game.expansions)
      : [];

  return {
    title: game?.title ?? "",
    itemKind: toGameItemKind(game?.is_expansion),
    coverUrl: game?.cover_url ?? "",
    bggUrl: game?.bgg_url ?? "",
    bggRank: game?.bgg_rank?.toString() ?? "",
    gameType: game?.game_type ?? "",
    minPlayers: game?.min_players?.toString() ?? "",
    maxPlayers: game?.max_players?.toString() ?? "",
    playTimeMinutes: game?.play_time_minutes?.toString() ?? "",
    releaseYear: game?.release_year?.toString() ?? "",
    mechanics: game?.mechanics.join(", ") ?? "",
    categories: game?.categories.join(", ") ?? "",
    bggWeight: game?.bgg_weight?.toString().replace(".", ",") ?? "",
    minAge: game?.min_age?.toString() ?? "",
    designer: game?.designer ?? "",
    publisher: game?.publisher ?? "",
    expansions,
    description: game?.description ?? "",
    status: game?.status ?? "available",
    currentHolderId: game?.current_holder_id ?? game?.owner_id ?? "",
    ownerId: game?.owner_id ?? "",
  };
}

export function getRatingEditorMode(rating: OwnGameRating | null) {
  return rating ? "edit" : "create";
}
