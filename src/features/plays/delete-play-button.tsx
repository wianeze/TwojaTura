"use client";

import { useFormStatus } from "react-dom";
import { ActionButton } from "@/components/ui/action-button";
import { useCanWrite } from "@/features/auth/member-role-context";

function DeletePlaySubmitButton() {
  const { pending } = useFormStatus();

  return (
    <ActionButton
      type="submit"
      action="danger"
      size="compact"
      disabled={pending}
      loading={pending}
      loadingLabel="Usuwanie..."
    >
      Usuń
    </ActionButton>
  );
}

export function DeletePlayButton({ action }: { action: () => Promise<void> }) {
  const canWrite = useCanWrite();
  if (!canWrite) return null;

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Usunąć wpis z Kroniki? Tej operacji nie można cofnąć.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <DeletePlaySubmitButton />
    </form>
  );
}
