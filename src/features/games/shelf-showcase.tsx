"use client";

import { useEffect, useState } from "react";
import { GameCover } from "@/components/ui/game-cover";
import { mockGames, type MockGame } from "./mock-games";

function formatRating(value: number) {
  return value.toFixed(1).replace(".", ",");
}

function GameFacts({ game }: { game: MockGame }) {
  return (
    <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
      {[
        ["Gracze", game.players],
        ["Czas", game.duration],
        ["Typ", game.type],
        ["Rok", String(game.releaseYear)],
      ].map(([label, value]) => (
        <div key={label} className="paper-wash rounded-xl px-3 py-2.5">
          <dt className="text-muted text-[0.62rem] font-bold tracking-wider uppercase">
            {label}
          </dt>
          <dd className="text-foreground mt-0.5 font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TagList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-muted text-[0.6rem] font-bold tracking-wider uppercase">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span
            key={value}
            className="rounded-full bg-[#ead9b9] px-2.5 py-1 text-[0.65rem] font-semibold text-[#705538] shadow-sm"
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

type ShelfSegmentProps = {
  games: MockGame[];
  label: string;
  onSelect: (game: MockGame) => void;
};

function ShelfSegment({ games, label, onSelect }: ShelfSegmentProps) {
  return (
    <div
      className="shelf-row-bg premium-edge relative overflow-visible rounded-[1.5rem] px-3 pt-7 pb-8 shadow-[inset_0_16px_34px_rgba(8,4,3,0.42)] sm:px-5 sm:pt-8 sm:pb-10 xl:pt-9 xl:pb-11"
      aria-label={label}
    >
      <div className="absolute inset-0 rounded-[inherit] bg-[linear-gradient(180deg,rgba(12,6,4,0.08),rgba(12,6,4,0.12)_45%,rgba(12,6,4,0.58))]" />
      <div className="shelf-segment-grid relative items-end">
        {games.map((game, index) => (
          <div
            key={game.id}
            className="relative flex min-w-0 items-end justify-center"
          >
            <button
              type="button"
              onClick={() => onSelect(game)}
              className="group focus-visible:ring-gold focus-visible:ring-offset-wood-dark relative rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
              aria-label={`Otwórz kartę gry ${game.title}`}
              aria-haspopup="dialog"
            >
              <GameCover
                game={game}
                size="shelf"
                className="transition-transform duration-300 group-hover:-translate-y-2 group-focus-visible:-translate-y-2"
              />

              <div
                aria-hidden="true"
                className={`parchment-card text-foreground shadow-warm pointer-events-none invisible absolute bottom-[calc(100%+0.75rem)] z-40 hidden w-80 rounded-[1.4rem] p-4 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100 lg:block ${
                  index === 0
                    ? "left-0"
                    : index === games.length - 1
                      ? "right-0"
                      : "left-1/2 -translate-x-1/2"
                }`}
              >
                <div className="flex gap-3">
                  <GameCover game={game} size="mini" />
                  <div className="min-w-0 flex-1 py-1">
                    <p className="font-display text-lg font-semibold">
                      {game.title}
                    </p>
                    <p className="text-muted mt-2 line-clamp-3 text-xs leading-5">
                      {game.description}
                    </p>
                    <p className="text-accent mt-2 text-xs font-bold">
                      {game.players} · {game.duration} · {game.releaseYear}
                    </p>
                    <dl className="text-muted mt-2 space-y-1 text-[0.65rem]">
                      <div className="flex justify-between gap-2">
                        <dt>Właściciel / u kogo</dt>
                        <dd className="text-right font-semibold">
                          {game.owner} / {game.currentHolder}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>BGG</dt>
                        <dd className="text-right font-semibold">
                          #{game.bgg.rank} · {formatRating(game.bgg.rating)} ·
                          waga {formatRating(game.bgg.weight)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Grupa</dt>
                        <dd className="text-right font-semibold">
                          {formatRating(game.community.averageRating)} ·{" "}
                          {game.community.playsCount} partii
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Ostatnio</dt>
                        <dd className="text-right font-semibold">
                          {game.community.lastPlayedAt ??
                            "jeszcze nie graliśmy"}
                        </dd>
                      </div>
                    </dl>
                    {game.expansions.length > 0 && (
                      <p className="mt-2 text-[0.65rem] font-semibold text-[#76532f]">
                        Dodatki: {game.expansions.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function groupGames(games: MockGame[], groupSize: number) {
  const groups: MockGame[][] = [];

  for (let index = 0; index < games.length; index += groupSize) {
    groups.push(games.slice(index, index + groupSize));
  }

  const lastGroup = groups.at(-1);
  const previousGroup = groups.at(-2);

  if (lastGroup?.length === 1 && previousGroup && previousGroup.length > 2) {
    lastGroup.unshift(previousGroup.pop() as MockGame);
  }

  return groups;
}

export function ShelfShowcase() {
  const [selectedGame, setSelectedGame] = useState<MockGame | null>(null);
  const [groupSize, setGroupSize] = useState(3);

  useEffect(() => {
    const smallMobileQuery = window.matchMedia("(min-width: 360px)");
    const tabletQuery = window.matchMedia("(min-width: 768px)");
    const desktopQuery = window.matchMedia("(min-width: 1280px)");
    const wideQuery = window.matchMedia("(min-width: 1920px)");
    const updateGroupSize = () => {
      setGroupSize(
        wideQuery.matches
          ? 9
          : desktopQuery.matches
            ? 6
            : tabletQuery.matches
              ? 4
              : smallMobileQuery.matches
                ? 3
                : 2,
      );
    };

    updateGroupSize();
    smallMobileQuery.addEventListener("change", updateGroupSize);
    tabletQuery.addEventListener("change", updateGroupSize);
    desktopQuery.addEventListener("change", updateGroupSize);
    wideQuery.addEventListener("change", updateGroupSize);

    return () => {
      smallMobileQuery.removeEventListener("change", updateGroupSize);
      tabletQuery.removeEventListener("change", updateGroupSize);
      desktopQuery.removeEventListener("change", updateGroupSize);
      wideQuery.removeEventListener("change", updateGroupSize);
    };
  }, []);

  const gameGroups = groupGames(mockGames, groupSize);

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
      <section className="wood-grain fire-glow premium-edge text-cream relative overflow-visible rounded-[2rem] p-4 sm:p-7 lg:p-9">
        <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
          <div>
            <p className="text-[0.65rem] font-bold tracking-[0.2em] text-[#d9b773] uppercase">
              Wspólna kolekcja · makieta
            </p>
            <h2 className="font-display mt-2 text-2xl font-semibold sm:text-3xl">
              Pudełka całej ekipy w jednym miejscu
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[#d3c2ae]">
            Regał płynnie dopasowuje liczbę pudełek do szerokości ekranu. Otwórz
            grę, aby zobaczyć jej właściciela, dodatki i historię grupy.
          </p>
        </div>

        <div className="space-y-4 sm:space-y-5">
          {gameGroups.map((games, index) => (
            <ShelfSegment
              key={games[0].id}
              games={games}
              label={`Segment półki ${index + 1} — ${games.length} gier`}
              onSelect={setSelectedGame}
            />
          ))}
        </div>
      </section>

      {selectedGame && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-[#1d120e]/76 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Karta gry ${selectedGame.title}`}
          onClick={() => setSelectedGame(null)}
        >
          <div
            className="parchment-card premium-edge relative max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl overflow-y-auto rounded-[2rem] p-5 sm:max-h-[calc(100dvh-3rem)] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedGame(null)}
              className="wood-grain text-cream absolute top-4 right-4 z-40 grid size-9 place-items-center rounded-full text-lg transition-transform hover:scale-105"
              aria-label="Zamknij kartę gry"
            >
              ×
            </button>

            <div className="grid gap-6 md:grid-cols-[auto_1fr]">
              <GameCover
                game={selectedGame}
                size="preview"
                className="mx-auto md:mx-0"
              />
              <div className="min-w-0 pt-1 md:pt-5">
                <p className="text-accent text-[0.65rem] font-bold tracking-[0.18em] uppercase">
                  Karta wspólnej kolekcji
                </p>
                <h3 className="font-display mt-2 pr-10 text-3xl font-semibold">
                  {selectedGame.title}
                </h3>
                <p className="text-muted mt-1 text-sm font-semibold">
                  {selectedGame.kicker}
                </p>
                <p className="text-muted mt-3 text-sm leading-6">
                  {selectedGame.description}
                </p>
                <div className="mt-5">
                  <GameFacts game={selectedGame} />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="paper-wash rounded-xl p-3">
                    <p className="text-muted text-[0.6rem] font-bold tracking-wider uppercase">
                      Właściciel
                    </p>
                    <p className="mt-1 font-semibold">{selectedGame.owner}</p>
                  </div>
                  <div className="paper-wash rounded-xl p-3">
                    <p className="text-muted text-[0.6rem] font-bold tracking-wider uppercase">
                      Aktualnie u
                    </p>
                    <p className="mt-1 font-semibold">
                      {selectedGame.currentHolder}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7 grid gap-5 border-t border-dashed border-[#b99d72] pt-6 lg:grid-cols-2">
              <section>
                <p className="text-accent text-[0.62rem] font-bold tracking-[0.16em] uppercase">
                  Dane BoardGameGeek
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  {[
                    ["Ranking", `#${selectedGame.bgg.rank}`],
                    ["Ocena", formatRating(selectedGame.bgg.rating)],
                    [
                      "Trudność",
                      `${formatRating(selectedGame.bgg.weight)} / 5`,
                    ],
                    ["Wiek", `${selectedGame.bgg.minAge}+`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-[#e8d6b5] p-3">
                      <dt className="text-muted text-[0.58rem] font-bold uppercase">
                        {label}
                      </dt>
                      <dd className="mt-1 font-bold">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 space-y-4">
                  <TagList
                    label="Mechaniki"
                    values={selectedGame.bgg.mechanics}
                  />
                  <TagList
                    label="Kategorie"
                    values={selectedGame.bgg.categories}
                  />
                  <div>
                    <p className="text-muted text-[0.6rem] font-bold tracking-wider uppercase">
                      Powiązane dodatki
                    </p>
                    {selectedGame.expansions.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {selectedGame.expansions.map((expansion) => (
                          <li
                            key={expansion}
                            className="rounded-lg bg-[#d9c099] px-2.5 py-1.5 text-[0.68rem] font-bold text-[#65482e] shadow-sm"
                          >
                            {expansion}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted mt-2 text-xs">
                        Brak dodatków w kolekcji.
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-muted mt-4 text-xs leading-5">
                  Projekt: <strong>{selectedGame.bgg.designer}</strong>
                  <br />
                  Wydawca: <strong>{selectedGame.bgg.publisher}</strong>
                </p>
                <a
                  href={selectedGame.bgg.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent mt-3 inline-flex text-xs font-bold underline decoration-[#b37a46]/40 underline-offset-4"
                >
                  Otwórz ręcznie zapisany link BGG ↗
                </a>
              </section>

              <section className="rounded-[1.4rem] bg-[#38251d] p-5 text-[#f7ead5] shadow-inner">
                <p className="text-[0.62rem] font-bold tracking-[0.16em] text-[#e8b870] uppercase">
                  Ślad w grupie
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-3xl font-bold text-[#f0c47e]">
                      {formatRating(selectedGame.community.averageRating)}
                    </p>
                    <p className="text-[0.65rem] text-[#cbb9a7]">
                      średnia z {selectedGame.community.ratingsCount} ocen
                    </p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-[#f0c47e]">
                      {selectedGame.community.playsCount}
                    </p>
                    <p className="text-[0.65rem] text-[#cbb9a7]">
                      zapisanych partii
                    </p>
                  </div>
                </div>
                <dl className="mt-5 space-y-3 border-t border-white/10 pt-4 text-xs">
                  <div>
                    <dt className="text-[#a9998a]">Ostatnia partia</dt>
                    <dd className="mt-1 font-semibold">
                      {selectedGame.community.lastPlayedAt ??
                        "Jeszcze nie graliśmy"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#a9998a]">Chcesz zagrać ponownie?</dt>
                    <dd className="mt-1 font-semibold">
                      {selectedGame.community.currentUserWantsToPlayAgain ===
                      null
                        ? "Brak Twojej oceny"
                        : selectedGame.community.currentUserWantsToPlayAgain
                          ? "Tak"
                          : "Nie"}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
