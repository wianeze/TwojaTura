import type { Metadata } from "next";
import { ActionLink } from "@/components/ui/action-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import {
  hasActiveFilters,
  parseGameFilters,
  parseShelfOwnerVisibility,
} from "@/features/games/filters";
import { ShelfFilters } from "@/features/games/shelf-filters";
import { ShelfShowcase } from "@/features/games/shelf-showcase";
import { profileServerOperation } from "@/lib/server-performance";
import {
  listGameFilterOptions,
  listShelfGames,
} from "@/features/games/queries";

export const metadata: Metadata = { title: "Półka" };

function pluralizeGames(count: number) {
  if (count === 1) return "1 gra";
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return `${count} gry`;
  }

  return `${count} gier`;
}

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseGameFilters(params);
  const showOwners = parseShelfOwnerVisibility(params);
  const [filterOptions, shelf] = await profileServerOperation("/gry", () =>
    Promise.all([listGameFilterOptions(), listShelfGames(filters)]),
  );
  const filtered = hasActiveFilters(filters);

  return (
    <div className="space-y-7">
      <header
        style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
        className="anim-rise-in-fast grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-6"
      >
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.2em] text-[#e3ae67] uppercase">
            Wspólna kolekcja
          </p>
          <h1 className="font-display text-cream mt-1.5 text-4xl font-semibold tracking-tight drop-shadow-[0_2px_12px_rgba(20,10,7,0.32)] sm:text-[2.8rem]">
            Półka
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:justify-end md:justify-self-end">
          <span className="bg-moss-soft text-moss w-fit rounded-full px-4 py-2 text-xs font-bold">
            {pluralizeGames(shelf.totalCount)} na półce
          </span>
          {/*
            Na smartfonie rząd jest wyrównany do lewej — ml-auto dosuwa
            akcję do prawej krawędzi, także gdy zawinie się pod licznik.
            Od md: układ przejmuje justify-end i margines znika.
          */}
          <ActionLink
            action="shelf"
            size="compact"
            href="/gry/nowa"
            className="ml-auto md:ml-0"
          >
            Dodaj egzemplarz
          </ActionLink>
        </div>
      </header>

      <ShelfFilters
        filters={filters}
        options={filterOptions}
        resultCount={shelf.totalCount}
        showOwners={showOwners}
      />

      {shelf.items.length > 0 ? (
        <ShelfShowcase games={shelf.items} showOwners={showOwners} />
      ) : filtered ? (
        <Panel className="anim-rise-in-fast paper-wash space-y-4 p-6 sm:p-8">
          <p className="text-accent text-[0.65rem] font-bold tracking-[0.18em] uppercase">
            Brak wyników
          </p>
          <h2 className="font-display text-3xl font-semibold text-[#4d3528]">
            Żadna gra nie pasuje do obecnych filtrów
          </h2>
          <p className="text-muted max-w-2xl text-sm leading-6">
            Spróbuj poluzować kryteria albo wróć do pełnej Półki całej grupy.
          </p>
          <ActionLink action="neutral" href="/gry">
            Wyczyść filtry
          </ActionLink>
        </Panel>
      ) : (
        <div className="space-y-5">
          <EmptyState variant="shelf" />
          <Panel
            style={{ animationDelay: `${getEntranceStaggerDelayMs(1)}ms` }}
            className="anim-rise-in-fast paper-wash flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6"
          >
            <div>
              <p className="text-accent text-[0.65rem] font-bold tracking-[0.18em] uppercase">
                Pierwsza gra w kolekcji
              </p>
              <p className="text-muted mt-2 max-w-2xl text-sm leading-6">
                Dodaj pierwszy fizyczny egzemplarz, a pojawi się na Półce całej
                grupy wraz z właścicielem, statusem i ocenami. Pierwsza gra to
                także 10 Renomy.
              </p>
            </div>
            <ActionLink action="shelf" size="large" href="/gry/nowa">
              Dodaj pierwszą grę
            </ActionLink>
          </Panel>
        </div>
      )}
    </div>
  );
}
