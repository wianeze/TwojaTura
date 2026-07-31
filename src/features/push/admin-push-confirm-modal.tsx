"use client";

import { useFormStatus } from "react-dom";
import { formatPushAudienceSentence } from "./formatting";
import type { AdminPushAudienceSummary } from "./types";

/**
 * Potwierdzenie przed wysłaniem. Renderowane wewnątrz formularza, więc
 * przycisk potwierdzenia jest zwykłym submitem — dzięki temu FormData niesie
 * komplet pól, a `useFormStatus` blokuje ponowne kliknięcie.
 *
 * W repo nie ma współdzielonego komponentu modala; markup odpowiada
 * istniejącym oknom w `src/features/admin/`.
 */
export function AdminPushConfirmModal({
  summary,
  title,
  body,
  onClose,
}: {
  summary: AdminPushAudienceSummary;
  title: string;
  body: string;
  onClose: () => void;
}) {
  const { pending } = useFormStatus();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-confirm-title"
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
    >
      <div className="paper-wash w-full max-w-md rounded-2xl p-5 shadow-2xl">
        <h2
          id="push-confirm-title"
          className="font-display text-lg font-semibold text-[#4c3528]"
        >
          Potwierdź wysyłkę
        </h2>

        <p className="mt-3 rounded-xl bg-[#f7e7b8] px-3 py-2 text-sm font-semibold text-[#6d5319]">
          {formatPushAudienceSentence(
            summary.userCount,
            summary.subscriptionCount,
          )}
        </p>

        {summary.usersWithoutSubscription > 0 ? (
          <p className="mt-2 text-xs text-[#6f5640]">
            {summary.usersWithoutSubscription}{" "}
            {summary.usersWithoutSubscription === 1
              ? "osoba nie ma"
              : "osób nie ma"}{" "}
            aktywnego urządzenia — do nich powiadomienie nie dotrze.
          </p>
        ) : null}

        <div className="mt-4 rounded-xl border border-[#9a7657]/30 bg-white/60 p-3">
          <p className="text-sm font-bold text-[#4c3528]">{title}</p>
          <p className="mt-1 text-sm whitespace-pre-line text-[#6f5640]">
            {body}
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-full border border-[#9a7657]/35 px-4 py-2 text-xs font-bold text-[#6f5640] disabled:opacity-60"
          >
            Anuluj
          </button>
          <button
            type="submit"
            disabled={pending || summary.subscriptionCount === 0}
            className="cta-glow bg-brand rounded-full px-4 py-2 text-xs font-bold text-[#fff3ec] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Wysyłamy…" : "Wyślij powiadomienie"}
          </button>
        </div>
      </div>
    </div>
  );
}
