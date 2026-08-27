import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { PlayerPortraitFrame } from "@/components/ui/player-portrait-frame";
import { PlayerDisplayName } from "@/components/ui/player-display-name";
import { canUseNextImageOptimization } from "@/lib/image-sources";
import { getLiveElapsedMs } from "@/features/meetings/live-play";
import { formatDashboardTime } from "./formatting";
import { LivePlayTimer } from "./live-play-timer";
import { LivePlayControls } from "./table-session-controls";
import type { DashboardTableSession, TableSessionMember } from "./types";

/*
 * Moduł „GRAMY!” — jedyny stan Stołu z FAKTYCZNIE trwającą partią. Osobny
 * plik z tego samego powodu co table-session-gathering-panel.tsx:
 * restylizacja jednego stanu nie może przypadkiem dotknąć pozostałych. Stan
 * „podsumowanie” (table-session-summary-panel.tsx, SummarySessionPanel) ma
 * być wizualnie SPÓJNY z tym modułem — stąd eksport GLOW_RGB i
 * SessionInfoTile stąd, żeby oba stany dzieliły dokładnie tę samą logikę
 * koloru poświaty i dokładnie ten sam wygląd kafli info, zamiast dwóch
 * osobnych, mogących się rozjechać implementacji. Dispatch do obu żyje w
 * table-session-panel.tsx, całkowicie nietknięty poza samym dispatchem.
 *
 * Tłem sekcji jest prawdziwa okładka ogrywanej gry (<Image fill>) z ciemnym
 * overlayem nad nią (.playing-cover-overlay w globals.css) dla czytelności
 * treści. Poświata sekcji (.playing-module) jest niebieska albo
 * pomarańczowa zależnie od tego, które z równoległych spotkań w
 * przełączniku jest aktywne — sterowana przez prop `accent`, wyliczany
 * przez rodzica (dashboard-showcase.tsx) z pozycji na liście
 * tableSessionOptions. Animowana jest wyłącznie intensywność tej poświaty
 * (patrz komentarz przy .playing-module) — nie cała sekcja.
 *
 * Logika jest niedotknięta: to samo LivePlayControls (te same akcje
 * finishMeetingPlayAction/cancelMeetingPlayAction pod spodem) i ten sam
 * LivePlayTimer — zmienia się wyłącznie warstwa wizualna wokół nich.
 */

const SWORDS_ICON_PATH = "M5 19L19 5M19 19L5 5M8 13.5L10.5 16M13.5 16L16 13.5";
const CLOCK_ICON_PATH = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3.2 2";

export const GLOW_RGB: Record<"blue" | "orange", string> = {
  blue: "94, 158, 214",
  orange: "224, 140, 58",
};

export function SessionInfoTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-[0.8rem] border border-white/14 bg-[rgba(20,13,9,0.55)] px-2.5 py-1.5 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
      <p className="text-[0.5rem] font-bold tracking-[0.14em] text-[#e0b978] uppercase">
        {label}
      </p>
      <p className="truncate text-[0.74rem] font-semibold text-[#fff3e0]">
        {value}
      </p>
    </div>
  );
}

/* Ten sam wzorzec co GatheringHeroes (table-session-gathering-panel.tsx) —
   portrety w aktywnej ramce + podpis, nie ciężkie prostokątne kapsułki
   PlayerChips sprzed przebudowy — dla spójności z resztą Stołu. */
function PlayingRoster({ members }: { members: TableSessionMember[] }) {
  if (members.length === 0) return null;

  return (
    <div className="table-heroes-row justify-center">
      {members.map((member) => (
        <div key={member.id} className="table-hero">
          <PlayerPortraitFrame
            avatarUrl={member.avatarUrl}
            name={member.displayName}
            size="medium"
          />
          <PlayerDisplayName
            variant="compact"
            displayName={member.displayName}
            title={member.equippedTitle}
            className="w-full text-center text-[0.66rem] font-bold text-[#fff3e0] [text-shadow:0_1px_2px_rgba(0,0,0,0.65)]"
          />
        </div>
      ))}
    </div>
  );
}

export function PlayingSessionPanel({
  session,
  accent,
}: {
  session: DashboardTableSession;
  /** Lewe spotkanie z przełącznika = niebieski, prawe = pomarańczowy. */
  accent: "blue" | "orange";
}) {
  const livePlay = session.livePlay;
  if (!livePlay) return null;

  const now = new Date();

  return (
    <div
      className="playing-module"
      style={{ "--glow-rgb": GLOW_RGB[accent] } as CSSProperties}
    >
      {livePlay.coverUrl ? (
        <Image
          src={livePlay.coverUrl}
          alt=""
          fill
          sizes="(min-width: 640px) 40rem, 100vw"
          unoptimized={!canUseNextImageOptimization(livePlay.coverUrl)}
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#2a1a12,#1c110b)]" />
      )}
      <div
        className="playing-cover-overlay absolute inset-0"
        aria-hidden="true"
      />

      <div className="relative space-y-3 p-3 sm:p-4">
        <div className="text-center">
          <span className="inline-flex items-center gap-1 rounded-full border border-[#d6a044]/55 bg-[linear-gradient(180deg,rgba(45,66,45,0.92),rgba(24,38,24,0.96))] px-2.5 py-1 text-[0.62rem] font-bold tracking-[0.02em] text-[#dcead8] shadow-[0_0_14px_rgba(92,109,89,0.35)]">
            <span aria-hidden="true">⏳</span>
            {livePlay.isContinuation ? "KONTYNUACJA" : "PARTIA TRWA"}
          </span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <svg
            className="size-6 shrink-0 text-[#ffdcae]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={SWORDS_ICON_PATH} />
          </svg>
          <h2 className="font-display text-[1.55rem] font-bold text-[#fff3e0] [text-shadow:0_2px_4px_rgba(0,0,0,0.6)] sm:text-[1.8rem]">
            GRAMY!
          </h2>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-[0.85rem] font-semibold text-[#f0dcb8] [text-shadow:0_1px_2px_rgba(0,0,0,0.65)]">
            {session.meeting.title}
          </p>
          <Link
            href={session.meeting.href}
            className="shrink-0 rounded-full border border-[#caa25a]/40 bg-[rgba(255,255,255,0.12)] px-2.5 py-1 text-[0.62rem] font-bold text-[#e7d3ab] shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition hover:bg-[rgba(255,255,255,0.2)]"
          >
            Spotkanie →
          </Link>
        </div>

        <p className="font-display text-center text-[1.35rem] font-bold text-[#fff3e0] [text-shadow:0_1px_2px_rgba(0,0,0,0.65),0_0_18px_rgba(0,0,0,0.5)] sm:text-[1.55rem]">
          {livePlay.gameTitle}
        </p>

        <div className="text-center">
          <p className="font-display inline-flex items-center justify-center gap-2 text-[2.5rem] leading-none font-semibold tracking-[0.02em] text-[#fff3e0] tabular-nums [text-shadow:0_2px_10px_rgba(0,0,0,0.65)] sm:text-[3rem]">
            <svg
              className="size-8 shrink-0 sm:size-9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={CLOCK_ICON_PATH} />
            </svg>
            <LivePlayTimer
              startedAt={livePlay.startedAt}
              initialElapsedMs={getLiveElapsedMs(livePlay.startedAt, now)}
            />
          </p>

          {livePlay.isContinuation ? (
            <p className="mt-1 text-[0.7rem] font-semibold text-[#e0b978] [text-shadow:0_1px_2px_rgba(0,0,0,0.65)]">
              Łącznie z poprzednimi sesjami:{" "}
              <LivePlayTimer
                startedAt={livePlay.startedAt}
                initialElapsedMs={getLiveElapsedMs(livePlay.startedAt, now)}
                accumulatedMinutes={livePlay.accumulatedMinutes}
                variant="total"
              />
            </p>
          ) : null}
        </div>

        <PlayingRoster members={livePlay.players} />

        <div className="grid grid-cols-2 gap-1.5">
          <SessionInfoTile
            label={livePlay.isContinuation ? "Start sesji" : "Start partii"}
            value={formatDashboardTime(livePlay.startedAt)}
          />
          <SessionInfoTile
            label="Miejsce"
            value={session.meeting.location ?? "Do ustalenia"}
          />
        </div>

        <LivePlayControls
          meetingId={session.meeting.id}
          playId={livePlay.playId}
          canManage={session.canManagePlays}
          isContinuation={livePlay.isContinuation}
        />

        <div className="text-center">
          <Link
            href={`/kronika/${livePlay.playId}`}
            className="text-[0.62rem] font-semibold text-[#e0c8a8] underline decoration-[#e0c8a8]/35 underline-offset-4"
          >
            Szczegóły wpisu
          </Link>
        </div>
      </div>
    </div>
  );
}
