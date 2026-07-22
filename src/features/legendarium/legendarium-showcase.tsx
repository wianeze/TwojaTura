import Image from "next/image";
import { getMemberInitial } from "@/features/auth/current-member";
import { AchievementCatalog } from "./achievement-catalog";
import { ClassCatalog } from "./class-catalog";
import { getAchievementAuraStyle } from "./mini-achievement-badge";
import { RecentLootList } from "./recent-loot-list";
import { ActiveClassEmblem } from "./active-class-emblem";
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

const trophyAssets: Record<number, string> = {
  1: "/brand/1st-place-nobg.png",
  2: "/brand/2nd-place-nobg.png",
  3: "/brand/3rd-place-nobg.png",
  4: "/brand/4th-place-nobg.png",
  5: "/brand/5th-place-nobg.png",
};

type LegendariumShowcaseProps = {
  data: LegendariumData;
};

export function LegendariumShowcase({ data }: LegendariumShowcaseProps) {
  const leaderboard = [...data.leaderboard].sort((a, b) => a.rank - b.rank);

  return (
    <section className="cork-board-bg premium-edge relative isolate overflow-hidden rounded-[2rem] p-3 sm:p-4 lg:p-5">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_0%,rgba(255,232,185,0.14),transparent_35%),linear-gradient(180deg,rgba(32,16,9,0.08),rgba(22,10,7,0.34))]" />

      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(25rem,0.95fr)] 2xl:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)]">
        <section className="leaderboard-rug-panel premium-edge h-full rounded-[1.55rem] p-2.5 sm:p-3">
          <div className="rounded-[1.25rem] p-4 sm:p-5">
            <SectionTitle dark title="Ranking grupy" />

            {leaderboard.length > 0 ? (
              <ol className="mt-4 ml-10 space-y-2.5 sm:ml-12">
                {leaderboard.map((entry) => (
                  <RankingEntry key={entry.userId} entry={entry} />
                ))}
              </ol>
            ) : (
              <p className="paper-wash mt-4 rounded-xl px-4 py-6 text-center text-sm text-[#725a45]">
                Ranking pojawi się, gdy grupa zdobędzie pierwsze punkty.
              </p>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-4 xl:h-full">
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

          <section className="loot-texture premium-edge text-cream flex flex-col rounded-[1.55rem] p-4 sm:p-5 xl:flex-1">
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
      <span className="text-accent text-sm font-bold">{reward.points} pkt</span>
      <p className="mt-0.5 text-xs leading-4 font-bold text-[#70533d]">
        {reward.title}
      </p>
      {!upcoming ? (
        <span className="absolute top-2 right-2 inline-flex rounded-full bg-[#ead8b9] px-1.5 py-0.5 text-[0.58rem] font-bold text-[#8a613f]">
          Raz
        </span>
      ) : null}
      <p className="absolute inset-1 grid place-items-center rounded-lg bg-[#fff8ea]/97 px-2 text-center text-[0.68rem] leading-4 font-semibold text-[#624635] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100">
        {reward.condition}
      </p>
    </article>
  );
}

function RankingEntry({ entry }: { entry: LegendariumLeaderboardEntry }) {
  const trophy = trophyAssets[entry.rank];
  const isFirst = entry.rank === 1;
  const isPodium = entry.rank <= 3;
  const cardSize = isPodium
    ? "min-h-25 px-3 py-3 pl-14 sm:min-h-28 sm:px-4 sm:py-3.5 sm:pl-18"
    : "min-h-19 px-3 py-2.5 pl-14 sm:min-h-21 sm:px-3.5 sm:py-3 sm:pl-18";
  const trophySize = isFirst
    ? "size-[7.2rem] sm:size-[8.4rem]"
    : isPodium
      ? "size-24 sm:size-[6.6rem]"
      : "size-[4.2rem] sm:size-[4.8rem]";
  const trophyPosition = isFirst
    ? "left-[-3.6rem] sm:left-[-4.2rem]"
    : isPodium
      ? "-left-12 sm:left-[-3.3rem]"
      : "left-[-2.1rem] sm:left-[-2.4rem]";
  const avatarSize = isPodium ? "size-10 sm:size-12" : "size-8 sm:size-9";
  const badgeSize = isFirst
    ? "size-10 text-sm sm:size-12 sm:text-base 2xl:size-24 2xl:text-2xl"
    : isPodium
      ? "size-9 text-xs sm:size-11 sm:text-sm 2xl:size-[5.5rem] 2xl:text-xl"
      : "size-8 text-xs sm:size-10 sm:text-sm 2xl:size-20 2xl:text-lg";

  return (
    <li
      className={`relative flex min-w-0 items-center gap-2.5 overflow-visible rounded-[1.25rem] border shadow-[0_9px_18px_rgba(76,44,23,0.14)] sm:gap-3.5 ${
        entry.isCurrentMember
          ? "border-[#e8b875] bg-[#75442e]/92"
          : isPodium
            ? "border-[#e3c493]/70 bg-[#321810]/78"
            : "border-[#d8bd90]/55 bg-black/20"
      } ${cardSize}`}
    >
      {trophy ? (
        <Image
          src={trophy}
          alt={`Puchar za ${entry.rank}. miejsce`}
          width={isFirst ? 144 : 112}
          height={isFirst ? 144 : 112}
          className={`absolute top-1/2 z-10 shrink-0 -translate-y-1/2 object-contain drop-shadow-[0_7px_10px_rgba(66,36,17,0.42)] ${trophyPosition} ${trophySize}`}
        />
      ) : null}
      <span className="relative shrink-0">
        <Avatar
          avatarUrl={entry.avatarUrl}
          name={entry.displayName}
          sizeClass={avatarSize}
        />
        <ActiveClassEmblem
          activeClass={entry.activeClass}
          sizeClass={isPodium ? "size-7 sm:size-8" : "size-6 sm:size-7"}
          className="absolute -right-2 -bottom-2 z-20"
        />
      </span>
      <span className="min-w-0 flex-1">
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
        {entry.activeClass ? (
          <span className="mt-0.5 block truncate text-[0.62rem] font-semibold tracking-[0.04em] text-[#e7bb70] sm:text-[0.7rem]">
            {entry.activeClass.name}
          </span>
        ) : null}
      </span>
      <TrophySet badges={entry.badges} sizeClass={badgeSize} />
    </li>
  );
}

function TrophySet({
  badges,
  sizeClass,
}: {
  badges: LegendariumLeaderboardEntry["badges"];
  sizeClass: string;
}) {
  if (badges.length === 0) return null;

  return (
    <span
      className="flex shrink-0 -space-x-2 sm:space-x-2 xl:space-x-3"
      aria-label="Najcenniejsze trofea"
      title="Najcenniejsze trofea"
    >
      {badges.map((badge) => {
        const aura = getAchievementAuraStyle(badge.rarity);

        return (
          <span
            key={badge.key}
            className={`relative isolate grid place-items-center ${sizeClass}`}
            title={badge.name}
          >
            {aura.raysClass ? (
              <span
                aria-hidden="true"
                className={`absolute -inset-[14%] -z-10 rounded-full opacity-60 ${aura.raysClass}`}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={`absolute -inset-[12%] -z-10 rounded-full ${aura.glowClass}`}
            />
            {badge.iconPath ? (
              <Image
                src={badge.iconPath}
                alt=""
                fill
                sizes="(min-width: 1536px) 96px, (min-width: 640px) 48px, 40px"
                className="object-contain drop-shadow-[0_3px_6px_rgba(37,18,9,0.48)]"
              />
            ) : (
              <span className="text-[#fff4dc]">◆</span>
            )}
          </span>
        );
      })}
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
