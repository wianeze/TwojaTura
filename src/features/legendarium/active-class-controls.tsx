"use client";

import { useFormStatus } from "react-dom";
import { setActiveClassAction } from "./active-class-actions";

export function ActiveClassControls({
  classKey,
  isActive,
}: {
  classKey: string;
  isActive: boolean;
}) {
  return (
    <div className="mt-2 flex items-center justify-end gap-2">
      {isActive ? (
        <>
          <span className="rounded-full bg-[#e7b65f] px-2.5 py-1 text-[0.66rem] font-bold text-[#3b2118]">
            Aktywna klasa
          </span>
          <ClassActionForm classKey="" label="Usuń wybór" subdued />
        </>
      ) : (
        <ClassActionForm classKey={classKey} label="Ustaw jako aktywną" />
      )}
    </div>
  );
}

function ClassActionForm({
  classKey,
  label,
  subdued = false,
}: {
  classKey: string;
  label: string;
  subdued?: boolean;
}) {
  return (
    <form action={setActiveClassAction}>
      <input type="hidden" name="classKey" value={classKey} />
      <ClassSubmitButton label={label} subdued={subdued} />
    </form>
  );
}

function ClassSubmitButton({
  label,
  subdued,
}: {
  label: string;
  subdued: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-full border px-2.5 py-1 text-[0.66rem] font-bold transition-colors disabled:cursor-wait disabled:opacity-60 ${
        subdued
          ? "border-white/18 bg-black/16 text-[#d8c7b1] hover:bg-black/28"
          : "cta-glow border-[#e2b361]/70 bg-[#8c4e2f] text-[#fff0d5] hover:bg-[#a45c35]"
      }`}
    >
      {pending ? "Zapisuję…" : label}
    </button>
  );
}
