import Image from "next/image";
import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { GameCover } from "@/components/ui/game-cover";
import { mockGames } from "@/features/games/mock-games";
import {
  QuestCard,
  type DashboardQuest,
} from "@/features/dashboard/action-card";

const dashboardQuests: DashboardQuest[] = [
  {
    id: "confirmed-meeting",
    type: "action",
    title: "Spotkanie potwierdzone",
    description: "Sobota, 18:00 u Michała",
    href: "/kalendarium",
    createdAt: "dzisiaj",
  },
  {
    id: "availability-question",
    type: "question",
    title: "Kiedy możesz grać?",
    description: "Wybierz termin lipcowego spotkania",
    href: "/kalendarium",
    optionalPoints: 5,
    createdAt: "do jutra",
  },
  {
    id: "complete-play",
    type: "action",
    title: "Uzupełnij wynik partii",
    description: "Wczoraj graliście w Nemesis",
    href: "/kronika",
    createdAt: "wczoraj",
  },
  {
    id: "rate-nemesis",
    type: "question",
    title: "Jak podobało Ci się Nemesis?",
    description: "Oceń ostatnią rozgrywkę",
    href: "/gry",
    optionalPoints: 10,
    createdAt: "wczoraj",
  },
  {
    id: "new-game",
    type: "action",
    title: "Nowa gra na Półce",
    description: "Marta dodała Frostpunk",
    href: "/gry",
    createdAt: "2 dni temu",
  },
  {
    id: "game-vote",
    type: "question",
    title: "W co chcesz zagrać?",
    description: "Zagłosuj na gry na najbliższy wieczór",
    href: "/kalendarium",
    createdAt: "nowe",
  },
];

const leaderboard = [
  {
    place: 1,
    name: "Przemek",
    points: 1240,
    trophy: "/brand/1st-place-nobg.png",
  },
  {
    place: 2,
    name: "Marta",
    points: 1080,
    trophy: "/brand/2nd-place-nobg.png",
  },
  {
    place: 3,
    name: "Michał",
    points: 940,
    trophy: "/brand/3rd-place-nobg.png",
  },
  {
    place: 4,
    name: "Ania",
    points: 810,
    trophy: "/brand/4th-place-nobg.png",
  },
  {
    place: 5,
    name: "Kuba",
    points: 690,
    trophy: "/brand/5th-place-nobg.png",
  },
];

const recentActivity = [
  {
    title: "Marta dodała Frostpunk",
    detail: "Nowy egzemplarz na wspólnej Półce",
    time: "35 min temu",
    color: "bg-moss",
  },
  {
    title: "Nemesis rozegrane — wygrał Michał",
    detail: "4 graczy · 108 minut",
    time: "wczoraj",
    color: "bg-accent",
  },
  {
    title: "Przemek ocenił XCOM 9/10",
    detail: "Chce zagrać ponownie",
    time: "2 dni temu",
    color: "bg-gold",
  },
];

const eveningGames = mockGames.filter((game) =>
  ["nemesis", "frostpunk", "xcom"].includes(game.id),
);

export function DashboardShowcase() {
  return (
    <div className="space-y-7 sm:space-y-9">
      <section className="premium-edge text-cream relative isolate flex min-h-[20rem] overflow-hidden rounded-[2.4rem] shadow-[0_38px_100px_rgba(12,6,4,0.58)] sm:min-h-[22rem] lg:min-h-[23rem]">
        <Image
          src="/brand/hero-desktop.png"
          alt="Wieczór planszówkowy w górskiej chacie przy kominku"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 80vw"
          className="-z-30 hidden object-cover object-center md:block"
        />
        <Image
          src="/brand/hero-mobile.png"
          alt="Wieczór planszówkowy w górskiej chacie przy kominku"
          fill
          priority
          sizes="(max-width: 767px) calc(100vw - 2rem), 0px"
          className="-z-30 object-cover object-[center_58%] md:hidden"
        />
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(17,9,7,0.94),rgba(17,9,7,0.76))] md:bg-[linear-gradient(90deg,rgba(17,9,7,0.94)_0%,rgba(20,11,8,0.79)_38%,rgba(20,11,8,0.32)_68%,rgba(12,7,5,0.14)_100%)]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(13,7,5,0.42),rgba(13,7,5,0.2)_35%,rgba(13,7,5,0.92)_100%)] md:bg-[radial-gradient(circle_at_20%_50%,rgba(220,116,53,0.13),transparent_34rem)]" />

        <div className="relative flex w-full max-w-2xl flex-col justify-end px-5 py-5 sm:px-8 sm:py-6 md:justify-center lg:px-10">
          <span className="w-fit rounded-full border border-[#e4b16c]/25 bg-black/30 px-3 py-1.5 text-[0.63rem] font-bold tracking-[0.2em] text-[#e3bd86] uppercase backdrop-blur-md">
            Stół · centrum klubowego wieczoru
          </span>
          <h1 className="font-display mt-3 text-3xl leading-[1.04] font-semibold tracking-tight text-[#fff2df] drop-shadow-[0_5px_24px_rgba(0,0,0,0.72)] sm:text-4xl xl:text-5xl">
            Zbierz ekipę.
            <br />
            Wybierz grę.
            <span className="mt-1 block text-[#e2a05d]">Twoja tura.</span>
          </h1>
          <p className="mt-3 max-w-xl text-xs leading-5 text-[#e2d2c0] drop-shadow-md sm:text-sm sm:leading-6">
            Jedno ciepłe miejsce dla wspólnej kolekcji, planów na wieczór i
            historii partii, do których chce się wracać.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link
              href="/gry"
              className="rounded-xl border border-[#efbf82]/35 bg-[#a95f3d]/95 px-4 py-2.5 text-sm font-bold text-[#fff1dc] shadow-[0_12px_30px_rgba(20,8,4,0.52)] backdrop-blur transition-transform hover:-translate-y-0.5 hover:bg-[#b86b45]"
            >
              Otwórz Półkę
            </Link>
            <Link
              href="/kalendarium"
              className="rounded-xl border border-white/18 bg-black/30 px-4 py-2.5 text-sm font-bold text-[#f2e4d3] backdrop-blur-md transition-colors hover:bg-black/42"
            >
              Otwórz Kalendarium
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="quests-heading">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-[#e6b36e] uppercase">
              Aktywne zadania
            </p>
            <h2
              id="quests-heading"
              className="font-display mt-1 text-3xl font-semibold text-[#fff1dc]"
            >
              Questy!
            </h2>
          </div>
          <p className="max-w-md text-xs leading-5 text-[#d0bdab]">
            Rzeczy, które czekają na Twój ruch.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashboardQuests.map((quest) => (
            <QuestCard key={quest.id} quest={quest} />
          ))}
        </div>
      </section>

      <Panel className="parchment-card premium-edge overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ccb48d] bg-[#e8d4b7]/50 px-5 py-4 sm:px-6">
          <div>
            <p className="text-accent text-[0.62rem] font-bold tracking-[0.16em] uppercase">
              Najbliższy wieczór
            </p>
            <h2 className="font-display mt-1 text-2xl font-semibold">
              Letnia strategia w Górskiej Chacie
            </h2>
          </div>
          <Link
            href="/kalendarium"
            className="text-accent text-xs font-bold underline decoration-[#a96a42]/35 underline-offset-4"
          >
            Zobacz spotkanie →
          </Link>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[7rem_1fr_auto] lg:items-center lg:p-7">
          <div className="wood-grain text-cream grid min-h-31 place-items-center rounded-2xl text-center shadow-[0_14px_28px_rgba(42,23,16,0.25)]">
            <div>
              <span className="block text-[0.62rem] font-bold tracking-widest text-[#c9945a] uppercase">
                lipiec
              </span>
              <span className="font-display mt-1 block text-5xl font-semibold">
                11
              </span>
              <span className="block text-xs text-[#c5b5a3]">
                sobota · 18:00
              </span>
            </div>
          </div>

          <div>
            <p className="text-muted text-[0.62rem] font-bold tracking-wider uppercase">
              Lokalizacja
            </p>
            <p className="mt-1 font-semibold">Górska Chata u Michała</p>
            <p className="text-muted mt-4 text-[0.62rem] font-bold tracking-wider uppercase">
              Przy stole
            </p>
            <div className="mt-2 flex items-center gap-2">
              {["P", "M", "A", "K", "J"].map((initial, index) => (
                <span
                  key={initial}
                  className={`text-cream grid size-9 place-items-center rounded-[55%_55%_45%_45%] text-xs font-bold shadow-sm ${index % 2 ? "bg-moss" : "bg-wood"}`}
                >
                  {initial}
                </span>
              ))}
              <span className="text-muted ml-1 text-xs">5 osób</span>
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-muted mb-3 text-[0.62rem] font-bold tracking-wider uppercase lg:text-right">
              Gry na wieczór
            </p>
            <div className="flex gap-3 overflow-x-auto px-1 pt-1 pb-4 lg:justify-end lg:overflow-visible">
              {eveningGames.map((game) => (
                <GameCover
                  key={game.id}
                  title={game.title}
                  coverUrl={game.coverSrc}
                  size="mini"
                />
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <section className="wood-grain premium-edge text-cream rounded-[2rem] p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.62rem] font-bold tracking-[0.2em] text-[#e0ad69] uppercase">
              Ranking punktów · makieta MVP 2
            </p>
            <h2 className="font-display mt-1 text-3xl font-semibold">
              Legendy przy Stole
            </h2>
          </div>
          <Link
            href="/legendarium"
            className="w-fit rounded-xl border border-[#e9b875]/28 bg-white/8 px-4 py-2.5 text-xs font-bold transition-colors hover:bg-white/13"
          >
            Otwórz Legendarium →
          </Link>
        </div>

        <ol className="mt-6 grid grid-cols-2 items-end gap-3 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
          {leaderboard.map((player) => {
            const firstPlace = player.place === 1;
            const compactPlace = player.place >= 4;

            return (
              <li
                key={player.name}
                className={`relative rounded-[1.4rem] border border-white/10 bg-black/17 p-3 text-center shadow-inner ${firstPlace ? "col-span-2 min-h-55 lg:col-span-1 lg:-translate-y-3" : compactPlace ? "min-h-38" : "min-h-46"}`}
              >
                <span className="absolute top-3 left-3 text-[0.58rem] font-bold tracking-wider text-[#bca58e] uppercase">
                  {player.place}. miejsce
                </span>
                <Image
                  src={player.trophy}
                  alt={`Puchar za ${player.place}. miejsce`}
                  width={160}
                  height={160}
                  sizes={firstPlace ? "144px" : compactPlace ? "72px" : "96px"}
                  className={`mx-auto object-contain drop-shadow-[0_12px_20px_rgba(0,0,0,0.45)] ${firstPlace ? "size-32" : compactPlace ? "mt-5 size-17" : "mt-3 size-22"}`}
                />
                <p className="font-display mt-1 text-lg font-semibold">
                  {player.name}
                </p>
                <p className="mt-1 text-xs font-bold text-[#e9b86f]">
                  {player.points.toLocaleString("pl-PL")} pkt
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="parchment-card premium-edge rounded-[2rem] p-4 sm:p-6">
        <p className="text-accent text-[0.62rem] font-bold tracking-[0.2em] uppercase">
          Ostatnio przy Stole
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {recentActivity.map((activity) => (
            <article
              key={activity.title}
              className="paper-wash flex items-start gap-3 rounded-xl p-4 shadow-sm"
            >
              <span
                className={`mt-1.5 size-2.5 shrink-0 rounded-full ${activity.color}`}
              />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold">{activity.title}</h2>
                <p className="text-muted mt-1 text-xs leading-5">
                  {activity.detail}
                </p>
                <p className="text-muted mt-2 text-[0.58rem]">
                  {activity.time}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
