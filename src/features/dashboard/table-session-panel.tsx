import Image from "next/image";
import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import {
  formatPlayDurationLabel,
  getLiveElapsedMs,
} from "@/features/meetings/live-play";
import { formatDashboardTime, isWithinMeetingWindow } from "./formatting";
import { GatheringSessionPanel } from "./table-session-gathering-panel";
import { LivePlayTimer } from "./live-play-timer";
import {
  FinishMeetingButton,
  LivePlayControls,
  PlayAgainButton,
  ResumePlayButton,
  TableSessionGamePicker,
} from "./table-session-controls";
import type {
  DashboardTableSession,
  TableSessionEndedPlay,
  TableSessionMember,
} from "./types";

/*
 * Sekcja spotkania na Stole w stanie „wieczór trwa”. To nie jest osobny moduł
 * ani nowa strona — to ten sam kafel spotkania, tyle że po nadejściu godziny
 * przechodzi kolejno przez: drużyna przy stole → GRAMY! → podsumowanie partii.
 * Przed godziną rozpoczęcia panel w ogóle się nie pojawia i Stół wygląda
 * dokładnie tak, jak dotąd.
 *
 * Język wizualny jest ten sam co dotychczasowy stan „spotkanie w trakcie”
 * (żar, pergamin, ciepłe brązy) — tylko rozwinięty: mocniejsza poświata i
 * większy nacisk na to jedno, co się teraz liczy.
 */

const PANEL_CLASSES =
  "border border-[#d99a39] bg-[radial-gradient(circle_at_16%_12%,rgba(255,238,179,0.94),transparent_35%),radial-gradient(circle_at_84%_88%,rgba(185,73,18,0.28),transparent_46%),linear-gradient(145deg,rgba(255,247,218,0.98),rgba(240,198,110,0.94))] shadow-[inset_0_0_0_1px_rgba(255,248,205,0.78),0_0_30px_rgba(255,153,32,0.35),0_18px_38px_rgba(90,39,5,0.24)]";

const TILE_CLASSES =
  "rounded-[0.8rem] border border-[#d89b40] bg-[linear-gradient(145deg,rgba(255,252,231,0.9),rgba(248,215,143,0.82))] px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.38)]";

const COVER_FRAME_CLASSES =
  "flex items-center justify-center rounded-[1rem] border border-[#c9872d] bg-[linear-gradient(145deg,rgba(255,249,219,0.96),rgba(238,185,89,0.9))] p-2 shadow-[inset_0_0_0_1px_rgba(255,255,227,0.72),0_10px_24px_rgba(113,48,5,0.24)]";

function GameCover({
  title,
  coverUrl,
  size,
}: {
  title: string;
  coverUrl: string | null;
  size: "regular" | "large";
}) {
  const box =
    size === "large"
      ? "h-[6.6rem] w-[4.9rem] sm:h-[7.6rem] sm:w-[5.6rem]"
      : "h-[5.35rem] w-[3.95rem]";

  return (
    <div className={COVER_FRAME_CLASSES}>
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt={title}
          width={90}
          height={122}
          unoptimized
          className={`${box} rounded-[0.68rem] border border-[#c98b36] bg-[#fff1c8] object-cover shadow-[0_6px_16px_rgba(61,34,16,0.18)]`}
        />
      ) : (
        <div
          className={`${box} flex items-center justify-center rounded-[0.68rem] border border-dashed border-[#c98b36] bg-[#fff0c4] px-2 text-center text-[0.62rem] font-semibold text-[#98531a]`}
        >
          Brak okładki
        </div>
      )}
    </div>
  );
}

function PlayerChips({
  members,
  limit = 5,
}: {
  members: TableSessionMember[];
  limit?: number;
}) {
  if (members.length === 0) {
    return (
      <p className="text-[0.68rem] font-semibold text-[#8a4618]">
        Skład ustali się przy stole.
      </p>
    );
  }

  const visible = members.slice(0, limit);
  const hidden = members.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((member) => (
        <span
          key={member.id}
          className="inline-flex max-w-[8.5rem] items-center gap-1 rounded-full bg-[#7d3515] px-2 py-0.5 text-[0.6rem] font-bold text-[#fff2c7]"
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
      {hidden > 0 ? (
        <span className="rounded-full bg-[#7d3515]/75 px-2 py-0.5 text-[0.6rem] font-bold text-[#fff2c7]">
          +{hidden}
        </span>
      ) : null}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className={`min-w-0 ${TILE_CLASSES}`}>
      <p className="text-[0.5rem] font-bold tracking-[0.14em] text-[#a64d16] uppercase">
        {label}
      </p>
      <p className="truncate text-[0.74rem] font-semibold text-[#5f3013]">
        {value}
      </p>
    </div>
  );
}

function FinishedPlayLine({ play }: { play: TableSessionEndedPlay }) {
  return (
    <Link
      href={play.href}
      className="flex items-center justify-between gap-2 rounded-[0.6rem] bg-[rgba(255,250,232,0.6)] px-2 py-1 transition hover:bg-[rgba(255,250,232,0.9)]"
    >
      <span className="min-w-0 truncate text-[0.68rem] font-bold text-[#5b3418]">
        {play.gameTitle}
      </span>
      <span className="shrink-0 text-[0.62rem] font-semibold text-[#8a4618]">
        {formatPlayDurationLabel(play.durationMinutes)}
      </span>
    </Link>
  );
}

export function TableSessionPanel({
  session,
  entranceIndex = 1,
  autoOpenGamePicker = false,
}: {
  session: DashboardTableSession;
  entranceIndex?: number;
  /** Ustawiane po „Zmień grę”, żeby picker był od razu otwarty. */
  autoOpenGamePicker?: boolean;
}) {
  // „Drużyna przy stole” ma od tej iteracji własny, niezależny wygląd — patrz
  // table-session-gathering-panel.tsx. Poniższy markup dotyczy wyłącznie
  // playing/summary i celowo zostaje nietknięty.
  if (session.state === "gathering") {
    return (
      <GatheringSessionPanel session={session} entranceIndex={entranceIndex} />
    );
  }

  const now = new Date();
  const isWithinWindow = isWithinMeetingWindow(session.meeting, now);
  const livePlay = session.livePlay;
  const lastPlay = session.lastEndedPlay;

  const headline = session.state === "playing" ? "🔥 GRAMY!" : "WIECZÓR TRWA";

  const statusBadge =
    session.state === "playing"
      ? livePlay?.isContinuation
        ? "KONTYNUACJA"
        : "PARTIA TRWA"
      : isWithinWindow
        ? "TRWA TERAZ"
        : "GRAMY PO GODZINACH";

  return (
    <Panel
      style={{
        animationDelay: `${getEntranceStaggerDelayMs(entranceIndex)}ms`,
      }}
      className={`anim-rise-in-fast ${PANEL_CLASSES} ${session.state === "playing" ? "motion-safe:animate-[pulse_3.6s_ease-in-out_infinite]" : ""} overflow-hidden p-3 sm:p-4`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.58rem] font-bold tracking-[0.18em] text-[#a64d16] uppercase">
            Wieczór przy stole
          </p>
          <h2 className="font-display mt-0.5 truncate text-[1.5rem] leading-tight font-semibold text-[#5f2c0c] sm:text-[1.75rem]">
            {headline}
          </h2>
          <p className="mt-0.5 truncate text-[0.8rem] font-semibold text-[#713515]">
            {session.meeting.title}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-full bg-[#7d3515] px-2.5 py-1 text-[0.62rem] font-bold text-[#fff2c7] shadow-[0_2px_8px_rgba(96,37,5,0.2)]">
            {statusBadge}
          </span>
          <Link
            href={session.meeting.href}
            className="rounded-full border border-[#c9872d] bg-[rgba(255,250,232,0.7)] px-2.5 py-1 text-[0.62rem] font-bold text-[#9a3d14] transition hover:bg-[rgba(255,250,232,0.95)]"
          >
            Spotkanie →
          </Link>
        </div>
      </div>

      <div className="mt-2.5 space-y-2.5">
        {session.state === "playing" && livePlay ? (
          // Cover po lewej, nazwa/status/licznik/gracze po prawej — zawsze
          // obok siebie, nie tylko od sm: w górę. To jedyna różnica względem
          // stanu „summary” poniżej, który zachowuje dotychczasowy układ
          // (cover na górze na mobile, obok treści od desktopu).
          <div className="flex items-start gap-3">
            <GameCover
              title={livePlay.gameTitle}
              coverUrl={livePlay.coverUrl}
              size="large"
            />

            <div className="min-w-0 flex-1 space-y-1.5">
              <div>
                <p className="font-display truncate text-[1.15rem] leading-tight font-bold text-[#5f2c0c] sm:text-[1.3rem]">
                  {livePlay.gameTitle}
                </p>
                <p className="text-[0.68rem] font-semibold text-[#8a4618]">
                  Partia trwa
                </p>
              </div>

              <p className="font-display text-[1.9rem] leading-none font-semibold tracking-[0.04em] text-[#7d3515] tabular-nums sm:text-[2.2rem]">
                ⏱{" "}
                <LivePlayTimer
                  startedAt={livePlay.startedAt}
                  initialElapsedMs={getLiveElapsedMs(livePlay.startedAt, now)}
                />
              </p>

              {/* Kontynuacja pokazuje dwa czasy: dzisiejszą sesję (licznik
                  wyżej) i łączny czas rozgrywki. Historia z poprzednich
                  wieczorów nie może zniknąć z widoku. */}
              {livePlay.isContinuation ? (
                <p className="text-[0.7rem] font-semibold text-[#8a4618]">
                  Łącznie z poprzednimi sesjami:{" "}
                  <LivePlayTimer
                    startedAt={livePlay.startedAt}
                    initialElapsedMs={getLiveElapsedMs(livePlay.startedAt, now)}
                    accumulatedMinutes={livePlay.accumulatedMinutes}
                    variant="total"
                  />
                </p>
              ) : null}

              <PlayerChips members={livePlay.players} />
            </div>
          </div>
        ) : null}

        {session.state === "playing" && livePlay ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              <InfoTile
                label={livePlay.isContinuation ? "Start sesji" : "Start partii"}
                value={formatDashboardTime(livePlay.startedAt)}
              />
              <InfoTile
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
          </div>
        ) : null}

        {session.state === "summary" && lastPlay ? (
          // Ten sam układ co stan „playing”: okładka po lewej, tytuł/status
          // po prawej, zawsze obok siebie (nie tylko od sm: w górę) — i ta
          // sama wielkość okładki („large”), żeby oba stany „GRAMY!” wyglądały
          // spójnie, niezależnie od tego, czy partia właśnie trwa, czy się
          // skończyła.
          <div className="flex items-start gap-3">
            <GameCover
              title={lastPlay.gameTitle}
              coverUrl={
                lastPlay.coverUrl ??
                session.meeting.leadingGame?.coverUrl ??
                null
              }
              size="large"
            />

            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="font-display truncate text-[1.15rem] leading-tight font-bold text-[#5f2c0c] sm:text-[1.3rem]">
                {lastPlay.gameTitle}
              </p>
              {/* Trzy różne zakończenia sesji mówią trzy różne rzeczy —
                  „zapisano” nie jest tu żadną informacją. */}
              <p
                className={`text-[0.95rem] font-bold ${lastPlay.resultTone === "loss" ? "text-[#7b3340]" : "text-[#7d3515]"}`}
              >
                {lastPlay.phase === "completed"
                  ? lastPlay.resultLabel
                  : lastPlay.phase === "awaiting-result"
                    ? "✓ PARTIA ZAKOŃCZONA"
                    : "⏸ PARTIA ODŁOŻONA"}
              </p>
              <p className="text-[0.66rem] leading-snug text-[#8a4618]">
                {lastPlay.phase === "awaiting-result"
                  ? "Wynik możesz uzupełnić później."
                  : lastPlay.phase === "paused"
                    ? "Wrócicie do niej na kolejnej sesji."
                    : "Wynik zapisany w Kronice."}
              </p>
            </div>
          </div>
        ) : null}

        {session.state === "summary" && lastPlay ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              <InfoTile
                label={
                  lastPlay.phase === "paused" ? "Czas dotychczas" : "Czas gry"
                }
                value={formatPlayDurationLabel(lastPlay.durationMinutes)}
              />
              <InfoTile label="Gracze" value={`${lastPlay.playersCount}`} />
            </div>

            <div className="grid gap-1.5 sm:grid-cols-2">
              {lastPlay.phase === "awaiting-result" ? (
                <Link
                  href={lastPlay.resultHref}
                  className="inline-flex items-center justify-center rounded-[0.78rem] border border-[#8f3b12] bg-[#753012] px-3 py-2 text-[0.72rem] font-bold text-[#fff0c4] shadow-[0_6px_16px_rgba(104,42,5,0.24)] transition hover:bg-[#8a3a15]"
                >
                  Uzupełnij wynik teraz
                </Link>
              ) : null}

              {lastPlay.phase === "paused" ? (
                <ResumePlayButton
                  meetingId={session.meeting.id}
                  playId={lastPlay.playId}
                />
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
              />
            </div>

            <FinishMeetingWithHint session={session} />
          </div>
        ) : null}

        {session.endedPlays.length > 0 ? (
          <div className="space-y-1 border-t border-[#d99a39]/50 pt-1.5">
            <p className="text-[0.5rem] font-bold tracking-[0.14em] text-[#a64d16] uppercase">
              Rozegrane tego wieczoru
            </p>
            <div className="space-y-1">
              {session.endedPlays.map((play) => (
                <FinishedPlayLine key={play.playId} play={play} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function FinishMeetingWithHint({
  session,
}: {
  session: DashboardTableSession;
}) {
  if (!session.canFinishMeeting) return null;

  return <FinishMeetingButton meetingId={session.meeting.id} />;
}
