import Image from "next/image";
import Link from "next/link";
import { ActionLink } from "@/components/ui/action-button";
import { Panel } from "@/components/ui/panel";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { canUseNextImageOptimization } from "@/lib/image-sources";
import { profileServerOperation } from "@/lib/server-performance";
import {
  getLeaderboardRankAsset,
  getLeaderboardRankLabel,
} from "@/features/legendarium/leaderboard-presentation";
import { FeedbackSubmitPanel } from "@/features/feedback/feedback-submit-panel";
import { formatMeetingDateRange } from "@/features/meetings/formatting";
import {
  MISSIONS_EMPTY_STATE,
  toMissionQuestCard,
} from "@/features/missions/mission-catalog";
import { formatPlayShortDate } from "@/features/plays/formatting";
import { QuestCard } from "./action-card";
import { getDashboardData } from "./queries";
import { TableSessionPanel } from "./table-session-panel";
import { TableSessionSwitcher } from "./table-session-switcher";
import type { DashboardLeaderboardEntry } from "./types";

/*
 * Trzy główne wejścia w akcje, wspólne dla mobilnego i desktopowego
 * układu hero. Każdy kafel jest własnym kontenerem zapytań (action-fit),
 * więc przy wąskiej kolumnie chowa symbol zamiast zwijać etykietę do
 * trzeciej linii.
 *
 * Kolejność i barwa: Zapisz wynik gry (fioletowy, Kronika) | Dodaj grę do
 * Półki (biały/srebrzysty — wariant "library", osobny od zwykłego
 * act-shelf używanego gdzie indziej) | Zorganizuj spotkanie (brąz).
 */
const HERO_ACTIONS = [
  {
    action: "chronicle",
    href: "/kronika/nowa",
    labelLines: ["Zapisz", "wynik gry"],
  },
  {
    action: "library",
    href: "/gry/nowa",
    labelLines: ["Dodaj grę", "do Półki"],
  },
  {
    action: "meeting",
    href: "/kalendarium/nowe",
    labelLines: ["Zorganizuj", "spotkanie"],
  },
] as const;

function HeroActionTiles({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-3 gap-2 sm:gap-2.5 ${className}`}>
      {HERO_ACTIONS.map((tile) => (
        <div key={tile.action} className="action-fit min-w-0">
          <ActionLink action={tile.action} size="hero" href={tile.href}>
            <span className="dashboard-hero-action-copy">
              {tile.labelLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
          </ActionLink>
        </div>
      ))}
    </div>
  );
}

function MeetingStatusBadge({
  label,
  state,
  compact = false,
}: {
  label: string;
  state: "confirmed" | "decision-required" | "awaiting-group" | "completed";
  compact?: boolean;
}) {
  const classes =
    state === "confirmed"
      ? "bg-[#e6f0e5] text-[#456247]"
      : state === "decision-required"
        ? "bg-[#f7e7b8] text-[#6d5319]"
        : "bg-[#f1d9dd] text-[#7b3340]";

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold whitespace-nowrap ${compact ? "gap-0.5 px-1 py-0.5 text-[0.46rem]" : "gap-1.5 px-2.5 py-1 text-[0.65rem]"} ${classes}`}
    >
      {state === "decision-required" ? (
        <Image
          src="/brand/exclamation-nobg.png"
          alt=""
          width={16}
          height={16}
          className={
            compact ? "size-3 object-contain" : "size-4 object-contain"
          }
        />
      ) : null}
      {label}
    </span>
  );
}

/*
 * Wygląd kafla „Najbliższe spotkanie”. Wariant żarowy („spotkanie w trakcie”)
 * przeniósł się stąd do TableSessionPanel — tu zostały wyłącznie stany
 * spotkania, które jeszcze się nie zaczęło.
 */
function getUpcomingMeetingPanelClasses(
  state: "confirmed" | "decision-required" | "awaiting-group" | "completed",
) {
  if (state === "confirmed") {
    return {
      panel:
        "border border-[#b7ccb5] bg-[linear-gradient(145deg,rgba(241,248,239,0.97),rgba(218,232,214,0.92))] shadow-[0_18px_36px_rgba(26,56,31,0.14)]",
      tile: "border-[#bfd2bc] bg-[linear-gradient(145deg,rgba(252,255,251,0.94),rgba(226,238,223,0.86))]",
      tileLabel: "text-[#62815f]",
      tileValue: "text-[#39533d]",
      attendees: "bg-[#e7f0e5] text-[#567056]",
      coverFrame:
        "border-[#bfd2bc] bg-[linear-gradient(145deg,rgba(250,254,248,0.96),rgba(224,237,220,0.9))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55),0_10px_24px_rgba(36,69,40,0.14)]",
      coverBorder: "border-[#c9d8c5] bg-[#eef5ea]",
      coverFallback: "border-[#bfd2bc] bg-[#edf4e9] text-[#6f886d]",
      link: "text-[#4f7a54] underline decoration-[#4f7a54]/30 underline-offset-4",
      action: "border-[#bfd2bc] bg-[#f3faf1] text-[#4f7a54]",
    };
  }

  return {
    panel:
      "border border-[#d8b3b9] bg-[linear-gradient(145deg,rgba(252,244,246,0.97),rgba(241,217,221,0.92))] shadow-[0_18px_36px_rgba(66,25,32,0.14)]",
    tile: "border-[#dfbcc1] bg-[linear-gradient(145deg,rgba(255,251,251,0.94),rgba(246,229,232,0.86))]",
    tileLabel: "text-[#b46d78]",
    tileValue: "text-[#633a40]",
    attendees: "bg-[#f4e6e8] text-[#8a5963]",
    coverFrame:
      "border-[#dfbcc1] bg-[linear-gradient(145deg,rgba(255,250,250,0.96),rgba(244,226,229,0.9))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55),0_10px_24px_rgba(76,31,37,0.14)]",
    coverBorder: "border-[#e1c4c7] bg-[#f8edef]",
    coverFallback: "border-[#dfbcc1] bg-[#f7ebed] text-[#94626b]",
    link: "text-[#b14833] underline decoration-[#b14833]/35 underline-offset-4",
    action: "border-[#dfbcc1] bg-[#fff7f8] text-[#b14833]",
  };
}

/*
 * Wiersz tablicy rankingu — puchar (już niesie kolor i numer miejsca na
 * medalionie, patrz /brand/{1..5}th-place-nobg.png) | nazwa gracza
 * (skraca się przez truncate, gdy zabraknie miejsca) | punkty. Separator
 * między wierszami przez `.legend-board-row` (patrz globals.css) — ostatni
 * wiersz go nie dostaje, żeby nie dublować się z paddingiem tablicy pod
 * spodem.
 */
function LegendBoardRow({
  entry,
  isLast,
}: {
  entry: DashboardLeaderboardEntry;
  isLast: boolean;
}) {
  const rankAsset = getLeaderboardRankAsset(entry.rank);

  return (
    <li
      className={`flex items-center gap-2.5 py-2 first:pt-0 last:pb-0 ${isLast ? "" : "legend-board-row"}`}
    >
      {rankAsset ? (
        <Image
          src={rankAsset}
          alt={getLeaderboardRankLabel(entry.rank)}
          width={36}
          height={36}
          className="size-7 shrink-0 object-contain sm:size-8"
        />
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-black/30 text-[0.62rem] font-bold text-[#f0cf9f] sm:size-8">
          {entry.rank}
        </span>
      )}

      <p className="legend-board-name min-w-0 flex-1 truncate text-[0.78rem] font-semibold sm:text-[0.86rem]">
        {entry.displayName}
      </p>

      <p className="shrink-0 text-[0.76rem] font-bold text-[#f2d8b8] sm:text-[0.84rem]">
        {entry.totalPoints.toLocaleString("pl-PL")}
      </p>
    </li>
  );
}

/*
 * "Legendy przy Stole" jako jedna, wspólna tablica rankingu dla mobile i
 * desktopu — poprzednio dwa osobne komponenty (CompactLeaderboardEntry na
 * desktopie, MobileLeaderboardRow na mobile) z dwoma różnymi stylami kart.
 * `.legend-board`/`.legend-board-shell` (globals.css) skalują się przez cqi
 * względem WŁASNEJ szerokości panelu, więc TEN SAM komponent dobrze
 * wygląda i w wąskiej kolumnie mobilnego grida, i w szerszym sidebarze
 * desktopu — bez rozdzielania na warianty per-breakpoint.
 */
function LegendBoard({
  entries,
  viewerRank,
  href,
  animationDelayMs,
  className = "",
}: {
  entries: DashboardLeaderboardEntry[];
  viewerRank: number | null;
  href: string;
  animationDelayMs: number;
  className?: string;
}) {
  return (
    <div className={`legend-board-shell ${className}`}>
      <Panel
        style={{ animationDelay: `${animationDelayMs}ms` }}
        className="anim-rise-in-fast legend-board flex h-full flex-col px-0 py-1 text-[#fff6ea] sm:p-3.5"
      >
        {/*
          Ozdobna rama jako OSOBNA warstwa, nie border na samym panelu — dzięki
          temu może rosnąć na zewnątrz boxa (ujemny inset) zamiast zabierać
          miejsce polu treści. Sterowanie: --legend-frame-overhang w
          globals.css. Leży pod treścią i nie łapie zdarzeń.
        */}
        <span className="legend-frame-overlay" aria-hidden="true" />

        <div className="legend-board-content flex flex-1 flex-col">
          <p className="text-center text-[0.58rem] font-bold tracking-[0.1em] text-[#f1ca8f] uppercase sm:text-left">
            Legendy przy Stole
          </p>

          <ol className="mt-2 flex-1">
            {entries.map((entry, index) => (
              <LegendBoardRow
                key={entry.userId}
                entry={entry}
                isLast={index === entries.length - 1}
              />
            ))}
          </ol>

          {viewerRank && viewerRank > entries.length ? (
            <p className="mt-1.5 text-center text-[0.6rem] text-[#f2d8b8]">
              Twoje miejsce: {viewerRank}.
            </p>
          ) : null}

          <Link
            href={href}
            className="legend-board-cta mt-[20px] px-0 py-1 text-center text-[0.48rem] font-bold tracking-[0.01em] uppercase sm:text-[0.62rem]"
          >
            Zobacz ranking →
          </Link>
        </div>
      </Panel>
    </div>
  );
}

export async function DashboardShowcase({
  autoOpenGamePicker = false,
  preferredMeetingId = null,
}: {
  autoOpenGamePicker?: boolean;
  /** Wybór z przełącznika równoległych wieczorów (`?meeting=`). */
  preferredMeetingId?: string | null;
} = {}) {
  const data = await profileServerOperation("/", () =>
    getDashboardData({ preferredMeetingId }),
  );
  // Stan „GRAMY!” dostał własny panel (TableSessionPanel) — kafel „Najbliższe
  // spotkanie” wraca więc do jednej roli: pokazuje NASTĘPNY wieczór i wygląda
  // dokładnie tak jak przed wdrożeniem.
  const tableSession = data.tableSession;
  // Poświata modułu GRAMY! (PlayingSessionPanel): przy jednym spotkaniu
  // (przełącznik się nie pokazuje) zawsze pomarańczowa — rozróżnienie
  // lewe=niebieski/prawe=pomarańczowy ma sens dopiero, gdy przełącznik
  // faktycznie pokazuje dwie pozycje do wyboru.
  const sessionAccentIndex = data.tableSessionOptions.findIndex(
    (option) => option.meetingId === tableSession?.meeting.id,
  );
  const sessionAccent: "blue" | "orange" =
    data.tableSessionOptions.length < 2
      ? "orange"
      : sessionAccentIndex === 1
        ? "orange"
        : "blue";
  const upcoming = data.upcomingMeeting;
  const upcomingVisual = upcoming
    ? getUpcomingMeetingPanelClasses(upcoming.visualState)
    : null;
  const upcomingRange = upcoming
    ? formatMeetingDateRange({
        startsAt: upcoming.startsAt,
        endsAt: upcoming.endsAt,
      })
    : null;

  const leaderboardSection = (
    <LegendBoard
      entries={data.leaderboard.entries}
      viewerRank={data.leaderboard.viewerRank}
      href="/legendarium"
      animationDelayMs={getEntranceStaggerDelayMs(1)}
    />
  );

  const upcomingMeetingSection = (
    <Panel
      style={{ animationDelay: `${getEntranceStaggerDelayMs(3)}ms` }}
      className={`anim-rise-in-fast ${upcomingVisual?.panel ?? "paper-wash shadow-[0_18px_36px_rgba(32,16,8,0.16)]"} overflow-hidden p-3.5 sm:p-4`}
    >
      <div className="flex h-full flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-accent text-[0.68rem] font-bold tracking-[0.18em] uppercase">
              Najbliższe spotkanie
            </p>
            <h2 className="font-display mt-1 truncate text-[1.25rem] font-semibold text-[#4c3528]">
              {upcoming ? upcoming.title : "Brak przyszłego spotkania"}
            </h2>
          </div>

          {upcoming ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <MeetingStatusBadge
                label={upcoming.visualLabel}
                state={upcoming.visualState}
              />
              <span
                className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold ${upcomingVisual?.attendees ?? "bg-[#f4ead3] text-[#705338]"}`}
              >
                {upcoming.confirmedAttendeesCount} osób potwierdziło
              </span>
            </div>
          ) : null}
        </div>

        {upcoming && upcomingRange ? (
          <div className="grid grid-cols-[minmax(0,1fr)_5.7rem] gap-3">
            <div className="grid gap-1.5">
              <div
                className={`grid grid-cols-[3.95rem_minmax(0,1fr)] items-center gap-2 rounded-[0.9rem] border px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.38)] ${upcomingVisual?.tile ?? "border-[#e6cfb1] bg-[linear-gradient(145deg,rgba(255,252,247,0.92),rgba(245,234,216,0.82))]"}`}
              >
                <span
                  className={`text-[0.56rem] font-bold tracking-[0.16em] uppercase ${upcomingVisual?.tileLabel ?? "text-[#b4764a]"}`}
                >
                  Termin
                </span>
                <span
                  className={`truncate text-[0.82rem] font-semibold ${upcomingVisual?.tileValue ?? "text-[#5d4334]"}`}
                >
                  {`${upcomingRange.startDate} · ${upcomingRange.startTime}`}
                </span>
              </div>

              <div
                className={`grid grid-cols-[3.95rem_minmax(0,1fr)] items-center gap-2 rounded-[0.9rem] border px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.38)] ${upcomingVisual?.tile ?? "border-[#e6cfb1] bg-[linear-gradient(145deg,rgba(255,252,247,0.92),rgba(245,234,216,0.82))]"}`}
              >
                <span
                  className={`text-[0.56rem] font-bold tracking-[0.16em] uppercase ${upcomingVisual?.tileLabel ?? "text-[#b4764a]"}`}
                >
                  Miejsce
                </span>
                <span
                  className={`truncate text-[0.82rem] font-semibold ${upcomingVisual?.tileValue ?? "text-[#5d4334]"}`}
                >
                  {upcoming.location ?? "Do ustalenia"}
                </span>
              </div>

              <div
                className={`grid grid-cols-[3.95rem_minmax(0,1fr)] items-center gap-2 rounded-[0.9rem] border px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.38)] ${upcomingVisual?.tile ?? "border-[#e6cfb1] bg-[linear-gradient(145deg,rgba(255,252,247,0.92),rgba(245,234,216,0.82))]"}`}
              >
                <span
                  className={`text-[0.56rem] font-bold tracking-[0.16em] uppercase ${upcomingVisual?.tileLabel ?? "text-[#b4764a]"}`}
                >
                  Prowadzi
                </span>
                <span
                  className={`truncate text-[0.82rem] font-semibold ${upcomingVisual?.tileValue ?? "text-[#5d4334]"}`}
                >
                  {upcoming.leadingGame
                    ? `${upcoming.leadingGame.title} · ${upcoming.leadingGame.yesCount} chce grać`
                    : "Jeszcze bez lidera"}
                </span>
                <Link href={upcoming.href} className="hidden">
                  Przejdź →
                </Link>
              </div>
            </div>

            <div className="flex flex-col items-end justify-start gap-1.5">
              <div
                className={`flex w-[5.7rem] items-center justify-center rounded-[1rem] border p-2 ${upcomingVisual?.coverFrame ?? "border-[#d6b188] bg-[linear-gradient(145deg,rgba(255,251,244,0.96),rgba(237,223,201,0.9))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55),0_10px_24px_rgba(58,31,12,0.16)]"}`}
              >
                {upcoming.leadingGame?.coverUrl ? (
                  <Image
                    src={upcoming.leadingGame.coverUrl}
                    alt={upcoming.leadingGame.title}
                    width={62}
                    height={86}
                    unoptimized={
                      !canUseNextImageOptimization(
                        upcoming.leadingGame.coverUrl,
                      )
                    }
                    className={`h-[5.35rem] w-[3.95rem] rounded-[0.68rem] border object-cover shadow-[0_6px_16px_rgba(61,34,16,0.18)] ${upcomingVisual?.coverBorder ?? "border-[#dcc3a1] bg-[#f6ecdd]"}`}
                  />
                ) : (
                  <div
                    className={`flex h-[5.35rem] w-[3.95rem] items-center justify-center rounded-[0.68rem] border border-dashed px-2 text-center text-[0.68rem] font-semibold ${upcomingVisual?.coverFallback ?? "border-[#d2ba99] bg-[#f5ead9] text-[#8a6749]"}`}
                  >
                    Brak okładki
                  </div>
                )}
              </div>
              <Link
                href={upcoming.href}
                className={`inline-flex w-[5.7rem] items-center justify-center rounded-[0.78rem] border px-2 py-1.5 text-[0.68rem] font-bold ${upcomingVisual?.action ?? "border-[#d8b3b9] bg-[#fff7f8] text-[#b14833]"}`}
              >
                Przejdź →
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-[#5f4738]">
              Nie ma jeszcze kolejnego wieczoru.
            </p>
            <ActionLink
              action="meeting"
              size="compact"
              emphasis="secondary"
              href="/kalendarium/nowe"
            >
              Zorganizuj spotkanie
            </ActionLink>
          </div>
        )}
      </div>
    </Panel>
  );

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="space-y-2 sm:hidden">
        {/* JEDEN moduł Stołu: bez aktywnego spotkania - nagłówek + 3 CTA jak
            dawniej. Z aktywnym - wyłącznie sekcja "wieczoru przy stole", bez
            nagłówka i bez trzech kafli akcji. table-sheet maluje
            table-background.png jako prawdziwy 9-slice border-image, nie
            zwykłe tło (patrz komentarz w globals.css). */}
        <div className="table-sheet-shell">
          <Panel
            style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
            className="anim-rise-in-fast table-sheet px-0 py-1.5 text-[#fff1dc]"
          >
            <div className="relative space-y-2">
              {tableSession ? (
                <>
                  <TableSessionSwitcher options={data.tableSessionOptions} />
                  <TableSessionPanel
                    session={tableSession}
                    autoOpenGamePicker={autoOpenGamePicker}
                    sessionAccent={sessionAccent}
                  />
                </>
              ) : (
                <>
                  <div className="text-center">
                    <h1 className="font-display truncate text-[1.22rem] leading-tight font-extrabold text-[#fff1dc]">
                      {data.summary.title}
                    </h1>
                    <p className="mt-0.5 truncate text-[0.86rem] font-semibold text-[#e6c79f]">
                      {data.summary.subtitle}
                    </p>
                  </div>

                  <HeroActionTiles className="!gap-[5px]" />
                </>
              )}
            </div>
          </Panel>
        </div>

        {/* Równe kolumny (1fr 1fr) — jedyne źródło różnicy wizualnej między
            kaflami mają być same assety ramek, nie różne wymiary paneli.
            Wcześniejsza próba wyrównania "optycznego" szerszą kolumną Legend
            została wycofana, bo psuła symetrię całego duetu. */}
        <div className="grid grid-cols-2 gap-1">
          <div className="meeting-board-shell min-w-0">
            <Panel
              style={{ animationDelay: `${getEntranceStaggerDelayMs(3)}ms` }}
              className="anim-rise-in-fast meeting-board flex h-full flex-col px-0 py-1"
            >
              <div className="flex flex-1 flex-col">
                <p className="text-accent text-center text-[0.58rem] font-bold tracking-[0.1em] uppercase">
                  Najbliższe spotkanie
                </p>

                {upcoming && upcomingRange ? (
                  <div className="mt-0.5 flex flex-1 flex-col">
                    <h3 className="font-display truncate text-center text-[1rem] leading-tight font-bold text-[#4c3528]">
                      {upcoming.title}
                    </h3>

                    <div className="mt-1 flex flex-nowrap items-center justify-center gap-0.5">
                      <span
                        className={`inline-flex items-center rounded-full px-1 py-0.5 text-[0.46rem] font-bold whitespace-nowrap ${upcomingVisual?.attendees ?? "bg-[#f4ead3] text-[#705338]"}`}
                      >
                        {upcoming.confirmedAttendeesCount} osób potwierdziło
                      </span>
                      <MeetingStatusBadge
                        label={
                          upcoming.visualLabel === "Do ustalenia"
                            ? "Niepotwierdzone"
                            : upcoming.visualLabel
                        }
                        state={upcoming.visualState}
                        compact
                      />
                    </div>

                    <div className="mt-1.5 space-y-1">
                      <div
                        className={`min-w-0 rounded-[0.55rem] border px-1.5 py-1 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.38)] ${upcomingVisual?.tile ?? "border-[#e6cfb1] bg-[linear-gradient(145deg,rgba(255,252,247,0.92),rgba(245,234,216,0.82))]"}`}
                      >
                        <p
                          className={`text-[0.48rem] font-bold tracking-[0.1em] uppercase ${upcomingVisual?.tileLabel ?? "text-[#b4764a]"}`}
                        >
                          Termin
                        </p>
                        <p
                          className={`truncate text-[0.66rem] font-semibold ${upcomingVisual?.tileValue ?? "text-[#5d4334]"}`}
                        >
                          {`${upcomingRange.startDate} · ${upcomingRange.startTime}`}
                        </p>
                      </div>
                      <div
                        className={`min-w-0 rounded-[0.55rem] border px-1.5 py-1 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.38)] ${upcomingVisual?.tile ?? "border-[#e6cfb1] bg-[linear-gradient(145deg,rgba(255,252,247,0.92),rgba(245,234,216,0.82))]"}`}
                      >
                        <p
                          className={`text-[0.48rem] font-bold tracking-[0.1em] uppercase ${upcomingVisual?.tileLabel ?? "text-[#b4764a]"}`}
                        >
                          Miejsce
                        </p>
                        <p
                          className={`truncate text-[0.66rem] font-semibold ${upcomingVisual?.tileValue ?? "text-[#5d4334]"}`}
                        >
                          {upcoming.location ?? "Do ustalenia"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-1.5 flex items-stretch gap-1.5">
                      <div
                        className={`flex min-w-0 flex-1 flex-col justify-center rounded-[0.55rem] border px-1.5 py-1 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.38)] ${upcomingVisual?.tile ?? "border-[#e6cfb1] bg-[linear-gradient(145deg,rgba(255,252,247,0.92),rgba(245,234,216,0.82))]"}`}
                      >
                        <p
                          className={`text-[0.48rem] font-bold tracking-[0.1em] uppercase ${upcomingVisual?.tileLabel ?? "text-[#b4764a]"}`}
                        >
                          Prowadzi
                        </p>
                        <p
                          className={`line-clamp-2 text-[0.66rem] leading-tight font-semibold ${upcomingVisual?.tileValue ?? "text-[#5d4334]"}`}
                        >
                          {upcoming.leadingGame
                            ? upcoming.leadingGame.title
                            : "Jeszcze bez lidera"}
                        </p>
                      </div>

                      <div
                        className={`flex shrink-0 items-center justify-center rounded-[0.7rem] border p-1 ${upcomingVisual?.coverFrame ?? "border-[#d6b188] bg-[linear-gradient(145deg,rgba(255,251,244,0.96),rgba(237,223,201,0.9))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55),0_8px_18px_rgba(58,31,12,0.16)]"}`}
                      >
                        {upcoming.leadingGame?.coverUrl ? (
                          <Image
                            src={upcoming.leadingGame.coverUrl}
                            alt={upcoming.leadingGame.title}
                            width={72}
                            height={72}
                            unoptimized={
                              !canUseNextImageOptimization(
                                upcoming.leadingGame.coverUrl,
                              )
                            }
                            className={`h-[4.5rem] w-[4.5rem] rounded-[0.5rem] border object-cover shadow-[0_4px_10px_rgba(61,34,16,0.18)] ${upcomingVisual?.coverBorder ?? "border-[#dcc3a1] bg-[#f6ecdd]"}`}
                          />
                        ) : (
                          <div
                            className={`flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[0.5rem] border border-dashed px-1 text-center text-[0.5rem] font-semibold ${upcomingVisual?.coverFallback ?? "border-[#d2ba99] bg-[#f5ead9] text-[#8a6749]"}`}
                          >
                            Brak okładki
                          </div>
                        )}
                      </div>
                    </div>

                    <Link
                      href={upcoming.href}
                      className="meeting-board-cta mt-[20px] px-0 py-1 text-center text-[0.48rem] font-bold tracking-normal uppercase"
                    >
                      Przejdź →
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="mt-1 flex flex-1 flex-col items-center justify-center text-center">
                      <p className="text-[0.68rem] text-[#5f4738]">
                        Nie ma jeszcze kolejnego wieczoru.
                      </p>
                    </div>
                    <Link
                      href="/kalendarium/nowe"
                      className="meeting-board-cta mt-[20px] px-0 py-1 text-center text-[0.48rem] font-bold tracking-normal uppercase"
                    >
                      Zorganizuj spotkanie
                    </Link>
                  </>
                )}
              </div>
            </Panel>
          </div>

          <LegendBoard
            entries={data.leaderboard.entries}
            viewerRank={data.leaderboard.viewerRank}
            href="/legendarium"
            animationDelayMs={getEntranceStaggerDelayMs(1)}
            className="min-w-0"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:items-start sm:gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(17.5rem,0.9fr)] xl:gap-5">
        <div className="flex flex-col gap-[18px]">
          {/* JEDEN moduł Stołu — patrz analogiczny komentarz w gałęzi mobile
              wyżej: bez aktywnego spotkania nagłówek + Renoma + 3 CTA jak
              dawniej; z aktywnym wyłącznie sekcja "wieczoru przy stole". */}
          <div className="hidden sm:block">
            <div className="table-sheet-shell">
              <Panel
                style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
                className="anim-rise-in-fast table-sheet p-3.5 text-[#fff1dc] sm:p-4"
              >
                {tableSession ? (
                  <div className="relative">
                    <TableSessionSwitcher options={data.tableSessionOptions} />
                    <TableSessionPanel
                      session={tableSession}
                      autoOpenGamePicker={autoOpenGamePicker}
                      sessionAccent={sessionAccent}
                    />
                  </div>
                ) : (
                  <div className="relative flex flex-col gap-2.5 lg:flex-row lg:items-stretch lg:gap-5">
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="space-y-1">
                        <p className="text-[0.58rem] font-bold tracking-[0.18em] text-[#e2b578] uppercase">
                          Stół
                        </p>
                        <h1 className="font-display text-[2.1rem] leading-tight font-extrabold text-[#fff1dc] sm:text-[2.3rem]">
                          {data.summary.title}
                        </h1>
                        <p className="text-[0.95rem] font-semibold text-[#e6c79f] sm:text-[1.05rem]">
                          {data.summary.subtitle}
                        </p>
                      </div>

                      <HeroActionTiles />
                    </div>

                    <div className="hidden w-fit shrink-0 self-stretch rounded-[1.2rem] border border-white/12 bg-[linear-gradient(145deg,rgba(19,10,7,0.32),rgba(31,17,11,0.18))] px-3.5 py-3 text-center shadow-[0_18px_36px_rgba(17,8,5,0.22)] lg:ml-auto lg:flex lg:min-h-full lg:flex-col lg:items-center lg:justify-center">
                      <p className="text-center text-[0.58rem] font-bold tracking-[0.16em] text-[#d7b486] uppercase">
                        Twoja Renoma
                      </p>
                      <p className="font-display mt-1 text-center text-[1.95rem] font-semibold text-[#fff1dc]">
                        {data.pointsSummary.currentPoints.toLocaleString(
                          "pl-PL",
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </Panel>
            </div>
          </div>

          <section
            aria-labelledby="quests-heading"
            style={{ animationDelay: `${getEntranceStaggerDelayMs(2)}ms` }}
            className="anim-rise-in-fast space-y-2.5"
          >
            <h2
              id="quests-heading"
              // Na mobile ten sam rozmiar co nagłówek "Witaj przy stole" w
              // module Stołu (text-[1.32rem] wyżej w tym pliku) — wcześniejsze
              // 1.9rem było wyraźnie większe od niego. Desktop (sm:) zostaje
              // bez zmian, tam nagłówek Stołu jest większy niż "Zlecenia".
              className="font-display text-center text-[1.32rem] font-bold text-[#fff1dc] sm:text-left sm:text-[2.05rem]"
            >
              Zlecenia
            </h2>

            {data.quests.length === 0 ? (
              <Panel className="paper-wash p-4">
                <p className="text-sm text-[#5f4738]">
                  Nie masz teraz żadnych zleceń.
                </p>
                <Link
                  href={data.summary.emptyCtaHref}
                  className="cta-glow text-accent mt-3 inline-flex text-xs font-bold underline decoration-[#b37a46]/40 underline-offset-4"
                >
                  {data.summary.emptyCtaLabel} →
                </Link>
              </Panel>
            ) : (
              <div className="grid auto-rows-fr gap-x-2 gap-y-2 md:grid-cols-2">
                {data.quests.map((quest, index) => (
                  // Animacja wejścia żyje na tym wrapperze, nie na samym
                  // <QuestCard> — jego wewnętrzny <Link> ma już własne
                  // transition-transform na hover, które animacja by
                  // trwale nadpisała (fill-mode: both).
                  <div
                    key={quest.id}
                    className="anim-rise-in-fast"
                    style={{
                      animationDelay: `${getEntranceStaggerDelayMs(index)}ms`,
                    }}
                  >
                    <QuestCard quest={quest} isPrimary={index === 0} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/*
            Misje stoją POD Zleceniami i są osobnym systemem, nie ich odmianą.
            Zlecenie to przypomnienie operacyjne płacone Renomą; Misja to
            wyzwanie gameplayowe płacone Tukatami. Pusta sekcja jest poprawnym
            stanem grupy grającej raz w miesiącu, więc nie chowamy jej ani nie
            zastępujemy wezwaniem do działania.
          */}
          <section
            aria-labelledby="missions-heading"
            style={{ animationDelay: `${getEntranceStaggerDelayMs(3)}ms` }}
            className="anim-rise-in-fast space-y-2.5"
          >
            <h2
              id="missions-heading"
              className="font-display text-center text-[1.32rem] font-bold text-[#fff1dc] sm:text-left sm:text-[2.05rem]"
            >
              Misje
            </h2>

            {data.missions.length === 0 ? (
              <Panel className="paper-wash p-4">
                <p className="text-sm text-[#5f4738]">{MISSIONS_EMPTY_STATE}</p>
              </Panel>
            ) : (
              <div className="grid auto-rows-fr gap-x-2 gap-y-2 md:grid-cols-2">
                {data.missions.map((mission, index) => (
                  <div
                    key={mission.id}
                    className="anim-rise-in-fast"
                    style={{
                      animationDelay: `${getEntranceStaggerDelayMs(index)}ms`,
                    }}
                  >
                    <QuestCard
                      quest={toMissionQuestCard(mission)}
                      isPrimary={index === 0}
                      kind="misja"
                      tukatyAmounts={[mission.rewardTukats]}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <div className="hidden sm:block">{leaderboardSection}</div>

          <div className="hidden sm:block">{upcomingMeetingSection}</div>

          {/*
            Ten sam pergaminowy 9-slice co karta wpisu w Kronice — dosłownie ta
            sama klasa `.chronicle-page` i ten sam asset chronicle-page-frame.png
            (slice 101 fill, border-image-width = --frame, repeat stretch),
            zamiast wcześniejszej jasnej karty `paper-wash`. `.chronicle-feed`
            to jedyna istniejąca klasa dająca sam `container-type: inline-size`,
            której potrzebuje `--frame` (skaluje się przez cqw) — świadomie NIE
            `.chronicle-page-shell`, bo ta niesie jeszcze hover/active karty
            będącej linkiem, a ten moduł linkiem nie jest.
          */}
          <div className="chronicle-feed">
            <section
              style={{ animationDelay: `${getEntranceStaggerDelayMs(4)}ms` }}
              className="anim-rise-in-fast chronicle-page"
            >
              {/*
                Link "Pełna Kronika" siedzi w JEDNYM rzędzie z nadtytułem
                "Ostatnio przy Stole", a nie obok właściwego nagłówka — dzięki
                temu "Świeże wpisy z Kroniki" dostaje całą szerokość pola treści
                i mieści się w jednej linii (przy ramie Kroniki zostaje jej
                ~266px, a wcześniej link zabierał z tego ~90px).
              */}
              <div className="flex items-baseline justify-between gap-2">
                {/* Rozmiar (0.58rem) był już taki sam jak w nagłówku "Legendy
                    przy Stole"; różnił je tylko tracking (0.18em vs 0.1em),
                    przez co ten napis wyglądał szerzej. Teraz oba mają 0.1em. */}
                <p className="text-accent text-[0.58rem] font-bold tracking-[0.1em] uppercase">
                  Ostatnio przy Stole
                </p>
                <Link
                  href="/kronika"
                  className="text-accent shrink-0 text-[0.62rem] font-bold whitespace-nowrap underline decoration-[#b37a46]/40 underline-offset-4"
                >
                  Pełna Kronika →
                </Link>
              </div>

              {/* Ten sam rozmiar co tytuł karty Zlecenia
                  ("Zaproponuj spotkanie", text-[0.95rem] w action-card.tsx). */}
              <h2 className="font-display mt-1 text-[0.95rem] font-semibold text-[#4c3528]">
                Świeże wpisy z Kroniki
              </h2>

              {data.recentPlays.length === 0 ? (
                <div className="mt-2.5 space-y-2">
                  <p className="text-sm text-[#5f4738]">
                    Jeszcze nic nie zapisano w Kronice.
                  </p>
                  <ActionLink
                    action="chronicle"
                    size="compact"
                    emphasis="secondary"
                    href="/kronika/nowa"
                  >
                    Zapisz wynik gry
                  </ActionLink>
                </div>
              ) : (
                <div className="mt-2.5 space-y-1.5">
                  {data.recentPlays.map((play) => (
                    <Link key={play.id} href={play.href} className="block">
                      <div className="rounded-[0.95rem] bg-white/70 px-3 py-2 transition hover:bg-white/85">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <p className="font-semibold text-[#4d3528]">
                            {play.gameTitle}
                          </p>
                          <span className="text-[#6a4d36]">
                            {formatPlayShortDate(play.playedAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#5f4738]">
                          {play.winnerLabel} · {play.playersCount} graczy
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          <FeedbackSubmitPanel />
        </div>
      </div>
    </div>
  );
}
