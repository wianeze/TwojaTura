"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GameCover } from "@/components/ui/game-cover";
import { getBggExpansionPreview } from "./bgg";
import { getOwnedExpansionNames } from "./expansions";
import { formatDecimal, formatPlayerRange, formatPlayTime } from "./formatting";
import type { GameShelfItem } from "./types";

function GameFacts({ game }: { game: GameShelfItem }) {
  return (
    <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
      {[
        ["Gracze", formatPlayerRange(game.minPlayers, game.maxPlayers)],
        ["Czas", formatPlayTime(game.playTimeMinutes)],
        ["Typ", game.gameType ?? "—"],
        ["Rok", game.releaseYear ? String(game.releaseYear) : "—"],
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
  if (values.length === 0) return null;

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
  games: GameShelfItem[];
  label: string;
  onSelect: (game: GameShelfItem) => void;
};

function ShelfSegment({ games, label, onSelect }: ShelfSegmentProps) {
  const router = useRouter();

  const handleGameClick = (game: GameShelfItem) => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      onSelect(game);
      return;
    }

    router.push(`/gry/${game.id}`);
  };

  return (
    <div
      className="shelf-row-bg premium-edge relative overflow-visible rounded-[1.5rem] px-3 pt-6 pb-6 shadow-[inset_0_16px_34px_rgba(8,4,3,0.42)] sm:px-5 sm:pt-7 sm:pb-7 xl:pt-8 xl:pb-8"
      aria-label={label}
    >
      <div className="absolute inset-0 rounded-[inherit] bg-[linear-gradient(180deg,rgba(12,6,4,0.08),rgba(12,6,4,0.12)_45%,rgba(12,6,4,0.58))]" />
      <div className="shelf-segment-grid relative items-end">
        {games.map((game, index) => {
          const ownedExpansions = getOwnedExpansionNames(game.expansions);
          const expansionPreview = getBggExpansionPreview(
            ownedExpansions,
            game.title,
          );

          return (
            <div
              key={game.id}
              className="relative flex min-w-0 items-end justify-center"
            >
              <button
                type="button"
                onClick={() => handleGameClick(game)}
                className="group focus-visible:ring-gold focus-visible:ring-offset-wood-dark relative w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
                aria-label={`Otwórz kartę gry ${game.title}`}
              >
                <GameCover
                  title={game.title}
                  coverUrl={game.coverUrl}
                  size="shelf"
                  className="mx-auto transition-transform duration-300 group-hover:-translate-y-2 group-focus-visible:-translate-y-2"
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
                    <GameCover
                      title={game.title}
                      coverUrl={game.coverUrl}
                      size="mini"
                    />
                    <div className="min-w-0 flex-1 py-1">
                      <p className="font-display text-lg font-semibold">
                        {game.title}
                      </p>
                      <p className="text-muted mt-2 line-clamp-3 text-xs leading-5">
                        {game.description ??
                          "Ta gra czeka jeszcze na krótki opis."}
                      </p>
                      <p className="text-accent mt-2 text-xs font-bold">
                        {formatPlayerRange(game.minPlayers, game.maxPlayers)} ·{" "}
                        {formatPlayTime(game.playTimeMinutes)} ·{" "}
                        {game.gameType ?? "bez typu"}
                      </p>
                      <dl className="text-muted mt-2 space-y-1 text-[0.65rem]">
                        <div className="flex justify-between gap-2">
                          <dt>Właściciel / u kogo</dt>
                          <dd className="text-right font-semibold">
                            {game.owner.displayName} /{" "}
                            {game.currentHolder?.displayName ?? "nieustalone"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>BGG</dt>
                          <dd className="text-right font-semibold">
                            {game.bggRank ? `#${game.bggRank}` : "brak"} · waga{" "}
                            {formatDecimal(game.bggWeight)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>Średnia grupy</dt>
                          <dd className="text-right font-semibold">
                            {formatDecimal(game.ratingSummary.averageOverall)} ·{" "}
                            {game.ratingSummary.ratingsCount} ocen
                          </dd>
                        </div>
                      </dl>
                      {expansionPreview.names.length > 0 && (
                        <p className="mt-2 text-[0.65rem] font-semibold text-[#76532f]">
                          Dodatki: {expansionPreview.names.join(", ")}
                          {expansionPreview.remainingCount > 0
                            ? ` +${expansionPreview.remainingCount} więcej`
                            : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function groupGames(games: GameShelfItem[], groupSize: number) {
  const groups: GameShelfItem[][] = [];

  for (let index = 0; index < games.length; index += groupSize) {
    groups.push(games.slice(index, index + groupSize));
  }

  const lastGroup = groups.at(-1);
  const previousGroup = groups.at(-2);

  if (lastGroup?.length === 1 && previousGroup && previousGroup.length > 2) {
    lastGroup.unshift(previousGroup.pop() as GameShelfItem);
  }

  return groups;
}

type ShelfShowcaseProps = {
  games: GameShelfItem[];
};

export function ShelfShowcase({ games }: ShelfShowcaseProps) {
  const [selectedGame, setSelectedGame] = useState<GameShelfItem | null>(null);
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

  const gameGroups = groupGames(games, groupSize);

  useEffect(() => {
    if (!selectedGame) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedGame(null);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedGame]);

  const selectedOwnedExpansions = selectedGame
    ? getOwnedExpansionNames(selectedGame.expansions)
    : [];
  const selectedExpansionPreview = selectedGame
    ? getBggExpansionPreview(selectedOwnedExpansions, selectedGame.title)
    : null;

  return (
    <>
      <section className="wood-grain fire-glow premium-edge text-cream relative overflow-visible rounded-[2rem] p-4 sm:p-5 lg:p-6">
        <div className="space-y-4 sm:space-y-5">
          {gameGroups.map((group, index) => (
            <ShelfSegment
              key={group[0].id}
              games={group}
              label={`Segment półki ${index + 1} — ${group.length} gier`}
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
          aria-label={`Szybki podgląd gry ${selectedGame.title}`}
          onClick={() => setSelectedGame(null)}
        >
          <div
            className="parchment-card premium-edge relative max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-[2rem] p-5 sm:max-h-[calc(100dvh-3rem)] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedGame(null)}
              className="wood-grain text-cream absolute top-4 right-4 z-40 grid size-9 place-items-center rounded-full text-lg transition-transform hover:scale-105"
              aria-label="Zamknij szybki podgląd"
            >
              ×
            </button>

            <div className="grid gap-6 md:grid-cols-[auto_1fr]">
              <GameCover
                title={selectedGame.title}
                coverUrl={selectedGame.coverUrl}
                size="preview"
                className="mx-auto md:mx-0"
              />
              <div className="min-w-0 pt-1 md:pt-3">
                <p className="text-accent text-[0.65rem] font-bold tracking-[0.18em] uppercase">
                  Szybki podgląd Półki
                </p>
                <h3 className="font-display mt-2 pr-10 text-3xl font-semibold">
                  {selectedGame.title}
                </h3>
                <p className="text-muted mt-3 text-sm leading-6">
                  {selectedGame.description ??
                    "Ta gra nie ma jeszcze opisu, ale możesz już zapisać jej ocenę i uzupełnić dane na pełnej karcie."}
                </p>

                <div className="mt-5">
                  <GameFacts game={selectedGame} />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="paper-wash rounded-xl p-3">
                    <p className="text-muted text-[0.6rem] font-bold tracking-wider uppercase">
                      Właściciel
                    </p>
                    <p className="mt-1 font-semibold">
                      {selectedGame.owner.displayName}
                    </p>
                  </div>
                  <div className="paper-wash rounded-xl p-3">
                    <p className="text-muted text-[0.6rem] font-bold tracking-wider uppercase">
                      Aktualnie u
                    </p>
                    <p className="mt-1 font-semibold">
                      {selectedGame.currentHolder?.displayName ?? "nieustalone"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
                  <div className="space-y-4">
                    <TagList
                      label="Mechaniki"
                      values={selectedGame.mechanics}
                    />
                    <TagList
                      label="Kategorie"
                      values={selectedGame.categories}
                    />
                    <div>
                      <p className="text-muted text-[0.6rem] font-bold tracking-wider uppercase">
                        Dodatki
                      </p>
                      <p className="mt-2 text-sm text-[#6f5640]">
                        {selectedExpansionPreview &&
                        selectedExpansionPreview.names.length > 0
                          ? `${selectedExpansionPreview.names.join(", ")}${
                              selectedExpansionPreview.remainingCount > 0
                                ? ` +${selectedExpansionPreview.remainingCount} więcej`
                                : ""
                            }`
                          : "Brak posiadanych dodatków."}
                      </p>
                    </div>
                  </div>

                  <div className="leather-panel rounded-[1.5rem] p-4 text-[#f7ead5]">
                    <p className="text-[0.62rem] font-bold tracking-[0.16em] text-[#e8b870] uppercase">
                      Ślad w grupie
                    </p>
                    <p className="mt-3 text-3xl font-bold text-[#f0c47e]">
                      {formatDecimal(selectedGame.ratingSummary.averageOverall)}
                    </p>
                    <p className="text-[0.7rem] text-[#cbb9a7]">
                      średnia z {selectedGame.ratingSummary.ratingsCount} ocen
                    </p>
                    <p className="mt-4 text-xs leading-5 text-[#d7c8b5]">
                      BGG Rank:{" "}
                      <strong>
                        {selectedGame.bggRank
                          ? `#${selectedGame.bggRank}`
                          : "brak"}
                      </strong>
                      <br />
                      BGG Weight:{" "}
                      <strong>{formatDecimal(selectedGame.bggWeight)}</strong>
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={`/gry/${selectedGame.id}`}
                    className="bg-brand hover:bg-brand-strong rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors"
                  >
                    Otwórz pełną kartę gry
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSelectedGame(null)}
                    className="paper-wash rounded-xl px-4 py-3 text-sm font-semibold text-[#6d5037]"
                  >
                    Wróć do Półki
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
