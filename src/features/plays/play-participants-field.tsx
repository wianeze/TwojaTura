"use client";

import { useMemo, useState } from "react";
import { getMemberInitial } from "@/features/auth/current-member";
import type {
  PlayMember,
  PlayParticipantDraft,
  PlayParticipantFieldError,
} from "./types";

type PlayParticipantsFieldProps = {
  members: PlayMember[];
  defaultValue: PlayParticipantDraft[];
  error?: string;
  participantErrors?: Record<string, PlayParticipantFieldError>;
};

function normalizeDrafts(drafts: PlayParticipantDraft[]) {
  return drafts.map((draft) => ({
    userId: draft.userId,
    isWinner: draft.isWinner,
    placement: draft.placement ?? "",
    score: draft.score ?? "",
  }));
}

export function PlayParticipantsField({
  members,
  defaultValue,
  error,
  participantErrors,
}: PlayParticipantsFieldProps) {
  const [drafts, setDrafts] = useState(() => normalizeDrafts(defaultValue));
  const selectedIds = useMemo(
    () => new Set(drafts.map((draft) => draft.userId)),
    [drafts],
  );

  function toggleMember(memberId: string) {
    setDrafts((current) => {
      const exists = current.some((draft) => draft.userId === memberId);
      if (exists) {
        return current.filter((draft) => draft.userId !== memberId);
      }

      return [
        ...current,
        {
          userId: memberId,
          isWinner: current.length === 0,
          placement: "",
          score: "",
        },
      ];
    });
  }

  function updateDraft(memberId: string, patch: Partial<PlayParticipantDraft>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.userId === memberId ? { ...draft, ...patch } : draft,
      ),
    );
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="participants" value={JSON.stringify(drafts)} />

      <div className="flex flex-wrap gap-2">
        {members.map((member) => {
          const selected = selectedIds.has(member.id);

          return (
            <button
              key={member.id}
              type="button"
              onClick={() => toggleMember(member.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                selected
                  ? "border-[#8d5a31] bg-[#ead6b3] text-[#523625]"
                  : "border-[#ccb18b]/70 bg-white/70 text-[#6b5140] hover:bg-[#f4e5cf]"
              }`}
            >
              {member.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- external user-provided URL
                <img
                  src={member.avatarUrl}
                  alt=""
                  className="size-6 rounded-full object-cover"
                />
              ) : (
                <span className="bg-brand text-cream grid size-6 place-items-center rounded-full text-[0.65rem] font-bold">
                  {getMemberInitial(member.displayName)}
                </span>
              )}
              <span>{member.displayName}</span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="text-xs font-semibold text-[#8f3528]">{error}</p>
      ) : null}

      {drafts.length > 0 ? (
        <div className="space-y-2">
          {drafts.map((draft) => {
            const member =
              members.find((entry) => entry.id === draft.userId) ?? null;
            if (!member) return null;

            const rowErrors = participantErrors?.[draft.userId];

            return (
              <div
                key={draft.userId}
                className="paper-wash rounded-[1.05rem] border border-[#cfb595]/60 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {member.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external user-provided URL
                      <img
                        src={member.avatarUrl}
                        alt=""
                        className="size-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="bg-brand text-cream grid size-8 place-items-center rounded-full text-[0.82rem] font-bold">
                        {getMemberInitial(member.displayName)}
                      </span>
                    )}
                    <span className="min-w-0 text-sm font-semibold break-words text-[#4d3528]">
                      {member.displayName}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft(draft.userId, { isWinner: !draft.isWinner })
                      }
                      className={`rounded-full px-3 py-1.5 text-[0.68rem] font-bold transition ${
                        draft.isWinner
                          ? "bg-moss-soft text-moss"
                          : "bg-[#eadcc6] text-[#72553a] hover:bg-[#e4d2b7]"
                      }`}
                    >
                      Zwycięzca
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleMember(draft.userId)}
                      className="rounded-full px-2.5 py-1.5 text-[0.68rem] font-bold text-[#7b3428] transition hover:bg-[#fff0ec]"
                    >
                      Usuń
                    </button>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2.5">
                  <label className="text-[0.7rem] font-semibold text-[#6a4d38]">
                    Miejsce
                    <input
                      value={draft.placement}
                      onChange={(event) =>
                        updateDraft(draft.userId, {
                          placement: event.target.value,
                        })
                      }
                      inputMode="numeric"
                      className="mt-1 h-9 w-full rounded-lg border border-[#b79674]/45 bg-white/85 px-2.5 text-sm text-[#4d3528] outline-none"
                    />
                    {rowErrors?.placement ? (
                      <span className="mt-1 block text-[0.68rem] text-[#8f3528]">
                        {rowErrors.placement}
                      </span>
                    ) : null}
                  </label>

                  <label className="text-[0.7rem] font-semibold text-[#6a4d38]">
                    Wynik
                    <input
                      value={draft.score}
                      onChange={(event) =>
                        updateDraft(draft.userId, { score: event.target.value })
                      }
                      inputMode="decimal"
                      className="mt-1 h-9 w-full rounded-lg border border-[#b79674]/45 bg-white/85 px-2.5 text-sm text-[#4d3528] outline-none"
                    />
                    {rowErrors?.score ? (
                      <span className="mt-1 block text-[0.68rem] text-[#8f3528]">
                        {rowErrors.score}
                      </span>
                    ) : null}
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
