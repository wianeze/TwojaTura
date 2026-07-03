const chronicleEntries = [
  {
    date: "28 czerwca 2026",
    game: "Frostpunk",
    winner: "Marta",
    duration: "82 min",
    players: ["M", "A", "K", "J"],
    note: "Miasto przetrwało burzę, choć ostatnia runda kosztowała nas niemal wszystkie zapasy.",
    marker: "bg-moss",
  },
  {
    date: "14 czerwca 2026",
    game: "Nemesis",
    winner: "Wspólne zwycięstwo",
    duration: "108 min",
    players: ["A", "K", "M"],
    note: "Silniki ruszyły w ostatnim możliwym ruchu. Nie wszyscy ufali właściwej osobie.",
    marker: "bg-accent",
  },
  {
    date: "31 maja 2026",
    game: "Wyspa Skarbów",
    winner: "Kuba",
    duration: "64 min",
    players: ["K", "J", "A", "M"],
    note: "Skarb leżał bliżej obozu, niż ktokolwiek podejrzewał. Blef wytrzymał prawie do końca.",
    marker: "bg-gold",
  },
];

export function ChronicleShowcase() {
  return (
    <section className="leather-panel shadow-warm relative overflow-hidden rounded-[2rem] border border-white/10 p-4 sm:p-7 lg:p-9">
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
                wpis #{3 - index}
              </p>
            </div>

            <div
              className={`parchment-card relative rounded-[1.5rem] border border-[#c9aa78]/55 p-5 sm:p-6 ${index % 2 ? "rotate-[0.15deg]" : "-rotate-[0.15deg]"}`}
            >
              <span
                aria-hidden="true"
                className="absolute -top-1 right-8 h-8 w-3 rotate-6 rounded-b-sm bg-[#b98b48]/55 shadow-sm"
              />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-accent text-[0.62rem] font-bold tracking-[0.16em] uppercase">
                    Zapis z wieczoru
                  </p>
                  <h2 className="font-display text-foreground mt-1.5 text-2xl font-semibold">
                    {entry.game}
                  </h2>
                </div>
                <span className="w-fit rounded-full border border-[#c9ad80] bg-[#f4e6ca] px-3 py-1.5 text-xs font-bold text-[#73562f]">
                  {entry.duration}
                </span>
              </div>

              <div className="mt-5 grid gap-4 border-t border-dashed border-[#ccb892] pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <p className="text-muted text-[0.6rem] font-bold tracking-wider uppercase">
                    Zwycięzca
                  </p>
                  <p className="font-display text-wood mt-1 text-lg font-semibold">
                    {entry.winner}
                  </p>
                  <p className="text-muted mt-3 max-w-xl text-xs leading-5">
                    {entry.note}
                  </p>
                </div>
                <div>
                  <p className="text-muted mb-2 text-right text-[0.58rem] font-bold tracking-wider uppercase">
                    Przy stole
                  </p>
                  <div className="flex -space-x-2">
                    {entry.players.map((player, playerIndex) => (
                      <span
                        key={`${player}-${playerIndex}`}
                        className={`text-cream grid size-9 place-items-center rounded-[55%_55%_45%_45%] border-2 border-[#f7ead4] text-[0.62rem] font-bold shadow-sm ${
                          playerIndex % 2 ? "bg-moss" : "bg-wood"
                        }`}
                      >
                        {player}
                      </span>
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
