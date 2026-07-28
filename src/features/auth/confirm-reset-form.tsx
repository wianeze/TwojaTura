"use client";

import { useActionState, useEffect } from "react";
import { confirmPasswordRecoveryAction } from "./actions";
import { AuthSubmitButton } from "./auth-submit-button";
import { INITIAL_FORM_STATE } from "./form-state";

/**
 * Deliberately passive on GET — this component only renders a form; the
 * token is never sent anywhere until the visitor clicks the button, which
 * is what actually triggers confirmPasswordRecoveryAction's server-side
 * verifyOtp. No auto-submit, no delay/disable timers: a real click (or
 * Enter within the form) is the only way this ever POSTs.
 */
export function ConfirmResetForm({
  tokenHash,
  next,
}: {
  tokenHash: string;
  next: string;
}) {
  const [state, formAction] = useActionState(
    confirmPasswordRecoveryAction,
    INITIAL_FORM_STATE,
  );

  useEffect(() => {
    // Strips the token from the visible URL right after hydration. The
    // token itself is never re-read from the URL again after this —  it
    // only lives in the tokenHash prop captured above (server-rendered
    // once) and the hidden input below, never in storage or logs.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <form action={formAction} className="mt-7 space-y-4">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="next" value={next} />
      {state.message && (
        <p
          role="alert"
          className="rounded-xl bg-[#8f3528]/10 px-4 py-3 text-sm text-[#8f3528]"
        >
          {state.message}
        </p>
      )}
      <AuthSubmitButton pendingLabel="Potwierdzamy…">
        Ustaw nowe hasło
      </AuthSubmitButton>
    </form>
  );
}
