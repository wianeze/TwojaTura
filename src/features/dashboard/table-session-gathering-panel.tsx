"use client";

import { ActionButton } from "@/components/ui/action-button";
import { PlayerPortraitFrame } from "@/components/ui/player-portrait-frame";
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
 * Ten komponent NIE renderuje własnego <Panel> — to jest treść WEWNĄTRZ
 * jednego, wspólnego modułu Stołu (.table-sheet w dashboard-showcase.tsx).
 * Gdy ten panel jest aktywny, dashboard-showcase.tsx CAŁKOWICIE chowa
 * nagłówek „Witaj przy stole” i trzy kafle CTA — nie renderuje ich obok
 * siebie. Stąd brak tła/border-radius/cienia tutaj — to wszystko należy
 * teraz do rodzica.
 *
 * Logika i akcje są niedotknięte: to samo TableSessionGamePicker (ta sama
 * startMeetingPlayAction pod spodem) i ten sam FinishMeetingButton (ta sama
 * finishMeetingAction) — zmienia się wyłącznie ich zewnętrzna warstwa
 * wizualna przez propy renderIdleButton / variant / showTopChoicesPreview,
 * które nie ruszają domyślnego wyglądu używanego przez pozostałe stany.
 */

function GatheringHeroes({ members }: { members: TableSessionMember[] }) {
  if (members.length === 0) {
    return (
      <p className="text-center text-[0.7rem] font-semibold text-[#c9a463]">
        Skład ustali się przy stole.
      </p>
    );
  }

  return (
    <div className="table-heroes-row justify-center sm:flex-wrap sm:justify-start">
      {members.map((member) => (
        <div key={member.id} className="table-hero">
          <PlayerPortraitFrame
            avatarUrl={member.avatarUrl}
            name={member.displayName}
            size="medium"
          />
          <p className="w-full truncate text-center text-[0.66rem] font-bold text-[#f0dcb8]">
            {member.displayName}
            {member.isViewer ? (
              <span className="text-[#c9a463]"> (Ty)</span>
            ) : null}
          </p>
          <p className="text-[0.58rem] font-semibold text-[#c9a463]">
            {member.points.toLocaleString("pl-PL")} pkt
          </p>
        </div>
      ))}
    </div>
  );
}

export function GatheringSessionPanel({
  session,
}: {
  session: DashboardTableSession;
}) {
  const range = formatMeetingDateRange({
    startsAt: session.meeting.startsAt,
    endsAt: session.meeting.endsAt,
  });

  return (
    // Ujemny margines u góry ściąga treść bliżej wewnętrznej krawędzi ramy
    // (Panel w dashboard-showcase.tsx ma własny padding, który tu był
    // dodatkową, zbyt dużą przerwą nad TRWA TERAZ) — dotyczy WYŁĄCZNIE tego
    // widoku, nie rusza paddingu Panelu (a więc i stanu bez sesji).
    <div className="-mt-2.5 space-y-3 sm:-mt-2">
      {/* TRWA TERAZ na samej górze, wyśrodkowany, nad tytułem — zwalnia
          miejsce w rzędzie nazwy spotkania niżej (patrz .table-status-row). */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1 rounded-full border border-[#d6a044]/55 bg-[linear-gradient(180deg,rgba(45,66,45,0.92),rgba(24,38,24,0.96))] px-2.5 py-1 text-[0.62rem] font-bold tracking-[0.02em] text-[#dcead8] shadow-[0_0_14px_rgba(92,109,89,0.35)]">
          <span aria-hidden="true">⏳</span> TRWA TERAZ
        </span>
      </div>

      <div className="text-center sm:text-left">
        <h2 className="table-legend-title font-display text-[1.55rem] leading-[1.08] font-semibold sm:text-[1.85rem]">
          Drużyna jest przy stole
        </h2>
      </div>

      {/* Nazwa spotkania + link. Na smartfonie: pionowo, wyśrodkowane (patrz
          .table-status-row). Od sm: wraca poprzedni rząd (nazwa do lewej,
          link po prawej). Overflow (line-clamp na mobile / jednowierszowa
          elipsa od sm:) jest CAŁKOWICIE w .table-meeting-name w globals.css
          — bez Tailwindowego `truncate` tutaj, żeby nie wymuszał
          white-space: nowrap na mobile i nie psuł zawijania do 2 linii. */}
      <div className="table-status-row">
        <p className="table-meeting-name min-w-0 text-[#fff3e0]">
          {session.meeting.title}
        </p>
        <a
          href={session.meeting.href}
          className="shrink-0 rounded-full border border-[#caa25a]/40 bg-[rgba(255,255,255,0.05)] px-2.5 py-1 text-[0.62rem] font-bold text-[#e7d3ab] transition hover:bg-[rgba(255,255,255,0.09)]"
        >
          Spotkanie →
        </a>
      </div>

      <p className="text-center text-[0.72rem] text-[#c9a463] sm:text-left">
        {range.startDate} · {range.startTime} ·{" "}
        {session.meeting.location ?? "Do ustalenia"}
      </p>

      <div className="space-y-2">
        <p className="text-center text-[0.82rem] font-bold tracking-[0.14em] text-[#e0b978] uppercase sm:text-left">
          Zebrana grupa bohaterów:
        </p>
        <GatheringHeroes members={session.participants} />
      </div>

      <div className="space-y-2">
        <p className="text-center text-[0.82rem] font-bold tracking-[0.14em] text-[#e0b978] uppercase sm:text-left">
          Czas wybrać przygodę:
        </p>

        <TableSessionGamePicker
          meetingId={session.meeting.id}
          choices={session.gameChoices}
          autoOpen={false}
          idleLabel="Zaczynamy grać"
          showTopChoicesPreview
          renderIdleButton={(onClick) => (
            // Dolne 2 główne przyciski: lewo Zakończ spotkanie (drugorzędne,
            // bronze-wood), prawo Zaczynamy grać (Orange, skrzyżowane
            // miecze) — kliknięcie dalej otwiera picker przez onClick, tak
            // samo jak wcześniej. table-cta-row = scoped, wyższy wariant
            // "large" (patrz globals.css) tylko dla tych dwóch przycisków.
            <div
              className={
                session.canFinishMeeting
                  ? "table-cta-row grid grid-cols-2 gap-2"
                  : "table-cta-row"
              }
            >
              {session.canFinishMeeting ? (
                <FinishMeetingButton
                  meetingId={session.meeting.id}
                  variant="wood"
                />
              ) : null}
              <ActionButton
                type="button"
                action="play"
                size="large"
                fullWidth
                onClick={onClick}
              >
                Zaczynamy grać
              </ActionButton>
            </div>
          )}
        />
      </div>
    </div>
  );
}
