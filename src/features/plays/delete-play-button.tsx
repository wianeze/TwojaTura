"use client";

import { useFormStatus } from "react-dom";

function DeletePlaySubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full border border-[#b9876a]/40 bg-white/70 px-4 py-2 text-xs font-bold text-[#8a433a] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Usuwanie..." : "Usuń"}
    </button>
  );
}

export function DeletePlayButton({ action }: { action: () => Promise<void> }) {
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
