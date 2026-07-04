type ChronicleResult = {
  name: string;
  initial: string;
  placement: number;
  score: number | null;
  winner: boolean;
};

type ChronicleEntry = {
  date: string;
  game: string;
  meeting: string;
  winner: string;
  duration: string;
  results: ChronicleResult[];
  comment: string;
  marker: string;
};

const chronicleEntries: ChronicleEntry[] = [
  {
    date: "28 czerwca 2026",
    game: "Frostpunk",
    meeting: "Strategiczna sobota u Michała",
    winner: "Marta",
    duration: "82 min",
    results: [
      { name: "Marta", initial: "M", placement: 1, score: 68, winner: true },
      { name: "Ania", initial: "A", placement: 2, score: 61, winner: false },
      { name: "Kuba", initial: "K", placement: 3, score: 54, winner: false },
      { name: "Jan", initial: "J", placement: 4, score: 48, winner: false },
    ],
    comment:
      "Miasto przetrwało burzę, choć ostatnia runda kosztowała nas niemal wszystkie zapasy.",
    marker: "bg-moss",
  },
  {
    date: "14 czerwca 2026",
    game: "Nemesis",
    meeting: "Wieczór z kosmicznym horrorem",
    winner: "Wspólne zwycięstwo",
    duration: "108 min",
    results: [
      { name: "Ania", initial: "A", placement: 1, score: null, winner: true },
      { name: "Kuba", initial: "K", placement: 1, score: null, winner: true },
      { name: "Marta", initial: "M", placement: 1, score: null, winner: true },
    ],
    comment:
      "Silniki ruszyły w ostatnim możliwym ruchu. Nie wszyscy ufali właściwej osobie.",
    marker: "bg-accent",
  },
  {
    date: "31 maja 2026",
    game: "Wyspa Skarbów",
    meeting: "Lekki finał maja",
    winner: "Kuba",
    duration: "64 min",
    results: [
      { name: "Kuba", initial: "K", placement: 1, score: 42, winner: true },
      { name: "Jan", initial: "J", placement: 2, score: 35, winner: false },
      { name: "Ania", initial: "A", placement: 3, score: 29, winner: false },
      { name: "Marta", initial: "M", placement: 4, score: 21, winner: false },
    ],
    comment:
      "Skarb leżał bliżej obozu, niż ktokolwiek podejrzewał. Blef wytrzymał prawie do końca.",
    marker: "bg-gold",
  },
];

export function ChronicleShowcase() {
  return (
    <section className="chronicle-room-bg premium-edge shadow-warm relative overflow-hidden rounded-[2rem] p-4 sm:p-7 lg:p-9">
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-7 w-px bg-[#d1aa67]/25 sm:left-[8.25rem]"
      />
      <div className="relative space-y-5">
        {chronicleEntries.map((entry, index) => (
          <article
            key={`${entry.date}-${entry.game}`}
            className="grid gap-3 sm:grid-cols-[6.5rem_1fr] sm:gap-8"
          >
            <div className="relative pl-8 sm:pt-5 sm:pl-0 sm:text-right">
              <span
                className={`absolute top-1 left-[0.7rem] size-3 rounded-full border-2 border-[#efd59c] shadow-[0_0_0_5px_rgba(47,30,25,0.9)] sm:top-7 sm:-right-[2.48rem] sm:left-auto ${entry.marker}`}
              />
              <p className="text-[0.63rem] font-bold tracking-[0.13em] text-[#d8ba84] uppercase">
                {entry.date}
              </p>
              <p className="mt-1 text-[0.62rem] text-[#9f8d7c]">
                wpis #{chronicleEntries.length - index}
              </p>
            </div>

            <div
              className={`parchment-card premium-edge relative rounded-[1.5rem] p-5 sm:p-6 ${index % 2 ? "rotate-[0.15deg]" : "-rotate-[0.15deg]"}`}
            >
              <span
                aria-hidden="true"
                className="absolute -top-1 right-8 h-8 w-3 rotate-6 rounded-b-sm bg-[#b98b48]/55 shadow-sm"
              />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-accent text-[0.62rem] font-bold tracking-[0.16em] uppercase">
                    {entry.meeting}
                  </p>
                  <h2 className="font-display text-foreground mt-1.5 text-2xl font-semibold">
                    {entry.game}
                  </h2>
                </div>
                <span className="w-fit rounded-full bg-[#ead9b9] px-3 py-1.5 text-xs font-bold text-[#73562f] shadow-inner">
                  {entry.duration}
                </span>
              </div>

              <div className="mt-5 grid gap-5 border-t border-dashed border-[#ccb892] pt-4 lg:grid-cols-[0.75fr_1.25fr]">
                <div>
                  <p className="text-muted text-[0.6rem] font-bold tracking-wider uppercase">
                    Zwycięzca
                  </p>
                  <p className="font-display text-wood mt-1 text-lg font-semibold">
                    {entry.winner}
                  </p>
                  <p className="text-muted mt-3 text-xs leading-5">
                    {entry.comment}
                  </p>
                </div>

                <div>
                  <p className="text-muted mb-2 text-[0.58rem] font-bold tracking-wider uppercase">
                    Uczestnicy i wynik
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {entry.results.map((result) => (
                      <div
                        key={result.name}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 shadow-sm ${result.winner ? "bg-[#e5d2a8]" : "paper-wash"}`}
                      >
                        <span
                          className={`text-cream grid size-8 shrink-0 place-items-center rounded-[55%_55%_45%_45%] text-[0.62rem] font-bold ${result.winner ? "bg-moss" : "bg-wood"}`}
                        >
                          {result.initial}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold">
                            {result.name}
                          </span>
                          <span className="text-muted block text-[0.6rem]">
                            {result.placement}. miejsce
                          </span>
                        </span>
                        <span className="text-accent text-xs font-bold">
                          {result.score === null ? "—" : `${result.score} pkt`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
