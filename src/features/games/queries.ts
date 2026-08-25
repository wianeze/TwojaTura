import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.generated";
import { mapGameExpansionRecord } from "./expansions";
import { filterShelfItemsByActiveLoan } from "./filters";
import { mapGameRatingOpinions } from "./rating-opinions";
import type {
  ActiveGameLoan,
  GameExpansion,
  GameDetails,
  GameFilterOptions,
  GameFilters,
  GameRatingComment,
  GameRatingSummary,
  GameRecordWithExpansions,
  GameShelfItem,
  MemberOption,
  OwnGameRating,
} from "./types";

type GameRow = Tables<"games">;
type ExpansionRow = Tables<"game_expansions">;
type GameLoanRow = Tables<"game_loans">;
type ProfileRow = Pick<
  Tables<"profiles">,
  "id" | "display_name" | "avatar_url" | "active_portrait_frame_key"
>;
type AppMemberRow = Pick<
  Tables<"app_members">,
  "user_id" | "role" | "is_active"
>;
type SummaryRow = Tables<"game_rating_summaries">;

function toMemberOption(
  profile: ProfileRow,
  role?: "member" | "admin",
): MemberOption {
  return {
    id: profile.id,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    activePortraitFrameKey: profile.active_portrait_frame_key,
    role,
  };
}

function defaultSummary(): GameRatingSummary {
  return {
    averageOverall: null,
    averageReplayability: null,
    averageTheme: null,
    ratingsCount: 0,
    wantsToPlayAgainCount: 0,
  };
}

function mapSummary(summary?: SummaryRow | null): GameRatingSummary {
  if (!summary) return defaultSummary();

  return {
    averageOverall: summary.average_overall,
    averageReplayability: summary.average_replayability,
    averageTheme: summary.average_theme,
    ratingsCount: Number(summary.ratings_count ?? 0),
    wantsToPlayAgainCount: Number(summary.wants_to_play_again_count ?? 0),
  };
}

function getProfileLabelFallback(id: string) {
  return `Gracz ${id.slice(0, 8)}`;
}

function mapShelfItem(
  game: GameRow,
  profiles: Map<string, MemberOption>,
  summaries: Map<string, GameRatingSummary>,
  expansionsByGame: Map<string, GameExpansion[]>,
  activeLoans: Map<string, ActiveGameLoan>,
): GameShelfItem {
  const owner = profiles.get(game.owner_id) ?? {
    id: game.owner_id,
    displayName: getProfileLabelFallback(game.owner_id),
    avatarUrl: null,
  };

  const currentHolder = game.current_holder_id
    ? (profiles.get(game.current_holder_id) ?? {
        id: game.current_holder_id,
        displayName: getProfileLabelFallback(game.current_holder_id),
        avatarUrl: null,
      })
    : null;

  return {
    id: game.id,
    title: game.title,
    coverUrl: game.cover_url,
    isExpansion: game.is_expansion,
    owner,
    currentHolder,
    status: game.status,
    description: game.description,
    gameType: game.game_type,
    minPlayers: game.min_players,
    maxPlayers: game.max_players,
    playTimeMinutes: game.play_time_minutes,
    releaseYear: game.release_year,
    bggRank: game.bgg_rank,
    bggWeight: game.bgg_weight,
    minAge: game.min_age,
    mechanics: game.mechanics,
    categories: game.categories,
    designer: game.designer,
    publisher: game.publisher,
    expansions: expansionsByGame.get(game.id) ?? [],
    bggUrl: game.bgg_url,
    ratingSummary: summaries.get(game.id) ?? defaultSummary(),
    activeLoan: activeLoans.get(game.id) ?? null,
  };
}

async function getActiveGameLoanRowsFromClient(
  gameIds: string[],
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  if (gameIds.length === 0) return [];

  const { data, error } = await supabase
    .from("game_loans")
    .select(
      "id, game_id, lender_user_id, borrower_user_id, loaned_at, returned_at, note",
    )
    .in("game_id", gameIds)
    .is("returned_at", null);

  if (error) {
    throw new Error("Nie udało się pobrać aktywnych wypożyczeń.");
  }

  return (data ?? []) as GameLoanRow[];
}

function buildActiveGameLoansMap(
  rows: GameLoanRow[],
  profiles: Map<string, MemberOption>,
) {
  return new Map<string, ActiveGameLoan>(
    rows.map((loan) => {
      const lender = profiles.get(loan.lender_user_id) ?? {
        id: loan.lender_user_id,
        displayName: getProfileLabelFallback(loan.lender_user_id),
        avatarUrl: null,
      };
      const borrower = profiles.get(loan.borrower_user_id) ?? {
        id: loan.borrower_user_id,
        displayName: getProfileLabelFallback(loan.borrower_user_id),
        avatarUrl: null,
      };

      return [
        loan.game_id,
        {
          id: loan.id,
          lender,
          borrower,
          loanedAt: loan.loaned_at,
          note: loan.note,
        },
      ];
    }),
  );
}

function buildGameExpansionsMap(rows: ExpansionRow[]) {
  const expansionsMap = new Map<string, GameExpansion[]>();

  for (const row of rows) {
    if (!expansionsMap.has(row.game_id)) {
      expansionsMap.set(row.game_id, []);
    }

    expansionsMap.get(row.game_id)?.push(mapGameExpansionRecord(row));
  }

  for (const expansions of expansionsMap.values()) {
    expansions.sort((left, right) =>
      left.name.localeCompare(right.name, "pl", { sensitivity: "base" }),
    );
  }

  return expansionsMap;
}

/* Kept read helpers share one request client below.
async function getProfilesMap(ids: string[]) {
  if (ids.length === 0) return new Map<string, MemberOption>();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, active_portrait_frame_key")
    .in("id", ids);

  if (error) {
    throw new Error("Nie udało się pobrać profili graczy.");
  }

  return new Map(
    (data ?? []).map((profile) => [profile.id, toMemberOption(profile)]),
  );
}
*/

async function getProfilesMapFromClient(
  ids: string[],
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  if (ids.length === 0) return new Map<string, MemberOption>();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, active_portrait_frame_key")
    .in("id", ids);

  if (error) {
    throw new Error("Nie udało się pobrać profili graczy.");
  }

  return new Map(
    (data ?? []).map((profile) => [profile.id, toMemberOption(profile)]),
  );
}

/*
async function getGameSummariesMap(gameIds: string[]) {
  if (gameIds.length === 0) return new Map<string, GameRatingSummary>();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_rating_summaries")
    .select(
      "game_id, average_overall, average_replayability, average_theme, ratings_count, wants_to_play_again_count",
    )
    .in("game_id", gameIds);

  if (error) {
    throw new Error("Nie udało się pobrać podsumowań ocen.");
  }

  return new Map(
    (data ?? [])
      .filter((row): row is SummaryRow & { game_id: string } =>
        Boolean(row.game_id),
      )
      .map((row) => [row.game_id, mapSummary(row)]),
  );
}
*/

async function getGameSummariesMapFromClient(
  gameIds: string[],
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  if (gameIds.length === 0) return new Map<string, GameRatingSummary>();

  const { data, error } = await supabase
    .from("game_rating_summaries")
    .select(
      "game_id, average_overall, average_replayability, average_theme, ratings_count, wants_to_play_again_count",
    )
    .in("game_id", gameIds);

  if (error) {
    throw new Error("Nie udało się pobrać podsumowań ocen.");
  }

  return new Map(
    (data ?? [])
      .filter((row): row is SummaryRow & { game_id: string } =>
        Boolean(row.game_id),
      )
      .map((row) => [row.game_id, mapSummary(row)]),
  );
}

/*
async function getGameExpansionsMap(gameIds: string[]) {
  if (gameIds.length === 0) return new Map<string, GameExpansion[]>();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_expansions")
    .select("id, game_id, name, is_owned")
    .in("game_id", gameIds)
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Nie udało się pobrać listy dodatków.");
  }

  return buildGameExpansionsMap((data ?? []) as ExpansionRow[]);
}
*/

async function getGameExpansionsMapFromClient(
  gameIds: string[],
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  if (gameIds.length === 0) return new Map<string, GameExpansion[]>();

  const { data, error } = await supabase
    .from("game_expansions")
    .select("id, game_id, name, is_owned")
    .in("game_id", gameIds)
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Nie udało się pobrać listy dodatków.");
  }

  return buildGameExpansionsMap((data ?? []) as ExpansionRow[]);
}

function sortAlphabetically(values: string[]) {
  return values.sort((left, right) =>
    left.localeCompare(right, "pl", { sensitivity: "base" }),
  );
}

export async function listActiveMembers() {
  const supabase = await createClient();
  const { data: memberships, error: membershipError } = await supabase
    .from("app_members")
    .select("user_id, role, is_active")
    .eq("is_active", true)
    .eq("role", "member");

  if (membershipError) {
    throw new Error("Nie udało się pobrać członków grupy.");
  }

  const activeMemberships = (memberships ?? []).filter(
    (membership) => membership.is_active,
  ) as AppMemberRow[];

  const profileIds = activeMemberships.map((membership) => membership.user_id);
  const profiles = await getProfilesMapFromClient(profileIds, supabase);

  return activeMemberships
    .map((membership) => {
      const profile = profiles.get(membership.user_id);
      return profile
        ? {
            id: profile.id,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            role: membership.role,
          }
        : null;
    })
    .filter((member): member is MemberOption & { role: "member" | "admin" } =>
      Boolean(member),
    )
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "pl", {
        sensitivity: "base",
      }),
    );
}

export async function listGameFilterOptions(): Promise<GameFilterOptions> {
  const supabase = await createClient();
  const { data: games, error } = await supabase
    .from("games")
    .select("owner_id, game_type, mechanics, categories")
    .is("archived_at", null);

  if (error) {
    throw new Error("Nie udało się pobrać opcji filtrów.");
  }

  const ownerIds = [...new Set((games ?? []).map((game) => game.owner_id))];
  const ownersMap = await getProfilesMapFromClient(ownerIds, supabase);

  const owners = ownerIds
    .map((ownerId) => ownersMap.get(ownerId))
    .filter((owner): owner is MemberOption => Boolean(owner))
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "pl", {
        sensitivity: "base",
      }),
    );

  const types = sortAlphabetically([
    ...new Set(
      (games ?? []).map((game) => game.game_type?.trim()).filter(Boolean),
    ),
  ] as string[]);
  const mechanics = sortAlphabetically([
    ...new Set(
      (games ?? [])
        .flatMap((game) => game.mechanics.map((value) => value.trim()))
        .filter(Boolean),
    ),
  ]);
  const categories = sortAlphabetically([
    ...new Set(
      (games ?? [])
        .flatMap((game) => game.categories.map((value) => value.trim()))
        .filter(Boolean),
    ),
  ]);

  return { owners, types, mechanics, categories };
}

export async function listShelfGames(filters: GameFilters) {
  const supabase = await createClient();
  const activeLoansPromise = supabase
    .from("game_loans")
    .select(
      "id, game_id, lender_user_id, borrower_user_id, loaned_at, returned_at, note",
    )
    .is("returned_at", null);
  let query = supabase
    .from("games")
    .select(
      "id, title, owner_id, current_holder_id, cover_url, bgg_url, bgg_rank, game_type, min_players, max_players, play_time_minutes, release_year, mechanics, categories, bgg_weight, min_age, designer, publisher, description, status, is_expansion, created_at, updated_at, archived_at",
    )
    .is("archived_at", null)
    .order("title", { ascending: true });

  if (filters.q) {
    query = query.ilike("title", `%${filters.q}%`);
  }

  if (filters.owner) {
    query = query.eq("owner_id", filters.owner);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.players) {
    query = query
      .lte("min_players", filters.players)
      .gte("max_players", filters.players);
  }

  if (filters.maxTime) {
    query = query.lte("play_time_minutes", filters.maxTime);
  }

  if (filters.type) {
    query = query.eq("game_type", filters.type);
  }

  if (filters.mechanics.length > 0) {
    query = query.overlaps("mechanics", filters.mechanics);
  }

  if (filters.categories.length > 0) {
    query = query.overlaps("categories", filters.categories);
  }

  const [{ data: games, error }, activeLoansResult] = await Promise.all([
    query,
    activeLoansPromise,
  ]);

  if (error || activeLoansResult.error) {
    throw new Error("Nie udało się pobrać gier z Półki.");
  }

  const gameRows = (games ?? []) as GameRow[];
  const gameIds = new Set(gameRows.map((game) => game.id));
  const loanRows = ((activeLoansResult.data ?? []) as GameLoanRow[]).filter(
    (loan) => gameIds.has(loan.game_id),
  );
  const profileIds = [
    ...new Set([
      ...gameRows.flatMap(
        (game) =>
          [game.owner_id, game.current_holder_id].filter(Boolean) as string[],
      ),
      ...loanRows.flatMap((loan) => [
        loan.lender_user_id,
        loan.borrower_user_id,
      ]),
    ]),
  ];
  const [profiles, summaries, expansionsByGame] = await Promise.all([
    getProfilesMapFromClient(profileIds, supabase),
    getGameSummariesMapFromClient(
      gameRows.map((game) => game.id),
      supabase,
    ),
    getGameExpansionsMapFromClient(
      gameRows.map((game) => game.id),
      supabase,
    ),
  ]);

  const activeLoans = buildActiveGameLoansMap(loanRows, profiles);
  const allItems = gameRows.map((game) =>
    mapShelfItem(game, profiles, summaries, expansionsByGame, activeLoans),
  );
  const items = filterShelfItemsByActiveLoan(allItems, filters.loanedOnly);
  return { items, totalCount: items.length };
}

export async function getGameDetails(
  gameId: string,
  viewerId: string,
): Promise<GameDetails | null> {
  const supabase = await createClient();
  const { data: game, error } = await supabase
    .from("games")
    .select(
      "id, title, owner_id, current_holder_id, cover_url, bgg_url, bgg_rank, game_type, min_players, max_players, play_time_minutes, release_year, mechanics, categories, bgg_weight, min_age, designer, publisher, description, status, is_expansion, created_at, updated_at, archived_at",
    )
    .eq("id", gameId)
    .maybeSingle();

  if (error) {
    throw new Error("Nie udało się pobrać karty gry.");
  }

  if (!game) return null;

  const loanRows = await getActiveGameLoanRowsFromClient([gameId], supabase);

  const { data: ratings, error: ratingsError } = await supabase
    .from("ratings")
    .select(
      "id, game_id, user_id, overall, replayability, theme, wants_to_play_again, comment, created_at, updated_at",
    )
    .eq("game_id", gameId)
    .order("updated_at", { ascending: false });

  if (ratingsError) {
    throw new Error("Nie udało się pobrać ocen gry.");
  }

  const [profiles, summaries, expansionsByGame] = await Promise.all([
    getProfilesMapFromClient(
      [
        ...new Set(
          [
            game.owner_id,
            game.current_holder_id,
            ...(ratings ?? []).map((rating) => rating.user_id),
            ...loanRows.flatMap((loan) => [
              loan.lender_user_id,
              loan.borrower_user_id,
            ]),
          ].filter(Boolean) as string[],
        ),
      ],
      supabase,
    ),
    getGameSummariesMapFromClient([gameId], supabase),
    getGameExpansionsMapFromClient([gameId], supabase),
  ]);

  const activeLoans = buildActiveGameLoansMap(loanRows, profiles);
  const base = mapShelfItem(
    game,
    profiles,
    summaries,
    expansionsByGame,
    activeLoans,
  );
  const ownRatingRow =
    (ratings ?? []).find((rating) => rating.user_id === viewerId) ?? null;
  const ownRating: OwnGameRating | null = ownRatingRow
    ? {
        id: ownRatingRow.id,
        overall: ownRatingRow.overall,
        replayability: ownRatingRow.replayability,
        theme: ownRatingRow.theme,
        wantsToPlayAgain: ownRatingRow.wants_to_play_again,
        comment: ownRatingRow.comment,
      }
    : null;

  const ratingComments: GameRatingComment[] = mapGameRatingOpinions(
    ratings ?? [],
    profiles,
    getProfileLabelFallback,
  );

  return {
    ...base,
    archivedAt: game.archived_at,
    createdAt: game.created_at,
    updatedAt: game.updated_at,
    ownRating,
    ratingComments,
  };
}

export async function getGameRecordById(gameId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select(
      "id, title, owner_id, current_holder_id, cover_url, bgg_url, bgg_rank, game_type, min_players, max_players, play_time_minutes, release_year, mechanics, categories, bgg_weight, min_age, designer, publisher, description, status, is_expansion, created_at, updated_at, archived_at",
    )
    .eq("id", gameId)
    .maybeSingle();

  if (error) {
    throw new Error("Nie udało się pobrać gry do edycji.");
  }

  if (!data) return null;

  const expansionsByGame = await getGameExpansionsMapFromClient(
    [gameId],
    supabase,
  );

  return {
    ...data,
    expansions: expansionsByGame.get(gameId) ?? [],
  } satisfies GameRecordWithExpansions;
}
