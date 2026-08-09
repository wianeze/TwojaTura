"use client";

import { useActionState } from "react";
import type { CurrentMember } from "./types";
import { updateProfileAction } from "./actions";
import { AuthSubmitButton } from "./auth-submit-button";
import { INITIAL_FORM_STATE } from "./form-state";

export function ProfileForm({ member }: { member: CurrentMember }) {
  const [state, formAction] = useActionState(
    updateProfileAction,
    INITIAL_FORM_STATE,
  );
  const inputClass =
    "bg-background/75 focus:border-gold focus:ring-gold/20 mt-1.5 h-11 w-full min-w-0 rounded-xl border border-[#9a7657]/35 px-3 text-sm outline-none transition focus:ring-4 disabled:opacity-65 sm:h-12 sm:px-4";

  return (
    <form action={formAction} className="mt-5 space-y-3 sm:mt-7 sm:space-y-4">
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2 sm:gap-4">
        <label className="block min-w-0 text-xs font-semibold sm:text-sm">
          <span className="block">Nazwa gracza</span>
          <input
            className={inputClass}
            name="displayName"
            defaultValue={member.displayName}
            maxLength={80}
            required
          />
        </label>
        <label className="block min-w-0 text-xs font-semibold sm:text-sm">
          <span className="block">Rola</span>
          <input
            className={inputClass}
            value={member.role === "admin" ? "Administrator" : "Gracz"}
            readOnly
            disabled
          />
        </label>
      </div>
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2 sm:gap-4">
        <label className="flex min-w-0 flex-col text-xs font-semibold sm:text-sm">
          <span className="flex min-h-8 items-end sm:min-h-0">Email</span>
          <input
            className={inputClass}
            type="email"
            value={member.email}
            readOnly
            disabled
          />
        </label>
        <label className="flex min-w-0 flex-col text-xs font-semibold sm:text-sm">
          <span className="min-h-8 leading-4 sm:min-h-0 sm:leading-normal">
            <span className="sm:hidden">URL avatara</span>
            <span className="hidden sm:inline">
              Adres URL avatara{" "}
              <span className="text-muted font-normal">(opcjonalnie)</span>
            </span>
          </span>
          <input
            className={inputClass}
            type="url"
            name="avatarUrl"
            defaultValue={member.avatarUrl ?? ""}
            placeholder="https://…"
          />
        </label>
      </div>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-xl px-4 py-3 text-sm ${state.status === "error" ? "bg-[#8f3528]/10 text-[#8f3528]" : "bg-moss/12 text-moss"}`}
        >
          {state.message}
        </p>
      )}
      <AuthSubmitButton pendingLabel="Zapisujemy…" glow>
        Zapisz Kartę Gracza
      </AuthSubmitButton>
    </form>
  );
}
