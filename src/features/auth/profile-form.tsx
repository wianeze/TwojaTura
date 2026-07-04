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
    "bg-background/75 focus:border-gold focus:ring-gold/20 mt-1.5 h-12 w-full rounded-xl border border-[#9a7657]/35 px-4 outline-none transition focus:ring-4 disabled:opacity-65";

  return (
    <form action={formAction} className="mt-7 space-y-4">
      <label className="block text-sm font-semibold">
        Nazwa gracza
        <input
          className={inputClass}
          name="displayName"
          defaultValue={member.displayName}
          maxLength={80}
          required
        />
      </label>
      <label className="block text-sm font-semibold">
        Email
        <input
          className={inputClass}
          type="email"
          value={member.email}
          readOnly
          disabled
        />
      </label>
      <label className="block text-sm font-semibold">
        Adres URL avatara{" "}
        <span className="text-muted font-normal">(opcjonalnie)</span>
        <input
          className={inputClass}
          type="url"
          name="avatarUrl"
          defaultValue={member.avatarUrl ?? ""}
          placeholder="https://…"
        />
      </label>
      <label className="block text-sm font-semibold">
        Rola
        <input
          className={inputClass}
          value={member.role === "admin" ? "Administrator" : "Gracz"}
          readOnly
          disabled
        />
      </label>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-xl px-4 py-3 text-sm ${state.status === "error" ? "bg-[#8f3528]/10 text-[#8f3528]" : "bg-moss/12 text-moss"}`}
        >
          {state.message}
        </p>
      )}
      <AuthSubmitButton pendingLabel="Zapisujemy…">
        Zapisz Kartę Gracza
      </AuthSubmitButton>
    </form>
  );
}
