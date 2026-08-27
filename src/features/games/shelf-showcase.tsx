"use client";

import { ActionButton, ActionLink } from "@/components/ui/action-button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GameCover } from "@/components/ui/game-cover";
import { PlayerPortraitFrame } from "@/components/ui/player-portrait-frame";
import { PlayerDisplayName } from "@/components/ui/player-display-name";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
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
  startIndex: number;
  animateEntrance: boolean;
  label: string;
  showOwners: boolean;
  onSelect: (game: GameShelfItem) => void;
};

function ShelfOwnerAvatar({ owner }: { owner: GameShelfItem["owner"] }) {
  return (
    <span
      className="absolute -top-1 right-0 z-10"
      aria-label={`Owner: ${owner.displayName}`}
      title={owner.displayName}
    >
      <PlayerPortraitFrame
        avatarUrl={owner.avatarUrl}
        name={owner.displayName}
        frameType={owner.activePortraitFrameKey}
        size="compact"
      />
    </span>
  );
}

function ShelfLoanStatus({ game }: { game: GameShelfItem }) {
  if (!game.activeLoan) return null;

  return (
    <span
      className="absolute right-1 bottom-1 left-1 z-10 truncate rounded-full border border-[#f2d8a8]/80 bg-[#2f1b15]/90 px-1.5 py-1 text-center text-[0.52rem] font-bold text-[#fff1d2] shadow-[0_3px_10px_rgba(13,6,3,0.65)] backdrop-blur-[2px] sm:text-[0.6rem]"
      title={`Aktywnie wypożyczona — u ${game.activeLoan.borrower.displayName}`}
    >
      u {game.activeLoan.borrower.displayName}
    </span>
  );
}

function ShelfSegment({
  games,
  startIndex,
  animateEntrance,
  label,
  showOwners,
  onSelect,
}: ShelfSegmentProps) {
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

          const absoluteIndex = startIndex + index;

          return (
            <div
              key={game.id}
              className="relative flex min-w-0 items-end justify-center"
            >
              <button
                type="button"
                onClick={() => handleGameClick(game)}
                className="game-card-glow group focus-visible:ring-gold focus-visible:ring-offset-wood-dark relative w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
                aria-label={`Otwórz kartę gry ${game.title}`}
              >
                {/*
                  Animacja wejścia żyje TYLKO na tym opakowaniu okładki, nie
                  na całej karcie/przycisku — CSS Animation na opacity/transform
                  tworzy nowy stacking context, a popup podglądu (niżej) musi
                  zostać POZA nim, inaczej jego z-index jest izolowany wewnątrz
                  tej jednej karty i nie może wznieść się nad sąsiednie karty.
                */}
                <div
                  className={animateEntrance ? "anim-rise-in-fast" : undefined}
                  style={
                    animateEntrance
                      ? {
                          animationDelay: `${getEntranceStaggerDelayMs(absoluteIndex)}ms`,
                        }
                      : undefined
                  }
                >
                  <div className="relative mx-auto w-full max-w-24 transition-transform duration-300 group-hover:-translate-y-2 group-focus-visible:-translate-y-2 sm:max-w-28 xl:max-w-30 2xl:max-w-32">
                    <GameCover
                      title={game.title}
                      coverUrl={game.coverUrl}
                      size="shelf"
                      className="mx-auto"
                    />
                    {showOwners && <ShelfOwnerAvatar owner={game.owner} />}
                    <ShelfLoanStatus game={game} />
                  </div>
                </div>

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
                        {game.activeLoan ? (
                          <div className="flex justify-between gap-2 text-[#8f4b31]">
                            <dt>Wypożyczona</dt>
                            <dd className="min-w-0 text-right font-bold">
                              <PlayerDisplayName variant="compact" displayName={game.activeLoan.borrower.displayName} title={game.activeLoan.borrower.equippedTitle} />
                            </dd>
                          </div>
                        ) : null}
                        <div className="flex justify-between gap-2">
                          <dt>Właściciel / u kogo</dt>
                          <dd className="min-w-0 text-right font-semibold">
                            <PlayerDisplayName variant="compact" displayName={game.owner.displayName} title={game.owner.equippedTitle} />
                            {game.currentHolder ? <><span> / </span><PlayerDisplayName variant="compact" displayName={game.currentHolder.displayName} title={game.currentHolder.equippedTitle} className="inline-block max-w-[8rem] align-bottom" /></> : "nieustalone"}
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
  showOwners?: boolean;
};

export function ShelfShowcase({
  games,
  showOwners = false,
}: ShelfShowcaseProps) {
  const [selectedGame, setSelectedGame] = useState<GameShelfItem | null>(null);
  const [groupSize, setGroupSize] = useState(3);
  // Startuje identycznie na serwerze i przy hydracji (false) — brak
  // mismatchu. Dopiero po potwierdzeniu realnej szerokości viewportu
  // włączamy animację wejścia, żeby nie odtwarzała się dwa razy (raz na
  // błędnym groupSize=3 z SSR, raz po korekcie) — to właśnie sprawiało,
  // że wejście wyglądało jak niewidoczne mignięcie zamiast animacji.
  const [isViewportReady, setIsViewportReady] = useState(false);

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
      setIsViewportReady(true);
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
  const gameGroupsWithOffsets = gameGroups.reduce<
    Array<{ group: GameShelfItem[]; startIndex: number }>
  >((acc, group) => {
    const previous = acc.at(-1);
    const startIndex = previous
      ? previous.startIndex + previous.group.length
      : 0;
    return [...acc, { group, startIndex }];
  }, []);

  // Zmienia się przy każdej korekcie groupSize ORAZ przy każdej zmianie
  // listy gier (np. po zastosowaniu filtrów) — wymusza jeden świeży
  // remount całej siatki, więc animacja wejścia jest widoczna zarówno po
  // wejściu na Półkę, jak i po zmianie filtrów. Przed potwierdzeniem
  // viewportu klucz jest stały ("initial"), żeby pierwszy render po
  // stronie klienta dokładnie odpowiadał SSR (bez mismatchu).
  const gridInstanceKey = isViewportReady
    ? `${groupSize}:${games.map((game) => game.id).join(",")}`
    : "initial";

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
      {/*
        isolate: .premium-edge (użyta zarówno tu, jak i w panelu filtrów
        nad Półką) rysuje dekoracyjną krawędź przez ::after z z-index:30.
        Bez własnego stacking contextu te pseudo-elementy "wyciekają" do
        wspólnego, odległego przodka i mieszają się tam z krawędzią panelu
        filtrów w nieprzewidywalny sposób — to właśnie dawało efekt linii
        z filtrów przechodzącej przez popup podglądu gry. isolate zamyka
        całą Półkę (wraz z popupem) w jednym, spójnym stacking contexcie,
        więc naturalna kolejność DOM (Półka renderuje się PO filtrach)
        poprawnie decyduje, że Półka rysuje się na wierzchu — bez zgadywania
        konkretnych wartości z-index.
      */}
      <section className="wood-grain fire-glow premium-edge text-cream relative isolate overflow-visible rounded-[2rem] p-4 sm:p-5 lg:p-6">
        <div key={gridInstanceKey} className="space-y-4 sm:space-y-5">
          {gameGroupsWithOffsets.map(({ group, startIndex }, index) => (
            <ShelfSegment
              key={group[0].id}
              games={group}
              startIndex={startIndex}
              animateEntrance={isViewportReady}
              showOwners={showOwners}
              label={`Segment półki ${index + 1} — ${group.length} gier`}
              onSelect={setSelectedGame}
            />
          ))}
        </div>
      </section>

      {selectedGame && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-[#1d120e]/76 p-3 pb-[calc(env(safe-area-inset-bottom)+5.75rem)] backdrop-blur-sm sm:items-center sm:px-6 sm:pt-6 sm:pb-[calc(env(safe-area-inset-bottom)+5.75rem)] lg:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Szybki podgląd gry ${selectedGame.title}`}
          onClick={() => setSelectedGame(null)}
        >
          <div className="premium-edge relative w-full max-w-3xl rounded-[2rem]">
            <div
              className="parchment-card relative max-h-[calc(100dvh-env(safe-area-inset-bottom)-6.5rem)] w-full overflow-y-auto rounded-[2rem] p-5 sm:max-h-[calc(100dvh-env(safe-area-inset-bottom)-6.5rem)] sm:p-7 lg:max-h-[calc(100dvh-3rem)]"
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

              <div className="space-y-5">
                <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] items-stretch gap-3 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-5">
                  <GameCover
                    title={selectedGame.title}
                    coverUrl={selectedGame.coverUrl}
                    size="preview"
                    fitParent
                    className="mx-auto max-w-[10.5rem] md:mx-0 md:max-w-none"
                  />
                  <div className="leather-panel flex h-full min-w-0 flex-col justify-between rounded-[1.5rem] p-3 text-[#f7ead5] sm:p-4">
                    <div>
                      <p className="text-[0.58rem] font-bold tracking-[0.14em] text-[#e8b870] uppercase">
                        Ocena grupy
                      </p>
                      <p className="mt-2 text-3xl leading-none font-bold text-[#f0c47e] sm:text-4xl">
                        {formatDecimal(
                          selectedGame.ratingSummary.averageOverall,
                        )}
                      </p>
                      <p className="mt-1 text-[0.68rem] text-[#cbb9a7]">
                        średnia z {selectedGame.ratingSummary.ratingsCount} ocen
                      </p>
                    </div>
                    <p className="mt-3 border-t border-white/10 pt-2 text-[0.68rem] leading-5 text-[#d7c8b5]">
                      BGG #{selectedGame.bggRank ?? "—"} · waga{" "}
                      <strong>{formatDecimal(selectedGame.bggWeight)}</strong>
                    </p>
                  </div>
                </div>
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

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="paper-wash rounded-xl px-3 py-2">
                      <p className="text-muted text-[0.58rem] font-bold tracking-wider uppercase">
                        Właściciel
                      </p>
                      <PlayerDisplayName variant="compact" displayName={selectedGame.owner.displayName} title={selectedGame.owner.equippedTitle} className="mt-1 text-sm font-semibold text-[#503828]" />
                    </div>
                    <div className="paper-wash rounded-xl px-3 py-2">
                      <p className="text-muted text-[0.58rem] font-bold tracking-wider uppercase">
                        Aktualnie u
                      </p>
                      {selectedGame.currentHolder ? <PlayerDisplayName variant="compact" displayName={selectedGame.currentHolder.displayName} title={selectedGame.currentHolder.equippedTitle} className="mt-1 text-sm font-semibold text-[#503828]" /> : <p className="mt-1 text-sm font-semibold text-[#503828]">nieustalone</p>}
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
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

                    <div className="hidden">
                      <p className="text-[0.62rem] font-bold tracking-[0.16em] text-[#e8b870] uppercase">
                        Ocena grupy
                      </p>
                      <p className="mt-3 text-3xl font-bold text-[#f0c47e]">
                        {formatDecimal(
                          selectedGame.ratingSummary.averageOverall,
                        )}
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

                  <div className="sticky bottom-0 -mx-5 mt-5 flex flex-wrap gap-2 border-t border-[#b99d72]/45 bg-[#f8edda]/95 px-5 pt-3 pb-1 backdrop-blur lg:static lg:mx-0 lg:mt-6 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:pb-0">
                    <ActionLink action="shelf" href={`/gry/${selectedGame.id}`}>
                      Otwórz pełną kartę gry
                    </ActionLink>
                    <ActionButton
                      type="button"
                      action="neutral"
                      emphasis="secondary"
                      onClick={() => setSelectedGame(null)}
                    >
                      Wróć do Półki
                    </ActionButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
