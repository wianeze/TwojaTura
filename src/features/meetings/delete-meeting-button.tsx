"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ActionButton } from "@/components/ui/action-button";
import { useCanWrite } from "@/features/auth/member-role-context";
import {
  getMeetingChronicleLockMessage,
  type MeetingChronicleLock,
} from "./meeting-deletion";
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
  chronicleLock,
}: {
  action: (state: MeetingDeleteState) => Promise<MeetingDeleteState>;
  // null = spotkanie nie należy do historii żadnej partii i da się je usunąć.
  chronicleLock: MeetingChronicleLock | null;
}) {
  const canWrite = useCanWrite();
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  if (!canWrite) return null;

  return (
    // Slot środkowy stałego, 3-kolumnowego paska akcji (Wróć / Usuń / Edytuj)
    // — pozycję ustala rodzic (justify-self-center), więc przycisk trzyma się
    // własnej, naturalnej szerokości zamiast rozciągać się na cały wiersz.
    <div className="flex flex-col items-center">
      <form
        action={formAction}
        onSubmit={(event) => {
          if (
            !chronicleLock &&
            !window.confirm(
              "Usunąć spotkanie? Cofniemy powiązaną Renomę za RSVP i głosy.",
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <DeleteMeetingSubmitButton disabled={Boolean(chronicleLock)} />
      </form>

      {chronicleLock ? (
        <p className="mt-1.5 max-w-[14rem] text-center text-xs leading-5 text-[#8a433a]">
          {getMeetingChronicleLockMessage(chronicleLock)}
        </p>
      ) : state.status === "error" && state.message ? (
        <p className="mt-1.5 max-w-[14rem] text-center text-xs leading-5 text-[#8a433a]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
