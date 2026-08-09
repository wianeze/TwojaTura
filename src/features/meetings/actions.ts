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
import { enqueueMeetingConfirmationReminderAfterRsvp } from "./meeting-confirmation-reminder";
import type {
  MeetingAvailabilityFormState,
  MeetingDeleteState,
  MeetingFormState,
  MeetingTableSessionState,
  MeetingVoteState,
} from "./types";
import { toMeetingFormErrorState, validateMeetingFormData } from "./validation";

type DatabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

function mapMeetingDatabaseError(error: DatabaseErrorLike) {
  // Kontynuacja dzieli kody błędów z resztą walidacji spotkania (23514 dla
  // reguły, 23503 dla brakującego wiersza), więc rozpoznajemy ją po treści —
  // inaczej użytkownik zobaczyłby komunikat o godzinach zakończenia.
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("continued play does not exist")) {
    return "Wybrana partia nie jest już dostępna. Odśwież stronę i wybierz ponownie.";
  }

  if (message.includes("play in progress can be continued")) {
    return "Kontynuować można wyłącznie partię w toku. Ta jest już zakończona.";
  }

  if (message.includes("running live at the table")) {
    return "Ta partia jest właśnie grana przy stole. Najpierw zapisz jej wynik.";
  }

  if (message.includes("cannot continue a play that already starts at it")) {
    return "To spotkanie jest początkiem tej partii — nie może być własną kontynuacją.";
  }

  switch (error.code) {
    case "42501":
      return "Nie masz uprawnień do tej operacji.";
    case "23503":
      // RPC-owe "spotkanie nie istnieje" — z perspektywy formularza
      // nieodróżnialne od braku uprawnień (RLS dawało dawniej ten sam
      // efekt: zero wierszy), więc zostaje ten sam komunikat co 42501.
      return "Nie udało się zapisać tego spotkania. Być może nie masz do niego uprawnień.";
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

  const { data: meetingId, error } = await access.supabase.rpc(
    "create_meeting_with_invitations",
    {
      p_title: validation.data.title,
      // Kolumny są nullable, ale RPC (jak każda funkcja Postgresa) nie ma
      // sposobu wyrazić "opcjonalny, ale przyjmuje null" w wygenerowanych
      // typach — parametr jest tam `string?`, czyli `string | undefined`, nie
      // `string | null`. ?? undefined nie zmienia zachowania (RPC ma
      // `default null`), tylko dogaduje się z tym typem.
      p_description: validation.data.description ?? undefined,
      p_location: validation.data.location ?? undefined,
      p_starts_at: validation.data.startsAt,
      p_ends_at: validation.data.endsAt,
      p_invited_user_ids: validation.data.invitedUserIds,
      p_continued_play_id: validation.data.continuedPlayId ?? undefined,
    },
  );

  if (error || !meetingId) {
    return {
      status: "error",
      message: mapMeetingDatabaseError(error ?? {}),
    };
  }

  const pointAward = await awardMeetingCreatedPointsAfterSave(true, () =>
    access.supabase.rpc("award_meeting_created_points", {
      p_meeting_id: meetingId,
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

  // Kampania dla zaproszonych (jeśli ktoś został zaproszony) jest już
  // w outboxie — zapisało ją RPC create_meeting_with_invitations w tej samej
  // transakcji co spotkanie i zaproszenia. Tu zostaje tylko pierwsza próba
  // wysyłki, uruchamiana po odesłaniu odpowiedzi: wariant „in background” nie
  // rzuca, więc jego niepowodzenie nie może zmienić wyniku tej akcji ani
  // cofnąć spotkania — zostawia za to kod błędu w logu. Nieudane dostawy
  // czekają w kolejce na crona albo na przycisk w panelu administratora.
  after(() => dispatchPendingPushDeliveriesInBackground());

  redirect(`/kalendarium/${meetingId}`);
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

  const { data, error } = await access.supabase.rpc(
    "update_meeting_with_invitations",
    {
      p_meeting_id: meetingId,
      p_title: validation.data.title,
      p_description: validation.data.description ?? undefined,
      p_location: validation.data.location ?? undefined,
      p_starts_at: validation.data.startsAt,
      p_ends_at: validation.data.endsAt,
      p_invited_user_ids: validation.data.invitedUserIds,
      // Brak wyboru = wyzerowanie wskaźnika (RPC ma `default null`), czyli
      // odznaczenie kontynuacji jest zwykłą edycją spotkania.
      p_continued_play_id: validation.data.continuedPlayId ?? undefined,
    },
  );

  if (error || !data) {
    return { status: "error", message: mapMeetingDatabaseError(error ?? {}) };
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

  const confirmationReminder =
    await enqueueMeetingConfirmationReminderAfterRsvp(
      () =>
        // Typ RPC pojawi się w database.generated.ts po zastosowaniu migracji.
        // Lokalny CLI jest obecnie blokowany przez dostęp do Dockera, więc ten
        // wąski cast utrzymuje build bez ręcznej edycji wygenerowanego pliku.
        access.supabase.rpc(
          "enqueue_meeting_confirmation_reminder" as never,
          { p_meeting_id: meetingId } as never,
        ) as unknown as PromiseLike<{
          data: boolean | null;
          error: { code?: string | null; message?: string | null } | null;
        }>,
    );

  if (confirmationReminder.queued) {
    after(() => dispatchPendingPushDeliveriesInBackground());
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

/*
 * Stan „GRAMY!”. Obie akcje są cienkimi opakowaniami RPC — cała logika
 * (idempotencja, „jedna aktywna partia na spotkanie”, uprawnienia) siedzi w
 * bazie, tak jak reszta reguł domenowych tego projektu.
 *
 * Zakończenie partii NIE ma tu własnej akcji: korzysta z istniejącego
 * updatePlayAction i istniejącego formularza Kroniki, więc wynik, punkty i
 * odznaki liczą się dokładnie jedną, sprawdzoną ścieżką.
 */

function mapTableSessionError(error: DatabaseErrorLike) {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("finish the running play")) {
    return "Najpierw zakończ trwającą partię — dopiero potem można zamknąć wieczór albo zacząć kolejną grę.";
  }

  if (message.includes("meeting is already finished")) {
    return "To spotkanie zostało już zakończone. Odśwież Stół.";
  }

  if (message.includes("participant of this meeting")) {
    return "Partiami tego wieczoru sterują jego uczestnicy. Poproś kogoś ze stołu albo odśwież Stół.";
  }

  if (message.includes("already running at another meeting")) {
    return "Ta partia jest właśnie grana na innym spotkaniu.";
  }

  if (message.includes("already continues another play")) {
    return "Na tym spotkaniu wracacie już do innej odłożonej partii.";
  }

  if (message.includes("paused play in progress can be resumed")) {
    return "Tej partii nie da się wznowić — jest już rozliczona albo czeka tylko na wynik.";
  }

  if (message.includes("running at the table can be cancelled")) {
    return "Anulować można wyłącznie partię, która właśnie trwa.";
  }

  if (message.includes("earlier sessions cannot be cancelled")) {
    return "Ta partia ma już wcześniejsze sesje — zamiast anulować, odłóż ją albo zakończ.";
  }

  switch (error.code) {
    case "42501":
      return "Nie masz uprawnień do tej operacji.";
    case "23503":
      return "Spotkanie, partia albo gra nie są już dostępne. Odśwież Stół.";
    default:
      return "Nie udało się wykonać tej operacji. Spróbuj ponownie.";
  }
}

function revalidateTableSession(meetingId: string) {
  revalidatePath("/");
  revalidatePath("/kalendarium");
  revalidatePath(`/kalendarium/${meetingId}`);
  revalidatePath("/kronika");
}

export async function startMeetingPlayAction(
  meetingId: string,
  gameId: string,
): Promise<MeetingTableSessionState> {
  const access = await requireWriteAccess();
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  // RPC jest idempotentne: powtórzone kliknięcie dostaje id już biegnącej
  // partii, więc podwójny submit nie tworzy drugiej rozgrywki.
  const { data, error } = await access.supabase.rpc("start_meeting_play", {
    p_meeting_id: meetingId,
    p_game_id: gameId,
  });

  if (error || !data) {
    return { status: "error", message: mapTableSessionError(error ?? {}) };
  }

  revalidateTableSession(meetingId);
  return { status: "success", playId: data };
}

/**
 * Wznowienie odłożonej rozgrywki na tym wieczorze. Korzysta z istniejącego
 * mechanizmu kontynuacji (meetings.continued_play_id), więc partia zostaje
 * JEDNYM wpisem Kroniki, a jej wcześniejsze sesje i czas nie znikają.
 */
export async function resumeMeetingPlayAction(
  meetingId: string,
  playId: string,
): Promise<MeetingTableSessionState> {
  const access = await requireWriteAccess();
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const { data, error } = await access.supabase.rpc("resume_meeting_play", {
    p_meeting_id: meetingId,
    p_play_id: playId,
  });

  if (error || !data) {
    return { status: "error", message: mapTableSessionError(error ?? {}) };
  }

  revalidateTableSession(meetingId);
  return { status: "success", playId: data };
}

/**
 * „Zakończ partię” i „Odłóż partię”. Obie zatrzymują zegar i dopisują minuty do
 * łącznego czasu rozgrywki; różni je tylko to, czy partia czeka teraz na wynik,
 * czy na kolejną sesję. Żadna z nich NIE prowadzi do formularza Kroniki i żadna
 * nie nalicza nagród.
 */
export async function finishMeetingPlayAction(
  meetingId: string,
  playId: string,
  options: { keepForLater?: boolean; stateNote?: string } = {},
): Promise<MeetingTableSessionState> {
  const access = await requireWriteAccess();
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const { data, error } = await access.supabase.rpc("finish_meeting_play", {
    p_play_id: playId,
    p_result_pending: !options.keepForLater,
    ...(options.stateNote ? { p_state_note: options.stateNote } : {}),
  });

  if (error || !data) {
    return { status: "error", message: mapTableSessionError(error ?? {}) };
  }

  revalidateTableSession(meetingId);
  return { status: "success", playId: data };
}

/**
 * „Anuluj start” — pomyłkowo wybrana gra. Partia znika bez śladu, więc nie
 * trafia do Kroniki, statystyk ani nagród.
 */
export async function cancelMeetingPlayAction(
  meetingId: string,
  playId: string,
): Promise<MeetingTableSessionState> {
  const access = await requireWriteAccess();
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const { error } = await access.supabase.rpc("cancel_meeting_play", {
    p_play_id: playId,
  });

  if (error) {
    return { status: "error", message: mapTableSessionError(error) };
  }

  revalidateTableSession(meetingId);
  return { status: "success" };
}

export async function finishMeetingAction(
  meetingId: string,
): Promise<MeetingTableSessionState> {
  const access = await requireWriteAccess();
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const { error } = await access.supabase.rpc("complete_meeting", {
    p_meeting_id: meetingId,
  });

  if (error) {
    return { status: "error", message: mapTableSessionError(error) };
  }

  revalidateTableSession(meetingId);
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
