"use client";

import { useFormStatus } from "react-dom";
import { useCanWrite } from "@/features/auth/member-role-context";

export function MeetingSubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
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
      className="cta-glow inline-flex rounded-xl bg-[#7d2f3d] px-4 py-3 text-sm font-semibold text-[#fff3ec] shadow-[0_10px_24px_rgba(73,21,31,0.22)] transition-colors hover:bg-[#8d3747] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
