"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildAuthCallbackUrl } from "@/lib/app-url";
import type { FormState } from "./form-state";
import { getCurrentMemberFromClient } from "./queries/get-current-member";
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

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: buildAuthCallbackUrl("/ustaw-haslo"),
  });

  return {
    status: "success",
    message:
      "Jeśli konto istnieje, wysłaliśmy wiadomość z dalszymi instrukcjami.",
  };
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
    return {
      status: "error",
      message: "Nie udało się ustawić hasła. Spróbuj ponownie.",
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
