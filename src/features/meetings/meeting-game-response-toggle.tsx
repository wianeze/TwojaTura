"use client";

import { useState, useTransition } from "react";
import { useCanWrite } from "@/features/auth/member-role-context";
import { setMeetingGameResponseAction } from "./actions";
import { segmentedOptionClasses, segmentedOptionStyle } from "./segmented-tone";
import type { MeetingGameResponse } from "./types";

/*
 * Gracz odpowiada, czy chce zagrać w daną grę. Trzy stany: brak odpowiedzi,
 * "chce grać", "nie chce grać". Nie ma akcji cofania — można tylko zmienić
 * decyzję, a kliknięcie już aktywnej strony jest świadomym no-opem, żeby nie
 * dało się przypadkiem odwrócić własnej odpowiedzi.
 *
 * Ten sam system kolorów co RSVP (segmentedOptionClasses): positive/negative
 * zamiast osobnego niebieskiego akcentu, żeby oba przełączniki w Kalendarium
 * mówiły jednym językiem. Mały, "mały segmented control" obok wiersza gry —
 * dwa oddzielne przyciski w wąskiej kolumnie, nie pełnej szerokości pigułka.
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
  tone: "positive" | "negative";
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      disabled={isPending}
      onClick={isActive ? undefined : onSelect}
      style={segmentedOptionStyle(tone, isActive)}
      className={`min-w-0 rounded-full border px-2 py-1 text-[0.62rem] leading-4 font-bold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${segmentedOptionClasses(tone, isActive)}`}
    >
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
    <div className="w-[5.5rem] shrink-0 space-y-1">
      <div
        role="group"
        aria-label="Czy chcesz zagrać w tę grę?"
        className="flex flex-col gap-1"
      >
        <ResponseOption
          isActive={ownResponse === true}
          isPending={pending}
          tone="positive"
          label="Chcę grać"
          onSelect={() => respond(true)}
        />
        <ResponseOption
          isActive={ownResponse === false}
          isPending={pending}
          tone="negative"
          label="Nie chcę grać"
          onSelect={() => respond(false)}
        />
      </div>
      {message ? (
        <p className="text-[0.62rem] leading-4 font-semibold text-[#8f3528]">
          {message}
        </p>
      ) : null}
    </div>
  );
}
