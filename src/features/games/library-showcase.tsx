import { GameCover } from "@/components/ui/game-cover";
import { Panel } from "@/components/ui/panel";
import { mockGames } from "./mock-games";

export function LibraryShowcase() {
  return (
    <section className="shadow-warm overflow-hidden rounded-[2rem] border border-[#8b674f]/35">
      <div className="leather-panel text-cream flex flex-col gap-3 border-b border-white/10 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block max-w-xl flex-1">
          <span className="sr-only">Wyszukaj grę</span>
          <span className="absolute top-1/2 left-4 -translate-y-1/2 text-[#dfbd7e]">
            ⌕
          </span>
          <input
            readOnly
            placeholder="Znajdź grę w salonie…"
            className="text-cream focus:border-gold h-12 w-full rounded-2xl border border-white/12 bg-black/12 pl-10 text-sm outline-none placeholder:text-[#c7b7a5]"
          />
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Przykładowe filtry">
          {["2–4 graczy", "do 60 min", "strategiczne"].map((filter) => (
            <span
              key={filter}
              className="rounded-full border border-white/12 bg-white/7 px-3 py-2 text-xs font-semibold text-[#d8c9b8]"
            >
              {filter}
            </span>
          ))}
        </div>
      </div>

      <div className="rug-pattern relative grid gap-5 overflow-hidden p-4 sm:grid-cols-2 sm:p-6 lg:p-8 xl:grid-cols-3">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_6%,rgba(225,142,63,0.2),transparent_30%),linear-gradient(180deg,rgba(42,24,18,0.1),rgba(24,13,10,0.3))]"
        />
        {mockGames.map((game, index) => (
          <div key={game.id} className="relative z-10 pb-3">
            <Panel
              className={`parchment-card group hover:shadow-warm relative h-full overflow-hidden border-[#c8ad83]/60 p-4 shadow-[0_18px_28px_rgba(21,10,7,0.3)] transition-transform duration-300 hover:-translate-y-1 ${
                index % 2 ? "rotate-[0.2deg]" : "-rotate-[0.2deg]"
              }`}
            >
              <span className="bg-gold/75 absolute top-0 right-5 h-8 w-3 shadow-sm" />
              <div className="flex gap-4 sm:block">
                <GameCover
                  game={game}
                  size="card"
                  className="transition-transform duration-300 group-hover:-rotate-1 sm:mx-auto"
                />
                <div className="min-w-0 flex-1 pt-2 sm:pt-4">
                  <span className="bg-moss-soft text-moss rounded-full px-2.5 py-1 text-[0.62rem] font-bold">
                    {game.type}
                  </span>
                  <h2 className="font-display mt-3 text-xl font-semibold">
                    {game.title}
                  </h2>
                  <p className="text-muted mt-2 text-xs leading-5">
                    {game.players} graczy
                    <br />
                    {game.duration}
                  </p>
                  <p className="text-accent mt-4 inline-flex items-center gap-1.5 text-sm font-bold">
                    <span className="bg-gold text-wood-dark grid size-6 place-items-center rounded-full text-[0.65rem] shadow-sm">
                      ◆
                    </span>{" "}
                    {game.rating}
                  </p>
                  <p className="mt-4 border-t border-dashed border-[#cbb896] pt-3 text-[0.62rem] font-bold tracking-wider text-[#8a755e] uppercase">
                    z półki {index % 2 ? "Ani" : "Marty"}
                  </p>
                </div>
              </div>
            </Panel>
            <span className="absolute right-1 bottom-0 left-1 h-4 rounded-b-lg border-t border-[#be8153]/55 bg-[linear-gradient(180deg,#70412b,#3a1f18_55%,#28150f)] shadow-[0_9px_12px_rgba(14,7,5,0.55)]" />
          </div>
        ))}
      </div>
    </section>
  );
}
