"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentMemberFromClient } from "@/features/auth/queries/get-current-member";
import { FEEDBACK_MAX_LENGTH } from "./constants";
import type { FeedbackFormState } from "./form-state";

const COOLDOWN_ERROR_CODE = "P0003";

export async function submitFeedbackAction(
  _state: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const rawContent = formData.get("content");
  const content = typeof rawContent === "string" ? rawContent.trim() : "";

  if (!content) {
    return {
      status: "error",
      message: "Treść zgłoszenia nie może być pusta.",
    };
  }

  if (content.length > FEEDBACK_MAX_LENGTH) {
    return {
      status: "error",
      message: `Zgłoszenie może mieć maksymalnie ${FEEDBACK_MAX_LENGTH} znaków.`,
    };
  }

  const supabase = await createClient();
  const memberState = await getCurrentMemberFromClient(supabase);

  if (memberState.status !== "active-member") {
    return {
      status: "error",
      message: "Wymagane aktywne członkostwo.",
    };
  }

  const { error } = await supabase
    .from("feedback_submissions")
    .insert({ content });

  if (error) {
    if (error.code === COOLDOWN_ERROR_CODE) {
      return {
        status: "error",
        message: "Kolejne zgłoszenie możesz wysłać za chwilę.",
      };
    }
    return {
      status: "error",
      message: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie.",
    };
  }

  return {
    status: "success",
    message: "Dzięki! Zgłoszenie trafiło do administratora.",
  };
}
