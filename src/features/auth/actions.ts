"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildAppUrl } from "@/lib/app-url";
import { recordAuditEventSafely } from "@/lib/analytics/server";
import type { FormState } from "./form-state";
import {
  isSamePasswordError,
  resolvePasswordUpdateRedirectTarget,
} from "./password-update-flow";
import { getCurrentMemberFromClient } from "./queries/get-current-member";
import { getSafeAuthErrorInfo } from "./recovery-session";
import { getSafeInternalPath } from "./safe-redirect";
import { validatePasswordChange, validateProfileInput } from "./validation";

function value(formData: FormData, key: string) {
  const field = formData.get(key);
  return typeof field === "string" ? field : "";
}

export async function loginAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = value(formData, "email").trim();
  const password = value(formData, "password");

  if (!email || !password) {
    return { status: "error", message: "Podaj email i hasło." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      status: "error",
      message: "Nie udało się zalogować. Sprawdź email i hasło.",
    };
  }

  const memberState = await getCurrentMemberFromClient(supabase);
  if (memberState.status === "active-member") {
    await recordAuditEventSafely(supabase, {
      eventType: "auth.login.success",
      status: "success",
      routeKey: "login",
      requestId: crypto.randomUUID(),
    });
  }
  revalidatePath("/", "layout");
  redirect(memberState.status === "active-member" ? "/" : "/brak-dostepu");
}

export async function requestPasswordResetAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = value(formData, "email").trim();
  if (!email) {
    return { status: "error", message: "Podaj adres email." };
  }

  const supabase = await createClient();

  // Points at the neutral, passive-GET confirmation page — never directly
  // at /auth/callback, whose GET used to consume the one-time token itself
  // (vulnerable to mailbox link-prefetching/scanning). The production
  // Supabase "Reset password" template builds its own link from
  // {{ .SiteURL }} rather than {{ .RedirectTo }}, so this value mainly
  // keeps resetPasswordForEmail's required redirect-URL allow-list check
  // happy and matches local dev's recovery.html.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: buildAppUrl("/potwierdz-reset").toString(),
  });

  return {
    status: "success",
    message:
      "Jeśli konto istnieje, wysłaliśmy wiadomość z dalszymi instrukcjami.",
  };
}

export async function confirmPasswordRecoveryAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const tokenHash = value(formData, "token_hash");
  const next = getSafeInternalPath(value(formData, "next"), "/ustaw-haslo");

  if (!tokenHash) {
    return {
      status: "error",
      message: "Link jest nieprawidłowy. Poproś o nową wiadomość.",
    };
  }

  const supabase = await createClient();
  // type is hardcoded here, never taken from the client — this action only
  // ever confirms a password-recovery link (invite keeps using the
  // separate, untouched /auth/callback token_hash flow).
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  if (error) {
    const info = getSafeAuthErrorInfo(error);
    return {
      status: "error",
      message:
        info.code === "otp_expired"
          ? "Link wygasł lub został już użyty. Poproś o nową wiadomość."
          : "Nie udało się potwierdzić linku. Spróbuj ponownie lub poproś o nową wiadomość.",
    };
  }

  // Success: verifyOtp already wrote the session to cookies via the
  // server-side client — no extra sign-out, refresh, or session call here.
  // Marks the destination as reached via the recovery flow specifically
  // (invite reaches /ustaw-haslo through the separate /auth/callback path
  // and never carries this marker) so updatePasswordAction knows to send a
  // successful recovery back to /logowanie instead of straight into the app.
  redirect(
    next.includes("?") ? `${next}&flow=recovery` : `${next}?flow=recovery`,
  );
}

export async function updatePasswordAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validatePasswordChange(
    value(formData, "password"),
    value(formData, "passwordConfirmation"),
  );
  if (!validation.ok) {
    return { status: "error", message: validation.error };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims) {
    return {
      status: "error",
      message: "Link wygasł lub jest nieprawidłowy. Poproś o nową wiadomość.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: validation.data.password,
  });

  if (error) {
    const info = getSafeAuthErrorInfo(error);
    if (isSamePasswordError(info)) {
      return {
        status: "error",
        code: "same_password",
        message:
          "To hasło jest już ustawione. Możesz się nim zalogować albo wybrać inne.",
      };
    }
    return {
      status: "error",
      message: "Nie udało się ustawić hasła. Spróbuj ponownie.",
    };
  }

  // Only the recovery flow (see confirmPasswordRecoveryAction) marks the
  // form with flow=recovery — invite reaches this same action/page without
  // it and keeps its existing behavior (straight into the app) untouched.
  const flow = value(formData, "flow");
  const isActiveMember =
    flow === "recovery"
      ? false // unused by resolvePasswordUpdateRedirectTarget for recovery
      : (await getCurrentMemberFromClient(supabase)).status === "active-member";
  revalidatePath("/", "layout");
  await recordAuditEventSafely(supabase, {
    eventType: "auth.password.changed",
    status: "success",
    routeKey: "password",
    requestId: crypto.randomUUID(),
  });
  redirect(resolvePasswordUpdateRedirectTarget(flow, isActiveMember));
}

export async function updateProfileAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const validation = validateProfileInput(
    value(formData, "displayName"),
    value(formData, "avatarUrl"),
  );
  if (!validation.ok) {
    return { status: "error", message: validation.error };
  }

  const supabase = await createClient();
  const memberState = await getCurrentMemberFromClient(supabase);
  if (memberState.status !== "active-member") {
    return { status: "error", message: "Sesja wygasła. Zaloguj się ponownie." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: validation.data.displayName,
      avatar_url: validation.data.avatarUrl,
    })
    .eq("id", memberState.member.id);

  if (error) {
    return { status: "error", message: "Nie udało się zapisać profilu." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/profil");
  return { status: "success", message: "Karta Gracza została zapisana." };
}

export async function signOutAction() {
  const supabase = await createClient();
  await recordAuditEventSafely(supabase, {
    eventType: "auth.logout",
    status: "success",
    routeKey: "profile",
    requestId: crypto.randomUUID(),
  });
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/logowanie");
}
