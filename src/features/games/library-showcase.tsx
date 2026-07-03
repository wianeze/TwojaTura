import { GameCover } from "@/components/ui/game-cover";
import { Panel } from "@/components/ui/panel";
import { mockGames } from "./mock-games";

export function LibraryShowcase() {
  return (
    <section className="border-border/80 rounded-[2rem] border bg-[#e9dfcf]/70 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block max-w-xl flex-1">
          <span className="sr-only">Wyszukaj grę</span>
          <span className="text-muted absolute top-1/2 left-4 -translate-y-1/2">
            ⌕
          </span>
          <input
            readOnly
            placeholder="Znajdź grę w salonie…"
            className="border-border bg-surface placeholder:text-muted/75 focus:border-gold h-12 w-full rounded-2xl border pl-10 text-sm outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Przykładowe filtry">
          {["2–4 graczy", "do 60 min", "strategiczne"].map((filter) => (
            <span
              key={filter}
              className="border-border bg-surface text-muted rounded-full border px-3 py-2 text-xs font-semibold"
            >
              {filter}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {mockGames.map((game) => (
          <Panel
            key={game.id}
            className="group hover:shadow-warm overflow-hidden p-4 transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="flex gap-4 sm:block xl:flex">
              <GameCover
                game={game}
                size="card"
                className="transition-transform duration-300 group-hover:-rotate-1"
              />
              <div className="min-w-0 flex-1 pt-2 sm:pt-4 xl:pt-2">
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
                  <span className="text-gold">◆</span> {game.rating}
                </p>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </section>
  );
}
