"use client";

import { useFormStatus } from "react-dom";

export function AuthSubmitButton({
  children,
  pendingLabel,
  glow = false,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  glow?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`bg-brand hover:bg-brand-strong focus-visible:outline-gold w-full rounded-xl px-4 py-3 font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-65 ${glow ? "cta-glow" : ""}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
