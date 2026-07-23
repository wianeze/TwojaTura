import Image from "next/image";
import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { formatMeetingDateRange } from "@/features/meetings/formatting";
import { formatPlayShortDate } from "@/features/plays/formatting";
import { QuestCard } from "./action-card";
import { getDashboardData } from "./queries";

function MeetingStatusBadge({
  label,
  state,
}: {
  label: string;
  state: "confirmed" | "decision-required" | "awaiting-group" | "completed";
}) {
  const classes =
    state === "confirmed"
      ? "bg-[#e6f0e5] text-[#456247]"
      : state === "decision-required"
        ? "bg-[#f7e7b8] text-[#6d5319]"
        : "bg-[#f1d9dd] text-[#7b3340]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.65rem] font-bold ${classes}`}
    >
      {state === "decision-required" ? (
        <Image
          src="/brand/exclamation-nobg.png"
          alt=""
          width={16}
          height={16}
          className="size-4 object-contain"
        />
      ) : null}
      {label}
    </span>
  );
}

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

function getRankMedal(rank: number) {
  if (rank === 1) return "/brand/1st-place-nobg.png";
  if (rank === 2) return "/brand/2nd-place-nobg.png";
  if (rank === 3) return "/brand/3rd-place-nobg.png";
  if (rank === 4) return "/brand/4th-place-nobg.png";
  return "/brand/5th-place-nobg.png";
}

export async function DashboardShowcase() {
  const data = await getDashboardData();
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
    <Panel className="leaderboard-rug-panel p-4 text-[#fff6ea] shadow-[inset_0_0_0_1px_rgba(255,230,184,0.08),0_18px_42px_rgba(22,9,5,0.24)] sm:p-4.5">
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[0.58rem] font-bold tracking-[0.18em] text-[#f1ca8f] uppercase">
              Legendy przy Stole
            </p>
            <h2 className="font-display mt-1 text-[1.3rem] font-semibold text-[#fff3e0]">
              Ranking drużyny
            </h2>
          </div>
          <Link
            href="/legendarium"
            className="text-xs font-bold text-[#ffe0b8] underline decoration-white/25 underline-offset-4"
          >
            Otwórz →
          </Link>
        </div>

        <ol className="space-y-2">
          {data.leaderboard.entries.map((entry) => (
            <li
              key={entry.userId}
              className="flex items-center gap-3 rounded-[1.05rem] border border-white/8 bg-[rgba(33,18,14,0.36)] px-3 py-2"
            >
              <Image
                src={getRankMedal(entry.rank)}
                alt={`${entry.rank}. miejsce`}
                width={36}
                height={36}
                className="size-8 shrink-0 object-contain"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#fff2dc]">
                  {entry.displayName}
                </p>
                <p className="text-xs text-[#f2d8b8]">
                  {entry.totalPoints.toLocaleString("pl-PL")} pkt
                </p>
              </div>
              <span className="text-xs text-[#f0cf9f]">
                {entry.rank}. miejsce
              </span>
            </li>
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
      className={`${upcomingVisual?.panel ?? "paper-wash shadow-[0_18px_36px_rgba(32,16,8,0.16)]"} overflow-hidden p-3.5 sm:p-4`}
    >
      <div className="flex h-full flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-accent text-[0.58rem] font-bold tracking-[0.18em] uppercase">
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
                    ? `${upcoming.leadingGame.title} · ${upcoming.leadingGame.votesCount} gł.`
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
                Przejdź {"→"}
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-[#5f4738]">
              Nie ma jeszcze kolejnego wieczoru.
            </p>
            <Link
              href="/kalendarium/nowe"
              className="cta-glow text-accent inline-flex text-xs font-bold underline decoration-[#b37a46]/40 underline-offset-4"
            >
              Zorganizuj spotkanie →
            </Link>
          </div>
        )}
      </div>
    </Panel>
  );

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(17.5rem,0.9fr)]">
        <Panel className="table-wood-panel fire-glow overflow-hidden p-3.5 text-[#fff1dc] shadow-[inset_0_0_0_1px_rgba(255,233,184,0.08),0_24px_54px_rgba(24,9,5,0.32)] sm:p-4">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,198,105,0.18),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(255,255,255,0.08),transparent_18%)]" />
          <div className="relative flex flex-col gap-2.5 lg:flex-row lg:items-stretch lg:gap-5">
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="space-y-1">
                <p className="text-[0.58rem] font-bold tracking-[0.18em] text-[#e2b578] uppercase">
                  Stół
                </p>
                <h1 className="font-display text-[1.75rem] leading-tight font-semibold text-[#fff1dc] sm:text-[1.95rem]">
                  {data.summary.title}
                </h1>
                <p className="text-[0.7rem] font-semibold text-[#e6c79f] sm:text-[0.78rem]">
                  {data.summary.subtitle}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                <Link
                  href="/kalendarium/nowe"
                  className="cta-glow min-w-0 rounded-xl border border-[#efbf82]/30 bg-[#9b5538]/92 px-2 py-1.5 text-center text-[0.62rem] leading-tight font-bold text-[#fff0db] sm:px-2.5 sm:py-2 sm:text-[0.68rem] lg:whitespace-nowrap"
                >
                  Zorganizuj spotkanie
                </Link>
                <Link
                  href="/gry/nowa"
                  className="cta-glow min-w-0 rounded-xl border border-white/14 bg-black/20 px-2 py-1.5 text-center text-[0.62rem] leading-tight font-bold text-[#f2e4d3] sm:px-2.5 sm:py-2 sm:text-[0.68rem] lg:whitespace-nowrap"
                >
                  Dodaj grę do Półki
                </Link>
                <Link
                  href="/kronika/nowa"
                  className="cta-glow min-w-0 rounded-xl border border-white/14 bg-black/20 px-2 py-1.5 text-center text-[0.62rem] leading-tight font-bold text-[#f2e4d3] sm:px-2.5 sm:py-2 sm:text-[0.68rem] lg:whitespace-nowrap"
                >
                  Zapisz wynik gry
                </Link>
              </div>
            </div>

            <div className="hidden w-fit shrink-0 self-stretch rounded-[1.2rem] border border-white/12 bg-[linear-gradient(145deg,rgba(19,10,7,0.32),rgba(31,17,11,0.18))] px-3.5 py-3 text-center shadow-[0_18px_36px_rgba(17,8,5,0.22)] lg:ml-auto lg:flex lg:min-h-full lg:flex-col lg:items-center lg:justify-center">
              <p className="text-center text-[0.58rem] font-bold tracking-[0.16em] text-[#d7b486] uppercase">
                Twoje punkty
              </p>
              <p className="font-display mt-1 text-center text-[1.95rem] font-semibold text-[#fff1dc]">
                {data.pointsSummary.currentPoints.toLocaleString("pl-PL")} pkt
              </p>
            </div>
          </div>
        </Panel>

        {leaderboardSection}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(17.5rem,0.9fr)] xl:gap-5">
        <div className="space-y-4 xl:-mt-[15.25rem] 2xl:-mt-[15.5rem]">
          <section aria-labelledby="quests-heading" className="space-y-2.5">
            <h2
              id="quests-heading"
              className="font-display text-[1.9rem] font-semibold text-[#fff1dc] sm:text-[2.05rem]"
            >
              Questy do wykonania!
            </h2>

            {data.quests.length === 0 ? (
              <Panel className="paper-wash p-4">
                <p className="text-sm text-[#5f4738]">
                  Nie masz teraz żadnych zadań.
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
                  <QuestCard
                    key={quest.id}
                    quest={quest}
                    isPrimary={index === 0}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          {upcomingMeetingSection}

          <Panel className="paper-wash p-3.5 sm:p-4">
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
                <Link
                  href="/kronika/nowa"
                  className="cta-glow text-accent inline-flex text-xs font-bold underline decoration-[#b37a46]/40 underline-offset-4"
                >
                  Zapisz wynik gry →
                </Link>
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
        </div>
      </div>
    </div>
  );
}
