import { Panel } from "@/components/ui/panel";
import { GameCover } from "@/components/ui/game-cover";
import { mockGames } from "@/features/games/mock-games";

const meetings = [
  {
    date: "11",
    month: "lip",
    day: "sobota",
    time: "18:00",
    title: "Letni wieczór z cięższą strategią",
    place: "Górska Chata u Michała",
    status: "Potwierdzone",
    statusClass: "bg-moss-soft text-moss",
    participants: ["M", "A", "K", "J"],
  },
  {
    date: "18",
    month: "lip",
    day: "sobota",
    time: "17:30",
    title: "Luźne granie i coś dobrego do jedzenia",
    place: "Przy dużym stole u Ani",
    status: "Trwa ankieta",
    statusClass: "bg-accent-soft text-accent",
    participants: ["A", "M", "K"],
  },
  {
    date: "01",
    month: "sie",
    day: "sobota",
    time: "—",
    title: "Pierwsza sierpniowa tura",
    place: "Lokalizacja do ustalenia",
    status: "Planowane",
    statusClass: "bg-[#f3e6c8] text-[#896527]",
    participants: ["J", "A"],
  },
];

const people = [
  { name: "Marta", initial: "M", answers: [true, true, false] },
  { name: "Ania", initial: "A", answers: [false, true, true] },
  { name: "Kuba", initial: "K", answers: [true, true, true] },
  { name: "Jan", initial: "J", answers: [true, false, false] },
];

export function MeetingsShowcase() {
  return (
    <div className="calendar-wood-panel premium-edge relative isolate space-y-6 overflow-hidden rounded-[2rem] p-4 sm:p-6 lg:p-8">
      <section
        className="grid gap-4 lg:grid-cols-3"
        aria-label="Przykładowe spotkania"
      >
        {meetings.map((meeting, index) => (
          <Panel
            key={`${meeting.date}-${meeting.title}`}
            className={`parchment-card relative overflow-hidden border-[#cbae7f]/60 p-5 sm:p-6 ${index === 0 ? "ring-gold/40 -rotate-[0.25deg] ring-1" : index === 1 ? "rotate-[0.2deg]" : "-rotate-[0.15deg]"}`}
          >
            <span className="via-gold absolute inset-x-5 top-0 h-1 rounded-b-full bg-gradient-to-r from-transparent to-transparent opacity-70" />
            <span
              aria-hidden="true"
              className="border-accent/12 absolute top-4 -right-5 size-17 rotate-12 rounded-full border-[5px]"
            />
            <div className="flex items-start justify-between gap-4">
              <div className="bg-wood-dark text-cream grid size-18 shrink-0 place-items-center rounded-2xl text-center shadow-inner">
                <span>
                  <span className="block text-[0.58rem] font-bold tracking-widest text-[#d7b16e] uppercase">
                    {meeting.month}
                  </span>
                  <span className="font-display block text-3xl leading-7 font-semibold">
                    {meeting.date}
                  </span>
                  <span className="block text-[0.58rem] text-[#c2b1a0]">
                    {meeting.day}
                  </span>
                </span>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[0.6rem] font-bold ${meeting.statusClass}`}
              >
                {meeting.status}
              </span>
            </div>
            <h2 className="font-display mt-5 min-h-14 text-xl leading-7 font-bold">
              {meeting.title}
            </h2>
            <div className="border-border text-muted mt-5 flex items-end justify-between gap-3 border-t border-dashed pt-4 text-xs leading-5">
              <div>
                <p className="text-foreground font-bold">{meeting.time}</p>
                <p>{meeting.place}</p>
              </div>
              <div
                className="flex -space-x-2"
                aria-label={`${meeting.participants.length} uczestników`}
              >
                {meeting.participants.map((initial, participantIndex) => (
                  <span
                    key={`${initial}-${participantIndex}`}
                    className={`text-cream relative grid size-8 place-items-center rounded-[55%_55%_45%_45%] border-2 border-[#f7ead4] text-[0.6rem] font-bold shadow-sm ${
                      participantIndex % 2 ? "bg-moss" : "bg-wood"
                    }`}
                  >
                    {initial}
                  </span>
                ))}
              </div>
            </div>
          </Panel>
        ))}
      </section>

      <section className="text-cream shadow-warm relative overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(145deg,#533428,#2d1d18)] p-5 sm:p-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_24%,rgba(221,111,54,0.18),transparent_18rem)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xs">
            <p className="text-[0.63rem] font-bold tracking-[0.18em] text-[#d4a566] uppercase">
              Na ten wieczór
            </p>
            <h2 className="font-display mt-2 text-2xl font-bold">
              Pudełka już leżą na stole
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#c9b7a5]">
              Statyczna makieta propozycji gier — później w tym miejscu pojawią
              się głosy znajomych.
            </p>
          </div>
          <div className="flex gap-5 overflow-x-auto px-2 pt-3 pb-5 lg:overflow-visible">
            {mockGames.slice(0, 3).map((game, index) => (
              <div
                key={game.id}
                className={`relative shrink-0 ${index === 1 ? "-translate-y-2 rotate-2" : index === 2 ? "-rotate-2" : "rotate-[-1deg]"}`}
              >
                <GameCover
                  title={game.title}
                  coverUrl={game.coverSrc}
                  size="card"
                />
                <span className="text-cream absolute -right-3 -bottom-3 grid size-10 place-items-center rounded-full border-2 border-[#efd09a] bg-[#7d3f2d] text-xs font-bold shadow-lg">
                  {5 - index}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="leather-panel text-cream shadow-warm relative overflow-hidden rounded-[2rem] border border-white/10 p-4 sm:p-6 lg:p-8">
        <span
          aria-hidden="true"
          className="absolute -top-12 right-[12%] h-28 w-40 rotate-3 rounded-md border border-white/8 bg-[#efe1c4]/6 shadow-lg"
        />
        <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.65rem] font-bold tracking-[0.2em] text-[#d8b773] uppercase">
              Stół Kreatywny · makieta
            </p>
            <h2 className="font-display mt-2 text-2xl font-bold sm:text-3xl">
              Ankieta i karta oceny
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[#c9b9a7]">
            Planszetki i żetony porządkują decyzje, ale nie udają grywalizacji.
          </p>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="paper-wash text-foreground overflow-hidden rounded-[1.6rem] border border-white/60 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-accent text-[0.6rem] font-bold tracking-[0.16em] uppercase">
                  Kto może kiedy?
                </p>
                <h3 className="font-display mt-1 text-xl font-semibold">
                  Weekend 18–19 lipca
                </h3>
              </div>
              <span className="bg-moss-soft text-moss rounded-full px-2.5 py-1 text-[0.6rem] font-bold">
                4 odpowiedzi
              </span>
            </div>

            <div className="mt-5 overflow-x-auto pb-2">
              <div className="min-w-[31rem]">
                <div className="text-muted grid grid-cols-[8rem_repeat(3,1fr)] gap-2 text-center text-[0.62rem] font-bold">
                  <span className="text-left">Gracz</span>
                  <span>Pt · 18:00</span>
                  <span className="rounded-lg bg-[#f2dfb8] py-1 text-[#755421]">
                    Sob · 17:30
                  </span>
                  <span>Nd · 16:00</span>
                </div>
                <div className="mt-2 space-y-2">
                  {people.map((person) => (
                    <div
                      key={person.name}
                      className="border-border/70 bg-surface/80 grid grid-cols-[8rem_repeat(3,1fr)] items-center gap-2 rounded-xl border p-2"
                    >
                      <span className="flex items-center gap-2 text-xs font-semibold">
                        <span className="bg-wood text-cream grid size-7 place-items-center rounded-full text-[0.6rem] font-bold">
                          {person.initial}
                        </span>
                        {person.name}
                      </span>
                      {person.answers.map((answer, answerIndex) => (
                        <span
                          key={`${person.name}-${answerIndex}`}
                          className={`mx-auto grid size-7 place-items-center rounded-full text-xs font-bold ${
                            answer
                              ? "bg-moss text-white"
                              : "bg-[#e8e0d4] text-[#a59584]"
                          }`}
                        >
                          {answer ? "✓" : "–"}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="border-gold/30 mt-3 flex items-center gap-3 rounded-xl border bg-[#f5e8ca] p-3 text-xs text-[#725422]">
              <span className="bg-gold text-wood-dark grid size-7 place-items-center rounded-full font-bold">
                3
              </span>
              <span>
                <strong>Najlepszy termin:</strong> sobota, 17:30
              </span>
            </div>
          </div>

          <div className="text-foreground rounded-[1.6rem] border border-[#d8bd8c]/50 bg-[#f0dfbd] p-4 shadow-inner sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.6rem] font-bold tracking-[0.16em] text-[#8c5f2e] uppercase">
                  Arkusz punktacji
                </p>
                <h3 className="font-display mt-1 text-xl font-semibold">
                  Nemesis
                </h3>
              </div>
              <span className="bg-surface text-accent rotate-2 rounded-md px-2 py-1 text-[0.6rem] font-bold shadow-sm">
                makieta oceny
              </span>
            </div>

            <div className="mt-5">
              <p className="text-xs font-bold">Ocena ogólna</p>
              <div
                className="mt-3 grid grid-cols-10 gap-1"
                aria-label="Przykładowa ocena 8 na 10"
              >
                {Array.from({ length: 10 }, (_, index) => index + 1).map(
                  (score) => (
                    <span
                      key={score}
                      className={`grid aspect-square place-items-center rounded-md text-[0.62rem] font-bold ${
                        score === 8
                          ? "bg-ember text-white shadow-md ring-2 ring-white"
                          : "border border-[#d4ba89] bg-[#f8edda] text-[#8a7656]"
                      }`}
                    >
                      {score}
                    </span>
                  ),
                )}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {[
                ["Regrywalność", "w-[80%]"],
                ["Klimat", "w-[90%]"],
                ["Chęć powrotu", "w-[75%]"],
              ].map(([label, width]) => (
                <div key={label}>
                  <div className="flex justify-between text-[0.65rem] font-semibold">
                    <span>{label}</span>
                    <span className="text-[#8b6841]">bardzo dobra</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-[#dcc59e]">
                    <div className={`bg-moss h-full rounded-full ${width}`} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-xl border border-dashed border-[#c7aa76] bg-[#f8edda]/70 p-3 text-xs leading-5 text-[#76654e]">
              „Napięcie do ostatniej rundy i świetny finał. Chętnie zagram
              ponownie.”
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
