import Image from "next/image";
import Link from "next/link";
import { ActionLink } from "@/components/ui/action-button";
import { Panel } from "@/components/ui/panel";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import {
  getActiveClassBackdropGradient,
  getLeaderboardRankAsset,
  getLeaderboardRankLabel,
} from "@/features/legendarium/leaderboard-presentation";
import { FeedbackSubmitPanel } from "@/features/feedback/feedback-submit-panel";
import { formatMeetingDateRange } from "@/features/meetings/formatting";
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
 */
const HERO_ACTIONS = [
  {
    action: "meeting",
    href: "/kalendarium/nowe",
    label: "Zorganizuj spotkanie",
  },
  { action: "shelf", href: "/gry/nowa", label: "Dodaj grę do Półki" },
  { action: "chronicle", href: "/kronika/nowa", label: "Zapisz wynik gry" },
] as const;

function HeroActionTiles() {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
      {HERO_ACTIONS.map((tile) => (
        <div key={tile.action} className="action-fit min-w-0">
          <ActionLink action={tile.action} size="hero" href={tile.href}>
            {tile.label}
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

function getRankGlowClass(rank: number) {
  if (rank === 1) return "rank-glow-gold";
  if (rank === 2) return "rank-glow-silver";
  if (rank === 3) return "rank-glow-bronze";
  return "";
}

function CompactLeaderboardEntry({
  entry,
  index,
}: {
  entry: DashboardLeaderboardEntry;
  index: number;
}) {
  const rankAsset = getLeaderboardRankAsset(entry.rank);
  const isPodium = entry.rank <= 3;
  // Statyczna, stała poświata podium — ten sam wzorzec co ranking w
  // Legendarium (.rank-glow-*): bez animacji/sheenu/pulsowania.
  const rankGlow = getRankGlowClass(entry.rank);
  const classBackdropGradient = entry.activeClass
    ? getActiveClassBackdropGradient(entry.activeClass.key)
    : null;

  return (
    <li
      style={{ animationDelay: `${getEntranceStaggerDelayMs(index)}ms` }}
      className={`anim-rise-in-fast relative isolate flex items-center gap-3 overflow-visible rounded-[1.05rem] px-3 py-2.5 ${
        isPodium
          ? `border border-white/12 bg-[rgba(33,18,14,0.5)] ${rankGlow}`
          : "border border-white/8 bg-[rgba(33,18,14,0.36)]"
      }`}
    >
      {entry.activeClass?.iconPath ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
        >
          <span
            className="absolute top-1/2 right-[-1.6rem] h-[170%] w-24 -translate-y-1/2 rounded-full blur-2xl"
            style={{ backgroundImage: classBackdropGradient ?? undefined }}
          />
          <span className="absolute top-1/2 right-[-1.1rem] h-[135%] w-20 -translate-y-1/2 opacity-25">
            <Image
              src={entry.activeClass.iconPath}
              alt=""
              fill
              sizes="80px"
              className="object-contain object-right"
            />
          </span>
        </span>
      ) : null}

      {rankAsset ? (
        <span className="ml-2 flex size-12 shrink-0 items-center justify-center">
          <Image
            src={rankAsset}
            alt={getLeaderboardRankLabel(entry.rank)}
            width={36}
            height={36}
            className="size-16 max-w-none object-contain"
          />
        </span>
      ) : (
        <span className="ml-2 grid size-12 shrink-0 place-items-center rounded-full bg-black/24 text-xs font-bold text-[#ffe2ad]">
          {entry.rank}
        </span>
      )}

      <div className="min-w-0 flex-1">
        {entry.activeClass ? (
          <p className="truncate text-[0.65rem] font-bold tracking-[0.1em] text-[#f0c978] uppercase">
            {entry.activeClass.name}
          </p>
        ) : null}
        <p className="truncate text-base font-semibold text-[#fff2dc]">
          {entry.displayName}
        </p>
        <p className="text-sm text-[#f2d8b8]">
          {entry.totalPoints.toLocaleString("pl-PL")} pkt
        </p>
      </div>

      <span className="shrink-0 text-sm text-[#f0cf9f]">
        {entry.rank}. miejsce
      </span>
    </li>
  );
}

function MobileLeaderboardRow({ entry }: { entry: DashboardLeaderboardEntry }) {
  const rankAsset = getLeaderboardRankAsset(entry.rank);
  const isPodium = entry.rank <= 3;
  const iconSizeClass = isPodium ? "size-12" : "size-10";
  const rankGlow = getRankGlowClass(entry.rank);

  return (
    <li
      className={`relative flex min-h-[2.7rem] items-center gap-1.5 overflow-visible rounded-[0.65rem] py-1.5 pr-1.5 ${isPodium ? `border border-white/12 bg-[rgba(33,18,14,0.5)] pl-14 ${rankGlow}` : "border border-white/8 bg-[rgba(33,18,14,0.36)] pl-14"}`}
    >
      {rankAsset ? (
        <Image
          src={rankAsset}
          alt={getLeaderboardRankLabel(entry.rank)}
          width={40}
          height={40}
          className={`absolute top-1/2 left-7 ${iconSizeClass} shrink-0 -translate-x-1/2 -translate-y-1/2 object-contain`}
        />
      ) : (
        <span
          className={`absolute top-1/2 left-7 ${iconSizeClass} grid shrink-0 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/24 text-[0.6rem] font-bold text-[#ffe2ad]`}
        >
          {entry.rank}
        </span>
      )}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
        <p className="line-clamp-2 min-w-0 text-[0.9rem] leading-tight font-semibold text-[#fff2dc]">
          {entry.displayName}
        </p>
        <p className="shrink-0 text-[0.78rem] leading-tight font-bold text-[#f2d8b8]">
          {entry.totalPoints.toLocaleString("pl-PL")} pkt
        </p>
      </div>
    </li>
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
  const data = await getDashboardData({ preferredMeetingId });
  // Stan „GRAMY!” dostał własny panel (TableSessionPanel) — kafel „Najbliższe
  // spotkanie” wraca więc do jednej roli: pokazuje NASTĘPNY wieczór i wygląda
  // dokładnie tak jak przed wdrożeniem.
  const tableSession = data.tableSession;
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
    <Panel
      style={{ animationDelay: `${getEntranceStaggerDelayMs(1)}ms` }}
      className="anim-rise-in-fast leaderboard-rug-panel p-4 text-[#fff6ea] shadow-[inset_0_0_0_1px_rgba(255,230,184,0.08),0_18px_42px_rgba(22,9,5,0.24)] sm:p-4.5"
    >
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-bold tracking-[0.18em] text-[#f1ca8f] uppercase">
              Legendy przy Stole
            </p>
            <h2 className="font-display mt-1 text-[1.3rem] font-semibold text-[#fff3e0]">
              Ranking drużyny
            </h2>
          </div>
          <ActionLink
            action="neutral"
            size="default"
            withIcon={false}
            href="/legendarium"
          >
            Otwórz →
          </ActionLink>
        </div>

        <ol className="space-y-2">
          {data.leaderboard.entries.map((entry, index) => (
            <CompactLeaderboardEntry
              key={entry.userId}
              entry={entry}
              index={index}
            />
          ))}
        </ol>

        {data.leaderboard.viewerRank &&
        data.leaderboard.viewerRank > data.leaderboard.entries.length ? (
          <p className="text-xs text-[#f2d8b8]">
            Twoje miejsce: {data.leaderboard.viewerRank}.
          </p>
        ) : null}
      </div>
    </Panel>
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
                    unoptimized
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
        <Panel
          style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
          className="anim-rise-in-fast table-wood-panel fire-glow overflow-hidden p-3 text-[#fff1dc] shadow-[inset_0_0_0_1px_rgba(255,233,184,0.08),0_14px_30px_rgba(24,9,5,0.28)]"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,198,105,0.18),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(255,255,255,0.08),transparent_18%)]" />
          <div className="relative space-y-2">
            <div className="text-center">
              <h1 className="font-display truncate text-[1.32rem] leading-tight font-semibold text-[#fff1dc]">
                {data.summary.title}
              </h1>
              <p className="mt-0.5 truncate text-[0.86rem] font-semibold text-[#e6c79f]">
                {data.summary.subtitle}
              </p>
            </div>

            <HeroActionTiles />
          </div>
        </Panel>

        {/* Wieczór, który właśnie trwa, jest najważniejszą rzeczą na Stole —
            zaraz pod hero, przed resztą kafli. Gdy nic nie trwa, dashboard
            wygląda dokładnie tak jak dotąd. */}
        {tableSession ? (
          <div>
            <TableSessionSwitcher options={data.tableSessionOptions} />
            <TableSessionPanel
              session={tableSession}
              entranceIndex={1}
              autoOpenGamePicker={autoOpenGamePicker}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-2 items-start gap-2">
          <Panel
            style={{ animationDelay: `${getEntranceStaggerDelayMs(3)}ms` }}
            className={`anim-rise-in-fast ${upcomingVisual?.panel ?? "paper-wash shadow-[0_12px_26px_rgba(32,16,8,0.14)]"} min-w-0 overflow-hidden p-2.5`}
          >
            <p className="text-accent text-center text-[0.66rem] font-bold tracking-[0.12em] uppercase">
              Najbliższe spotkanie
            </p>

            {upcoming && upcomingRange ? (
              <div className="mt-0.5">
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
                        unoptimized
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
                  className={`mt-1.5 flex w-full items-center justify-center rounded-[0.6rem] border px-2 py-1.5 text-[0.62rem] font-bold ${upcomingVisual?.action ?? "border-[#d8b3b9] bg-[#fff7f8] text-[#b14833]"}`}
                >
                  Przejdź →
                </Link>
              </div>
            ) : (
              <div className="mt-1 flex flex-col items-center gap-1.5 text-center">
                <p className="text-[0.68rem] text-[#5f4738]">
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
          </Panel>

          <Panel
            style={{ animationDelay: `${getEntranceStaggerDelayMs(1)}ms` }}
            className="anim-rise-in-fast leaderboard-rug-panel flex h-full min-w-0 flex-col p-2.5 text-[#fff6ea] shadow-[inset_0_0_0_1px_rgba(255,230,184,0.08),0_12px_26px_rgba(22,9,5,0.22)]"
          >
            <h2 className="font-display truncate text-center text-[0.9rem] font-semibold text-[#fff3e0]">
              Legendy przy Stole
            </h2>

            <ol className="mt-1.5 flex-1 space-y-1">
              {data.leaderboard.entries.map((entry) => (
                <MobileLeaderboardRow key={entry.userId} entry={entry} />
              ))}
            </ol>

            <ActionLink
              action="neutral"
              size="compact"
              withIcon={false}
              fullWidth
              href="/legendarium"
              className="mt-1.5"
            >
              Otwórz →
            </ActionLink>
          </Panel>
        </div>
      </div>

      <div className="grid gap-3 sm:items-start sm:gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(17.5rem,0.9fr)] xl:gap-5">
        <div className="flex flex-col gap-[18px]">
          <div className="hidden sm:block">
            <Panel
              style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
              className="anim-rise-in-fast table-wood-panel fire-glow overflow-hidden p-3.5 text-[#fff1dc] shadow-[inset_0_0_0_1px_rgba(255,233,184,0.08),0_24px_54px_rgba(24,9,5,0.32)] sm:p-4"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,198,105,0.18),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(255,255,255,0.08),transparent_18%)]" />
              <div className="relative flex flex-col gap-2.5 lg:flex-row lg:items-stretch lg:gap-5">
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div className="space-y-1">
                    <p className="text-[0.58rem] font-bold tracking-[0.18em] text-[#e2b578] uppercase">
                      Stół
                    </p>
                    <h1 className="font-display text-[2.1rem] leading-tight font-semibold text-[#fff1dc] sm:text-[2.3rem]">
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
                    {data.pointsSummary.currentPoints.toLocaleString("pl-PL")}
                  </p>
                </div>
              </div>
            </Panel>
          </div>

          {tableSession ? (
            <div className="hidden sm:block">
              <TableSessionSwitcher options={data.tableSessionOptions} />
              <TableSessionPanel
                session={tableSession}
                entranceIndex={1}
                autoOpenGamePicker={autoOpenGamePicker}
              />
            </div>
          ) : null}

          <section
            aria-labelledby="quests-heading"
            style={{ animationDelay: `${getEntranceStaggerDelayMs(2)}ms` }}
            className="anim-rise-in-fast space-y-2.5"
          >
            <h2
              id="quests-heading"
              className="font-display text-[1.9rem] font-semibold text-[#fff1dc] sm:text-[2.05rem]"
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
        </div>

        <div className="space-y-4">
          <div className="hidden sm:block">{leaderboardSection}</div>

          <div className="hidden sm:block">{upcomingMeetingSection}</div>

          <Panel
            style={{ animationDelay: `${getEntranceStaggerDelayMs(4)}ms` }}
            className="anim-rise-in-fast paper-wash p-3.5 sm:p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-accent text-[0.58rem] font-bold tracking-[0.18em] uppercase">
                  Ostatnio przy Stole
                </p>
                <h2 className="font-display mt-1 text-[1.1rem] font-semibold text-[#4c3528]">
                  Świeże wpisy z Kroniki
                </h2>
              </div>
              <Link
                href="/kronika"
                className="text-accent text-xs font-bold underline decoration-[#b37a46]/40 underline-offset-4"
              >
                Pełna Kronika →
              </Link>
            </div>

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
          </Panel>

          <FeedbackSubmitPanel />
        </div>
      </div>
    </div>
  );
}
