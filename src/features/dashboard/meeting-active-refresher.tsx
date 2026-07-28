"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  MAX_REFRESH_TIMEOUT_MS,
  getNextMeetingBoundaryMs,
} from "./active-meeting";

// Komponent nie renderuje nic i nie liczy stanu „w trakcie" po stronie
// klienta — decyzję podejmuje serwer, więc nie ma ryzyka hydration mismatch.
// Jedyne zadanie: obudzić Stół dokładnie na granicy startu/końca spotkania.
export function MeetingActiveRefresher({
  activeMeetingEffectiveEnds,
  nextMeetingStartsAt,
}: {
  activeMeetingEffectiveEnds: string[];
  nextMeetingStartsAt: string | null;
}) {
  const router = useRouter();
  const boundaryKey = activeMeetingEffectiveEnds.join("|");

  useEffect(() => {
    const nowMs = Date.now();
    const boundaryMs = getNextMeetingBoundaryMs(
      {
        activeMeetingEffectiveEnds: boundaryKey ? boundaryKey.split("|") : [],
        nextMeetingStartsAt,
      },
      nowMs,
    );

    if (boundaryMs === null) return;

    const timeout = setTimeout(
      () => {
        router.refresh();
      },
      Math.min(boundaryMs - nowMs, MAX_REFRESH_TIMEOUT_MS),
    );

    return () => {
      clearTimeout(timeout);
    };
  }, [boundaryKey, nextMeetingStartsAt, router]);

  return null;
}
