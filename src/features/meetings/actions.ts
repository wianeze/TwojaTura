"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireWriteAccess } from "@/features/auth/require-write-access";
import { dispatchPendingPushDeliveriesInBackground } from "@/features/push/server/dispatch";
import {
  awardSimpleAchievementsAfterMeetingCreate,
  awardSimpleAchievementsAfterRsvpSave,
} from "@/features/legendarium/achievement-awards";
import { buildMeetingConfirmationStatusPatch } from "./meeting-status";
import {
  awardMeetingCreatedPointsAfterSave,
  awardMeetingRsvpPointsAfterSave,
  awardMeetingVotePointsAfterSave,
} from "./meeting-points";
import { mapMeetingDeleteError } from "./meeting-deletion";
import { DEFAULT_MEETING_STATUS } from "./types";
import type {
  MeetingAvailabilityFormState,
  MeetingDeleteState,
  MeetingFormState,
  MeetingVoteState,
} from "./types";
import { toMeetingFormErrorState, validateMeetingFormData } from "./validation";

type DatabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

function mapMeetingDatabaseError(error: DatabaseErrorLike) {
  switch (error.code) {
    case "42501":
      return "Nie masz uprawnień do tej operacji.";
    case "23514":
      return "Koniec spotkania musi być późniejszy niż początek.";
    default:
      return "Nie udało się zapisać spotkania. Spróbuj ponownie.";
  }
}

export async function createMeetingAction(
  _state: MeetingFormState,
  formData: FormData,
): Promise<MeetingFormState> {
  const access = await requireWriteAccess();
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const validation = validateMeetingFormData(formData);
  if (!validation.ok) {
    return toMeetingFormErrorState(validation);
  }

  const { data, error } = await access.supabase
    .from("meetings")
    .insert({
      created_by: access.member.id,
      title: validation.data.title,
      description: validation.data.description,
      location: validation.data.location,
      status: DEFAULT_MEETING_STATUS,
      starts_at: validation.data.startsAt,
      ends_at: validation.data.endsAt,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      status: "error",
      message: mapMeetingDatabaseError(error ?? {}),
    };
  }

  const pointAward = await awardMeetingCreatedPointsAfterSave(true, () =>
    access.supabase.rpc("award_meeting_created_points", {
      p_meeting_id: data.id,
    }),
  );

  if (!pointAward.ok) {
    return {
      status: "error",
      message:
        "Spotkanie zostało zapisane, ale nie udało się naliczyć punktów. Odśwież Kalendarium przed ponowną próbą.",
    };
  }

  const achievementAward = await awardSimpleAchievementsAfterMeetingCreate(() =>
    access.supabase.rpc("award_current_user_simple_achievements"),
  );

  if (!achievementAward.ok) {
    return {
      status: "error",
      message:
        "Spotkanie zostało zapisane, ale nie udało się sprawdzić nowych odznak. Odśwież Kalendarium przed ponowną próbą.",
    };
  }

  revalidatePath("/kalendarium");

  // Kampania „Nowe spotkanie!” jest już w outboxie — zapisał ją trigger
  // z_meetings_enqueue_push w tej samej transakcji co spotkanie. Tu zostaje
  // tylko pierwsza próba wysyłki, uruchamiana po odesłaniu odpowiedzi:
  // wariant „in background” nie rzuca, więc jego niepowodzenie nie może zmienić
  // wyniku tej akcji ani cofnąć spotkania — zostawia za to kod błędu w logu.
  // Nieudane dostawy czekają w kolejce na crona albo na przycisk w panelu
  // administratora.
  after(() => dispatchPendingPushDeliveriesInBackground());

  redirect(`/kalendarium/${data.id}`);
}

export async function updateMeetingAction(
  meetingId: string,
  _state: MeetingFormState,
  formData: FormData,
): Promise<MeetingFormState> {
  const access = await requireWriteAccess();
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const validation = validateMeetingFormData(formData);
  if (!validation.ok) {
    return toMeetingFormErrorState(validation);
  }

  const { data, error } = await access.supabase
    .from("meetings")
    .update({
      title: validation.data.title,
      description: validation.data.description,
      location: validation.data.location,
      starts_at: validation.data.startsAt,
      ends_at: validation.data.endsAt,
    })
    .eq("id", meetingId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { status: "error", message: mapMeetingDatabaseError(error) };
  }

  if (!data) {
    return {
      status: "error",
      message:
        "Nie udało się zapisać tego spotkania. Być może nie masz do niego uprawnień.",
    };
  }

  revalidatePath("/kalendarium");
  revalidatePath(`/kalendarium/${meetingId}`);
  revalidatePath(`/kalendarium/${meetingId}/edytuj`);
  redirect(`/kalendarium/${meetingId}`);
}

export async function saveMeetingAvailabilityAction(
  meetingId: string,
  _state: MeetingAvailabilityFormState,
  formData: FormData,
): Promise<MeetingAvailabilityFormState> {
  const access = await requireWriteAccess();
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const response = formData.get("response");
  const isAvailable =
    response === "available" ? true : response === "unavailable" ? false : null;

  if (isAvailable === null) {
    return {
      status: "error",
      message: "Wybierz, czy będziesz na spotkaniu.",
    };
  }

  const { error } = await access.supabase.from("meeting_availability").upsert(
    {
      meeting_id: meetingId,
      user_id: access.member.id,
      is_available: isAvailable,
    },
    { onConflict: "meeting_id,user_id" },
  );

  if (error) {
    return {
      status: "error",
      message: "Nie udało się zapisać odpowiedzi RSVP.",
      savedResponse: null,
    };
  }

  const pointAward = await awardMeetingRsvpPointsAfterSave(() =>
    access.supabase.rpc("award_meeting_rsvp_points", {
      p_meeting_id: meetingId,
    }),
  );

  if (!pointAward.ok) {
    return {
      status: "error",
      message:
        "Odpowiedź RSVP została zapisana, ale nie udało się naliczyć punktów.",
      savedResponse: isAvailable,
    };
  }

  const achievementAward = await awardSimpleAchievementsAfterRsvpSave(() =>
    access.supabase.rpc("award_current_user_simple_achievements"),
  );

  if (!achievementAward.ok) {
    return {
      status: "error",
      message:
        "Odpowiedź została zapisana, ale nie udało się sprawdzić nowych odznak.",
      savedResponse: isAvailable,
    };
  }

  revalidatePath("/kalendarium");
  revalidatePath(`/kalendarium/${meetingId}`);
  return { status: "success", savedResponse: isAvailable };
}

export async function confirmMeetingAction(
  meetingId: string,
  currentStatus: "planned" | "confirmed",
) {
  const access = await requireWriteAccess();
  if (!access.ok) {
    return;
  }

  const statusPatch = buildMeetingConfirmationStatusPatch(currentStatus);
  if (!statusPatch) {
    return;
  }

  const { data, error } = await access.supabase
    .from("meetings")
    .update(statusPatch)
    .eq("id", meetingId)
    .eq("status", currentStatus)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return;
  }

  revalidatePath("/kalendarium");
  revalidatePath(`/kalendarium/${meetingId}`);
}

/*
 * Zapisy do propozycji i odpowiedzi idą wyłącznie przez transakcyjne RPC —
 * klient nie ma na tych tabelach grantów INSERT/UPDATE/DELETE. Punkty za
 * udział w głosowaniu przyznaje samo RPC, więc tutaj zostaje tylko
 * normalizacja odpowiedzi i odświeżenie ścieżek.
 */
export async function proposeMeetingGameAction(
  meetingId: string,
  gameId: string,
): Promise<MeetingVoteState> {
  const access = await requireWriteAccess();
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const pointAward = await awardMeetingVotePointsAfterSave(() =>
    access.supabase.rpc("propose_meeting_game", {
      p_meeting_id: meetingId,
      p_game_id: gameId,
    }),
  );

  if (!pointAward.ok) {
    return { status: "error", message: "Nie udało się zgłosić gry." };
  }

  revalidatePath("/kalendarium");
  revalidatePath(`/kalendarium/${meetingId}`);
  return { status: "success" };
}

export async function setMeetingGameResponseAction(
  meetingId: string,
  gameId: string,
  wantsToPlay: boolean,
): Promise<MeetingVoteState> {
  const access = await requireWriteAccess();
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const pointAward = await awardMeetingVotePointsAfterSave(() =>
    access.supabase.rpc("set_meeting_game_response", {
      p_meeting_id: meetingId,
      p_game_id: gameId,
      p_wants_to_play: wantsToPlay,
    }),
  );

  if (!pointAward.ok) {
    return { status: "error", message: "Nie udało się zapisać odpowiedzi." };
  }

  revalidatePath("/kalendarium");
  revalidatePath(`/kalendarium/${meetingId}`);
  return { status: "success" };
}

export async function deleteMeetingAction(
  meetingId: string,
  _state: MeetingDeleteState,
): Promise<MeetingDeleteState> {
  void _state;

  const access = await requireWriteAccess();
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const { error } = await access.supabase.rpc("delete_meeting", {
    p_meeting_id: meetingId,
  });

  if (error) {
    return {
      status: "error",
      message: mapMeetingDeleteError(error),
    };
  }

  revalidatePath("/");
  revalidatePath("/kalendarium");
  revalidatePath(`/kalendarium/${meetingId}`);
  revalidatePath(`/kalendarium/${meetingId}/edytuj`);
  redirect("/kalendarium");
}
