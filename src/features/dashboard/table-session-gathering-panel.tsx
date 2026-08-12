"use client";

import Image from "next/image";
import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { canUseNextImageOptimization } from "@/lib/image-sources";
import { formatMeetingDateRange } from "@/features/meetings/formatting";
import {
  FinishMeetingButton,
  TableSessionGamePicker,
} from "./table-session-controls";
import type { DashboardTableSession, TableSessionMember } from "./types";

/*
 * Wizualna warstwa stanu „drużyna przy stole” (gathering) — jedyny stan
 * dotknięty tą iteracją. Pozostałe stany „GRAMY!” (playing/summary) mieszkają
 * w table-session-panel.tsx i renderują inny, niezależny markup — świadomie
 * osobny plik, żeby restylizacja tego ekranu nie mogła przypadkiem dotknąć
 * ich wyglądu.
 *
 * Kierunek: ciemna, drewniano-mosiężna „skorupa” (dark fantasy shell,
 * table-wood-panel — ten sam, którego już używa hero „Stół” na górze
 * dashboardu) opakowująca jasną kartę pergaminową (parchment-card) ze
 * streszczeniem wieczoru. Oba te warianty tła już istnieją w globals.css —
 * ta iteracja nie dokłada żadnej nowej klasy globalnej ani assetu, tylko
 * układa istniejące klimaty w nowej kompozycji.
 *
 * Logika i akcje są niedotknięte: to samo TableSessionGamePicker (ta sama
 * startMeetingPlayAction pod spodem) i ten sam FinishMeetingButton (ta sama
 * finishMeetingAction) — zmienia się wyłącznie ich zewnętrzna warstwa
 * wizualna przez propy renderIdleButton / variant, które nie ruszają
 * domyślnego wyglądu używanego przez pozostałe stany.
 */

function GatheringCover({
  title,
  coverUrl,
}: {
  title: string;
  coverUrl: string | null;
}) {
  return (
    <div className="mx-auto w-[46%] max-w-[10.5rem] sm:w-[36%] sm:max-w-[9rem]">
      <div className="rounded-[1.15rem] border border-[#caa25a]/70 bg-[linear-gradient(155deg,rgba(58,38,20,0.9),rgba(32,19,11,0.95))] p-[3px] shadow-[0_16px_34px_rgba(20,9,4,0.4),inset_0_1px_0_rgba(255,224,163,0.16)]">
        <div className="aspect-[45/61] overflow-hidden rounded-[0.95rem] bg-[#f6ecdd]">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={title}
              width={220}
              height={300}
              unoptimized={!canUseNextImageOptimization(coverUrl)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-3 text-center text-[0.68rem] font-semibold text-[#8a6749]">
              Brak okładki
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GatheringPlayerChips({ members }: { members: TableSessionMember[] }) {
  if (members.length === 0) {
    return (
      <p className="text-center text-[0.7rem] font-semibold text-[#8a6749]">
        Skład ustali się przy stole.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {members.map((member) => (
        <span
          key={member.id}
          className="inline-flex max-w-[9rem] items-center gap-1.5 rounded-full border border-[#caa25a]/45 bg-[linear-gradient(180deg,rgba(58,36,24,0.94),rgba(40,24,15,0.96))] px-2.5 py-1 text-[0.64rem] font-bold text-[#f0dcb8] shadow-[inset_0_1px_0_rgba(255,232,187,0.1)]"
        >
          {member.avatarUrl ? (
            <Image
              src={member.avatarUrl}
              alt=""
              width={16}
              height={16}
              unoptimized
              className="size-3.5 shrink-0 rounded-full object-cover"
            />
          ) : null}
          <span className="truncate">{member.displayName}</span>
        </span>
      ))}
    </div>
  );
}

function GatheringInfoTile({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-[0.85rem] border border-[#c9a463]/45 bg-[linear-gradient(180deg,rgba(238,220,182,0.55),rgba(224,199,152,0.42))] px-2.5 py-1.5">
      <p className="flex items-center gap-1 text-[0.5rem] font-bold tracking-[0.14em] text-[#8a6231] uppercase">
        <span aria-hidden="true">{icon}</span>
        {label}
      </p>
      <p className="mt-0.5 truncate text-[0.76rem] font-semibold text-[#4a2f18]">
        {value}
      </p>
    </div>
  );
}

export function GatheringSessionPanel({
  session,
  entranceIndex = 1,
}: {
  session: DashboardTableSession;
  entranceIndex?: number;
}) {
  const range = formatMeetingDateRange({
    startsAt: session.meeting.startsAt,
    endsAt: session.meeting.endsAt,
  });

  return (
    <Panel
      style={{
        animationDelay: `${getEntranceStaggerDelayMs(entranceIndex)}ms`,
      }}
      className="anim-rise-in-fast table-wood-panel overflow-hidden p-3 sm:p-4"
    >
      <div className="min-w-0 text-center sm:text-left">
        <p className="text-[0.58rem] font-bold tracking-[0.24em] text-[#e0b978] uppercase">
          Wieczór przy stole
        </p>
        <h2 className="font-display mt-1 text-[1.55rem] leading-[1.08] font-semibold text-[#fff3e0] sm:text-[1.85rem]">
          Drużyna jest przy stole
        </h2>
        <p className="mt-1 truncate text-[0.82rem] font-semibold text-[#e7c793]">
          {session.meeting.title}
        </p>
      </div>

      {/* Delikatny ornamentalny separator — jedna cienka złota linia, bez
          dodatkowych zdobień. */}
      <div className="my-2.5 h-px bg-[linear-gradient(90deg,transparent,rgba(214,160,68,0.55),transparent)]" />

      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
        <span className="inline-flex items-center gap-1 rounded-full border border-[#d6a044]/55 bg-[linear-gradient(180deg,rgba(45,66,45,0.92),rgba(24,38,24,0.96))] px-2.5 py-1 text-[0.62rem] font-bold tracking-[0.02em] text-[#dcead8] shadow-[0_0_14px_rgba(92,109,89,0.35)]">
          <span aria-hidden="true">⏳</span> TRWA TERAZ
        </span>
        <Link
          href={session.meeting.href}
          className="rounded-full border border-[#caa25a]/40 bg-[rgba(255,255,255,0.05)] px-2.5 py-1 text-[0.62rem] font-bold text-[#e7d3ab] transition hover:bg-[rgba(255,255,255,0.09)]"
        >
          Spotkanie →
        </Link>
      </div>

      {/* Wewnętrzna, jaśniejsza warstwa pergaminowa — jeden spójny blok:
          okładka → tekst → gracze → termin/miejsce → CTA. */}
      <div className="parchment-card mt-3 rounded-[1.35rem] p-3 sm:p-4">
        <GatheringCover
          title={session.meeting.leadingGame?.title ?? "Wybierz grę"}
          coverUrl={session.meeting.leadingGame?.coverUrl ?? null}
        />

        <p className="mt-2.5 text-center text-[0.8rem] leading-snug font-semibold text-[#5a3d22]">
          Drużyna zebrała się przy stole.
          <br />
          Czas wybrać grę.
        </p>

        <div className="mt-2.5">
          <GatheringPlayerChips members={session.participants} />
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          <GatheringInfoTile
            icon="📅"
            label="Termin"
            value={`${range.startDate} · ${range.startTime}`}
          />
          <GatheringInfoTile
            icon="📍"
            label="Miejsce"
            value={session.meeting.location ?? "Do ustalenia"}
          />
        </div>

        <div className="mt-3">
          <TableSessionGamePicker
            meetingId={session.meeting.id}
            choices={session.gameChoices}
            autoOpen={false}
            idleLabel="Zaczynamy grać"
            renderIdleButton={(onClick) => (
              <button
                type="button"
                onClick={onClick}
                className="w-full rounded-[0.95rem] border border-[#e9c27a] bg-[linear-gradient(180deg,#2f5433,#1c3521)] px-4 py-3 text-[0.82rem] font-bold tracking-[0.03em] text-[#f7ecc9] shadow-[inset_0_1px_0_rgba(255,238,190,0.28),0_10px_26px_rgba(20,40,20,0.4)] transition hover:brightness-110 active:translate-y-px active:brightness-95"
              >
                ⚔️ Zaczynamy grać
              </button>
            )}
          />
        </div>
      </div>

      {session.canFinishMeeting ? (
        <div className="mt-2.5">
          <FinishMeetingButton meetingId={session.meeting.id} variant="wood" />
        </div>
      ) : null}
    </Panel>
  );
}
