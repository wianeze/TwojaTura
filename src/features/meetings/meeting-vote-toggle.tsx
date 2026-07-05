"use client";

import { useState, useTransition } from "react";
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

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
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
        className={`rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${
          hasOwnVote ? "bg-moss text-white" : "paper-wash text-[#6a4f38]"
        } disabled:cursor-not-allowed disabled:opacity-70`}
      >
        {pending ? "Zapisuję…" : hasOwnVote ? "Głosuję" : "Głosuj"}
      </button>
      {message ? (
        <p className="text-xs font-semibold text-[#8f3528]">{message}</p>
      ) : null}
    </div>
  );
}
