import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { hasActiveFilters, parseGameFilters } from "@/features/games/filters";
import { ShelfFilters } from "@/features/games/shelf-filters";
import { ShelfShowcase } from "@/features/games/shelf-showcase";
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
  const [filterOptions, shelf] = await Promise.all([
    listGameFilterOptions(),
    listShelfGames(filters),
  ]);
  const filtered = hasActiveFilters(filters);

  return (
    <div className="space-y-7">
      <header className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-6">
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
          <Link
            href="/gry/nowa"
            className="inline-flex rounded-full bg-[#7d2f3d] px-4 py-2 text-xs font-bold text-[#fff3ec] shadow-[0_10px_24px_rgba(73,21,31,0.28)] transition-colors hover:bg-[#8d3747]"
          >
            Dodaj egzemplarz
          </Link>
        </div>
      </header>

      <ShelfFilters
        filters={filters}
        options={filterOptions}
        resultCount={shelf.totalCount}
      />

      {shelf.items.length > 0 ? (
        <ShelfShowcase games={shelf.items} />
      ) : filtered ? (
        <Panel className="paper-wash space-y-4 p-6 sm:p-8">
          <p className="text-accent text-[0.65rem] font-bold tracking-[0.18em] uppercase">
            Brak wyników
          </p>
          <h2 className="font-display text-3xl font-semibold text-[#4d3528]">
            Żadna gra nie pasuje do obecnych filtrów
          </h2>
          <p className="text-muted max-w-2xl text-sm leading-6">
            Spróbuj poluzować kryteria albo wróć do pełnej Półki całej grupy.
          </p>
          <Link
            href="/gry"
            className="bg-brand hover:bg-brand-strong inline-flex rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors"
          >
            Wyczyść filtry
          </Link>
        </Panel>
      ) : (
        <div className="space-y-5">
          <EmptyState variant="shelf" />
          <Panel className="paper-wash flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
            <div>
              <p className="text-accent text-[0.65rem] font-bold tracking-[0.18em] uppercase">
                Pierwsza gra w kolekcji
              </p>
              <p className="text-muted mt-2 max-w-2xl text-sm leading-6">
                Dodaj pierwszy fizyczny egzemplarz, a pojawi się na Półce całej
                grupy wraz z właścicielem, statusem i ocenami.
              </p>
            </div>
            <Link
              href="/gry/nowa"
              className="bg-brand hover:bg-brand-strong rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors"
            >
              Dodaj pierwszą grę
            </Link>
          </Panel>
        </div>
      )}
    </div>
  );
}
