"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  AdminFeedbackSubmissionRow,
  FeedbackStatus,
} from "@/features/feedback/types";
import { adminUpdateFeedbackSubmissionAction } from "./actions";
import { FEEDBACK_STATUS_LABELS, formatAdminDate } from "./formatting";

const STATUS_FILTER_OPTIONS: Array<{ value: FeedbackStatus | "all"; label: string }> =
  [
    { value: "all", label: "Wszystkie statusy" },
    { value: "new", label: FEEDBACK_STATUS_LABELS.new },
    { value: "in_progress", label: FEEDBACK_STATUS_LABELS.in_progress },
    { value: "completed", label: FEEDBACK_STATUS_LABELS.completed },
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
    status !== submission.status ||
    adminNote !== (submission.adminNote ?? "");

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
          onChange={(event) =>
            setStatus(event.target.value as FeedbackStatus)
          }
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
          className="focus:border-gold focus:ring-gold/20 mt-2 w-full rounded-xl border border-[#9a7657]/35 bg-white/70 px-3 py-2 text-sm text-[#503828] outline-none transition focus:ring-4 disabled:opacity-65"
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
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      statusFilter === "all"
        ? submissions
        : submissions.filter((item) => item.status === statusFilter),
    [submissions, statusFilter],
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
          {filtered.length} / {submissions.length} zgłoszeń
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
    </div>
  );
}
