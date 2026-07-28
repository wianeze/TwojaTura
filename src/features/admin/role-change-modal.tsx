"use client";

import { useState } from "react";
import type { MemberRole } from "@/features/auth/types";
import { ROLE_LABELS } from "./formatting";
import type { AdminAccountRow } from "./types";

const ROLE_OPTIONS: MemberRole[] = ["member", "admin", "observer"];

export function RoleChangeModal({
  account,
  isPending,
  isSelf,
  onConfirm,
  onClose,
}: {
  account: AdminAccountRow;
  isPending: boolean;
  isSelf: boolean;
  onConfirm: (newRole: MemberRole, reason: string) => void;
  onClose: () => void;
}) {
  const [newRole, setNewRole] = useState<MemberRole>(account.role);
  const [reason, setReason] = useState("");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-change-modal-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
    >
      <div className="paper-wash w-full max-w-md rounded-2xl p-5 shadow-2xl">
        <h2
          id="role-change-modal-title"
          className="font-display text-lg font-semibold text-[#4c3528]"
        >
          Zmień typ konta
        </h2>
        <p className="mt-1 text-sm text-[#6f5640]">
          {account.displayName} · {account.email}
        </p>

        {isSelf ? (
          <p className="mt-3 rounded-xl bg-[#f7e7b8] px-3 py-2 text-xs font-semibold text-[#6d5319]">
            Nie możesz zmienić własnej roli administratora z tego panelu.
          </p>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="rounded-full bg-black/5 px-3 py-1 font-semibold text-[#4c3528]">
                Obecnie: {ROLE_LABELS[account.role]}
              </span>
              <span aria-hidden="true">→</span>
              <span className="bg-gold/20 rounded-full px-3 py-1 font-semibold text-[#4c3528]">
                Nowa rola: {ROLE_LABELS[newRole]}
              </span>
            </div>

            <fieldset
              className="mt-4 grid grid-cols-3 gap-2"
              disabled={isPending}
            >
              <legend className="sr-only">Wybierz nową rolę</legend>
              {ROLE_OPTIONS.map((role) => (
                <label
                  key={role}
                  className={`cursor-pointer rounded-xl border px-2 py-2 text-center text-xs font-bold transition-colors ${
                    newRole === role
                      ? "border-gold bg-gold/20 text-[#4c3528]"
                      : "border-[#9a7657]/30 bg-white/60 text-[#6f5640]"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={role}
                    checked={newRole === role}
                    onChange={() => setNewRole(role)}
                    className="sr-only"
                  />
                  {ROLE_LABELS[role]}
                </label>
              ))}
            </fieldset>

            <label className="mt-4 block text-xs font-semibold text-[#503828]">
              Powód (opcjonalnie)
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={isPending}
                className="paper-wash focus:border-gold focus:ring-gold/20 mt-1.5 min-h-16 w-full rounded-xl border border-[#9a7657]/35 px-3 py-2 text-sm text-[#503828] transition outline-none focus:ring-4"
                placeholder="Np. dołączenie do zespołu moderacji"
              />
            </label>
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-full border border-[#9a7657]/35 px-4 py-2 text-xs font-bold text-[#6f5640] disabled:opacity-60"
          >
            Anuluj
          </button>
          {!isSelf ? (
            <button
              type="button"
              onClick={() => onConfirm(newRole, reason)}
              disabled={isPending || newRole === account.role}
              className="cta-glow rounded-full bg-[#7d2f3d] px-4 py-2 text-xs font-bold text-[#fff3ec] transition-colors hover:bg-[#8d3747] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Zapisywanie…" : "Potwierdź zmianę"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
