"use client";

import { useActionState } from "react";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { useCanWrite } from "@/features/auth/member-role-context";
import { PlayerDisplayName } from "@/components/ui/player-display-name";
import { INITIAL_MEETING_AVAILABILITY_STATE } from "./form-state";
import { segmentedOptionClasses, segmentedOptionStyle } from "./segmented-tone";
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

function statusDotClass(response: boolean | null) {
  if (response === true) return "bg-[#4f7a52]";
  if (response === false) return "bg-[#a34638]";
  return "bg-[#c2a262]";
}

function statusTextClass(response: boolean | null) {
  if (response === true) return "text-[#3d6340]";
  if (response === false) return "text-[#8f3528]";
  return "text-[#8a6a3d]";
}

function statusLabel(response: boolean | null) {
  if (response === true) return "Będzie";
  if (response === false) return "Nie może";
  return "Brak odpowiedzi";
}

/*
  Kolor linii między wierszami musi iść przez inline `style`, nie przez
  Tailwindową klasę `border-[...]`: globalna, NIELAYEROWANA reguła
  `* { border-color: var(--border) }` (globals.css) bije każdą warstwowaną
  utility koloru obramowania niezależnie od specyficzności — border-b
  renderowałby się jako blady, neutralny `--border` (#dacdbb), nie jako
  zamierzony ciemniejszy brąz. Ta sama wartość co separatory na stronie
  szczegółów spotkania (page.tsx), żeby cała kartka mówiła jednym językiem.
*/
const SEPARATOR_LINE_COLOR = "rgba(139, 103, 67, 0.65)";

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
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <p className="min-w-0 flex-1 text-[0.8rem] leading-5 text-[#6c5644]">
            Odpowiedz czy będziesz na spotkaniu:
          </p>

          {/* Segmenty mają identyczną geometrię niezależnie od stanu — zmienia
              się wyłącznie kolor (border+tło+tekst) z segmentedOptionClasses,
              nigdy padding ani obecność obramowania. */}
          <div className="grid w-full grid-cols-2 gap-1.5 sm:w-auto sm:min-w-[13rem]">
            <button
              type="submit"
              name="response"
              value="available"
              disabled={pending}
              aria-pressed={currentResponse === true}
              style={segmentedOptionStyle("positive", currentResponse === true)}
              className={`min-w-0 rounded-full border px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${segmentedOptionClasses(
                "positive",
                currentResponse === true,
              )}`}
            >
              {pending && currentResponse !== true ? "Zapisuję…" : "Będę"}
            </button>
            <button
              type="submit"
              name="response"
              value="unavailable"
              disabled={pending}
              aria-pressed={currentResponse === false}
              style={segmentedOptionStyle(
                "negative",
                currentResponse === false,
              )}
              className={`min-w-0 rounded-full border px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${segmentedOptionClasses(
                "negative",
                currentResponse === false,
              )}`}
            >
              {pending && currentResponse !== false ? "Zapisuję…" : "Nie mogę"}
            </button>
          </div>
        </div>
      ) : null}

      {state.message && state.status === "error" ? (
        <p className="text-xs font-semibold text-[#8f3528]">{state.message}</p>
      ) : null}

      <div className="grid gap-x-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row, index) => {
          const response =
            row.member.id === currentUserId ? currentResponse : row.response;
          const isSelf = row.member.id === currentUserId;

          return (
            <div
              key={row.member.id}
              style={{
                animationDelay: `${getEntranceStaggerDelayMs(index)}ms`,
                borderBottomColor: SEPARATOR_LINE_COLOR,
              }}
              className={`anim-rise-in-fast flex items-center justify-between gap-3 border-b py-2 ${
                isSelf ? "border-l-2 border-l-[#c58a3a] pl-2.5" : ""
              }`}
            >
              <div className="min-w-0">
                <PlayerDisplayName
                  variant="compact"
                  displayName={row.member.displayName}
                  title={row.member.equippedTitle}
                  className="text-sm font-semibold text-[#4e3528]"
                />
                {isSelf ? (
                  <p className="mt-0.5 text-[0.6rem] font-bold tracking-[0.14em] text-[#a06b43] uppercase">
                    Twoja odpowiedź
                  </p>
                ) : null}
              </div>

              <span
                className={`flex shrink-0 items-center gap-1.5 text-[0.72rem] font-bold ${statusTextClass(response)}`}
              >
                <span
                  aria-hidden="true"
                  className={`size-1.5 rounded-full ${statusDotClass(response)}`}
                />
                {statusLabel(response)}
              </span>
            </div>
          );
        })}
      </div>
    </form>
  );
}
