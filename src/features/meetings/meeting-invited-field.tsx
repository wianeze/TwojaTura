"use client";

import { useMemo, useState } from "react";
import { getMemberInitial } from "@/features/auth/current-member";
import {
  clearInvitedIds,
  filterInvitableMembers,
  selectAllInvitableIds,
  toggleInvitedUserId,
} from "./invited-selection";
import type { MeetingMember } from "./types";

type MeetingInvitedFieldProps = {
  members: MeetingMember[];
  defaultValue: string[];
  error?: string;
};

/*
  "Kogo zapraszasz?" — organizator wybiera wprost, kto dostanie zaproszenie
  i powiadomienie push; nic nie dzieje się automatycznie dla nikogo innego.
  Organizator sam nie występuje w `members` (odsiany już w
  getInvitableMembers/getMeetingCreateFormData), więc nie da się go ani
  zaznaczyć, ani "usunąć" — nie jest tu w ogóle wierszem do wyboru.

  Wybór trafia do submitu jako JSON w ukrytym polu, tym samym wzorcem co
  `participants` w PlayParticipantsField — realna walidacja identyfikatorów
  (aktywny member, bez duplikatów, bez organizatora) i tak żyje w RPC, to pole
  tylko wygodnie serializuje aktualny stan checkboxów.
*/
export function MeetingInvitedField({
  members,
  defaultValue,
  error,
}: MeetingInvitedFieldProps) {
  const [selectedIds, setSelectedIds] = useState(defaultValue);
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleMembers = useMemo(
    () => filterInvitableMembers(members, query),
    [members, query],
  );

  function toggle(memberId: string) {
    setSelectedIds((current) => toggleInvitedUserId(current, memberId));
  }

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name="invitedUserIds"
        value={JSON.stringify(selectedIds)}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#503828]">
            Kogo zapraszasz?
          </p>
          <p className="mt-0.5 text-xs text-[#7a6048]">
            Zaproszenie i powiadomienie dostaną wyłącznie zaznaczone osoby.
          </p>
        </div>
        <span className="paper-wash rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap text-[#6a4f38]">
          Zaproszeni: {selectedIds.length}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedIds(selectAllInvitableIds(members))}
          className="rounded-full border border-[#ccb18b]/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#6b5140] transition hover:bg-[#f4e5cf]"
        >
          Zaznacz wszystkich
        </button>
        <button
          type="button"
          onClick={() => setSelectedIds(clearInvitedIds())}
          className="rounded-full border border-[#ccb18b]/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#6b5140] transition hover:bg-[#f4e5cf]"
        >
          Wyczyść wybór
        </button>

        {members.length > 8 ? (
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Szukaj osoby…"
            className="focus:border-gold focus:ring-gold/20 ml-auto h-9 min-w-0 flex-1 rounded-full border border-[#9a7657]/35 bg-white/80 px-3.5 text-xs text-[#503828] transition outline-none focus:ring-4 sm:max-w-56"
          />
        ) : null}
      </div>

      {error ? (
        <p className="text-xs font-semibold text-[#8f3528]">{error}</p>
      ) : null}

      {members.length === 0 ? (
        <p className="paper-wash rounded-xl px-3.5 py-3 text-sm text-[#7a6048]">
          Brak innych aktywnych członków do zaproszenia.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {visibleMembers.map((member) => {
            const selected = selectedSet.has(member.id);

            return (
              <button
                key={member.id}
                type="button"
                onClick={() => toggle(member.id)}
                aria-pressed={selected}
                className={`flex min-w-0 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b48760] ${
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
                    className="size-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="bg-brand text-cream grid size-8 shrink-0 place-items-center rounded-full text-[0.75rem] font-bold">
                    {getMemberInitial(member.displayName)}
                  </span>
                )}
                <span className="min-w-0 truncate">{member.displayName}</span>
              </button>
            );
          })}

          {visibleMembers.length === 0 ? (
            <p className="col-span-full text-sm text-[#7a6048]">
              Nikt nie pasuje do wyszukiwania „{query}”.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
