"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type {
  AdminFeedbackSubmissionRow,
  FeedbackStatus,
} from "@/features/feedback/types";
import { adminUpdateFeedbackSubmissionAction } from "./actions";
import { FEEDBACK_STATUS_LABELS, formatAdminDate } from "./formatting";

const STATUS_FILTER_OPTIONS: Array<{
  value: FeedbackStatus | "all";
  label: string;
}> = [
  { value: "all", label: "Wszystkie statusy" },
  { value: "new", label: FEEDBACK_STATUS_LABELS.new },
  { value: "in_progress", label: FEEDBACK_STATUS_LABELS.in_progress },
  { value: "rejected", label: FEEDBACK_STATUS_LABELS.rejected },
];

function FeedbackRow({
  submission,
  isPending,
  onSave,
}: {
  submission: AdminFeedbackSubmissionRow;
  isPending: boolean;
  onSave: (status: FeedbackStatus, adminNote: string) => void;
}) {
  const [status, setStatus] = useState<FeedbackStatus>(submission.status);
  const [adminNote, setAdminNote] = useState(submission.adminNote ?? "");
  const [isNoteOpen, setIsNoteOpen] = useState(false);

  const isDirty =
    status !== submission.status || adminNote !== (submission.adminNote ?? "");

  return (
    <li className="paper-wash rounded-xl border border-[#9a7657]/25 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#4c3528]">
            {submission.authorDisplayName}
          </p>
          <p className="text-xs text-[#6f5640]">
            {formatAdminDate(submission.createdAt)}
          </p>
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as FeedbackStatus)}
          disabled={isPending}
          className="rounded-full border border-[#9a7657]/35 bg-white/70 px-3 py-1 text-xs font-semibold text-[#503828] outline-none disabled:opacity-60"
        >
          {(Object.keys(FEEDBACK_STATUS_LABELS) as FeedbackStatus[]).map(
            (value) => (
              <option key={value} value={value}>
                {FEEDBACK_STATUS_LABELS[value]}
              </option>
            ),
          )}
        </select>
      </div>

      <p className="mt-2 text-sm break-words whitespace-pre-wrap text-[#503828]">
        {submission.content}
      </p>

      <button
        type="button"
        onClick={() => setIsNoteOpen((open) => !open)}
        aria-expanded={isNoteOpen}
        className="mt-2 text-xs font-bold text-[#9b5538] underline decoration-[#9b5538]/40 underline-offset-4"
      >
        {isNoteOpen ? "Ukryj notatkę" : "Notatka administratora"}
      </button>

      {isNoteOpen ? (
        <textarea
          value={adminNote}
          onChange={(event) => setAdminNote(event.target.value)}
          disabled={isPending}
          rows={2}
          placeholder="Wewnętrzna notatka (niewidoczna dla użytkownika)"
          className="focus:border-gold focus:ring-gold/20 mt-2 w-full rounded-xl border border-[#9a7657]/35 bg-white/70 px-3 py-2 text-sm text-[#503828] transition outline-none focus:ring-4 disabled:opacity-65"
        />
      ) : null}

      {isDirty ? (
        <button
          type="button"
          onClick={() => onSave(status, adminNote)}
          disabled={isPending}
          className="cta-glow mt-2 rounded-full border border-[#efbf82]/30 bg-[#9b5538]/92 px-4 py-1.5 text-xs font-bold text-[#fff0db] disabled:opacity-60"
        >
          {isPending ? "Zapisywanie…" : "Zapisz"}
        </button>
      ) : null}
    </li>
  );
}

function FeedbackArchiveDialog({
  submissions,
  isOpen,
  isPending,
  pendingId,
  onSave,
  onClose,
}: {
  submissions: AdminFeedbackSubmissionRow[];
  isOpen: boolean;
  isPending: boolean;
  pendingId: string | null;
  onSave: (
    submissionId: string,
    status: FeedbackStatus,
    adminNote: string,
  ) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-end justify-center overflow-x-hidden bg-[#170b08]/78 p-2 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-archive-title"
        className="cork-board-bg premium-edge anim-rise-in-fast relative isolate flex max-h-[calc(100dvh-env(safe-area-inset-bottom)-6.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[1.6rem] p-2.5 shadow-[0_24px_52px_rgba(10,4,2,0.48)] sm:max-h-[min(48rem,calc(100dvh-2.5rem))] sm:p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="parchment-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.25rem]">
          <header className="flex items-start justify-between gap-3 border-b border-[#bd966f]/35 px-4 py-3.5 sm:px-5 sm:py-4">
            <div>
              <p className="text-accent text-[0.62rem] font-bold tracking-[0.18em] uppercase">
                Zrealizowane pomysły
              </p>
              <h2
                id="feedback-archive-title"
                className="font-display mt-1 text-2xl font-semibold text-[#3f2a1a] sm:text-3xl"
              >
                Archiwum
              </h2>
              <p className="mt-1 text-sm text-[#705846]">
                {submissions.length}{" "}
                {submissions.length === 1 ? "zgłoszenie" : "zgłoszeń"}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Zamknij archiwum zgłoszeń"
              className="grid size-9 shrink-0 place-items-center rounded-full border border-[#a76b43] bg-[#6b3828] text-lg font-bold text-[#fff4df] shadow-[0_4px_10px_rgba(60,27,13,0.2)] transition hover:bg-[#81452f]"
            >
              ×
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
            {submissions.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#6f5640]">
                Archiwum jest puste.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {submissions.map((submission) => (
                  <FeedbackRow
                    key={submission.id}
                    submission={submission}
                    isPending={isPending && pendingId === submission.id}
                    onSave={(status, adminNote) =>
                      onSave(submission.id, status, adminNote)
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function FeedbackReviewPanel({
  initialSubmissions,
}: {
  initialSubmissions: AdminFeedbackSubmissionRow[];
}) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">(
    "all",
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activeSubmissions = useMemo(
    () => submissions.filter((item) => item.status !== "completed"),
    [submissions],
  );
  const archivedSubmissions = useMemo(
    () => submissions.filter((item) => item.status === "completed"),
    [submissions],
  );
  const filtered = useMemo(
    () =>
      statusFilter === "all"
        ? activeSubmissions
        : activeSubmissions.filter((item) => item.status === statusFilter),
    [activeSubmissions, statusFilter],
  );

  function handleSave(
    submissionId: string,
    status: FeedbackStatus,
    adminNote: string,
  ) {
    setError(null);
    setPendingId(submissionId);
    startTransition(async () => {
      const result = await adminUpdateFeedbackSubmissionAction(
        submissionId,
        status,
        adminNote,
      );
      setPendingId(null);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSubmissions((current) =>
        current.map((item) =>
          item.id === submissionId
            ? { ...item, status, adminNote: adminNote.trim() || null }
            : item,
        ),
      );
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-[#4c3528]">
          Zgłoszenia użytkowników
        </h2>
        <button
          type="button"
          onClick={() => setIsArchiveOpen(true)}
          aria-haspopup="dialog"
          className="shrink-0 rounded-full border border-[#8d5b42]/45 bg-[#603827] px-4 py-2 text-xs font-bold text-[#fff0db] shadow-[0_4px_12px_rgba(64,31,18,0.18)] transition hover:bg-[#75432e] focus-visible:ring-2 focus-visible:ring-[#c47a3e] focus-visible:outline-none"
        >
          Archiwum
          {archivedSubmissions.length > 0
            ? ` (${archivedSubmissions.length})`
            : ""}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as FeedbackStatus | "all")
          }
          className="paper-wash focus:border-gold focus:ring-gold/20 rounded-full border border-[#9a7657]/35 px-4 py-2 text-sm text-[#503828] transition outline-none focus:ring-4"
        >
          {STATUS_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-[#6f5640]">
          {filtered.length} / {activeSubmissions.length} zgłoszeń
        </span>
      </div>

      {error ? (
        <p className="rounded-xl bg-[#7d2f3d]/10 px-3 py-2 text-sm font-semibold text-[#7d2f3d]">
          {error}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="text-sm text-[#6f5640]">Brak zgłoszeń.</p>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((submission) => (
            <FeedbackRow
              key={submission.id}
              submission={submission}
              isPending={isPending && pendingId === submission.id}
              onSave={(status, adminNote) =>
                handleSave(submission.id, status, adminNote)
              }
            />
          ))}
        </ul>
      )}

      <FeedbackArchiveDialog
        submissions={archivedSubmissions}
        isOpen={isArchiveOpen}
        isPending={isPending}
        pendingId={pendingId}
        onSave={handleSave}
        onClose={() => setIsArchiveOpen(false)}
      />
    </div>
  );
}
