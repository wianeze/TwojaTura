"use client";

import Link from "next/link";
import type { PropsWithChildren } from "react";
import { useMemo, useState } from "react";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { countAdvancedShelfFilters } from "./filters";
import type { GameFilterOptions, GameFilters } from "./types";

type ShelfFiltersProps = {
  filters: GameFilters;
  options: GameFilterOptions;
  resultCount: number;
};

const timeOptions = [30, 45, 60, 90, 120, 150, 180, 240];

function pluralizeGames(count: number) {
  if (count === 1) return "gra";

  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return "gry";
  }

  return "gier";
}

function FilterChip({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="paper-wash peer-checked:bg-brand peer-checked:text-cream inline-flex rounded-full px-3 py-2 text-xs font-semibold text-[#6d5037] transition-colors">
        {label}
      </span>
    </label>
  );
}

function FilterSelect({
  label,
  name,
  defaultValue,
  children,
}: PropsWithChildren<{
  label: string;
  name: string;
  defaultValue: string;
}>) {
  return (
    <label className="block text-xs font-semibold text-[#5b4332]">
      <span className="mb-1.5 block tracking-[0.14em] text-[#9a7251] uppercase">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="paper-wash focus:border-gold focus:ring-gold/20 h-10 w-full rounded-xl border border-[#9a7657]/28 px-3 text-sm text-[#503828] transition outline-none focus:ring-4"
      >
        {children}
      </select>
    </label>
  );
}

function FilterChipsGroup({
  label,
  name,
  values,
  selectedValues,
}: {
  label: string;
  name: string;
  values: string[];
  selectedValues: string[];
}) {
  if (values.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.14em] text-[#9a7251] uppercase">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <FilterChip
            key={value}
            name={name}
            value={value}
            label={value}
            defaultChecked={selectedValues.includes(value)}
          />
        ))}
      </div>
    </div>
  );
}

function AdvancedFilterPanel({
  filters,
  options,
}: {
  filters: GameFilters;
  options: GameFilterOptions;
}) {
  return (
    <div className="paper-wash rounded-[1.4rem] border border-[#9a7657]/18 p-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <FilterSelect
          label="Typ gry"
          name="type"
          defaultValue={filters.type ?? ""}
        >
          <option value="">Każdy typ</option>
          {options.types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </FilterSelect>

        <FilterChipsGroup
          label="Mechaniki"
          name="mechanic"
          values={options.mechanics}
          selectedValues={filters.mechanics}
        />

        <FilterChipsGroup
          label="Kategorie"
          name="category"
          values={options.categories}
          selectedValues={filters.categories}
        />
      </div>
    </div>
  );
}

function PersistAdvancedFiltersHidden({
  filters,
  enabled,
}: {
  filters: GameFilters;
  enabled: boolean;
}) {
  if (!enabled) return null;

  return (
    <>
      {filters.type && <input type="hidden" name="type" value={filters.type} />}
      {filters.mechanics.map((mechanic) => (
        <input
          key={`mechanic-${mechanic}`}
          type="hidden"
          name="mechanic"
          value={mechanic}
        />
      ))}
      {filters.categories.map((category) => (
        <input
          key={`category-${category}`}
          type="hidden"
          name="category"
          value={category}
        />
      ))}
    </>
  );
}

export function ShelfFilters({
  filters,
  options,
  resultCount,
}: ShelfFiltersProps) {
  const [isDesktopAdvancedOpen, setIsDesktopAdvancedOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const advancedCount = useMemo(
    () => countAdvancedShelfFilters(filters),
    [filters],
  );

  const searchInputClass =
    "paper-wash focus:border-gold focus:ring-gold/20 h-10 w-full rounded-xl border border-[#9a7657]/28 px-3.5 text-sm text-[#503828] outline-none transition focus:ring-4";

  return (
    <section
      style={{ animationDelay: `${getEntranceStaggerDelayMs(1)}ms` }}
      className="anim-rise-in-fast premium-edge material-panel rounded-[1.7rem] px-3 py-3 sm:px-4 sm:py-3.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div>
          <p className="text-accent text-[0.62rem] font-bold tracking-[0.18em] uppercase">
            Szukaj na Półce
          </p>
        </div>

        <div className="flex min-w-0 flex-col items-start gap-2 text-left sm:items-end sm:text-right">
          <p className="text-muted text-sm">
            {resultCount} {pluralizeGames(resultCount)} pasuje do obecnego
            widoku.
          </p>

          {advancedCount > 0 && (
            <span className="paper-wash rounded-full px-3 py-1.5 text-[0.68rem] font-bold text-[#6d5037]">
              Filtry dodatkowe: {advancedCount}
            </span>
          )}
        </div>
      </div>

      <form method="get" className="mt-4 hidden space-y-3 md:block">
        <PersistAdvancedFiltersHidden
          filters={filters}
          enabled={!isDesktopAdvancedOpen}
        />
        <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(0,0.8fr))_auto]">
          <label className="block text-xs font-semibold text-[#5b4332] md:col-span-2 xl:col-span-1">
            <span className="mb-1.5 block tracking-[0.14em] text-[#9a7251] uppercase">
              Wyszukaj grę
            </span>
            <input
              className={searchInputClass}
              type="search"
              name="q"
              placeholder="Szukaj po nazwie…"
              defaultValue={filters.q}
            />
          </label>

          <FilterSelect
            label="Właściciel"
            name="owner"
            defaultValue={filters.owner ?? ""}
          >
            <option value="">Wszyscy</option>
            {options.owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.displayName}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Status"
            name="status"
            defaultValue={filters.status ?? ""}
          >
            <option value="">Każdy</option>
            <option value="available">Dostępna</option>
            <option value="unavailable">Niedostępna</option>
            <option value="loaned">Pożyczona</option>
          </FilterSelect>

          <label className="block text-xs font-semibold text-[#5b4332]">
            <span className="mb-1.5 block tracking-[0.14em] text-[#9a7251] uppercase">
              Gracze
            </span>
            <input
              className={searchInputClass}
              type="number"
              min={1}
              step={1}
              name="players"
              defaultValue={filters.players ?? ""}
              placeholder="np. 4"
            />
          </label>

          <FilterSelect
            label="Maks. czas"
            name="maxTime"
            defaultValue={filters.maxTime?.toString() ?? ""}
          >
            <option value="">Bez limitu</option>
            {timeOptions.map((time) => (
              <option key={time} value={time}>
                do {time} min
              </option>
            ))}
          </FilterSelect>

          <div className="mt-[1.55rem] flex flex-wrap items-center justify-end gap-2 md:col-span-2 xl:col-span-1 xl:justify-start">
            <button
              type="button"
              onClick={() => setIsDesktopAdvancedOpen((current) => !current)}
              className="paper-wash h-10 rounded-xl px-3 text-sm font-semibold text-[#6d5037]"
              aria-expanded={isDesktopAdvancedOpen}
            >
              {advancedCount > 0 ? `Filtry · ${advancedCount}` : "Filtry"}
            </button>

            <button
              type="submit"
              className="cta-glow bg-brand hover:bg-brand-strong h-10 rounded-xl px-4 text-sm font-semibold text-white transition-colors"
            >
              Zastosuj
            </button>

            <Link
              href="/gry"
              className="paper-wash inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-[#6d5037]"
            >
              Wyczyść
            </Link>
          </div>
        </div>

        {isDesktopAdvancedOpen && (
          <AdvancedFilterPanel filters={filters} options={options} />
        )}
      </form>

      <form method="get" className="mt-4 space-y-3 md:hidden">
        <PersistAdvancedFiltersHidden
          filters={filters}
          enabled={!isMobileOpen}
        />
        <label className="block text-xs font-semibold text-[#5b4332]">
          <span className="mb-1.5 block tracking-[0.14em] text-[#9a7251] uppercase">
            Wyszukaj grę
          </span>
          <input
            className={searchInputClass}
            type="search"
            name="q"
            placeholder="Szukaj po nazwie…"
            defaultValue={filters.q}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="wood-grain text-cream rounded-xl px-4 py-2.5 text-sm font-semibold"
            aria-expanded={isMobileOpen}
          >
            {advancedCount > 0 ? `Filtry · ${advancedCount}` : "Filtry"}
          </button>
          <button
            type="submit"
            className="cta-glow bg-brand hover:bg-brand-strong rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            Zastosuj
          </button>
          <Link
            href="/gry"
            className="paper-wash rounded-xl px-4 py-2.5 text-sm font-semibold text-[#6d5037]"
          >
            Wyczyść
          </Link>
        </div>

        {isMobileOpen && (
          <div
            className="fixed inset-0 z-[70] bg-[#1c120d]/72 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Filtry Półki"
            onClick={() => setIsMobileOpen(false)}
          >
            <div className="flex min-h-full items-end">
              <div
                className="parchment-card premium-edge relative w-full rounded-t-[2rem] p-5"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-accent text-[0.62rem] font-bold tracking-[0.18em] uppercase">
                      Filtry Półki
                    </p>
                    <h3 className="font-display mt-2 text-2xl font-semibold text-[#4c3528]">
                      Ustaw kryteria widoku
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileOpen(false)}
                    className="wood-grain text-cream grid size-9 place-items-center rounded-full text-lg"
                    aria-label="Zamknij filtry"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  <FilterSelect
                    label="Właściciel"
                    name="owner"
                    defaultValue={filters.owner ?? ""}
                  >
                    <option value="">Wszyscy</option>
                    {options.owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.displayName}
                      </option>
                    ))}
                  </FilterSelect>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FilterSelect
                      label="Status"
                      name="status"
                      defaultValue={filters.status ?? ""}
                    >
                      <option value="">Każdy</option>
                      <option value="available">Dostępna</option>
                      <option value="unavailable">Niedostępna</option>
                      <option value="loaned">Pożyczona</option>
                    </FilterSelect>

                    <FilterSelect
                      label="Maks. czas"
                      name="maxTime"
                      defaultValue={filters.maxTime?.toString() ?? ""}
                    >
                      <option value="">Bez limitu</option>
                      {timeOptions.map((time) => (
                        <option key={time} value={time}>
                          do {time} min
                        </option>
                      ))}
                    </FilterSelect>
                  </div>

                  <label className="block text-xs font-semibold text-[#5b4332]">
                    <span className="mb-1.5 block tracking-[0.14em] text-[#9a7251] uppercase">
                      Gracze
                    </span>
                    <input
                      className={searchInputClass}
                      type="number"
                      min={1}
                      step={1}
                      name="players"
                      defaultValue={filters.players ?? ""}
                      placeholder="np. 4"
                    />
                  </label>

                  <AdvancedFilterPanel filters={filters} options={options} />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="cta-glow bg-brand hover:bg-brand-strong rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors"
                  >
                    Zastosuj filtry
                  </button>
                  <Link
                    href="/gry"
                    className="paper-wash rounded-xl px-4 py-3 text-sm font-semibold text-[#6d5037]"
                  >
                    Wyczyść
                  </Link>
                  <button
                    type="button"
                    onClick={() => setIsMobileOpen(false)}
                    className="paper-wash rounded-xl px-4 py-3 text-sm font-semibold text-[#6d5037]"
                  >
                    Zamknij
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}
