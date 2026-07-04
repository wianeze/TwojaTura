"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "./actions";
import { AuthSubmitButton } from "./auth-submit-button";
import { INITIAL_FORM_STATE } from "./form-state";

export function SetPasswordForm() {
  const [state, formAction] = useActionState(
    updatePasswordAction,
    INITIAL_FORM_STATE,
  );
  const inputClass =
    "bg-background/80 focus:border-gold focus:ring-gold/20 mt-1.5 h-12 w-full rounded-xl border border-[#9a7657]/35 px-4 outline-none transition focus:ring-4";

  return (
    <form action={formAction} className="mt-7 space-y-4">
      <label className="block text-sm font-semibold">
        Nowe hasło
        <input
          className={inputClass}
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <label className="block text-sm font-semibold">
        Powtórz hasło
        <input
          className={inputClass}
          type="password"
          name="passwordConfirmation"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      {state.message && (
        <p
          role="alert"
          className="rounded-xl bg-[#8f3528]/10 px-4 py-3 text-sm text-[#8f3528]"
        >
          {state.message}
        </p>
      )}
      <AuthSubmitButton pendingLabel="Zapisujemy…">
        Ustaw nowe hasło
      </AuthSubmitButton>
    </form>
  );
}
