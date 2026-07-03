import { Panel } from "@/components/ui/panel";

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
    <div className="space-y-6">
      <section
        className="grid gap-4 lg:grid-cols-3"
        aria-label="Przykładowe spotkania"
      >
        {meetings.map((meeting, index) => (
          <Panel
            key={`${meeting.date}-${meeting.title}`}
            className={`relative overflow-hidden p-5 sm:p-6 ${index === 0 ? "ring-gold/40 ring-1" : ""}`}
          >
            <span className="via-gold absolute inset-x-5 top-0 h-1 rounded-b-full bg-gradient-to-r from-transparent to-transparent opacity-70" />
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
            <h2 className="font-display mt-5 min-h-14 text-xl leading-7 font-semibold">
              {meeting.title}
            </h2>
            <div className="border-border text-muted mt-5 border-t border-dashed pt-4 text-xs leading-5">
              <p className="text-foreground font-bold">{meeting.time}</p>
              <p>{meeting.place}</p>
            </div>
          </Panel>
        ))}
      </section>

      <section className="wood-grain text-cream shadow-warm rounded-[2rem] border border-white/10 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.65rem] font-bold tracking-[0.2em] text-[#d8b773] uppercase">
              Stół Kreatywny · makieta
            </p>
            <h2 className="font-display mt-2 text-2xl font-semibold sm:text-3xl">
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
                  Leśny Szlak
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
              „Piękna mapa i dużo dobrych decyzji. Chętnie zagram ponownie.”
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
