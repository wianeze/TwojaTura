"use client";

import { useFormStatus } from "react-dom";

export function PlaySubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-[#7d2f3d] px-4 py-2 text-xs font-bold text-[#fff3ec] transition-colors hover:bg-[#8d3747] disabled:cursor-wait disabled:opacity-75"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
