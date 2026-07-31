"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { ROLE_LABELS } from "@/features/admin/formatting";
import {
  adminSendPushCampaignAction,
  getAdminPushAudienceSummaryAction,
} from "./admin-actions";
import { AdminPushConfirmModal } from "./admin-push-confirm-modal";
import { formatPushMeetingOption } from "./formatting";
import { createIdempotencyKey } from "./idempotency";
import { findPushTemplate, PUSH_TEMPLATES } from "./templates";
import {
  isSafeInternalPath,
  PUSH_BODY_MAX_LENGTH,
  PUSH_TITLE_MAX_LENGTH,
} from "./validation";
import type {
  AdminPushAudienceRow,
  AdminPushAudienceSummary,
  PushCampaignFormState,
  PushMeetingOption,
} from "./types";

const INITIAL_STATE: PushCampaignFormState = { status: "idle" };

const EMPTY_SUMMARY: AdminPushAudienceSummary = {
  userCount: 0,
  subscriptionCount: 0,
  usersWithoutSubscription: 0,
};

const inputClass =
  "paper-wash focus:border-gold focus:ring-gold/20 mt-1 w-full rounded-xl border border-[#9a7657]/35 bg-[#fff9ee] px-3 py-2.5 text-sm text-[#503828] outline-none transition focus:ring-4";

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1.5 text-xs font-semibold text-[#8f3528]">{error}</p>;
}

export function AdminPushForm({
  audience,
  meetings,
}: {
  audience: AdminPushAudienceRow[];
  meetings: PushMeetingOption[];
}) {
  const [state, formAction] = useActionState(
    adminSendPushCampaignAction,
    INITIAL_STATE,
  );

  const [templateKey, setTemplateKey] = useState<string>("admin_message");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [recipientMode, setRecipientMode] = useState<"all" | "selected">("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [summary, setSummary] =
    useState<AdminPushAudienceSummary>(EMPTY_SUMMARY);

  /**
   * Otwarte potwierdzenie trzyma własny token idempotencji i migawkę stanu
   * formularza z chwili otwarcia. Modal jest widoczny dopóki `state` się nie
   * zmieni — a zmienia się dokładnie wtedy, gdy akcja serwerowa wróci. Dzięki
   * temu domykanie okna jest czystym wyliczeniem, bez setState w efekcie.
   */
  const [confirm, setConfirm] = useState<{
    idempotencyKey: string;
    baseState: PushCampaignFormState;
  } | null>(null);

  const isConfirmOpen = confirm !== null && confirm.baseState === state;
  const idempotencyKey = confirm?.idempotencyKey ?? "";

  const template = findPushTemplate(templateKey);
  const requiresMeeting = template?.requiresMeeting ?? false;

  const recipientUserIds = useMemo(
    () => (recipientMode === "selected" ? selectedUserIds : null),
    [recipientMode, selectedUserIds],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        // Pusta lista odbiorców jest bezpieczna: RPC zwróci wtedy same zera.
        const result =
          await getAdminPushAudienceSummaryAction(recipientUserIds);
        if (!cancelled) setSummary(result);
      } catch {
        if (!cancelled) setSummary(EMPTY_SUMMARY);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [recipientUserIds]);

  // Nowy token przy każdym świadomym otwarciu potwierdzenia: każde
  // potwierdzone wysłanie ma tworzyć nową kampanię, a podwójne kliknięcie
  // przycisku w modalu — nie (blokuje je useFormStatus i unikalny dedupe_key).
  function openConfirm() {
    setConfirm({ idempotencyKey: createIdempotencyKey(), baseState: state });
  }

  // Wybór szablonu WYŁĄCZNIE uzupełnia formularz — nic nie wysyła.
  function handleTemplateChange(nextKey: string) {
    setTemplateKey(nextKey);

    const nextTemplate = findPushTemplate(nextKey);
    if (!nextTemplate) return;

    setTitle(nextTemplate.title);
    setBody(nextTemplate.body);
    setActionUrl(nextTemplate.actionUrl ?? "");
    setMeetingId("");
  }

  function toggleUser(userId: string) {
    setSelectedUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  const resolvedActionUrl = requiresMeeting
    ? meetingId.length > 0
      ? `/kalendarium/${meetingId}`
      : ""
    : actionUrl;

  const canOpenConfirm =
    title.trim().length > 0 &&
    title.trim().length <= PUSH_TITLE_MAX_LENGTH &&
    body.trim().length > 0 &&
    body.trim().length <= PUSH_BODY_MAX_LENGTH &&
    (resolvedActionUrl.length === 0 || isSafeInternalPath(resolvedActionUrl)) &&
    (recipientMode === "all" || selectedUserIds.length > 0);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="templateKey" value={templateKey} />
      <input type="hidden" name="recipientMode" value={recipientMode} />
      <input type="hidden" name="actionUrl" value={resolvedActionUrl} />
      {recipientMode === "selected"
        ? selectedUserIds.map((userId) => (
            <input
              key={userId}
              type="hidden"
              name="recipientUserIds"
              value={userId}
            />
          ))
        : null}

      <fieldset>
        <legend className="text-xs font-bold tracking-[0.12em] text-[#503828] uppercase">
          Odbiorcy
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label
            className={`cursor-pointer rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
              recipientMode === "all"
                ? "border-gold bg-gold/20 text-[#4c3528]"
                : "border-[#9a7657]/30 bg-white/60 text-[#6f5640]"
            }`}
          >
            <input
              type="radio"
              checked={recipientMode === "all"}
              onChange={() => setRecipientMode("all")}
              className="sr-only"
            />
            Wszyscy z włączonymi powiadomieniami
            <span className="mt-1 block text-[0.7rem] font-semibold text-[#6f5640]">
              Wszyscy aktywni użytkownicy z aktywnym urządzeniem, w tym
              obserwatorzy.
            </span>
          </label>

          <label
            className={`cursor-pointer rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
              recipientMode === "selected"
                ? "border-gold bg-gold/20 text-[#4c3528]"
                : "border-[#9a7657]/30 bg-white/60 text-[#6f5640]"
            }`}
          >
            <input
              type="radio"
              checked={recipientMode === "selected"}
              onChange={() => setRecipientMode("selected")}
              className="sr-only"
            />
            Wybrane osoby
            <span className="mt-1 block text-[0.7rem] font-semibold text-[#6f5640]">
              Zaznacz konkretnych odbiorców na liście poniżej.
            </span>
          </label>
        </div>

        {recipientMode === "selected" ? (
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {audience.map((row) => {
              const hasDevice = row.activeSubscriptionCount > 0;

              return (
                <li key={row.userId}>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                      selectedUserIds.includes(row.userId)
                        ? "border-gold bg-gold/15"
                        : "border-[#9a7657]/25 bg-white/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(row.userId)}
                      onChange={() => toggleUser(row.userId)}
                      className="accent-[#c86638]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-[#4c3528]">
                        {row.displayName}
                      </span>
                      <span className="block text-xs text-[#6f5640]">
                        {ROLE_LABELS[row.role]} ·{" "}
                        {hasDevice
                          ? `${row.activeSubscriptionCount} ${row.activeSubscriptionCount === 1 ? "urządzenie" : "urządzenia"}`
                          : "bez aktywnego urządzenia"}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}

        <FieldError error={state.fieldErrors?.recipients} />

        <p className="mt-2 text-xs text-[#6f5640]">
          Zasięg: <strong>{summary.userCount}</strong>{" "}
          {summary.userCount === 1 ? "użytkownik" : "użytkowników"} ·{" "}
          <strong>{summary.subscriptionCount}</strong>{" "}
          {summary.subscriptionCount === 1
            ? "aktywne urządzenie"
            : "aktywnych urządzeń"}
          {summary.usersWithoutSubscription > 0 ? (
            <>
              {" "}
              · <strong>{summary.usersWithoutSubscription}</strong> bez
              aktywnego urządzenia
            </>
          ) : null}
        </p>
      </fieldset>

      <label className="block text-xs font-semibold text-[#503828]">
        Szablon
        <select
          value={templateKey}
          onChange={(event) => handleTemplateChange(event.target.value)}
          className={inputClass}
        >
          {PUSH_TEMPLATES.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        {template?.hint ? (
          <span className="mt-1 block text-[0.7rem] font-normal text-[#6f5640]">
            {template.hint}
          </span>
        ) : null}
      </label>

      {requiresMeeting ? (
        <label className="block text-xs font-semibold text-[#503828]">
          Spotkanie
          <select
            value={meetingId}
            onChange={(event) => setMeetingId(event.target.value)}
            className={inputClass}
          >
            <option value="">Bez linku do spotkania</option>
            {meetings.map((meeting) => (
              <option key={meeting.id} value={meeting.id}>
                {formatPushMeetingOption(meeting.title, meeting.startsAt)}
              </option>
            ))}
          </select>
          {meetings.length === 0 ? (
            <span className="mt-1 block text-[0.7rem] font-normal text-[#6f5640]">
              Brak nadchodzących spotkań do wskazania.
            </span>
          ) : null}
        </label>
      ) : (
        <label className="block text-xs font-semibold text-[#503828]">
          Ścieżka po kliknięciu (opcjonalnie)
          <input
            type="text"
            value={actionUrl}
            onChange={(event) => setActionUrl(event.target.value)}
            placeholder="/kalendarium"
            className={inputClass}
          />
          <span className="mt-1 block text-[0.7rem] font-normal text-[#6f5640]">
            Wyłącznie adres wewnątrz aplikacji, zaczynający się od „/”.
          </span>
          <FieldError error={state.fieldErrors?.actionUrl} />
        </label>
      )}

      <label className="block text-xs font-semibold text-[#503828]">
        Tytuł
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          name="title"
          maxLength={PUSH_TITLE_MAX_LENGTH * 2}
          className={inputClass}
        />
        <span className="mt-1 block text-[0.7rem] font-normal text-[#6f5640]">
          {title.trim().length} / {PUSH_TITLE_MAX_LENGTH} znaków
        </span>
        <FieldError error={state.fieldErrors?.title} />
      </label>

      <label className="block text-xs font-semibold text-[#503828]">
        Treść
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          name="body"
          rows={4}
          maxLength={PUSH_BODY_MAX_LENGTH * 2}
          className={inputClass}
        />
        <span className="mt-1 block text-[0.7rem] font-normal text-[#6f5640]">
          {body.trim().length} / {PUSH_BODY_MAX_LENGTH} znaków
        </span>
        <FieldError error={state.fieldErrors?.body} />
      </label>

      <div>
        <p className="text-xs font-bold tracking-[0.12em] text-[#503828] uppercase">
          Podgląd
        </p>
        <div className="mt-2 flex gap-3 rounded-2xl border border-[#9a7657]/30 bg-white/70 p-3">
          <span className="bg-brand size-9 shrink-0 rounded-lg" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#2f1e19]">
              {title.trim().length > 0 ? title : "Tytuł powiadomienia"}
            </p>
            <p className="mt-0.5 text-sm whitespace-pre-line text-[#5b4636]">
              {body.trim().length > 0 ? body : "Treść powiadomienia"}
            </p>
            <p className="mt-1 text-[0.7rem] text-[#8a7059]">
              Twoja Tura!
              {resolvedActionUrl.length > 0 ? ` · ${resolvedActionUrl}` : ""}
            </p>
          </div>
        </div>
        <p className="mt-1.5 text-[0.7rem] text-[#6f5640]">
          Finalny wygląd zależy od systemu operacyjnego i przeglądarki.
        </p>
      </div>

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-xl px-4 py-3 text-sm ${
            state.status === "error"
              ? "bg-[#8f3528]/10 text-[#8f3528]"
              : "bg-moss/12 text-moss"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={openConfirm}
        disabled={!canOpenConfirm}
        className="cta-glow bg-brand w-full rounded-full px-5 py-3 text-sm font-bold text-[#fff3ec] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        Wyślij powiadomienie
      </button>

      {isConfirmOpen ? (
        <AdminPushConfirmModal
          summary={summary}
          title={title}
          body={body}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </form>
  );
}
