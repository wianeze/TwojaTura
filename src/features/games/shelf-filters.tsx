"use client";

import { ActionButton, ActionLink } from "@/components/ui/action-button";
import type { PropsWithChildren } from "react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { countAdvancedShelfFilters } from "./filters";
import type { GameFilterOptions, GameFilters } from "./types";

type ShelfFiltersProps = {
  filters: GameFilters;
  options: GameFilterOptions;
  resultCount: number;
};

const timeOptions = [30, 45, 60, 90, 120, 150, 180, 240];

/*
 * Arkusz filtrów renderujemy przez portal do <body>, bo sekcja filtrów ma
 * klasę wejścia (.anim-rise-in-fast) z animation-fill-mode: both — utrwalony
 * transform tworzy kontekst układania i zamyka w nim pozycjonowanie fixed,
 * przez co nakładka chowała się pod kafelkami Półki.
 *
 * Portal wynosi pola poza <form>, więc każde z nich wiążemy z formularzem
 * atrybutem form="…". Zachowanie wysyłki zostaje bez zmian.
 */
const MOBILE_FORM_ID = "shelf-filters-mobile";

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
  form,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked: boolean;
  form?: string;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        form={form}
        className="peer sr-only"
      />
      <span className="inline-flex rounded-full border border-[#d9c7aa] bg-[#f7ead3] px-3 py-2 text-xs font-semibold text-[#6d5037] shadow-[0_2px_5px_rgba(83,51,35,0.08)] transition-[background-color,border-color,color,box-shadow] peer-checked:border-[#e4b95f] peer-checked:bg-[#56382b] peer-checked:text-[#fff5df] peer-checked:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_4px_10px_rgba(72,39,24,0.28)]">
        {label}
      </span>
    </label>
  );
}

function FilterSelect({
  label,
  name,
  defaultValue,
  form,
  children,
}: PropsWithChildren<{
  label: string;
  name: string;
  defaultValue: string;
  form?: string;
}>) {
  return (
    <label className="block text-xs font-semibold text-[#5b4332]">
      <span className="mb-1 block tracking-[0.14em] text-[#9a7251] uppercase">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        form={form}
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
  form,
}: {
  label: string;
  name: string;
  values: string[];
  selectedValues: string[];
  form?: string;
}) {
  if (values.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.14em] text-[#9a7251] uppercase">
        {label}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {values.map((value) => (
          <FilterChip
            key={value}
            name={name}
            value={value}
            label={value}
            defaultChecked={selectedValues.includes(value)}
            form={form}
          />
        ))}
      </div>
    </div>
  );
}

function AdvancedFilterPanel({
  filters,
  options,
  form,
  compact = false,
}: {
  filters: GameFilters;
  options: GameFilterOptions;
  form?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`paper-wash rounded-[1.4rem] border border-[#9a7657]/18 ${compact ? "p-3" : "p-4"}`}
    >
      <div
        className={`grid md:grid-cols-2 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)_minmax(0,1fr)] ${compact ? "gap-3" : "gap-4"}`}
      >
        <FilterSelect
          label="Typ gry"
          name="type"
          defaultValue={filters.type ?? ""}
          form={form}
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
          form={form}
        />

        <FilterChipsGroup
          label="Kategorie"
          name="category"
          values={options.categories}
          selectedValues={filters.categories}
          form={form}
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
            <ActionButton
              type="button"
              action="neutral"
              size="compact"
              emphasis="secondary"
              pill
              withIcon={false}
              onClick={() => setIsDesktopAdvancedOpen((current) => !current)}
              aria-expanded={isDesktopAdvancedOpen}
            >
              {advancedCount > 0 ? `Filtry · ${advancedCount}` : "Filtry"}
            </ActionButton>

            <ActionButton
              type="submit"
              action="shelf"
              size="compact"
              withIcon={false}
            >
              Zastosuj
            </ActionButton>

            <ActionLink
              action="neutral"
              size="compact"
              emphasis="secondary"
              pill
              withIcon={false}
              href="/gry"
            >
              Wyczyść
            </ActionLink>
          </div>
        </div>

        {isDesktopAdvancedOpen && (
          <AdvancedFilterPanel filters={filters} options={options} />
        )}
      </form>

      <form
        id={MOBILE_FORM_ID}
        method="get"
        className="mt-4 space-y-3 md:hidden"
      >
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
          <ActionButton
            type="button"
            action="neutral"
            size="compact"
            emphasis="secondary"
            pill
            withIcon={false}
            onClick={() => setIsMobileOpen(true)}
            aria-expanded={isMobileOpen}
          >
            {advancedCount > 0 ? `Filtry · ${advancedCount}` : "Filtry"}
          </ActionButton>
          <ActionButton
            type="submit"
            action="shelf"
            size="compact"
            withIcon={false}
          >
            Zastosuj
          </ActionButton>
          <ActionLink
            action="neutral"
            size="compact"
            emphasis="secondary"
            pill
            withIcon={false}
            href="/gry"
          >
            Wyczyść
          </ActionLink>
        </div>
      </form>

      {isMobileOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end bg-[#1c120d]/72 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Filtry Półki"
            onClick={() => setIsMobileOpen(false)}
          >
            {/*
              Arkusz nigdy nie wychodzi poza ekran: ograniczony do 88 % wysokości
              okna, z przewijaniem w środku i akcjami przyklejonymi do dołu.
            */}
            <div
              className="parchment-card premium-edge relative flex max-h-[88dvh] w-full flex-col rounded-t-[1.75rem]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 px-4 pt-4">
                <div>
                  <p className="text-accent text-[0.58rem] font-bold tracking-[0.18em] uppercase">
                    Filtry Półki
                  </p>
                  <h3 className="font-display mt-0.5 text-lg font-semibold text-[#4c3528]">
                    Ustaw kryteria widoku
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  className="wood-grain text-cream grid size-8 shrink-0 place-items-center rounded-full text-base"
                  aria-label="Zamknij filtry"
                >
                  ×
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <FilterSelect
                    label="Właściciel"
                    name="owner"
                    defaultValue={filters.owner ?? ""}
                    form={MOBILE_FORM_ID}
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
                    form={MOBILE_FORM_ID}
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
                    form={MOBILE_FORM_ID}
                  >
                    <option value="">Bez limitu</option>
                    {timeOptions.map((time) => (
                      <option key={time} value={time}>
                        do {time} min
                      </option>
                    ))}
                  </FilterSelect>

                  <label className="block text-xs font-semibold text-[#5b4332]">
                    <span className="mb-1 block tracking-[0.14em] text-[#9a7251] uppercase">
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
                      form={MOBILE_FORM_ID}
                    />
                  </label>
                </div>

                <AdvancedFilterPanel
                  filters={filters}
                  options={options}
                  form={MOBILE_FORM_ID}
                  compact
                />
              </div>

              <div className="flex flex-wrap gap-2 border-t border-[#b99d72]/40 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
                <ActionButton
                  type="submit"
                  action="shelf"
                  size="compact"
                  withIcon={false}
                  form={MOBILE_FORM_ID}
                >
                  Zastosuj filtry
                </ActionButton>
                <ActionLink
                  action="neutral"
                  size="compact"
                  emphasis="secondary"
                  withIcon={false}
                  href="/gry"
                >
                  Wyczyść
                </ActionLink>
                <ActionButton
                  type="button"
                  action="neutral"
                  size="compact"
                  emphasis="secondary"
                  withIcon={false}
                  className="ml-auto"
                  onClick={() => setIsMobileOpen(false)}
                >
                  Zamknij
                </ActionButton>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
