import Image from "next/image";
import { getMemberInitial } from "@/features/auth/current-member";
import { BadgePreviewCard, type BadgePreview } from "./badge-preview";
import {
  formatPointAction,
  formatPointEventDate,
  formatPoints,
} from "./formatting";
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

const badgePreviews: BadgePreview[] = [
  {
    id: "collector",
    name: "Kolekcjoner",
    description: "Za rozwój wspólnej Półki",
    fallbackSymbol: "◇",
    preview: true,
  },
  {
    id: "host",
    name: "Gospodarz",
    description: "Za organizowanie spotkań",
    fallbackSymbol: "⌂",
    preview: true,
  },
  {
    id: "chronicler",
    name: "Kronikarz",
    description: "Za historię rozgrywek",
    fallbackSymbol: "✦",
    preview: true,
  },
];

const trophyAssets: Record<number, string> = {
  1: "/brand/1st-place-nobg.png",
  2: "/brand/2nd-place-nobg.png",
  3: "/brand/3rd-place-nobg.png",
  4: "/brand/4th-place-nobg.png",
  5: "/brand/5th-place-nobg.png",
};

const eventIconAssets: Record<string, string> = {
  shelf_first_game: "/brand/Exclamation-common.png",
  shelf_5_games: "/brand/Exclamation-common.png",
  shelf_10_games: "/brand/Exclamation-common.png",
  shelf_15_games: "/brand/Exclamation-common.png",
  meeting_created: "/brand/Exclamation-legendary.png",
  meeting_rsvp: "/brand/Exclamation-legendary.png",
  meeting_vote: "/brand/Exclamation-magic.png",
  rating_created: "/brand/Exclamation-uncommon.png",
  play_logged: "/brand/Exclamation-epic.png",
  admin_adjustment: "/brand/Exclamation-magic.png",
};

type LegendariumShowcaseProps = {
  data: LegendariumData;
};

export function LegendariumShowcase({ data }: LegendariumShowcaseProps) {
  const leaderboard = [...data.leaderboard].sort((a, b) => a.rank - b.rank);

  return (
    <section className="cork-board-bg premium-edge relative isolate overflow-hidden rounded-[2rem] p-3 sm:p-4 lg:p-5">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_0%,rgba(255,232,185,0.14),transparent_35%),linear-gradient(180deg,rgba(32,16,9,0.08),rgba(22,10,7,0.34))]" />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(25rem,0.95fr)]">
        <section className="leaderboard-rug-panel premium-edge rounded-[1.55rem] p-2.5 sm:p-3">
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

        <div className="grid content-start gap-4">
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

          <section className="wood-grain premium-edge text-cream rounded-[1.55rem] p-4 sm:p-5">
            <SectionTitle dark title="Zdobyte Łupy" />
            {hasRecentPointEvents(data.recentEvents) ? (
              <div className="mt-3 space-y-2">
                {data.recentEvents.map((event) => (
                  <article
                    key={event.id}
                    className="relative flex min-h-16 items-center gap-3 rounded-xl bg-black/18 px-3 py-2.5 shadow-inner"
                  >
                    <Image
                      src={
                        eventIconAssets[event.actionType] ??
                        "/brand/Exclamation-magic.png"
                      }
                      alt=""
                      width={42}
                      height={58}
                      className="h-11 w-auto shrink-0 object-contain drop-shadow-[0_5px_8px_rgba(10,4,2,0.5)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">
                        {formatPointAction(event.actionType)}
                      </span>
                      <span className="block truncate text-[0.68rem] text-[#c9b8a5]">
                        {event.description
                          ? `${event.description} · ${formatPointEventDate(event.createdAt)}`
                          : formatPointEventDate(event.createdAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-[#efbd68]">
                      {formatPoints(event.points)}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-white/12 bg-black/16 px-4 py-6 text-center text-sm leading-6 text-[#d2c0aa]">
                Pierwsze łupy pojawią się tutaj po wykonaniu akcji przy stole.
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="parchment-card premium-edge mt-4 rounded-[1.55rem] p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-accent text-[0.62rem] font-bold tracking-[0.18em] uppercase">
              Wkrótce
            </p>
            <h2 className="font-display mt-1 text-2xl font-semibold">
              Odznaki
            </h2>
          </div>
          <p className="text-muted max-w-sm text-xs leading-5">
            Przyszłe plakietki i trofea drużyny — bez trwałych rekordów na tym
            etapie.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {badgePreviews.map((badge) => (
            <BadgePreviewCard key={badge.id} badge={badge} />
          ))}
        </div>
      </section>
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
    ? "size-9 text-sm sm:size-11 sm:text-lg"
    : isPodium
      ? "size-8 text-xs sm:size-9 sm:text-sm"
      : "size-6 text-[0.62rem] sm:size-7 sm:text-xs";

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
      <Avatar
        avatarUrl={entry.avatarUrl}
        name={entry.displayName}
        sizeClass={avatarSize}
      />
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
      </span>
      <TrophySet sizeClass={badgeSize} />
    </li>
  );
}

function TrophySet({ sizeClass }: { sizeClass: string }) {
  return (
    <span
      className="flex shrink-0 -space-x-2.5"
      aria-label="Najcenniejsze trofea"
      title="Najcenniejsze trofea"
    >
      {[
        ["◇", "#b8753f"],
        ["⌂", "#657859"],
        ["✦", "#74558e"],
      ].map(([symbol, color]) => (
        <span
          key={symbol}
          style={{ backgroundColor: color }}
          className={`grid place-items-center rounded-full border-2 border-[#fff0ca] font-bold text-[#fff4dc] shadow-[0_4px_9px_rgba(49,25,14,0.34)] ${sizeClass}`}
        >
          {symbol}
        </span>
      ))}
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
