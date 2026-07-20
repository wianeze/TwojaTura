import { getMemberInitial } from "@/features/auth/current-member";
import { BadgePreviewCard, type BadgePreview } from "./badge-preview";
import {
  formatPointAction,
  formatPointEventDate,
  formatPoints,
} from "./formatting";
import type { LegendariumData } from "./queries";
import { hasRecentPointEvents } from "./view-model";

const activeRewards = [
  ["Pierwsza gra", "+40"],
  ["5 gier", "+30"],
  ["10 gier", "+20"],
  ["15 gier", "+15"],
  ["Spotkanie", "+25"],
  ["RSVP", "+10"],
  ["Głos", "+10"],
  ["Ocena", "+30"],
  ["Kronika", "+40"],
] as const;

const badgePreviews: BadgePreview[] = [
  {
    id: "collector",
    name: "Kolekcjoner",
    description: "Za rozwój wspólnej Półki",
    fallbackSymbol: "◇",
  },
  {
    id: "host",
    name: "Gospodarz",
    description: "Za organizowanie spotkań",
    fallbackSymbol: "⌂",
  },
  {
    id: "chronicler",
    name: "Kronikarz",
    description: "Za historię rozgrywek",
    fallbackSymbol: "✦",
  },
];

type LegendariumShowcaseProps = {
  data: LegendariumData;
};

export function LegendariumShowcase({ data }: LegendariumShowcaseProps) {
  return (
    <section className="cork-board-bg premium-edge relative isolate overflow-hidden rounded-[2rem] p-4 sm:p-5 lg:p-6">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(32,16,9,0.08),rgba(22,10,7,0.32))]" />

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="wood-grain premium-edge text-cream rounded-[1.5rem] p-5 sm:p-6">
          <p className="text-[0.62rem] font-bold tracking-[0.18em] text-[#e7b672] uppercase">
            Twoje Legendarium
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-display text-4xl font-semibold text-[#fff1dc] sm:text-5xl">
                {data.currentPoints.toLocaleString("pl-PL")} pkt
              </p>
              <p className="mt-1 text-sm text-[#d9c8b4]">
                {data.currentRank
                  ? `${data.currentRank}. miejsce w rankingu grupy`
                  : "Pozycja pojawi się wraz z rankingiem grupy"}
              </p>
            </div>
            <span className="rounded-full border border-[#e7b672]/30 bg-black/18 px-3 py-1.5 text-xs font-bold text-[#f2d39e]">
              Realne punkty
            </span>
          </div>
          <p className="mt-5 max-w-xl text-sm leading-6 text-[#d9c8b4]">
            Punkty zdobywasz aktywnością przy Stole, Półce, Kalendarium i
            Kronice.
          </p>
        </section>

        <section className="parchment-card premium-edge rounded-[1.5rem] p-5 sm:p-6">
          <p className="text-accent text-[0.62rem] font-bold tracking-[0.18em] uppercase">
            Jak zdobywać punkty
          </p>
          <p className="text-muted mt-2 text-sm leading-5">
            Każda nagroda jest naliczana tylko raz dla danego zdarzenia lub
            progu.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {activeRewards.map(([label, points]) => (
              <div
                key={label}
                className="paper-wash rounded-xl px-2 py-2 text-center shadow-sm"
              >
                <p className="text-accent text-sm font-bold">{points} pkt</p>
                <p className="text-muted mt-0.5 text-[0.62rem] font-semibold">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="parchment-card premium-edge rounded-[1.5rem] p-5 sm:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-accent text-[0.62rem] font-bold tracking-[0.18em] uppercase">
                Legendy przy stole
              </p>
              <h2 className="font-display mt-1 text-2xl font-semibold">
                Ranking grupy
              </h2>
            </div>
            <span className="text-muted text-xs font-semibold">
              miejsce · punkty
            </span>
          </div>

          <ol className="mt-4 space-y-2">
            {data.leaderboard.map((entry) => (
              <li
                key={entry.userId}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  entry.isCurrentMember
                    ? "border-[#c98547] bg-[#f2ddba]/78 shadow-[0_8px_20px_rgba(95,49,25,0.14)]"
                    : "border-[#d6c1a0]/80 bg-white/38"
                }`}
              >
                <span className="text-accent grid size-8 shrink-0 place-items-center rounded-full bg-[#ead6b3] text-xs font-bold">
                  {entry.rank}
                </span>
                <Avatar avatarUrl={entry.avatarUrl} name={entry.displayName} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {entry.displayName}
                    {entry.isCurrentMember ? " (Ty)" : ""}
                  </span>
                  <span className="text-muted text-[0.68rem]">
                    {entry.totalPoints.toLocaleString("pl-PL")} pkt
                  </span>
                </span>
                <span className="text-muted text-xs font-semibold">
                  {entry.rank}. miejsce
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="wood-grain premium-edge text-cream rounded-[1.5rem] p-5 sm:p-6">
          <p className="text-[0.62rem] font-bold tracking-[0.18em] text-[#e7b672] uppercase">
            Twój ledger
          </p>
          <h2 className="font-display mt-1 text-2xl font-semibold">
            Ostatnie zdobycze
          </h2>
          {hasRecentPointEvents(data.recentEvents) ? (
            <div className="mt-4 space-y-2">
              {data.recentEvents.map((event) => (
                <article
                  key={event.id}
                  className="flex items-center gap-3 rounded-xl bg-black/18 px-3 py-3 shadow-inner"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#b7753d] text-sm font-bold text-[#fff1dc]">
                    +
                  </span>
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
            <div className="mt-4 rounded-xl border border-white/12 bg-black/16 px-4 py-7 text-center text-sm leading-6 text-[#d2c0aa]">
              Pierwsze zdobycze pojawią się tutaj po wykonaniu akcji przy stole.
            </div>
          )}
        </section>
      </div>

      <section className="parchment-card premium-edge mt-4 rounded-[1.5rem] p-5 sm:p-6">
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
            To zapowiedź przyszłego systemu — odznaki nie są jeszcze trwałymi
            rekordami.
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

function Avatar({ avatarUrl, name }: { avatarUrl: string; name: string }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-provided avatar URL
      <img
        src={avatarUrl}
        alt=""
        className="size-8 shrink-0 rounded-full border border-[#d3b68a] object-cover"
      />
    );
  }

  return (
    <span className="wood-grain text-cream grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold">
      {getMemberInitial(name)}
    </span>
  );
}
