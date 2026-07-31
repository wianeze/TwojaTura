"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentMemberFromClient } from "@/features/auth/queries/get-current-member";
import type { PushSubscriptionActionResult } from "./types";

/**
 * Subskrypcję zapisuje sam użytkownik dla własnego urządzenia. Zapis idzie
 * przez security definer RPC, bo `push_subscriptions` nie ma polityk zapisu:
 * user_id bierze się zawsze z `auth.uid()`, nigdy z payloadu.
 */
async function requireActiveMember() {
  const supabase = await createClient();
  const memberState = await getCurrentMemberFromClient(supabase);

  if (memberState.status !== "active-member") {
    return {
      ok: false as const,
      message: "Musisz być zalogowany, aby zmienić ustawienia powiadomień.",
    };
  }

  return { ok: true as const, supabase };
}

export async function savePushSubscriptionAction(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
}): Promise<PushSubscriptionActionResult> {
  const access = await requireActiveMember();
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  const { error } = await access.supabase.rpc("save_push_subscription", {
    p_endpoint: input.endpoint,
    p_p256dh: input.p256dh,
    p_auth: input.auth,
    p_user_agent: input.userAgent ?? undefined,
  });

  if (error) {
    // Endpoint należy do innego konta, a podane klucze się nie zgadzają.
    // Kontrolka reaguje na to jednorazową ponowną subskrypcją — dostawca
    // wyda wtedy nowy endpoint.
    if (error.code === "P0004") {
      return {
        ok: false,
        code: "endpoint_taken",
        message:
          "To urządzenie ma subskrypcję przypisaną do innego konta. Odświeżamy ją.",
      };
    }

    return {
      ok: false,
      message: "Nie udało się zapisać powiadomień na tym urządzeniu.",
    };
  }

  return { ok: true, state: "enabled" };
}

export async function disablePushSubscriptionAction(
  endpoint: string,
): Promise<PushSubscriptionActionResult> {
  const access = await requireActiveMember();
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  const { error } = await access.supabase.rpc("disable_push_subscription", {
    p_endpoint: endpoint,
  });

  if (error) {
    return {
      ok: false,
      message: "Nie udało się wyłączyć powiadomień na tym urządzeniu.",
    };
  }

  return { ok: true, state: "disabled" };
}

/**
 * Kontrolka poznaje endpoint dopiero w przeglądarce, więc o stan pyta po
 * zamontowaniu. Zwracamy sam fakt włączenia — nigdy kluczy subskrypcji.
 */
export async function getPushSubscriptionStateAction(
  endpoint: string,
): Promise<{ isRegistered: boolean; isEnabled: boolean }> {
  const access = await requireActiveMember();
  if (!access.ok) {
    return { isRegistered: false, isEnabled: false };
  }

  const { data, error } = await access.supabase.rpc(
    "get_own_push_subscription",
    { p_endpoint: endpoint },
  );

  const row = data?.[0];

  if (error || !row) {
    return { isRegistered: false, isEnabled: false };
  }

  return { isRegistered: true, isEnabled: row.is_enabled };
}
