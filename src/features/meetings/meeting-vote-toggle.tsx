"use client";

import { useState, useTransition } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { useCanWrite } from "@/features/auth/member-role-context";
import { toggleMeetingVoteAction } from "./actions";

export function MeetingVoteToggle({
  meetingId,
  gameId,
  hasOwnVote,
}: {
  meetingId: string;
  gameId: string;
  hasOwnVote: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const canWrite = useCanWrite();
  if (!canWrite) return null;

  return (
    <div className="space-y-2">
      {/*
        Oddany głos nosi barwę akcji głosowania (niebieski); brak głosu
        zostaje neutralny. Zieleń jest zarezerwowana dla oceniania gry.
      */}
      <ActionButton
        type="button"
        action={hasOwnVote ? "vote" : "neutral"}
        size="compact"
        emphasis={hasOwnVote ? "primary" : "secondary"}
        disabled={pending}
        loading={pending}
        loadingLabel="Zapisuję…"
        onClick={() =>
          startTransition(async () => {
            const result = await toggleMeetingVoteAction(
              meetingId,
              gameId,
              !hasOwnVote,
            );
            setMessage(
              result.status === "error" ? (result.message ?? null) : null,
            );
          })
        }
      >
        {hasOwnVote ? "Głosuję" : "Głosuj"}
      </ActionButton>
      {message ? (
        <p className="text-xs font-semibold text-[#8f3528]">{message}</p>
      ) : null}
    </div>
  );
}
