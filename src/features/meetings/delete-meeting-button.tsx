"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useCanWrite } from "@/features/auth/member-role-context";
import { MEETING_WITH_CHRONICLE_DELETE_ERROR } from "./meeting-deletion";
import type { MeetingDeleteState } from "./types";

const INITIAL_STATE: MeetingDeleteState = { status: "idle" };

function DeleteMeetingSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-full border border-[#b9876a]/45 bg-white/70 px-4 py-2 text-xs font-bold text-[#8a433a] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-55"
    >
      {pending ? "Usuwanie..." : "Usuń spotkanie"}
    </button>
  );
}

export function DeleteMeetingButton({
  action,
  hasChroniclePlay,
}: {
  action: (state: MeetingDeleteState) => Promise<MeetingDeleteState>;
  hasChroniclePlay: boolean;
}) {
  const canWrite = useCanWrite();
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  if (!canWrite) return null;

  return (
    <div className="max-w-sm">
      <form
        action={formAction}
        onSubmit={(event) => {
          if (
            !hasChroniclePlay &&
            !window.confirm(
              "Usunąć spotkanie? Cofniemy punkty za utworzenie, RSVP i głosy.",
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <DeleteMeetingSubmitButton disabled={hasChroniclePlay} />
      </form>

      {hasChroniclePlay ? (
        <p className="mt-1.5 text-xs leading-5 text-[#8a433a]">
          {MEETING_WITH_CHRONICLE_DELETE_ERROR}
        </p>
      ) : state.status === "error" && state.message ? (
        <p className="mt-1.5 text-xs leading-5 text-[#8a433a]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
