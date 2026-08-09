"use client";

import { useEffect, useState } from "react";
import {
  formatLiveElapsed,
  formatPlayDurationLabel,
  getLiveElapsedMs,
} from "@/features/meetings/live-play";

/*
 * Licznik partii. Źródłem prawdy jest WYŁĄCZNIE `startedAt` z bazy
 * (plays.live_started_at) — komponent nie zlicza własnych tyknięć, tylko za
 * każdym razem wylicza różnicę wobec zapisanego startu. Dlatego odświeżenie
 * strony, uśpienie telefonu ani wejście z innego urządzenia nie resetują czasu
 * i nie rozjeżdżają go między graczami.
 *
 * `initialElapsedMs` policzył serwer przy renderze — pierwszy render klienta
 * używa dokładnie tej wartości, więc hydratacja nie widzi rozjazdu. Sekundnik
 * rusza dopiero z efektu.
 */
export function LivePlayTimer({
  startedAt,
  initialElapsedMs,
  accumulatedMinutes = null,
  variant = "session",
  className,
}: {
  startedAt: string;
  initialElapsedMs: number;
  /** Suma zamkniętych wcześniej sesji — tylko dla wariantu „total”. */
  accumulatedMinutes?: number | null;
  /**
   * `session` — czas dzisiejszego grania (HH:MM:SS),
   * `total`   — łączny czas całej rozgrywki, razem z poprzednimi wieczorami.
   */
  variant?: "session" | "total";
  className?: string;
}) {
  const [elapsedMs, setElapsedMs] = useState(initialElapsedMs);

  useEffect(() => {
    const tick = () => setElapsedMs(getLiveElapsedMs(startedAt, new Date()));

    tick();
    const intervalId = window.setInterval(tick, 1000);

    return () => window.clearInterval(intervalId);
  }, [startedAt]);

  const label =
    variant === "total"
      ? formatPlayDurationLabel(
          (accumulatedMinutes ?? 0) + Math.round(elapsedMs / 60_000),
        )
      : formatLiveElapsed(elapsedMs);

  return (
    <span
      role="timer"
      aria-label={
        variant === "total"
          ? "Łączny czas rozgrywki"
          : "Czas trwania bieżącej sesji"
      }
      suppressHydrationWarning
      className={className}
    >
      {label}
    </span>
  );
}
