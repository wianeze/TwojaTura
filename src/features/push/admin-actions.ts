"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMemberFromClient } from "@/features/auth/queries/get-current-member";
import {
  dispatchPendingPushDeliveries,
  dispatchPendingPushDeliveriesInBackground,
} from "./server/dispatch";
import { pushDispatchErrorMessage } from "./dispatch-errors";
import { getAdminPushAudienceSummary } from "./queries";
import { validatePushCampaignInput } from "./validation";
import type {
  AdminPushAudienceSummary,
  PushCampaignFormState,
  PushQueueRunResult,
} from "./types";

/**
 * Niezależne od guardu w `(app)/admin/layout.tsx` — Server Action da się
 * wywołać bez renderowania strony, która ją udostępnia. RPC sprawdzają rolę
 * jeszcze raz po stronie bazy; to jest obrona w głąb, nie jedyna bramka.
 */
async function requireAdminAccess() {
  const supabase = await createClient();
  const memberState = await getCurrentMemberFromClient(supabase);

  if (
    memberState.status !== "active-member" ||
    memberState.member.role !== "admin"
  ) {
    return {
      ok: false as const,
      message: "Wymagane uprawnienia administratora.",
    };
  }

  return { ok: true as const, supabase };
}

export async function adminSendPushCampaignAction(
  _state: PushCampaignFormState,
  formData: FormData,
): Promise<PushCampaignFormState> {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const validation = validatePushCampaignInput(formData);
  if (!validation.ok) {
    return {
      status: "error",
      message: validation.message,
      fieldErrors: validation.fieldErrors,
    };
  }

  // Pominięte argumenty oznaczają w SQL null: brak linku, brak szablonu oraz
  // „wszyscy aktywni z aktywnym urządzeniem”.
  const { data, error } = await access.supabase.rpc(
    "admin_create_push_campaign",
    {
      p_title: validation.data.title,
      p_body: validation.data.body,
      p_idempotency_key: validation.data.idempotencyKey,
      p_action_url: validation.data.actionUrl ?? undefined,
      p_template_key: validation.data.templateKey ?? undefined,
      p_recipient_user_ids: validation.data.recipientUserIds ?? undefined,
    },
  );

  if (error) {
    return {
      status: "error",
      message: "Nie udało się utworzyć kampanii powiadomień.",
    };
  }

  const summary = data?.[0];

  // Pierwsza próba wysyłki startuje po odesłaniu odpowiedzi. Jej wynik nie ma
  // prawa zmienić rezultatu tej akcji — kampania jest już zacommitowana.
  after(() => dispatchPendingPushDeliveriesInBackground());

  revalidatePath("/admin/powiadomienia");

  const userCount = summary?.user_count ?? 0;
  const subscriptionCount = summary?.subscription_count ?? 0;

  if (subscriptionCount === 0) {
    return {
      status: "success",
      message:
        "Kampania została utworzona, ale nikt z wybranych odbiorców nie ma aktywnego urządzenia z powiadomieniami.",
    };
  }

  // Świadomie „zakolejkowana”, a nie „wysłana”: w tym momencie nic jeszcze nie
  // zostało dostarczone. Rzeczywisty wynik pokazuje historia kampanii.
  return {
    status: "success",
    message: `Kampania została utworzona i zakolejkowana dla ${userCount} ${userCount === 1 ? "użytkownika" : "użytkowników"} na ${subscriptionCount} ${subscriptionCount === 1 ? "urządzeniu" : "urządzeniach"}.`,
  };
}

export type PushQueueActionResult =
  { ok: true; result: PushQueueRunResult } | { ok: false; message: string };

/**
 * „Ponów oczekujące teraz”.
 *
 * Przesuwa termin wyłącznie dostawom, które i tak czekają w kolejce na kolejną
 * próbę (`queued`, 0 < attempt_count < 5), a potem CZEKA na dispatcher, żeby
 * pokazać realny wynik. To jedyne miejsce, gdzie nie używamy `after()` —
 * administrator klika świadomie i chce zobaczyć liczby, a nie potwierdzenie
 * zakolejkowania.
 *
 * Świadomie nie wznawia `failed`: to stan końcowy (wygasła subskrypcja, błąd
 * trwały albo wyczerpany limit prób).
 *
 * Awaria dispatchera kończy się tu `ok: false`, a nie sukcesem z zerami.
 * „Przetworzono 0” ma znaczyć wyłącznie „kolejka była pusta” — inaczej panel
 * meldowałby poprawne wykonanie akurat wtedy, gdy nic się nie wysłało.
 */
export async function adminRunPushQueueAction(): Promise<PushQueueActionResult> {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  const { data, error } = await access.supabase.rpc(
    "admin_reschedule_pending_push_deliveries",
  );

  if (error) {
    return {
      ok: false,
      message: "Nie udało się ponowić oczekujących wysyłek.",
    };
  }

  let summary;

  try {
    summary = await dispatchPendingPushDeliveries();
  } catch (dispatchError) {
    // Przesunięcie terminów już się zapisało, więc odświeżamy widok mimo
    // awarii — administrator ma zobaczyć aktualne liczniki i komunikat błędu.
    revalidatePath("/admin/powiadomienia");

    return { ok: false, message: pushDispatchErrorMessage(dispatchError) };
  }

  revalidatePath("/admin/powiadomienia");

  return {
    ok: true,
    result: { rescheduled: typeof data === "number" ? data : 0, ...summary },
  };
}

/**
 * Liczniki do zdania w modalu potwierdzenia. Formularz przelicza je przy
 * każdej zmianie wyboru odbiorców, więc muszą być osiągalne z klienta —
 * ale nadal wyłącznie jako liczby, bez listy urządzeń.
 */
export async function getAdminPushAudienceSummaryAction(
  recipientUserIds: string[] | null,
): Promise<AdminPushAudienceSummary> {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return {
      userCount: 0,
      subscriptionCount: 0,
      usersWithoutSubscription: 0,
    };
  }

  return getAdminPushAudienceSummary(recipientUserIds);
}
