"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ActionButton } from "@/components/ui/action-button";
import { useCanWrite } from "@/features/auth/member-role-context";
import { MEETING_WITH_CHRONICLE_DELETE_ERROR } from "./meeting-deletion";
import type { MeetingDeleteState } from "./types";

const INITIAL_STATE: MeetingDeleteState = { status: "idle" };

function DeleteMeetingSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <ActionButton
      type="submit"
      action="danger"
      size="compact"
      disabled={disabled || pending}
      loading={pending}
      loadingLabel="Usuwanie..."
    >
      Usuń spotkanie
    </ActionButton>
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
    // Na smartfonie usuwanie zajmuje własny wiersz nad pozostałymi akcjami
    // (order-first + w-full) i trzyma się prawej krawędzi. Od sm: wraca do
    // wspólnego rzędu, wciąż dosunięte do prawej.
    <div className="order-first flex w-full flex-col items-end sm:order-none sm:ml-auto sm:w-auto sm:max-w-sm">
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
