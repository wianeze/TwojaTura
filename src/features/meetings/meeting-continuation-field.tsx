"use client";

import { useState } from "react";
import { formatMeetingContinuationSubtitle } from "./formatting";
import { shouldRenderContinuationField } from "./validation";
import type { MeetingContinuablePlay } from "./types";

type MeetingContinuationFieldProps = {
  plays: MeetingContinuablePlay[];
  defaultValue: string;
  error?: string;
};

/*
  „Zaproponuj dokończenie” — lekka sekcja planu wieczoru, domyślnie zwinięta.
  Wybrany play_id trafia do głosowania razem ze zwykłymi grami. Nie tworzy
  nowego wpisu i nie ustawia meetings.continued_play_id.

  Lista jest z natury krótka (partie ze statusem „w toku”), więc nie ma tu ani
  wyszukiwarki, ani paginacji — gdy nie ma czego kontynuować, cała sekcja się
  nie renderuje i formularz wygląda dokładnie jak wcześniej.

  `continuesPlay` jest osobnym polem od `continuedPlayId`, żeby serwer odróżnił
  „nie kontynuujemy” od „zaznaczone, ale nic nie wybrano” — drugie jest błędem
  walidacji, nie cichym zapisem bez kontynuacji.
*/
export function MeetingContinuationField({
  plays,
  defaultValue,
  error,
}: MeetingContinuationFieldProps) {
  const [isOpen, setIsOpen] = useState(Boolean(defaultValue));
  const [selectedId, setSelectedId] = useState(defaultValue);

  if (!shouldRenderContinuationField(plays.length, defaultValue)) return null;

  return (
    <div className="space-y-3">
      <input type="hidden" name="continuesPlay" value={isOpen ? "1" : ""} />
      <input
        type="hidden"
        name="continuedPlayId"
        value={isOpen ? selectedId : ""}
      />

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-dashed border-[#9a7657]/55 bg-[#f7ecd6]/60 px-3.5 py-3 transition hover:bg-[#f4e5cf]/80">
        <input
          type="checkbox"
          checked={isOpen}
          onChange={(event) => {
            setIsOpen(event.target.checked);
            // Odznaczenie czyści wybór, żeby ponowne zaznaczenie nie wracało po
            // cichu do partii, o której użytkownik zdążył już zapomnieć.
            if (!event.target.checked) setSelectedId("");
          }}
          className="mt-0.5 size-4 shrink-0 accent-[#7d2f3d]"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[#503828]">
            Zaproponuj dokończenie
          </span>
          <span className="mt-0.5 block text-xs text-[#7a6048]">
            {isOpen
              ? "Wybierz odłożoną partię. Trafi do planu wieczoru i głosowania."
              : `Czeka ${formatWaitingPlaysLabel(plays.length)}.`}
          </span>
        </span>
      </label>

      {error ? (
        <p className="text-xs font-semibold text-[#8f3528]">{error}</p>
      ) : null}

      {isOpen ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {plays.map((play) => {
            const selected = selectedId === play.playId;

            return (
              <button
                key={play.playId}
                type="button"
                onClick={() => setSelectedId(selected ? "" : play.playId)}
                aria-pressed={selected}
                className={`flex min-w-0 flex-col gap-0.5 rounded-2xl border px-3.5 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b48760] ${
                  selected
                    ? "border-[#8d5a31] bg-[#ead6b3] text-[#523625]"
                    : "border-[#ccb18b]/70 bg-white/70 text-[#6b5140] hover:bg-[#f4e5cf]"
                }`}
              >
                <span className="truncate text-sm font-semibold">
                  {play.gameTitle}
                </span>
                <span className="truncate text-xs text-[#7a6048]">
                  {formatMeetingContinuationSubtitle(play)}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function formatWaitingPlaysLabel(count: number) {
  if (count === 1) return "1 partia w toku";
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  const usesFewForm =
    lastDigit >= 2 &&
    lastDigit <= 4 &&
    !(lastTwoDigits >= 12 && lastTwoDigits <= 14);

  return usesFewForm ? `${count} partie w toku` : `${count} partii w toku`;
}
