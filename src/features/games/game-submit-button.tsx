"use client";

import { useFormStatus } from "react-dom";

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

  return (
    <button
      type="submit"
      disabled={pending}
      className={`bg-brand hover:bg-brand-strong focus-visible:outline-gold rounded-xl px-4 py-3 font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-65 ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
