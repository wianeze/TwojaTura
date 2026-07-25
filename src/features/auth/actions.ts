"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildAppUrl } from "@/lib/app-url";
import type { FormState } from "./form-state";
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
    console.error("[auth/potwierdz-reset] verifyOtp failed:", info);
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
  redirect(next);
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
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  // Diagnostic only — no password/email/user_id/token/cookie/JWT/session
  // data, just enough to see whether a session was found at each stage.
  console.info("[auth/ustaw-haslo] getClaims:", {
    stage: "getClaims",
    hasUser: Boolean(claimsData?.claims),
    error: claimsError ? getSafeAuthErrorInfo(claimsError) : null,
  });

  if (!claimsData?.claims) {
    return {
      status: "error",
      message: "Link wygasł lub jest nieprawidłowy. Poproś o nową wiadomość.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: validation.data.password,
  });

  console.info("[auth/ustaw-haslo] updateUser:", {
    stage: "updateUser",
    hasUser: true,
    error: error ? getSafeAuthErrorInfo(error) : null,
  });

  if (error) {
    const info = getSafeAuthErrorInfo(error);
    // Temporary, safe-only detail (code/status, nothing else) to help
    // diagnose the production "updateUser fails after a working recovery
    // redirect" report.
    return {
      status: "error",
      message: `Nie udało się ustawić hasła (Auth ${info.status ?? "?"}: ${info.code ?? info.name ?? "unknown_error"}).`,
    };
  }

  const memberState = await getCurrentMemberFromClient(supabase);
  revalidatePath("/", "layout");
  redirect(memberState.status === "active-member" ? "/" : "/brak-dostepu");
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
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/logowanie");
}
