import Image from "next/image";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { getMemberInitial } from "@/features/auth/current-member";
import { AchievementCatalog } from "./achievement-catalog";
import { ClassCatalog } from "./class-catalog";
import { RecentLootList } from "./recent-loot-list";
import {
  getActiveClassBackdropGradient,
  getLeaderboardRankAsset,
  getLeaderboardRankLabel,
} from "./leaderboard-presentation";
import type { AchievementRarity } from "./achievement-view-model";
import type { LegendariumData, LegendariumLeaderboardEntry } from "./queries";
import { hasRecentPointEvents } from "./view-model";

export const legacyActiveRewards = [
  ["Pierwsza gra w Półce", "+40"],
  ["5 gier w Półce", "+30"],
  ["10 gier w Półce", "+20"],
  ["15 gier w Półce", "+15"],
  ["Utworzenie spotkania", "+25"],
  ["Odpowiedź na spotkanie", "+10"],
  ["Głos na grę", "+10"],
  ["Ocena gry", "+30"],
  ["Zapis partii w Kronice", "+40"],
] as const;

export type LegendariumReward = {
  points: string;
  title: string;
  condition: string;
  limit: string;
};

export const activeRewards = [
  {
    points: "+40",
    title: "Pierwsza gra",
    condition: "Dodaj pierwszy egzemplarz gry do P\u00f3\u0142ki.",
    limit: "Raz na gracza.",
  },
  {
    points: "+30",
    title: "5 gier",
    condition: "Rozbuduj P\u00f3\u0142k\u0119 o 5 nowych gier.",
    limit: "Raz na gracza.",
  },
  {
    points: "+20",
    title: "10 gier",
    condition: "Dodaj \u0142\u0105cznie 10 gier do P\u00f3\u0142ki.",
    limit: "Raz na gracza.",
  },
  {
    points: "+15",
    title: "15 gier",
    condition: "Wprowad\u017a 15 gier do wsp\u00f3lnej kolekcji.",
    limit: "Raz na gracza.",
  },
  {
    points: "+25",
    title: "Spotkanie",
    condition: "Zaproponuj spotkanie plansz\u00f3wkowe w Kalendarium.",
    limit: "Raz na spotkanie.",
  },
  {
    points: "+10",
    title: "Odpowied\u017a",
    condition:
      "Daj zna\u0107, czy b\u0119dziesz na spotkaniu \u2014 TAK albo NIE.",
    limit: "Raz na spotkanie.",
  },
  {
    points: "+10",
    title: "G\u0142os",
    condition: "Oddaj pierwszy g\u0142os na gr\u0119 w danym spotkaniu.",
    limit: "Raz na spotkanie.",
  },
  {
    points: "+30",
    title: "Ocena gry",
    condition: "Dodaj pierwsz\u0105 ocen\u0119 danej gry.",
    limit: "Raz na gr\u0119.",
  },
  {
    points: "+40",
    title: "Kronika",
    condition: "Uzupe\u0142nij rozegran\u0105 parti\u0119 w Kronice.",
    limit: "Raz za wpis.",
  },
] as const satisfies readonly LegendariumReward[];

export const futureRewards = [
  {
    points: "+30",
    title: "Udzia\u0142 w spotkaniu",
    condition: "Bonus po potwierdzeniu spotkania i uczestnictwie w Kronice.",
    limit: "Wkr\u00f3tce.",
  },
  {
    points: "+10",
    title: "Trafiony g\u0142os",
    condition:
      "Bonus, je\u015bli gra, na kt\u00f3r\u0105 g\u0142osowa\u0142e\u015b, trafi na st\u00f3\u0142.",
    limit: "Wkr\u00f3tce.",
  },
  {
    points: "+25",
    title: "Spotkanie odbyte",
    condition:
      "Bonus dla organizatora po zapisaniu rozegranej partii w Kronice.",
    limit: "Wkr\u00f3tce.",
  },
] as const satisfies readonly LegendariumReward[];

type LegendariumShowcaseProps = {
  data: LegendariumData;
};

export function LegendariumShowcase({ data }: LegendariumShowcaseProps) {
  const leaderboard = [...data.leaderboard].sort((a, b) => a.rank - b.rank);

  return (
    // p-3→p-2 on mobile only: shared outer frame for every section
    // (ranking, Zdobyte Łupy, achievement/class catalogs below) — trimming
    // it here keeps their margins identical to each other (all read from
    // this same padding) while reclaiming a few more px of row width for
    // the ranking's fixed-size podium content. sm:p-4/lg:p-5 unchanged.
    <section className="cork-board-bg premium-edge relative isolate overflow-hidden rounded-[2rem] p-2 sm:p-4 lg:p-5">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_0%,rgba(255,232,185,0.14),transparent_35%),linear-gradient(180deg,rgba(32,16,9,0.08),rgba(22,10,7,0.34))]" />

      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(25rem,0.95fr)] 2xl:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)]">
        {/*
         * p-2.5/p-4 shrunk to p-1/p-2 on mobile only: the podium rows'
         * fixed-size avatar+badges (images/icons, not shrinkable) need
         * ~196px+ of row width, but the full padding stack down to the
         * <li> (cork-board-bg + this panel + this div + ol's ml-10 +
         * li's own pl-14) only left 176px at 360px viewport — a ~20px+
         * deficit that no min-w-0 can fix since there's nothing left to
         * shrink. This panel and the div below are NOT shared with
         * "Zdobyte Łupy" (separate section), so trimming them here can't
         * affect that section's own margins. pl-14/ml-10 (icon clearance)
         * and every avatar/badge/icon size are untouched — sm:p-3/sm:p-5
         * keep desktop pixel-identical.
         */}
        <section className="leaderboard-rug-panel premium-edge h-full min-w-0 rounded-[1.55rem] p-1 sm:p-3">
          <div className="rounded-[1.25rem] p-2 sm:p-5">
            <SectionTitle dark title="Ranking grupy" />

            {leaderboard.length > 0 ? (
              // translate-x-[-19px] shifts every row (and everything
              // positioned relative to it, incl. the rank icon/trophy) left
              // as one rigid unit — pure paint-time transform, doesn't
              // touch the ml-10 reserved-icon-space margin or any row's own
              // layout, so widths/heights/internal positions are
              // untouched. The negative sign has to live INSIDE the
              // brackets (Tailwind's `-` prefix negation only applies to
              // theme-scale values, not arbitrary ones — `-translate-x-[9px]`
              // silently fails to generate any CSS at all).
              // sm:translate-x-0 keeps sm:+ pixel-identical to before.
              <ol className="mt-4 ml-10 translate-x-[-19px] space-y-2.5 sm:ml-12 sm:translate-x-0">
                {leaderboard.map((entry, index) => (
                  <RankingEntry
                    key={entry.userId}
                    entry={entry}
                    index={index}
                  />
                ))}
              </ol>
            ) : (
              <p className="paper-wash mt-4 rounded-xl px-4 py-6 text-center text-sm text-[#725a45]">
                Ranking pojawi się, gdy grupa zdobędzie pierwsze punkty.
              </p>
            )}
          </div>
        </section>

        {/*
         * min-w-0 on both this div (a grid item — grid items default to
         * min-width:auto, i.e. "never shrink below content's min-content
         * size") and loot-texture below (a flex item of this column-flex
         * div — same default, applies to the cross axis = width for
         * flex-col) is the actual fix: without either one, this column
         * refused to shrink below its content's intrinsic width, forcing
         * the single-column mobile grid (and everything under
         * cork-board-bg) wider than the viewport. xl:/2xl:'s
         * minmax(0, ...) grid-template only constrains the *grid track* —
         * it doesn't reach this deep into the nested flex item.
         */}
        <div className="flex min-w-0 flex-col gap-4 xl:h-full">
          <section className="parchment-card premium-edge hidden rounded-[1.55rem] p-4 md:block md:p-5">
            <SectionTitle title="Jak zdobywać łupy" />
            <p className="text-accent mt-3 text-[0.65rem] font-bold tracking-[0.16em] uppercase">
              {"Naliczane od razu"}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
              {activeRewards.map((reward, index) => (
                <RewardPreviewNote
                  key={reward.title}
                  reward={reward}
                  index={index}
                />
              ))}
            </div>

            <div className="mt-4 border-t border-[#c89d73]/45 pt-3">
              <p className="text-[0.62rem] font-bold tracking-[0.15em] text-[#83614a] uppercase">
                {"Po spotkaniu \u2014 wkr\u00f3tce"}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                {futureRewards.map((reward, index) => (
                  <RewardPreviewNote
                    key={reward.title}
                    reward={reward}
                    index={index}
                    upcoming
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="loot-texture premium-edge text-cream flex min-w-0 flex-col rounded-[1.55rem] p-4 sm:p-5 xl:flex-1">
            <SectionTitle dark title="Zdobyte Łupy" />
            {hasRecentPointEvents(data.recentEvents) ? (
              <RecentLootList events={data.recentEvents} />
            ) : (
              <div className="mt-3 rounded-xl border border-white/12 bg-black/16 px-4 py-6 text-center text-sm leading-6 text-[#d2c0aa]">
                Pierwsze łupy pojawią się tutaj po wykonaniu akcji przy stole.
              </div>
            )}
          </section>
        </div>
      </div>

      <AchievementCatalog achievements={data.achievements} />
      <ClassCatalog classes={data.classes} />
    </section>
  );
}

function SectionTitle({
  title,
  detail,
  dark = false,
}: {
  title: string;
  detail?: string;
  dark?: boolean;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2
        className={`font-display text-2xl font-semibold ${
          dark ? "text-[#fff1dc]" : ""
        }`}
      >
        {title}
      </h2>
      {detail ? (
        <span
          className={dark ? "text-xs text-[#d2c0aa]" : "text-muted text-xs"}
        >
          {detail}
        </span>
      ) : null}
    </div>
  );
}

function RewardPreviewNote({
  reward,
  index,
  upcoming = false,
}: {
  reward: LegendariumReward;
  index: number;
  upcoming?: boolean;
}) {
  return (
    <article
      tabIndex={0}
      className={`paper-wash group relative min-h-16 overflow-hidden rounded-xl px-2.5 py-2 shadow-[0_7px_14px_rgba(70,40,22,0.12)] transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-[#b96f3f] ${
        index % 3 === 1 ? "rotate-[0.35deg]" : "-rotate-[0.25deg]"
      } ${upcoming ? "opacity-75" : ""}`}
    >
      {/*
        Animacja wejścia żyje na wewnętrznym wrapperze, nie na samym
        <article> — <article> ma już statyczny stały obrót (rotate-…deg,
        efekt "karteczki"), a transform z animacji nadpisałby go na stałe
        (fill-mode: both) po zakończeniu wejścia.
      */}
      <div
        className="anim-rise-in-fast"
        style={{ animationDelay: `${getEntranceStaggerDelayMs(index)}ms` }}
      >
        <span className="text-accent text-sm font-bold">
          {reward.points} pkt
        </span>
        <p className="mt-0.5 text-xs leading-4 font-bold text-[#70533d]">
          {reward.title}
        </p>
        {!upcoming ? (
          <span className="absolute top-2 right-2 inline-flex rounded-full bg-[#ead8b9] px-1.5 py-0.5 text-[0.58rem] font-bold text-[#8a613f]">
            Raz
          </span>
        ) : null}
      </div>
      <p className="absolute inset-1 grid place-items-center rounded-lg bg-[#fff8ea]/97 px-2 text-center text-[0.68rem] leading-4 font-semibold text-[#624635] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100">
        {reward.condition}
      </p>
    </article>
  );
}

function RankingEntry({
  entry,
  index,
}: {
  entry: LegendariumLeaderboardEntry;
  index: number;
}) {
  const rankAsset = getLeaderboardRankAsset(entry.rank);
  const classBackdropGradient = getActiveClassBackdropGradient(
    entry.activeClass?.key ?? null,
  );
  const isFirst = entry.rank === 1;
  const isPodium = entry.rank <= 3;
  // pr-[17px] mobile-only: was pr-[35px] (12px from px-3 + 23px, matched
  // 1:1 to the li's own mr-[-23px] to keep the card's right edge 23px
  // closer to the section without moving any content). mr-[-23px] and the
  // row's own border-box width are unchanged here — only this padding
  // shrinks by 18px, so the flex row's content box gains that same 18px.
  // Badges (shrink-0, flush to this padding) render 18px further right,
  // and that whole 18px goes to the text block (flex-1) right next to
  // them — exactly the "shift badges right, give the freed room to the
  // name" request. sm:pr-4/sm:pr-3.5 (tablet/desktop) untouched.
  const cardSize = isPodium
    ? "min-h-25 px-3 py-3 pl-14 pr-[17px] sm:min-h-28 sm:px-4 sm:py-3.5 sm:pl-18 sm:pr-4"
    : "min-h-19 px-3 py-2.5 pl-14 pr-[17px] sm:min-h-21 sm:px-3.5 sm:py-3 sm:pl-18 sm:pr-3.5";
  const rankIconSize = isFirst
    ? "size-[7.2rem] sm:size-[8.4rem]"
    : isPodium
      ? "size-24 sm:size-[6.6rem]"
      : entry.rank <= 5
        ? "size-[4.2rem] sm:size-[4.8rem]"
        : "size-[2.8rem] sm:size-[3.2rem]";
  const rankIconPosition = isFirst
    ? "left-[-3.6rem] sm:left-[-4.2rem]"
    : isPodium
      ? "-left-12 sm:left-[-3.3rem]"
      : entry.rank <= 5
        ? "left-[-2.1rem] sm:left-[-2.4rem]"
        : "left-[-1.4rem] sm:left-[-1.6rem]";
  const avatarSize = isPodium ? "size-10 sm:size-12" : "size-8 sm:size-9";
  // Shared by the avatar and text spans below (not the row, trophy/rank,
  // badges, or ornament) — both shift by the same amount so the gap
  // between them (from the <li>'s own gap-2.5) is untouched; transform is
  // paint-only and never affects gap/layout math. sm:translate-x-0 keeps
  // desktop pixel-identical.
  const userBlockShift = "translate-x-[-20px] sm:translate-x-0";
  // Mobile-only fluid size (<640px): clamp(360px-value, linear ramp, sm:'s
  // own px value). The ramp is tuned so it *reaches* the sm: value exactly
  // at 430px — by 430 the clamp's own upper bound already caps it at the
  // same number sm: uses at >=640px, so there is no jump at the sm
  // breakpoint (they're numerically identical, just expressed via two
  // different mechanisms). Replaces the old fixed size-N + scale-200
  // transform hack, which rendered every mobile width identically (no
  // 360->430 growth) and — because a transform doesn't reserve layout
  // space — visually overflowed into the text block/neighbors. sm:/2xl:
  // classes are untouched, so tablet/desktop is pixel-identical to before.
  const badgeSize = isFirst
    ? "size-[clamp(42px,calc(11.14px_+_8.5714vw),48px)] text-sm sm:size-12 sm:text-base 2xl:size-24 2xl:text-2xl"
    : isPodium
      ? "size-[clamp(38px,calc(7.14px_+_8.5714vw),44px)] text-xs sm:size-11 sm:text-sm 2xl:size-[5.5rem] 2xl:text-xl"
      : entry.rank <= 5
        ? "size-[clamp(34px,calc(3.14px_+_8.5714vw),40px)] text-xs sm:size-10 sm:text-sm 2xl:size-20 2xl:text-lg"
        : "size-[clamp(26px,calc(15.71px_+_2.8571vw),28px)] text-[0.62rem] sm:size-7 sm:text-xs 2xl:size-[3.4rem] 2xl:text-sm";
  // Podium (miejsca 1-3) keeps the same -8px overlap as mobile at every
  // desktop breakpoint too, instead of spreading out to sm:space-x-2/
  // xl:space-x-3 — badges 1-3 sit closer together. The rightmost badge's
  // screen position is untouched either way: the row's text span has
  // flex-1 and absorbs all leftover space, so this span (shrink-0) is
  // always flush against the row's right padding regardless of the gap
  // between badges inside it — only the earlier badges shift right
  // (closer to the fixed last one) as the gap shrinks.
  const badgeGap = isPodium
    ? "-space-x-2"
    : "-space-x-2 sm:space-x-2 xl:space-x-3";
  const podiumTone = isFirst
    ? "border-[#f6d78b]/90 bg-[linear-gradient(110deg,rgba(132,76,27,0.96),rgba(103,57,23,0.88)_48%,rgba(73,37,20,0.84))]"
    : entry.rank === 2
      ? "border-[#e8c983]/80 bg-[linear-gradient(110deg,rgba(103,61,26,0.9),rgba(75,40,22,0.84)_55%,rgba(49,27,20,0.8))]"
      : "border-[#dcb96d]/75 bg-[linear-gradient(110deg,rgba(88,53,25,0.88),rgba(62,34,22,0.82)_55%,rgba(43,25,20,0.78))]";
  // Statyczna, stała poświata podium — bez animacji/sheenu/pulsowania,
  // karty rankingu nie są klikalne, więc brak liftu.
  const rankGlow = isFirst
    ? "rank-glow-gold"
    : entry.rank === 2
      ? "rank-glow-silver"
      : entry.rank === 3
        ? "rank-glow-bronze"
        : "";

  return (
    <li
      style={{ animationDelay: `${getEntranceStaggerDelayMs(index)}ms` }}
      className={`anim-rise-in-fast relative isolate mr-[-23px] flex min-w-0 items-center gap-2.5 overflow-visible rounded-[1.25rem] border shadow-[0_9px_18px_rgba(76,44,23,0.14)] sm:mr-0 sm:gap-3.5 ${
        isPodium
          ? `${podiumTone} ${entry.isCurrentMember ? "ring-1 ring-[#f4d48a]/65" : ""}`
          : entry.isCurrentMember
            ? "border-[#e8b875] bg-[#75442e]/92"
            : "border-[#d8bd90]/55 bg-black/20"
      } ${cardSize} ${rankGlow}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
      >
        {entry.activeClass?.iconPath ? (
          <>
            <span
              className="absolute top-1/2 left-[-11rem] h-[190%] w-56 -translate-y-1/2 rounded-full blur-3xl sm:left-[-13rem] sm:w-72"
              style={{ backgroundImage: classBackdropGradient }}
            />
            <span className="absolute top-1/2 left-[-12rem] h-[265%] w-64 -translate-y-1/2 opacity-50 sm:left-[-14rem] sm:w-80">
              <Image
                src={entry.activeClass.iconPath}
                alt=""
                fill
                sizes="(min-width: 640px) 320px, 256px"
                className="object-contain object-right"
              />
            </span>
            <span
              className="absolute top-1/2 left-[19%] h-[135%] w-36 -translate-y-1/2 rounded-full blur-3xl sm:left-[21%] sm:w-48"
              style={{ backgroundImage: classBackdropGradient }}
            />
            <span className="absolute top-1/2 left-[19%] h-[185%] w-44 -translate-y-1/2 opacity-50 sm:left-[21%] sm:w-56">
              <Image
                src={entry.activeClass.iconPath}
                alt=""
                fill
                sizes="(min-width: 1024px) 224px, 176px"
                className="object-contain object-left"
              />
            </span>
          </>
        ) : null}
      </span>
      {rankAsset ? (
        <Image
          src={rankAsset}
          alt={getLeaderboardRankLabel(entry.rank)}
          width={isFirst ? 144 : 112}
          height={isFirst ? 144 : 112}
          className={`absolute top-1/2 z-20 shrink-0 -translate-y-1/2 object-contain drop-shadow-[0_7px_10px_rgba(66,36,17,0.42)] ${rankIconPosition} ${rankIconSize}`}
        />
      ) : (
        <span className="absolute top-1/2 left-[-1.15rem] z-20 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-[#e6c68f]/70 bg-[#2b140d] text-xs font-bold text-[#ffe8bd] shadow-[0_5px_10px_rgba(38,17,8,0.38)] sm:left-[-1.35rem] sm:size-10">
          {entry.rank}
        </span>
      )}
      <span className={`relative z-10 shrink-0 ${userBlockShift}`}>
        <Avatar
          avatarUrl={entry.avatarUrl}
          name={entry.displayName}
          sizeClass={avatarSize}
        />
      </span>
      <span className={`relative z-10 min-w-0 flex-1 ${userBlockShift}`}>
        {entry.activeClass ? (
          <span className="mb-0.5 block truncate text-[0.62rem] font-bold tracking-[0.1em] text-[#f0c978] uppercase sm:text-[0.7rem]">
            {entry.activeClass.name}
          </span>
        ) : null}
        <span
          className={`block truncate font-bold text-[#fff1dc] ${
            isPodium ? "text-base sm:text-lg" : "text-sm sm:text-base"
          }`}
        >
          {entry.displayName}
          {entry.isCurrentMember ? " (Ty)" : ""}
        </span>
        <span
          className={`mt-0.5 block font-semibold text-[#efd8b7] ${
            isPodium ? "text-sm sm:text-base" : "text-xs sm:text-sm"
          }`}
        >
          {entry.totalPoints.toLocaleString("pl-PL")} pkt
        </span>
      </span>
      <span className="relative z-10 shrink-0">
        {isPodium ? (
          <>
            <PodiumMobileTrophyCluster
              badges={entry.badges}
              sizeClass={badgeSize}
            />
            <TrophySet
              badges={entry.badges}
              sizeClass={badgeSize}
              gapClass={badgeGap}
              className="hidden sm:flex"
            />
          </>
        ) : (
          <TrophySet
            badges={entry.badges}
            sizeClass={badgeSize}
            gapClass={badgeGap}
          />
        )}
      </span>
    </li>
  );
}

type RankingTrophyRay = {
  angleDeg: number;
  lengthPercent: number;
  widthPercent: number;
};

// Irregular by design (varied angles/lengths), not an even sunburst.
// A ray's own bottom sits at the badge's vertical center (bottom: 50%),
// so half its lengthPercent is always hidden behind the icon, and the
// halo (-inset-[17%]) still has some opacity out to ~117% — so the ray
// only reads as clearly connected to the badge once it clears both.
// A shorter ray is interspersed between each pair of the original,
// longer ("primary") rays — denser sunburst without changing the
// primary angles.
const EPIC_RANKING_RAYS: RankingTrophyRay[] = [
  { angleDeg: 18, lengthPercent: 94, widthPercent: 7 },
  { angleDeg: 82, lengthPercent: 70, widthPercent: 4 },
  { angleDeg: 146, lengthPercent: 81, widthPercent: 6 },
  { angleDeg: 192, lengthPercent: 66, widthPercent: 4 },
  { angleDeg: 238, lengthPercent: 89, widthPercent: 7 },
  { angleDeg: 308, lengthPercent: 68, widthPercent: 4 },
];

const LEGENDARY_RANKING_RAYS: RankingTrophyRay[] = [
  { angleDeg: 8, lengthPercent: 96, widthPercent: 6 },
  { angleDeg: 30, lengthPercent: 72, widthPercent: 4 },
  { angleDeg: 52, lengthPercent: 83, widthPercent: 5 },
  { angleDeg: 75, lengthPercent: 74, widthPercent: 4 },
  { angleDeg: 98, lengthPercent: 104, widthPercent: 7 },
  { angleDeg: 125, lengthPercent: 76, widthPercent: 4 },
  { angleDeg: 151, lengthPercent: 86, widthPercent: 5 },
  { angleDeg: 177, lengthPercent: 74, widthPercent: 4 },
  { angleDeg: 203, lengthPercent: 98, widthPercent: 6 },
  { angleDeg: 229, lengthPercent: 71, widthPercent: 4 },
  { angleDeg: 255, lengthPercent: 81, widthPercent: 5 },
  { angleDeg: 277, lengthPercent: 69, widthPercent: 4 },
  { angleDeg: 299, lengthPercent: 92, widthPercent: 6 },
  { angleDeg: 317, lengthPercent: 70, widthPercent: 4 },
  { angleDeg: 335, lengthPercent: 84, widthPercent: 5 },
  { angleDeg: 352, lengthPercent: 72, widthPercent: 4 },
];

/**
 * Ranking trophy background only — deliberately separate from
 * getAchievementAuraStyle (mini-achievement-badge.tsx), which still
 * drives the unrelated Profil trophy case untouched. Ten-stop alpha
 * curve and per-rarity color stops match the approved proposal; the
 * radial-gradient MUST use `closest-side` — the default sizing
 * (farthest-corner) reaches past the visually-clipped circle into the
 * corners of the square box, so the tail of the curve (where alpha
 * actually reaches 0) would never be visible and the badge would look
 * like a nearly solid disc instead of a soft glow.
 */
function getRankingTrophyHaloClass(rarity: AchievementRarity): string {
  switch (rarity) {
    case "rare":
      return "bg-[radial-gradient(circle_closest-side,rgba(120,175,220,0.92)_0%,rgba(80,130,180,0.72)_25%,rgba(55,105,155,0.52)_50%,rgba(42,88,130,0.30)_75%,rgba(36,76,115,0.10)_85%,rgba(33,70,105,0.05)_90%,rgba(30,65,95,0)_100%)]";
    case "epic":
      return "bg-[radial-gradient(circle_closest-side,rgba(240,205,255,0.92)_0%,rgba(183,152,228,0.72)_25%,rgba(160,125,208,0.52)_50%,rgba(140,102,188,0.30)_75%,rgba(127,85,170,0.10)_85%,rgba(122,76,158,0.05)_90%,rgba(120,70,150,0)_100%)]";
    case "legendary":
      return "bg-[radial-gradient(circle_closest-side,rgba(255,248,210,0.92)_0%,rgba(248,200,115,0.72)_25%,rgba(238,178,85,0.52)_50%,rgba(222,152,58,0.30)_75%,rgba(205,128,40,0.10)_85%,rgba(196,116,33,0.05)_90%,rgba(190,110,30,0)_100%)]";
    case "common":
    case "secret":
    default:
      return "bg-[radial-gradient(circle_closest-side,rgba(255,255,255,0.92)_0%,rgba(225,208,183,0.72)_25%,rgba(205,188,155,0.52)_50%,rgba(192,172,135,0.30)_75%,rgba(184,163,122,0.10)_85%,rgba(180,160,120,0.05)_90%,rgba(180,160,120,0)_100%)]";
  }
}

function getRankingTrophyRays(rarity: AchievementRarity): RankingTrophyRay[] {
  if (rarity === "epic") return EPIC_RANKING_RAYS;
  if (rarity === "legendary") return LEGENDARY_RANKING_RAYS;
  return [];
}

// The inner ~40-45% of every ray's own length sits behind the icon
// (and a bit more behind the still-fading halo edge) and is never seen,
// so the brightest stop needs to sit past that, not at a symmetric
// midpoint, or the visible tip only ever shows the tail of the fade.
function getRankingTrophyRayColorClass(rarity: AchievementRarity): string {
  return rarity === "legendary"
    ? "bg-[linear-gradient(to_top,transparent_0%,transparent_32%,rgba(255,210,120,0.48)_58%,rgba(255,210,120,0.48)_82%,transparent_100%)]"
    : "bg-[linear-gradient(to_top,transparent_0%,transparent_32%,rgba(224,182,255,0.45)_58%,rgba(224,182,255,0.45)_82%,transparent_100%)]";
}

// Single badge's rays/halo/sheen/image — shared, pixel-identical, by
// TrophySet (the plain horizontal row: non-podium at every width, podium
// from sm: up) and PodiumMobileTrophyCluster (podium's <sm: triangle/pair
// layout) below, so neither call site duplicates this markup.
function TrophyBadge({
  badge,
  sizeClass,
}: {
  badge: LegendariumLeaderboardEntry["badges"][number];
  sizeClass: string;
}) {
  const rays = getRankingTrophyRays(badge.rarity);
  const rayColorClass = getRankingTrophyRayColorClass(badge.rarity);

  return (
    <span
      className={`relative isolate grid place-items-center ${sizeClass}`}
      title={badge.name}
    >
      {rays.map((ray, rayIndex) => (
        // Two elements on purpose: rotating translateX(-50%) together
        // with rotate() in one transform only pivots exactly on
        // center at 0deg — for any other angle the translate rotates
        // along with it and the pivot drifts off-center. Splitting
        // rotation (outer, dead-center by default) from centering
        // (inner, translate only) keeps both operations independent.
        <span
          key={rayIndex}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-20"
          style={{ transform: `rotate(${ray.angleDeg}deg)` }}
        >
          <span
            className={`trophy-ray absolute bottom-1/2 left-1/2 -translate-x-1/2 rounded-full ${rayColorClass}`}
            style={{
              height: `${ray.lengthPercent}%`,
              width: `${ray.widthPercent}%`,
            }}
          />
        </span>
      ))}
      <span
        aria-hidden="true"
        className={`absolute -inset-[17%] -z-10 rounded-full ${getRankingTrophyHaloClass(badge.rarity)}`}
      />
      <span
        aria-hidden="true"
        className="trophy-sheen absolute inset-0 rounded-full"
      />
      {badge.iconPath ? (
        <Image
          src={badge.iconPath}
          alt=""
          fill
          sizes="(min-width: 1536px) 96px, (min-width: 640px) 48px, 40px"
          className="relative z-10 object-contain drop-shadow-[0_3px_6px_rgba(37,18,9,0.48)]"
        />
      ) : (
        <span className="relative z-10 text-[#fff4dc]">◆</span>
      )}
    </span>
  );
}

function TrophySet({
  badges,
  sizeClass,
  gapClass,
  className = "flex",
}: {
  badges: LegendariumLeaderboardEntry["badges"];
  sizeClass: string;
  gapClass: string;
  className?: string;
}) {
  if (badges.length === 0) return null;

  return (
    <span
      className={`${className} shrink-0 ${gapClass}`}
      aria-label="Najcenniejsze trofea"
      title="Najcenniejsze trofea"
    >
      {badges.map((badge) => (
        <TrophyBadge key={badge.key} badge={badge} sizeClass={sizeClass} />
      ))}
    </span>
  );
}

// Podium (miejsca 1-3) only, <sm only — TrophySet itself (used for sm:+
// podium and every non-podium row, all widths) is untouched. 1-2 badges
// keep the plain overlapping row; 3 badges become a top-1/bottom-2
// triangle instead of a 3-wide row, which is narrower (the widest row is
// only 2 badges across) — that reclaims horizontal width for the
// avatar/name/points block, matching the request to shrink the badge
// group to only what it needs. -mb-3 on the top badge overlaps it into
// the bottom pair vertically (same -8px/-12px-scale overlap language as
// the horizontal -space-x-2 elsewhere) instead of literally stacking two
// full badge heights, which comfortably fits the row's existing height
// (verified with Playwright, not estimated) instead of growing it.
function PodiumMobileTrophyCluster({
  badges,
  sizeClass,
}: {
  badges: LegendariumLeaderboardEntry["badges"];
  sizeClass: string;
}) {
  if (badges.length === 0) return null;

  if (badges.length < 3) {
    return (
      <span
        className="flex shrink-0 -space-x-2 sm:hidden"
        aria-label="Najcenniejsze trofea"
        title="Najcenniejsze trofea"
      >
        {badges.map((badge) => (
          <TrophyBadge key={badge.key} badge={badge} sizeClass={sizeClass} />
        ))}
      </span>
    );
  }

  const [top, left, right] = badges;
  return (
    <span
      className="flex shrink-0 flex-col items-center sm:hidden"
      aria-label="Najcenniejsze trofea"
      title="Najcenniejsze trofea"
    >
      <span className="relative z-10 -mb-3">
        <TrophyBadge badge={top} sizeClass={sizeClass} />
      </span>
      <span className="flex -space-x-2">
        <TrophyBadge badge={left} sizeClass={sizeClass} />
        <TrophyBadge badge={right} sizeClass={sizeClass} />
      </span>
    </span>
  );
}

function Avatar({
  avatarUrl,
  name,
  sizeClass,
}: {
  avatarUrl: string;
  name: string;
  sizeClass: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-provided avatar URL
      <img
        src={avatarUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full border-2 border-[#d3b68a] object-cover`}
      />
    );
  }

  return (
    <span
      className={`wood-grain text-cream grid ${sizeClass} shrink-0 place-items-center rounded-full text-xs font-bold`}
    >
      {getMemberInitial(name)}
    </span>
  );
}
