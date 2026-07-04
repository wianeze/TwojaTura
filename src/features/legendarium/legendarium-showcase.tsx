import Image from "next/image";
import {
  BadgePreviewCard,
  type BadgePreview,
} from "@/features/legendarium/badge-preview";

type LeaderboardEntry = {
  place: number;
  trophy: string;
  initial: string;
  name: string;
  points: number;
  movement: "up" | "down" | "same";
};

type ChallengePreview = {
  title: string;
  points: number;
  category: string;
  accent: string;
};

export type PointEventPreview = {
  id: string;
  userName: string;
  userInitial: string;
  points: number;
  actionType: string;
  description: string;
  createdAt: string;
};

const leaderboard: LeaderboardEntry[] = [
  {
    place: 1,
    trophy: "/brand/1st-place-nobg.png",
    initial: "P",
    name: "Przemek",
    points: 1240,
    movement: "same",
  },
  {
    place: 2,
    trophy: "/brand/2nd-place-nobg.png",
    initial: "M",
    name: "Marta",
    points: 1080,
    movement: "up",
  },
  {
    place: 3,
    trophy: "/brand/3rd-place-nobg.png",
    initial: "M",
    name: "Michał",
    points: 940,
    movement: "down",
  },
  {
    place: 4,
    trophy: "/brand/4th-place-nobg.png",
    initial: "A",
    name: "Ania",
    points: 810,
    movement: "same",
  },
  {
    place: 5,
    trophy: "/brand/5th-place-nobg.png",
    initial: "K",
    name: "Kuba",
    points: 690,
    movement: "up",
  },
];

const challenges: ChallengePreview[] = [
  {
    title: "Zagraj w grę o trudności BGG powyżej 3.5",
    points: 50,
    category: "Strategia",
    accent: "bg-[#8f4f38]",
  },
  {
    title: "Naucz grupę nowej gry",
    points: 30,
    category: "Wspólnota",
    accent: "bg-moss",
  },
  {
    title: "Wypełnij wszystkie ankiety w tym miesiącu",
    points: 20,
    category: "Regularność",
    accent: "bg-[#b78642]",
  },
  {
    title: "Zorganizuj wieczór planszówkowy",
    points: 40,
    category: "Gospodarz",
    accent: "bg-[#536a74]",
  },
];

const recentPointEvents: PointEventPreview[] = [
  {
    id: "event-1",
    userName: "Przemek",
    userInitial: "P",
    points: 20,
    actionType: "availability_completed",
    description: "Wypełnienie ankiety",
    createdAt: "dzisiaj · 19:42",
  },
  {
    id: "event-2",
    userName: "Marta",
    userInitial: "M",
    points: 30,
    actionType: "game_added",
    description: "Dodanie gry",
    createdAt: "wczoraj · 21:10",
  },
  {
    id: "event-3",
    userName: "Michał",
    userInitial: "M",
    points: 50,
    actionType: "challenge_completed",
    description: "Ukończenie wyzwania",
    createdAt: "2 dni temu",
  },
];

const badges: BadgePreview[] = [
  {
    id: "collector",
    name: "Kolekcjoner",
    description: "Rozbudowuje wspólną półkę",
    fallbackSymbol: "◇",
    earned: true,
  },
  {
    id: "strategist",
    name: "Strateg",
    description: "Nie boi się ciężkich gier",
    fallbackSymbol: "♟",
    earned: true,
  },
  {
    id: "host",
    name: "Gospodarz",
    description: "Organizuje wspólne wieczory",
    fallbackSymbol: "⌂",
    earned: false,
  },
  {
    id: "poll-ninja",
    name: "Ankietowy Ninja",
    description: "Zawsze odpowiada na czas",
    fallbackSymbol: "✓",
    earned: true,
  },
  {
    id: "teacher",
    name: "Nauczyciel Gry",
    description: "Tłumaczy nowe zasady",
    fallbackSymbol: "✦",
    earned: false,
  },
];

const movementLabel = {
  up: "↑ 1",
  down: "↓ 1",
  same: "—",
} as const;

export function LegendariumShowcase() {
  return (
    <section className="cork-board-bg premium-edge relative isolate overflow-hidden rounded-[2rem] p-4 sm:p-6 lg:p-8">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(32,16,9,0.08),rgba(22,10,7,0.3))]" />

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <article className="parchment-card premium-edge relative rounded-[1.5rem] p-5 sm:p-6">
          <span className="absolute -top-2 left-1/2 size-5 -translate-x-1/2 rounded-full border border-white/50 bg-[#9f5139] shadow-md" />
          <p className="text-accent text-[0.62rem] font-bold tracking-[0.18em] uppercase">
            Ranking graczy · makieta
          </p>
          <h2 className="font-display mt-2 text-2xl font-semibold">
            Przy klubowym stole
          </h2>

          <ol className="mt-5 space-y-2.5">
            {leaderboard.map((entry) => (
              <li
                key={entry.name}
                className="paper-wash flex items-center gap-3 rounded-xl px-3 py-3 shadow-sm"
              >
                <Image
                  src={entry.trophy}
                  alt={`Puchar za ${entry.place}. miejsce`}
                  width={64}
                  height={64}
                  sizes={entry.place === 1 ? "52px" : "42px"}
                  className={`shrink-0 object-contain drop-shadow-[0_7px_10px_rgba(74,42,24,0.28)] ${entry.place === 1 ? "size-13" : "size-10"}`}
                />
                <span className="wood-grain text-cream grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold">
                  {entry.initial}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {entry.name}
                  </span>
                  <span className="text-muted text-[0.62rem]">
                    pozycja klubowa
                  </span>
                </span>
                <span className="text-right">
                  <span className="text-accent block text-sm font-bold">
                    {entry.points.toLocaleString("pl-PL")} pkt
                  </span>
                  <span
                    className={`text-[0.62rem] font-bold ${
                      entry.movement === "up"
                        ? "text-moss"
                        : entry.movement === "down"
                          ? "text-[#a55a47]"
                          : "text-muted"
                    }`}
                  >
                    {movementLabel[entry.movement]}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </article>

        <div>
          <div className="flex flex-col gap-2 text-[#f6e8d4] sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[0.62rem] font-bold tracking-[0.18em] text-[#efbd78] uppercase">
                Tablica wyzwań
              </p>
              <h2 className="font-display mt-1 text-2xl font-semibold">
                Przypięte zadania
              </h2>
            </div>
            <p className="max-w-xs text-xs leading-5 text-[#d2c0aa]">
              Statyczne przykłady. Automatyczne naliczanie punktów pojawi się
              dopiero w MVP 2.
            </p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {challenges.map((challenge, index) => (
              <article
                key={challenge.title}
                className={`parchment-card premium-edge relative min-h-40 rounded-xl p-5 ${index % 2 ? "rotate-[0.35deg]" : "-rotate-[0.35deg]"}`}
              >
                <span
                  className={`absolute -top-2 left-1/2 size-4 -translate-x-1/2 rounded-full border border-white/50 ${challenge.accent} shadow-md`}
                />
                <p className="text-moss text-[0.58rem] font-bold tracking-[0.16em] uppercase">
                  {challenge.category}
                </p>
                <h3 className="font-display mt-3 text-lg leading-6 font-semibold">
                  {challenge.title}
                </h3>
                <span className="bg-wood-dark text-cream absolute right-4 bottom-4 rounded-full px-3 py-1.5 text-xs font-bold shadow-md">
                  +{challenge.points} pkt
                </span>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="wood-grain premium-edge text-cream rounded-[1.5rem] p-5 sm:p-6">
          <p className="text-[0.62rem] font-bold tracking-[0.18em] text-[#e7b672] uppercase">
            Ledger point_events · makieta
          </p>
          <h2 className="font-display mt-2 text-2xl font-semibold">
            Ostatnio zdobyte punkty
          </h2>
          <div className="mt-5 space-y-2.5">
            {recentPointEvents.map((event) => (
              <article
                key={event.id}
                className="flex items-center gap-3 rounded-xl bg-black/18 p-3 shadow-inner"
              >
                <span className="bg-moss grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold">
                  {event.userInitial}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {event.userName} · {event.description}
                  </span>
                  <span className="block truncate text-[0.6rem] text-[#bbaa98]">
                    {event.actionType} · {event.createdAt}
                  </span>
                </span>
                <span className="font-bold text-[#efbd68]">
                  +{event.points}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="parchment-card premium-edge rounded-[1.5rem] p-5 sm:p-6">
          <p className="text-accent text-[0.62rem] font-bold tracking-[0.18em] uppercase">
            Osiągnięcia · statyczna makieta MVP 2
          </p>
          <h2 className="font-display mt-2 text-2xl font-semibold">Odznaki</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {badges.map((badge) => (
              <BadgePreviewCard key={badge.id} badge={badge} />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
