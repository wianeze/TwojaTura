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
      <section className="wood-grain fire-glow text-cream relative overflow-hidden rounded-[2rem] border border-white/10 p-4 sm:p-7 lg:p-9">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-52 bg-[radial-gradient(ellipse_at_50%_0,rgba(244,190,101,0.15),transparent_62%)]"
        />
        <span
          aria-hidden="true"
          className="absolute top-16 left-7 hidden h-24 w-10 rounded-full bg-[#f0bc63]/9 blur-xl sm:block"
        />
        <span
          aria-hidden="true"
          className="absolute top-16 right-7 hidden h-24 w-10 rounded-full bg-[#f0bc63]/9 blur-xl sm:block"
        />
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-[0.65rem] font-bold tracking-[0.2em] text-[#d9b773] uppercase">
              Drewniana półka · makieta
            </p>
            <h2 className="font-display mt-2 text-2xl font-semibold sm:text-3xl">
              Pudełka czekają na swój wieczór
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[#c9b9a7]">
            Najedź na pudełko albo stuknij je, żeby otworzyć szybki podgląd.
          </p>
        </div>

        <div className="relative mt-10 rounded-xl border border-white/6 bg-black/10 px-2 pt-8 shadow-[inset_0_18px_34px_rgba(0,0,0,0.22)] sm:px-5">
          <div className="grid grid-cols-2 items-end gap-x-2 gap-y-10 sm:grid-cols-4 sm:gap-x-4 lg:gap-x-8">
            {mockGames.map((game, index) => (
              <div
                key={game.id}
                className="relative flex items-end justify-center pb-6"
              >
                <button
                  type="button"
                  onClick={() => setSelectedGame(game)}
                  className="group focus-visible:ring-gold focus-visible:ring-offset-wood-dark relative rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
                  aria-label={`Szybki podgląd gry ${game.title}`}
                  aria-haspopup="dialog"
                >
                  <GameCover
                    game={game}
                    size={game.coverSize}
                    className="transition-transform duration-300 group-hover:-translate-y-3 group-focus-visible:-translate-y-3"
                  />

                  <div
                    aria-hidden="true"
                    className={`parchment-card text-foreground shadow-warm pointer-events-none invisible absolute bottom-[calc(100%+1.25rem)] z-30 hidden w-80 rounded-[1.4rem] border border-[#caa978]/60 p-4 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 md:block ${
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
                          {game.players} graczy · {game.duration} ·{" "}
                          {game.rating}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
                <span className="absolute inset-x-0 bottom-0 h-5 rounded-sm border-t border-[#b98760] bg-gradient-to-b from-[#80523b] to-[#4f3025] shadow-[0_9px_14px_rgba(14,8,5,0.7)]" />
              </div>
            ))}
          </div>
          <div
            aria-hidden="true"
            className="absolute inset-x-[-0.5rem] bottom-0 h-3 translate-y-2 rounded-b-lg bg-[#2a1914] shadow-[0_12px_24px_rgba(0,0,0,0.45)]"
          />
        </div>
      </section>

      {selectedGame && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-[#1d120e]/72 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          style={{ zIndex: 60 }}
          role="dialog"
          aria-modal="true"
          aria-label={`Szybki podgląd gry ${selectedGame.title}`}
          onClick={() => setSelectedGame(null)}
        >
          <div
            className="parchment-card shadow-warm relative max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-[#d2b27f]/70 p-5 sm:max-h-[calc(100dvh-3rem)] sm:p-7"
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
            <span
              aria-hidden="true"
              className="border-accent/15 absolute -top-6 -left-6 size-20 rotate-12 rounded-full border-[6px]"
            />
            <div className="relative flex flex-col gap-6 sm:flex-row">
              <GameCover
                game={selectedGame}
                size="preview"
                className="mx-auto sm:mx-0"
              />
              <div className="min-w-0 flex-1 pt-1 sm:pt-6">
                <p className="text-accent text-[0.65rem] font-bold tracking-[0.18em] uppercase">
                  Karta kolekcjonera
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
