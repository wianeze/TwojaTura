"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database.generated";
import { getCurrentMemberFromClient } from "@/features/auth/queries/get-current-member";
import type {
  GameFormState,
  RatingFormState,
  ToggleGameExpansionState,
} from "./types";
import {
  toGameFormErrorState,
  validateGameFormData,
  validateRatingFormData,
} from "./validation";

type DatabaseErrorLike = {
  code?: string | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type GameRpcBasePayload = {
  p_title: string;
  p_owner_id: string;
  p_current_holder_id: string | null;
  p_cover_url: string | null;
  p_bgg_url: string | null;
  p_bgg_rank: number | null;
  p_game_type: string | null;
  p_min_players: number | null;
  p_max_players: number | null;
  p_play_time_minutes: number | null;
  p_release_year: number | null;
  p_mechanics: string[];
  p_categories: string[];
  p_bgg_weight: number | null;
  p_min_age: number | null;
  p_designer: string | null;
  p_publisher: string | null;
  p_description: string | null;
  p_status: Extract<
    ReturnType<typeof validateGameFormData>,
    { ok: true }
  >["data"]["status"];
  p_expansions?: Json;
};

type CreateGameRpcPayload = GameRpcBasePayload & {
  p_archived_at?: string | null;
};

type UpdateGameRpcPayload = GameRpcBasePayload & {
  p_game_id: string;
};

async function requireActiveMember() {
  const supabase = await createClient();
  const memberState = await getCurrentMemberFromClient(supabase);

  if (memberState.status !== "active-member") {
    return {
      ok: false as const,
      message: "Sesja wygasła albo nie masz dostępu do tej sekcji.",
    };
  }

  return {
    ok: true as const,
    supabase,
    member: memberState.member,
  };
}

async function getActiveMemberIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { data, error } = await supabase
    .from("app_members")
    .select("user_id")
    .eq("is_active", true);

  if (error) {
    throw new Error("Nie udało się pobrać aktywnych członków.");
  }

  return (data ?? []).map((membership) => membership.user_id);
}

function mapGameDatabaseError(error: DatabaseErrorLike) {
  switch (error.code) {
    case "42501":
      return "Nie masz uprawnień do tej operacji.";
    case "23503":
      return "Wybrany właściciel albo aktualny posiadacz nie są dostępni.";
    case "23505":
      return "Lista dodatków zawiera zduplikowane nazwy. Każdy dodatek może wystąpić tylko raz dla tej gry.";
    case "23514":
      return "Dane gry nie spełniają zasad formularza. Sprawdź pola i spróbuj ponownie.";
    case "22023":
      return "Lista dodatków ma nieprawidłowy format.";
    default:
      return "Nie udało się zapisać gry. Spróbuj ponownie.";
  }
}

function mapRatingDatabaseError(error: DatabaseErrorLike) {
  switch (error.code) {
    case "42501":
      return "Nie możesz zapisać oceny w imieniu innej osoby.";
    case "23503":
      return "Ta gra nie jest już dostępna do ocenienia.";
    case "23514":
      return "Ocena jest nieprawidłowa. Popraw pola formularza.";
    default:
      return "Nie udało się zapisać oceny. Spróbuj ponownie.";
  }
}

function toGameRpcPayload(
  validation: Extract<
    ReturnType<typeof validateGameFormData>,
    { ok: true }
  >["data"],
): GameRpcBasePayload {
  return {
    p_title: validation.title,
    p_owner_id: validation.ownerId,
    p_current_holder_id: validation.currentHolderId,
    p_cover_url: validation.coverUrl,
    p_bgg_url: validation.bggUrl,
    p_bgg_rank: validation.bggRank,
    p_game_type: validation.gameType,
    p_min_players: validation.minPlayers,
    p_max_players: validation.maxPlayers,
    p_play_time_minutes: validation.playTimeMinutes,
    p_release_year: validation.releaseYear,
    p_mechanics: validation.mechanics,
    p_categories: validation.categories,
    p_bgg_weight: validation.bggWeight,
    p_min_age: validation.minAge,
    p_designer: validation.designer,
    p_publisher: validation.publisher,
    p_description: validation.description,
    p_status: validation.status,
    p_expansions: validation.expansions.map((expansion) => ({
      name: expansion.name,
      is_owned: expansion.isOwned,
    })),
  };
}

async function callCreateGameWithExpansions(
  supabase: SupabaseServerClient,
  payload: CreateGameRpcPayload,
) {
  return supabase.rpc(
    "create_game_with_expansions",
    payload as Database["public"]["Functions"]["create_game_with_expansions"]["Args"],
  );
}

async function callUpdateGameWithExpansions(
  supabase: SupabaseServerClient,
  payload: UpdateGameRpcPayload,
) {
  return supabase.rpc(
    "update_game_with_expansions",
    payload as Database["public"]["Functions"]["update_game_with_expansions"]["Args"],
  );
}

export async function createGameAction(
  _state: GameFormState,
  formData: FormData,
): Promise<GameFormState> {
  const access = await requireActiveMember();
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const activeMemberIds = await getActiveMemberIds(access.supabase);
  const validation = validateGameFormData(
    formData,
    access.member,
    activeMemberIds,
    "create",
  );

  if (!validation.ok) {
    return toGameFormErrorState(validation);
  }

  const { data, error } = await callCreateGameWithExpansions(access.supabase, {
    ...toGameRpcPayload(validation.data),
  });

  if (error) {
    return { status: "error", message: mapGameDatabaseError(error) };
  }

  revalidatePath("/gry");
  redirect(`/gry/${data}`);
}

export async function updateGameAction(
  gameId: string,
  _state: GameFormState,
  formData: FormData,
): Promise<GameFormState> {
  const access = await requireActiveMember();
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const activeMemberIds = await getActiveMemberIds(access.supabase);
  const validation = validateGameFormData(
    formData,
    access.member,
    activeMemberIds,
    "update",
  );

  if (!validation.ok) {
    return toGameFormErrorState(validation);
  }

  const { data, error } = await callUpdateGameWithExpansions(access.supabase, {
    p_game_id: gameId,
    ...toGameRpcPayload(validation.data),
  });

  if (error) {
    return { status: "error", message: mapGameDatabaseError(error) };
  }

  if (!data) {
    return {
      status: "error",
      message:
        "Nie udało się zapisać tej gry. Być może nie masz do niej uprawnień.",
    };
  }

  revalidatePath("/gry");
  revalidatePath(`/gry/${gameId}`);
  revalidatePath(`/gry/${gameId}/edytuj`);
  redirect(`/gry/${gameId}`);
}

export async function archiveGameAction(
  gameId: string,
  _state: GameFormState,
): Promise<GameFormState> {
  void _state;
  const access = await requireActiveMember();
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const { data, error } = await access.supabase
    .from("games")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", gameId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { status: "error", message: mapGameDatabaseError(error) };
  }

  if (!data) {
    return {
      status: "error",
      message:
        "Nie udało się zarchiwizować gry. Być może nie masz do niej uprawnień.",
    };
  }

  revalidatePath("/gry");
  revalidatePath(`/gry/${gameId}`);
  redirect("/gry");
}

export async function toggleGameExpansionOwnedAction(
  gameId: string,
  expansionId: string,
  isOwned: boolean,
): Promise<ToggleGameExpansionState> {
  const access = await requireActiveMember();
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const { data, error } = await access.supabase
    .from("game_expansions")
    .update({ is_owned: isOwned })
    .eq("id", expansionId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { status: "error", message: mapGameDatabaseError(error) };
  }

  if (!data) {
    return {
      status: "error",
      message: "Nie udało się zmienić stanu dodatku dla tej gry.",
    };
  }

  revalidatePath("/gry");
  revalidatePath(`/gry/${gameId}`);

  return { status: "success" };
}

export async function saveRatingAction(
  gameId: string,
  _state: RatingFormState,
  formData: FormData,
): Promise<RatingFormState> {
  const access = await requireActiveMember();
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const validation = validateRatingFormData(formData);
  if (!validation.ok) {
    return {
      status: "error",
      message: validation.message,
      fieldErrors: validation.fieldErrors,
    };
  }

  const { data: existingRating, error: existingRatingError } =
    await access.supabase
      .from("ratings")
      .select("id")
      .eq("game_id", gameId)
      .eq("user_id", access.member.id)
      .maybeSingle();

  if (existingRatingError) {
    return {
      status: "error",
      message: "Nie udało się sprawdzić Twojej oceny dla tej gry.",
    };
  }

  const payload = {
    overall: validation.data.overall,
    replayability: validation.data.replayability,
    theme: validation.data.theme,
    wants_to_play_again: validation.data.wantsToPlayAgain,
    comment: validation.data.comment,
  };

  const mutation = existingRating
    ? access.supabase
        .from("ratings")
        .update(payload)
        .eq("id", existingRating.id)
        .eq("user_id", access.member.id)
    : access.supabase.from("ratings").insert({
        ...payload,
        game_id: gameId,
        user_id: access.member.id,
      });

  const { error } = await mutation;

  if (error) {
    return { status: "error", message: mapRatingDatabaseError(error) };
  }

  revalidatePath("/gry");
  revalidatePath(`/gry/${gameId}`);

  return {
    status: "success",
    message: existingRating
      ? "Twoja ocena została zaktualizowana."
      : "Twoja ocena została zapisana.",
  };
}
