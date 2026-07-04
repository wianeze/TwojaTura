"use client";

import { useActionState, useState } from "react";
import { loginAction, requestPasswordResetAction } from "./actions";
import { AuthSubmitButton } from "./auth-submit-button";
import { INITIAL_FORM_STATE } from "./form-state";

const inputClass =
  "bg-background/80 focus:border-gold focus:ring-gold/20 mt-1.5 h-12 w-full rounded-xl border border-[#9a7657]/35 px-4 outline-none transition focus:ring-4";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [loginState, loginFormAction] = useActionState(
    loginAction,
    INITIAL_FORM_STATE,
  );
  const [recoveryState, recoveryFormAction] = useActionState(
    requestPasswordResetAction,
    INITIAL_FORM_STATE,
  );
  const state = recoveryMode ? recoveryState : loginState;
  const message = state.message ?? (!recoveryMode ? initialError : undefined);

  return (
    <>
      <form
        action={recoveryMode ? recoveryFormAction : loginFormAction}
        className="mt-7 space-y-4"
      >
        <label className="block text-sm font-semibold">
          Email
          <input
            className={inputClass}
            type="email"
            name="email"
            autoComplete="email"
            required
          />
        </label>
        {!recoveryMode && (
          <label className="block text-sm font-semibold">
            Hasło
            <input
              className={inputClass}
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
        )}
        {message && (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={`rounded-xl px-4 py-3 text-sm ${state.status === "error" ? "bg-[#8f3528]/10 text-[#8f3528]" : "bg-moss/12 text-moss"}`}
          >
            {message}
          </p>
        )}
        <AuthSubmitButton
          pendingLabel={recoveryMode ? "Wysyłamy…" : "Wchodzisz do Chaty…"}
        >
          {recoveryMode ? "Wyślij instrukcje" : "Zaloguj się"}
        </AuthSubmitButton>
      </form>
      <button
        type="button"
        onClick={() => setRecoveryMode((current) => !current)}
        className="text-accent focus-visible:outline-gold mx-auto mt-5 block text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2"
      >
        {recoveryMode ? "Wróć do logowania" : "Nie pamiętasz hasła?"}
      </button>
    </>
  );
}
