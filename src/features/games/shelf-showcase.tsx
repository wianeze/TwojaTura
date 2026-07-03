"use client";

import { useEffect, useState } from "react";
import { GameCover } from "@/components/ui/game-cover";
import { mockGames, type MockGame } from "./mock-games";

function GameFacts({ game }: { game: MockGame }) {
  return (
    <dl className="grid grid-cols-2 gap-2 text-xs">
      {[
        ["Gracze", game.players],
        ["Czas", game.duration],
        ["Typ", game.type],
        ["Ocena", `${game.rating} / 10`],
      ].map(([label, value]) => (
        <div key={label} className="bg-background/80 rounded-xl px-3 py-2.5">
          <dt className="text-muted text-[0.62rem] font-bold tracking-wider uppercase">
            {label}
          </dt>
          <dd className="text-foreground mt-0.5 font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ShelfShowcase() {
  const [selectedGame, setSelectedGame] = useState<MockGame | null>(null);

  useEffect(() => {
    if (!selectedGame) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedGame(null);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedGame]);

  return (
    <>
      <section className="wood-grain fire-glow text-cream rounded-[2rem] border border-white/10 p-4 sm:p-7 lg:p-9">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-[0.65rem] font-bold tracking-[0.2em] text-[#d9b773] uppercase">
              Cozy Shelf · prototyp
            </p>
            <h2 className="font-display mt-2 text-2xl font-semibold sm:text-3xl">
              Pudełka czekają na swój wieczór
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[#c9b9a7]">
            Najedź na pudełko albo stuknij je, żeby otworzyć szybki podgląd.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-4 sm:gap-x-6 lg:gap-x-9">
          {mockGames.map((game, index) => (
            <div key={game.id} className="relative flex justify-center pb-5">
              <button
                type="button"
                onClick={() => setSelectedGame(game)}
                className="group focus-visible:ring-gold focus-visible:ring-offset-wood-dark relative rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
                aria-label={`Szybki podgląd gry ${game.title}`}
                aria-haspopup="dialog"
              >
                <GameCover
                  game={game}
                  className="transition-transform duration-300 group-hover:-translate-y-3 group-focus-visible:-translate-y-3"
                />

                <div
                  aria-hidden="true"
                  className={`border-border bg-surface text-foreground shadow-warm pointer-events-none invisible absolute bottom-[calc(100%+1.25rem)] z-30 hidden w-80 rounded-2xl border p-4 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 md:block ${
                    index === 0
                      ? "left-0"
                      : index === mockGames.length - 1
                        ? "right-0"
                        : "left-1/2 -translate-x-1/2"
                  }`}
                >
                  <div className="flex gap-4">
                    <GameCover game={game} size="card" />
                    <div className="min-w-0 flex-1 py-1">
                      <p className="font-display text-xl font-semibold">
                        {game.title}
                      </p>
                      <p className="text-muted mt-2 text-xs leading-5">
                        {game.description}
                      </p>
                      <p className="text-accent mt-3 text-xs font-bold">
                        {game.players} graczy · {game.duration} · {game.rating}
                      </p>
                    </div>
                  </div>
                </div>
              </button>
              <span className="absolute inset-x-0 bottom-0 h-4 rounded-sm border-t border-[#a87956] bg-[#6c422f] shadow-[0_7px_10px_rgba(14,8,5,0.55)]" />
            </div>
          ))}
        </div>
      </section>

      {selectedGame && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#1d120e]/72 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Szybki podgląd gry ${selectedGame.title}`}
          onClick={() => setSelectedGame(null)}
        >
          <div
            className="paper-wash shadow-warm relative w-full max-w-2xl rounded-[2rem] border border-white/60 p-5 sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedGame(null)}
              className="bg-wood-dark text-cream hover:bg-brand absolute top-4 right-4 z-10 grid size-9 place-items-center rounded-full text-lg transition-colors"
              aria-label="Zamknij szybki podgląd"
            >
              ×
            </button>
            <div className="flex flex-col gap-6 sm:flex-row">
              <GameCover
                game={selectedGame}
                size="preview"
                className="mx-auto sm:mx-0"
              />
              <div className="min-w-0 flex-1 pt-1 sm:pt-6">
                <p className="text-accent text-[0.65rem] font-bold tracking-[0.18em] uppercase">
                  Szybki podgląd
                </p>
                <h3 className="font-display mt-2 text-3xl font-semibold">
                  {selectedGame.title}
                </h3>
                <p className="text-muted mt-3 text-sm leading-6">
                  {selectedGame.description}
                </p>
                <div className="mt-5">
                  <GameFacts game={selectedGame} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
