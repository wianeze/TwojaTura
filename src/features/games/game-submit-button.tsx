"use client";

import { useFormStatus } from "react-dom";
import { useCanWrite } from "@/features/auth/member-role-context";

export function GameSubmitButton({
  children,
  pendingLabel,
  className = "",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
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
      className={`cta-glow bg-brand hover:bg-brand-strong focus-visible:outline-gold rounded-xl px-4 py-3 font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-65 ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
