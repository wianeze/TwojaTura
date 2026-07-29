"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Database, Json } from "@/types/database.generated";
import { createClient } from "@/lib/supabase/server";
import { requireWriteAccess } from "@/features/auth/require-write-access";
import type { PlayFormState } from "./types";
import { toPlayFormErrorState, validatePlayFormData } from "./validation";

type DatabaseErrorLike = {
  code?: string | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type PlayParticipantRpcPayload = {
  user_id: string;
  is_winner: boolean;
  placement: number | null;
  score: number | null;
};

type CreatePlayRpcPayload =
  Database["public"]["Functions"]["create_play_with_participants"]["Args"];

type UpdatePlayRpcPayload =
  Database["public"]["Functions"]["update_play_with_participants"]["Args"];

async function getActiveMemberIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { data, error } = await supabase
    .from("app_members")
    .select("user_id")
    .eq("is_active", true)
    .eq("role", "member");

  if (error) {
    throw new Error("Nie udało się pobrać aktywnych członków.");
  }

  return (data ?? []).map((membership) => membership.user_id);
}

function mapPlayDatabaseError(error: DatabaseErrorLike) {
  switch (error.code) {
    case "42501":
      return "Nie masz uprawnień do tej operacji.";
    case "23503":
      return "Wybrana gra, spotkanie albo gracz nie są już dostępne.";
    case "23505":
      return "Ten sam gracz nie może zostać zapisany dwa razy w jednej partii.";
    case "23514":
      return "Dane partii nie spełniają zasad formularza. Sprawdź pola i spróbuj ponownie.";
    case "23502":
      return "Każdy uczestnik partii musi wskazywać poprawnego gracza.";
    case "22023":
      return "Lista graczy ma nieprawidłowy format.";
    default:
      return "Nie udało się zapisać partii. Spróbuj ponownie.";
  }
}

function toPlayRpcPayload(
  validation: Extract<
    ReturnType<typeof validatePlayFormData>,
    { ok: true }
  >["data"],
) {
  const participants: PlayParticipantRpcPayload[] = validation.participants.map(
    (participant) => ({
      user_id: participant.userId,
      is_winner: participant.isWinner,
      placement: participant.placement,
      score: participant.score,
    }),
  );

  return {
    p_game_id: validation.gameId,
    p_played_at: validation.playedAt,
    p_participants: participants as Json,
    p_status: validation.status,
    p_mode: validation.mode,
    ...(validation.teamResult ? { p_team_result: validation.teamResult } : {}),
    ...(validation.meetingId ? { p_meeting_id: validation.meetingId } : {}),
    ...(validation.durationMinutes !== null
      ? { p_duration_minutes: validation.durationMinutes }
      : {}),
    ...(validation.comment !== null ? { p_comment: validation.comment } : {}),
    ...(validation.stateNote !== null
      ? { p_state_note: validation.stateNote }
      : {}),
  } satisfies CreatePlayRpcPayload;
}

async function callCreatePlayWithParticipants(
  supabase: SupabaseServerClient,
  payload: CreatePlayRpcPayload,
) {
  return supabase.rpc("create_play_with_participants", payload);
}

async function callUpdatePlayWithParticipants(
  supabase: SupabaseServerClient,
  payload: UpdatePlayRpcPayload,
) {
  return supabase.rpc("update_play_with_participants", payload);
}

async function getPlayRevalidationSnapshot(
  supabase: SupabaseServerClient,
  playId: string,
) {
  const [{ data: play }, { data: participants }] = await Promise.all([
    supabase
      .from("plays")
      .select("game_id, meeting_id")
      .eq("id", playId)
      .maybeSingle(),
    supabase.from("play_participants").select("user_id").eq("play_id", playId),
  ]);

  return {
    gameId: play?.game_id ?? null,
    meetingId: play?.meeting_id ?? null,
    participantIds: [
      ...new Set((participants ?? []).map((row) => row.user_id)),
    ],
  };
}

function revalidatePlaySurfaces(params: {
  playId: string;
  gameIds: string[];
  meetingIds: string[];
  participantIds: string[];
}) {
  revalidatePath("/kronika");
  revalidatePath(`/kronika/${params.playId}`);
  revalidatePath(`/kronika/${params.playId}/edytuj`);
  revalidatePath("/profil");

  for (const gameId of params.gameIds) {
    revalidatePath(`/gry/${gameId}`);
  }

  for (const meetingId of params.meetingIds) {
    revalidatePath(`/kalendarium/${meetingId}`);
  }

  for (const participantId of params.participantIds) {
    revalidatePath(`/znajomi/${participantId}`);
  }
}

export type CreatePlayActionResult =
  { ok: true; playId: string } | { ok: false; formState: PlayFormState };

/**
 * Unlike updatePlayAction, this never redirects: the client needs the
 * created play_id back so it can upload any photos staged before the play
 * existed, and only navigate to the details page once that finishes (or the
 * user has seen which photos failed and can retry without a duplicate
 * play).
 */
export async function createPlayAction(
  formData: FormData,
): Promise<CreatePlayActionResult> {
  const access = await requireWriteAccess();
  if (!access.ok) {
    return {
      ok: false,
      formState: { status: "error", message: access.message },
    };
  }

  const activeMemberIds = await getActiveMemberIds(access.supabase);
  const validation = validatePlayFormData(formData, activeMemberIds);
  if (!validation.ok) {
    return { ok: false, formState: toPlayFormErrorState(validation) };
  }

  const { data, error } = await callCreatePlayWithParticipants(
    access.supabase,
    toPlayRpcPayload(validation.data),
  );

  if (error || !data) {
    return {
      ok: false,
      formState: {
        status: "error",
        message: mapPlayDatabaseError(error ?? {}),
      },
    };
  }

  // Nagrody nalicza teraz baza, w tej samej transakcji co zapis partii
  // (private.recompute_play_rewards wywoływane z RPC). Wcześniejsza sekwencja
  // czterech osobnych wywołań RPC z tego miejsca zniknęła: mogła się nie
  // wykonać po udanym zapisie i zostawić punkty oraz odznaki niespójne z
  // danymi.

  revalidatePlaySurfaces({
    playId: data,
    gameIds: [validation.data.gameId],
    meetingIds: validation.data.meetingId ? [validation.data.meetingId] : [],
    participantIds: validation.data.participants.map(
      (participant) => participant.userId,
    ),
  });

  return { ok: true, playId: data };
}

export async function updatePlayAction(
  playId: string,
  _state: PlayFormState,
  formData: FormData,
): Promise<PlayFormState> {
  const access = await requireWriteAccess();
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const [snapshot, activeMemberIds] = await Promise.all([
    getPlayRevalidationSnapshot(access.supabase, playId),
    getActiveMemberIds(access.supabase),
  ]);

  const validation = validatePlayFormData(formData, activeMemberIds);
  if (!validation.ok) {
    return toPlayFormErrorState(validation);
  }

  const { data, error } = await callUpdatePlayWithParticipants(
    access.supabase,
    {
      p_play_id: playId,
      ...toPlayRpcPayload(validation.data),
    },
  );

  if (error || !data) {
    return {
      status: "error",
      message: mapPlayDatabaseError(error ?? {}),
    };
  }

  // Nagrody nalicza baza w tej samej transakcji co edycję (recompute wołane z
  // RPC). Dawne wywołanie award_play_logged_points z tego miejsca było nie
  // tylko zbędne, ale i szkodliwe: ta funkcja odrzuca każdego, kto nie jest
  // autorem partii, więc admin edytujący cudzy wpis dostawał komunikat o
  // nieudanym naliczeniu punktów mimo poprawnie zapisanej i przeliczonej
  // partii.

  revalidatePlaySurfaces({
    playId,
    gameIds: [
      ...new Set([snapshot.gameId, validation.data.gameId].filter(Boolean)),
    ] as string[],
    meetingIds: [
      ...new Set(
        [snapshot.meetingId, validation.data.meetingId].filter(Boolean),
      ),
    ] as string[],
    participantIds: [
      ...new Set([
        ...snapshot.participantIds,
        ...validation.data.participants.map(
          (participant) => participant.userId,
        ),
      ]),
    ],
  });

  redirect(`/kronika/${playId}`);
}

async function removePlayPhotoFiles(
  supabase: SupabaseServerClient,
  playId: string,
) {
  const { data: photos } = await supabase
    .from("play_photos")
    .select("storage_path")
    .eq("play_id", playId);

  const storagePaths = (photos ?? []).map((photo) => photo.storage_path);

  if (storagePaths.length === 0) return;

  // Best-effort: a play the user is entitled to delete should not be stuck
  // just because Storage had a transient failure. The reconciliation sweep
  // (Etap C4) is the safety net for whatever this misses.
  const { error } = await supabase.storage
    .from("play-photos")
    .remove(storagePaths);

  if (error) {
    console.error(
      `Nie udało się usunąć zdjęć partii ${playId} ze Storage:`,
      error,
    );
  }
}

export async function deletePlayAction(playId: string) {
  const access = await requireWriteAccess();
  if (!access.ok) {
    redirect("/kronika");
  }

  const snapshot = await getPlayRevalidationSnapshot(access.supabase, playId);
  await removePlayPhotoFiles(access.supabase, playId);

  // Usuwanie idzie przez RPC, a nie przez bezpośredni DELETE na tabeli:
  // skutki nagrodowe partii (punkty za zapis, odznaki uczestników) muszą
  // zostać skompensowane w tej samej transakcji, w której znika sama partia.
  // Pliki zdjęć kasujemy wcześniej — baza nie ma dostępu do Storage.
  const { data, error } = await access.supabase.rpc("delete_play", {
    p_play_id: playId,
  });

  if (error || !data) {
    redirect(`/kronika/${playId}`);
  }

  revalidatePlaySurfaces({
    playId,
    gameIds: snapshot.gameId ? [snapshot.gameId] : [],
    meetingIds: snapshot.meetingId ? [snapshot.meetingId] : [],
    participantIds: snapshot.participantIds,
  });

  redirect("/kronika");
}
