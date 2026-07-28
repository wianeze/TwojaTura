"use client";

import { useState } from "react";
import type { AdminAccountRow } from "./types";

const CONFIRM_WORD = "USUŃ";

export function DeactivateAccountModal({
  account,
  isPending,
  blockReason,
  onConfirm,
  onClose,
}: {
  account: AdminAccountRow;
  isPending: boolean;
  blockReason: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const canConfirm = !blockReason && confirmText.trim() === CONFIRM_WORD;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deactivate-modal-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
    >
      <div className="paper-wash w-full max-w-md rounded-2xl p-5 shadow-2xl">
        <h2
          id="deactivate-modal-title"
          className="font-display text-lg font-semibold text-[#7d2f3d]"
        >
          Usuń konto
        </h2>
        <p className="mt-1 text-sm text-[#6f5640]">
          {account.displayName} · {account.email}
        </p>

        <div className="mt-3 rounded-xl bg-[#7d2f3d]/10 px-3 py-2 text-xs text-[#5a2530]">
          Konto zostanie dezaktywowane, a dane profilu (imię, e-mail, avatar)
          zanonimizowane. Cała historia rozgrywek, ocen i punktów zostanie
          zachowana. Tej operacji nie da się cofnąć z poziomu panelu.
        </div>

        {blockReason ? (
          <p className="mt-3 rounded-xl bg-[#f7e7b8] px-3 py-2 text-xs font-semibold text-[#6d5319]">
            {blockReason}
          </p>
        ) : (
          <>
            <label className="mt-4 block text-xs font-semibold text-[#503828]">
              Powód (opcjonalnie)
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={isPending}
                className="paper-wash focus:border-gold focus:ring-gold/20 mt-1.5 min-h-16 w-full rounded-xl border border-[#9a7657]/35 px-3 py-2 text-sm text-[#503828] transition outline-none focus:ring-4"
                placeholder="Np. rezygnacja z grupy"
              />
            </label>

            <label className="mt-4 block text-xs font-semibold text-[#503828]">
              Wpisz{" "}
              <span className="font-bold text-[#7d2f3d]">{CONFIRM_WORD}</span>{" "}
              aby potwierdzić
              <input
                type="text"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                disabled={isPending}
                autoComplete="off"
                className="paper-wash focus:border-gold focus:ring-gold/20 mt-1.5 w-full rounded-xl border border-[#9a7657]/35 px-3 py-2 text-sm text-[#503828] transition outline-none focus:ring-4"
                placeholder={CONFIRM_WORD}
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
          {!blockReason ? (
            <button
              type="button"
              onClick={() => onConfirm(reason)}
              disabled={isPending || !canConfirm}
              className="rounded-full bg-[#7d2f3d] px-4 py-2 text-xs font-bold text-[#fff3ec] transition-colors hover:bg-[#8d3747] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Usuwanie…" : "Usuń konto"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
