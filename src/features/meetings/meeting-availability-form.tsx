"use client";

import { useActionState } from "react";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { useCanWrite } from "@/features/auth/member-role-context";
import { INITIAL_MEETING_AVAILABILITY_STATE } from "./form-state";
import type {
  MeetingAttendanceRow,
  MeetingAvailabilityFormState,
} from "./types";

type MeetingAvailabilityFormProps = {
  action: (
    state: MeetingAvailabilityFormState,
    formData: FormData,
  ) => Promise<MeetingAvailabilityFormState>;
  rows: MeetingAttendanceRow[];
  currentUserId: string;
  ownResponse: boolean | null;
};

function tileStyles(response: boolean | null) {
  if (response === true) {
    return "bg-[linear-gradient(145deg,rgba(222,236,219,0.98),rgba(206,226,202,0.95))] text-[#2f4b35] ring-1 ring-[#8ea88e]/28";
  }

  if (response === false) {
    return "bg-[linear-gradient(145deg,rgba(245,225,221,0.98),rgba(236,207,202,0.95))] text-[#7d3229] ring-1 ring-[#c88677]/24";
  }

  return "bg-[linear-gradient(145deg,rgba(247,235,196,0.98),rgba(239,219,162,0.95))] text-[#6c5222] ring-1 ring-[#d0b06a]/24";
}

function statusLabel(response: boolean | null) {
  if (response === true) return "Będzie";
  if (response === false) return "Nie może";
  return "Brak odpowiedzi";
}

export function MeetingAvailabilityForm({
  action,
  rows,
  currentUserId,
  ownResponse,
}: MeetingAvailabilityFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_MEETING_AVAILABILITY_STATE,
  );
  const currentResponse =
    typeof state.savedResponse === "boolean"
      ? state.savedResponse
      : ownResponse;
  const canWrite = useCanWrite();

  return (
    <form action={formAction} className="space-y-3">
      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            name="response"
            value="available"
            disabled={pending}
            className={`cta-glow rounded-full px-3.5 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
              currentResponse === true
                ? "bg-moss text-white"
                : "paper-wash text-[#5e4634]"
            }`}
          >
            {pending && currentResponse !== true ? "Zapisuję…" : "Będę"}
          </button>
          <button
            type="submit"
            name="response"
            value="unavailable"
            disabled={pending}
            className={`rounded-full px-3.5 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
              currentResponse === false
                ? "bg-[#8f3528] text-white"
                : "paper-wash text-[#5e4634]"
            }`}
          >
            {pending && currentResponse !== false ? "Zapisuję…" : "Nie mogę"}
          </button>
        </div>
      ) : null}

      {state.message && state.status === "error" ? (
        <p className="text-xs font-semibold text-[#8f3528]">{state.message}</p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row, index) => {
          const response =
            row.member.id === currentUserId ? currentResponse : row.response;

          return (
            <div
              key={row.member.id}
              style={{
                animationDelay: `${getEntranceStaggerDelayMs(index)}ms`,
              }}
              className={`anim-rise-in-fast flex items-center justify-between gap-3 rounded-[1.05rem] px-3.5 py-3 ${tileStyles(
                response,
              )} ${
                row.member.id === currentUserId
                  ? "shadow-[0_0_0_1px_rgba(205,168,106,0.38)]"
                  : ""
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#4e3528]">
                  {row.member.displayName}
                </p>
                {row.member.id === currentUserId ? (
                  <p className="mt-0.5 text-[0.62rem] font-bold tracking-[0.14em] text-[#a06b43] uppercase">
                    Twoja odpowiedź
                  </p>
                ) : null}
              </div>

              <span className="shrink-0 text-[0.72rem] font-bold">
                {statusLabel(response)}
              </span>
            </div>
          );
        })}
      </div>
    </form>
  );
}
