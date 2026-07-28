"use client";

import { useActionState } from "react";
import { useCanWrite } from "@/features/auth/member-role-context";
import type { GameFormState } from "./types";
import { INITIAL_GAME_FORM_STATE } from "./form-state";

export function ArchiveGameButton({
  action,
}: {
  action: (state: GameFormState) => Promise<GameFormState>;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_GAME_FORM_STATE,
  );
  const canWrite = useCanWrite();
  if (!canWrite) return null;

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Zarchiwizować ten egzemplarz? Zniknie z Półki, ale oceny i historia zostaną zachowane.",
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
      className="space-y-2"
    >
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-[#8f3528] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#74271d] disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Archiwizujemy…" : "Archiwizuj egzemplarz"}
      </button>
      {state.message && (
        <p
          role="alert"
          className="rounded-xl bg-[#8f3528]/10 px-4 py-3 text-sm text-[#8f3528]"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
