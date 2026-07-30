"use client";

import { useState, useTransition } from "react";
import { useCanWrite } from "@/features/auth/member-role-context";
import { setMeetingGameResponseAction } from "./actions";
import type { MeetingGameResponse } from "./types";

/*
 * Gracz odpowiada, czy chce zagrać w daną grę. Trzy stany: brak odpowiedzi,
 * "chce grać", "nie chce grać". Nie ma akcji cofania — można tylko zmienić
 * decyzję, a kliknięcie już aktywnej strony jest świadomym no-opem, żeby nie
 * dało się przypadkiem odwrócić własnej odpowiedzi.
 *
 * Stan nie jest komunikowany samym kolorem: aktywna strona dostaje też
 * obramowanie i znacznik, więc czyta się bez rozróżniania barw.
 */
function ResponseOption({
  isActive,
  isPending,
  tone,
  label,
  onSelect,
}: {
  isActive: boolean;
  isPending: boolean;
  tone: "yes" | "no";
  label: string;
  onSelect: () => void;
}) {
  const activeClasses =
    tone === "yes"
      ? "border-[#5da3d6] bg-[#2c536f] text-[#eaf5ff]"
      : "border-[#b09a80] bg-[#4a3c2d] text-[#f0e3d1]";

  return (
    <button
      type="button"
      aria-pressed={isActive}
      disabled={isPending}
      onClick={isActive ? undefined : onSelect}
      className={`inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        isActive
          ? activeClasses
          : "border-transparent text-[#6a4f38] hover:bg-black/5"
      }`}
    >
      {isActive ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="size-3.5 shrink-0"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      ) : null}
      {label}
    </button>
  );
}

export function MeetingGameResponseToggle({
  meetingId,
  gameId,
  ownResponse,
}: {
  meetingId: string;
  gameId: string;
  ownResponse: MeetingGameResponse;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const canWrite = useCanWrite();
  if (!canWrite) return null;

  const respond = (wantsToPlay: boolean) => {
    startTransition(async () => {
      const result = await setMeetingGameResponseAction(
        meetingId,
        gameId,
        wantsToPlay,
      );
      setMessage(result.status === "error" ? (result.message ?? null) : null);
    });
  };

  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-label="Czy chcesz zagrać w tę grę?"
        className="paper-wash inline-flex w-full max-w-[15rem] gap-1 rounded-full p-1"
      >
        <ResponseOption
          isActive={ownResponse === true}
          isPending={pending}
          tone="yes"
          label="Chcę grać"
          onSelect={() => respond(true)}
        />
        <ResponseOption
          isActive={ownResponse === false}
          isPending={pending}
          tone="no"
          label="Nie chcę grać"
          onSelect={() => respond(false)}
        />
      </div>
      {message ? (
        <p className="text-xs font-semibold text-[#8f3528]">{message}</p>
      ) : null}
    </div>
  );
}
