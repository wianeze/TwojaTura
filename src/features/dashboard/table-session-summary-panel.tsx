"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { ActionLink } from "@/components/ui/action-button";
import { canUseNextImageOptimization } from "@/lib/image-sources";
import { formatPlayDurationLabel } from "@/features/meetings/live-play";
import { isWithinMeetingWindow } from "./formatting";
import { GLOW_RGB, SessionInfoTile } from "./table-session-playing-panel";
import {
  FinishMeetingButton,
  PlayAgainButton,
  ResumePlayButton,
  TableSessionGamePicker,
} from "./table-session-controls";
import type { DashboardTableSession, TableSessionEndedPlay } from "./types";

/*
 * Stan „podsumowanie” (WIECZÓR TRWA — partia właśnie się skończyła, wieczór
 * jeszcze nie) — świadomie ten sam system wizualny co PlayingSessionPanel
 * (table-session-playing-panel.tsx, moduł GRAMY!), nie osobny, starszy
 * komponent: ta sama plakietka z tłem-okładką + poświatą (.playing-module/
 * .playing-cover-overlay), ten sam SessionInfoTile, ten sam GLOW_RGB (import
 * stamtąd — jedno źródło prawdy dla koloru poświaty, żeby oba stany nie
 * mogły się rozjechać), ta sama kolejność: badge -> nagłówek -> rząd
 * nazwa+link.
 *
 * Logika jest niedotknięta: te same akcje (finishMeetingPlayAction przez
 * PlayAgainButton/ResumePlayButton, finishMeetingAction przez
 * FinishMeetingButton, TableSessionGamePicker) i te same trzy warianty fazy
 * partii (completed/awaiting-result/paused) sterujące statusem i
 * dostępnymi przyciskami — zmienia się wyłącznie warstwa wizualna wokół
 * nich i ich UKŁAD (kolejność/rozmiar/wysokość), nie ich zachowanie.
 */

const RESULT_TONE_CLASSES: Record<"win" | "loss" | "neutral", string> = {
  win: "text-[#c8e6c0]",
  loss: "text-[#f0b8bf]",
  neutral: "text-[#fff3e0]",
};

function SummaryFinishedPlayLine({ play }: { play: TableSessionEndedPlay }) {
  return (
    <Link
      href={play.href}
      className="flex items-center justify-between gap-2 rounded-[0.6rem] border border-white/10 bg-[rgba(20,13,9,0.5)] px-2.5 py-1.5 transition hover:bg-[rgba(20,13,9,0.7)]"
    >
      <span className="min-w-0 truncate text-[0.68rem] font-bold text-[#fff3e0]">
        {play.gameTitle}
      </span>
      <span className="shrink-0 text-[0.62rem] font-semibold text-[#e0c8a8]">
        {formatPlayDurationLabel(play.durationMinutes)}
      </span>
    </Link>
  );
}

export function SummarySessionPanel({
  session,
  accent,
  autoOpenGamePicker = false,
}: {
  session: DashboardTableSession;
  /** Lewe spotkanie z przełącznika = niebieski, prawe = pomarańczowy. */
  accent: "blue" | "orange";
  autoOpenGamePicker?: boolean;
}) {
  // Odbicie wewnętrznego stanu TableSessionGamePicker (patrz onOpenChange) —
  // pozwala PRZEBUDOWAĆ layout wokół pickera, gdy lista się otwiera: "Zagraj
  // ponownie"/"Wznów partię" ma wtedy przenieść się znad połowicznej kolumny
  // na cały wiersz nad rozwiniętą listą, zamiast zostać ściśnięte obok niej.
  const [isPickerOpen, setIsPickerOpen] = useState(autoOpenGamePicker);

  const lastPlay = session.lastEndedPlay;
  if (!lastPlay) return null;

  const now = new Date();
  const isWithinWindow = isWithinMeetingWindow(session.meeting, now);
  const coverUrl =
    lastPlay.coverUrl ?? session.meeting.leadingGame?.coverUrl ?? null;

  const statusText =
    lastPlay.phase === "completed"
      ? lastPlay.resultLabel
      : lastPlay.phase === "awaiting-result"
        ? "⏳ WYNIK DO UZUPEŁNIENIA"
        : "⏸ PARTIA ODŁOŻONA";

  const subtext =
    lastPlay.phase === "awaiting-result"
      ? "Możecie dokończyć partię albo od razu uzupełnić wynik."
      : lastPlay.phase === "paused"
        ? "Wrócicie do niej na kolejnej sesji."
        : "Wynik zapisany w Kronice.";

  return (
    <div
      className="playing-module"
      style={{ "--glow-rgb": GLOW_RGB[accent] } as CSSProperties}
    >
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt=""
          fill
          sizes="(min-width: 640px) 40rem, 100vw"
          unoptimized={!canUseNextImageOptimization(coverUrl)}
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
            {isWithinWindow ? "TRWA TERAZ" : "GRAMY PO GODZINACH"}
          </span>
        </div>

        <h2 className="font-display text-center text-[1.55rem] font-bold text-[#fff3e0] [text-shadow:0_2px_4px_rgba(0,0,0,0.6)] sm:text-[1.8rem]">
          WIECZÓR TRWA
        </h2>

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

        {/* Główny blok partii — okładka + wynik, z wyraźnym oddechem
            (gap-4, nie gap-3 jak w GRAMY!, bo tu nie ma już timera/rosteru
            odciążających pion) i mocnym, bardzo czytelnym statusem. */}
        <div className="flex items-start gap-4 rounded-[0.9rem] border border-white/10 bg-[rgba(15,10,7,0.4)] p-3">
          <div className="h-[6.6rem] w-[4.9rem] shrink-0 overflow-hidden rounded-[0.6rem] border border-white/20 shadow-[0_10px_24px_rgba(0,0,0,0.45)] sm:h-[7.6rem] sm:w-[5.6rem]">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt={lastPlay.gameTitle}
                width={90}
                height={122}
                unoptimized={!canUseNextImageOptimization(coverUrl)}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-[rgba(20,13,9,0.7)] px-2 text-center text-[0.62rem] font-semibold text-[#e0c8a8]">
                Brak okładki
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="font-display truncate text-[1.15rem] leading-tight font-bold text-[#fff3e0] [text-shadow:0_1px_2px_rgba(0,0,0,0.65)] sm:text-[1.3rem]">
              {lastPlay.gameTitle}
            </p>
            <p
              className={`text-[1.05rem] leading-tight font-bold [text-shadow:0_1px_2px_rgba(0,0,0,0.65)] ${RESULT_TONE_CLASSES[lastPlay.resultTone]}`}
            >
              {statusText}
            </p>
            <p className="text-[0.7rem] leading-snug text-[#e0c8a8] [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
              {subtext}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <SessionInfoTile
            label={lastPlay.phase === "paused" ? "Czas dotychczas" : "Czas gry"}
            value={formatPlayDurationLabel(lastPlay.durationMinutes)}
          />
          <SessionInfoTile label="Gracze" value={`${lastPlay.playersCount}`} />
        </div>

        {/* Hierarchia akcji: dla każdego nierozliczonego wpisu główne CTA
            wraca do TEGO SAMEGO play_id. Wynik oczekujący na uzupełnienie
            nadal można rozliczyć bez wznawiania. "Zakończ spotkanie"
            osobno na samym dole jako domknięcie wieczoru — nie obok reszty. */}
        <div className="space-y-1.5">
          {lastPlay.phase === "awaiting-result" ? (
            <ResumePlayButton
              meetingId={session.meeting.id}
              playId={lastPlay.playId}
              label="Wznów partię"
            />
          ) : null}

          {/* Dopóki lista wyboru gry jest zamknięta: "Zagraj ponownie"/"Wznów
              partię" obok przycisku "Wybierz kolejną grę" (table-icon-stack:
              ikona NAD tekstem, nie obok — patrz komentarz przy
              .table-icon-stack w globals.css; bez tego ikona + dwuwierszowy
              tekst w połowicznej kolumnie potrafi wyrenderować się z
              widocznie nierównym marginesem z lewej strony). Po otwarciu
              listy (isPickerOpen, odbite z TableSessionGamePicker przez
              onOpenChange) układ przechodzi w pionowy stos: "Zagraj
              ponownie" wjeżdża NAD listę, a lista dostaje pełną szerokość
              sekcji zamiast połowicznej kolumny. */}
          <div
            className={
              isPickerOpen
                ? "space-y-1.5"
                : "table-icon-stack grid grid-cols-2 gap-1.5"
            }
          >
            {lastPlay.phase === "paused" ? (
              <ResumePlayButton
                meetingId={session.meeting.id}
                playId={lastPlay.playId}
                label="Wznów partię"
              />
            ) : lastPlay.phase === "awaiting-result" ? (
              <ActionLink
                href={lastPlay.resultHref}
                action="chronicle"
                size="large"
                fullWidth
              >
                Zapisz wynik
              </ActionLink>
            ) : (
              <PlayAgainButton
                meetingId={session.meeting.id}
                gameId={lastPlay.gameId}
                gameTitle={lastPlay.gameTitle}
              />
            )}

            <TableSessionGamePicker
              meetingId={session.meeting.id}
              choices={session.gameChoices}
              autoOpen={autoOpenGamePicker}
              idleLabel="Wybierz kolejną grę"
              onOpenChange={setIsPickerOpen}
            />
          </div>

          {session.canFinishMeeting ? (
            <FinishMeetingButton
              meetingId={session.meeting.id}
              variant="wood"
            />
          ) : null}
        </div>

        {session.endedPlays.length > 0 ? (
          <div className="space-y-1.5 border-t border-white/12 pt-2.5">
            <p className="text-center text-[0.68rem] font-bold tracking-[0.14em] text-[#e0b978] uppercase">
              Rozegrane tego wieczoru
            </p>
            <div className="space-y-1">
              {session.endedPlays.map((play) => (
                <SummaryFinishedPlayLine key={play.playId} play={play} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
