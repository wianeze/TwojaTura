"use client";

import { useFormStatus } from "react-dom";
import { useCanWrite } from "@/features/auth/member-role-context";

export function PlaySubmitButton({
  label,
  pendingLabel,
  pendingOverride,
}: {
  label: string;
  pendingLabel: string;
  // Create-mode's form uses onSubmit (not a form action), so useFormStatus
  // can't see it as pending — the caller tracks that itself and passes it
  // in explicitly instead.
  pendingOverride?: boolean;
}) {
  const { pending: formPending } = useFormStatus();
  const pending = pendingOverride ?? formPending;
  const canWrite = useCanWrite();

  if (!canWrite) {
    return (
      <p className="text-muted text-xs font-semibold">
        Tryb tylko do odczytu — zapis niedostępny.
      </p>
    );
  }

  return (
    <button
      type="submit"
      disabled={pending}
      className="cta-glow rounded-full bg-[#7d2f3d] px-4 py-2 text-xs font-bold text-[#fff3ec] transition-colors hover:bg-[#8d3747] disabled:cursor-wait disabled:opacity-75"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
