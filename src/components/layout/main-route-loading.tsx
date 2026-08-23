import type { ReactNode } from "react";
import { Panel } from "@/components/ui/panel";

function LoadingLine({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block rounded-full bg-current opacity-12 ${className}`}
    />
  );
}

function LoadingTile({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-[1rem] border border-current/10 bg-current/7 ${className}`}
    />
  );
}

function LoadingRegion({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={className}
    >
      {children}
    </div>
  );
}

function ChronicleLoadingEntry({
  className = "h-44 sm:h-[16.875rem]",
}: {
  className?: string;
}) {
  return (
    <div className={`chronicle-page-shell block rounded-[1.75rem] ${className}`}>
      <article className="chronicle-page h-full overflow-hidden text-[#5f4738]">
        <header className="chronicle-head flex items-center gap-[0.5em]">
          <div className="min-w-0 flex-1 space-y-[0.3em]">
            <LoadingLine className="h-[0.74em] w-3/5" />
            <LoadingLine className="h-[0.72em] w-4/5" />
            <div className="flex gap-[0.25em]">
              <LoadingLine className="h-[1.05em] w-[4em]" />
              <LoadingLine className="h-[1.05em] w-[5em]" />
            </div>
          </div>
          <span className="w-px self-stretch bg-current/20" />
          <div className="flex w-[34%] max-w-[12em] min-w-[4.6em] shrink-0 flex-col items-center gap-[0.4em]">
            <LoadingLine className="h-[0.82em] w-4/5" />
            <LoadingTile className="h-[4em] w-[4em] rounded-[0.3em]" />
          </div>
        </header>
        <LoadingLine className="mt-[0.5em] h-[0.55em] w-[4em]" />
        <div className="chronicle-players mt-[0.25em]">
          <LoadingTile className="h-[2.15em] rounded-full" />
        </div>
      </article>
    </div>
  );
}

export function DashboardRouteLoading() {
  return (
    <LoadingRegion label="Ładowanie Stołu" className="space-y-2 sm:space-y-3">
      <div className="space-y-2 sm:hidden">
        <div className="table-sheet-shell min-h-[13.375rem]">
          <Panel className="table-sheet h-[13.375rem] px-0 py-1.5 text-[#fff1dc]">
            <div className="relative space-y-2">
              <div className="text-center">
                <LoadingLine className="mx-auto h-[1.22rem] w-3/5" />
                <LoadingLine className="mx-auto mt-0.5 h-[0.86rem] w-4/5" />
              </div>
              <div className="grid grid-cols-3 gap-[5px]">
                <LoadingTile className="h-14" />
                <LoadingTile className="h-14" />
                <LoadingTile className="h-14" />
              </div>
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <div className="meeting-board-shell min-h-[17.875rem] min-w-0">
            <Panel className="meeting-board flex h-full flex-col px-0 py-1 text-[#5f4738]">
              <div className="flex flex-1 flex-col">
                <LoadingLine className="mx-auto h-3 w-4/5" />
                <LoadingLine className="mx-auto mt-0.5 h-4 w-3/5" />
                <div className="mt-1.5 space-y-1">
                  <LoadingTile className="h-8 rounded-[0.55rem]" />
                  <LoadingTile className="h-8 rounded-[0.55rem]" />
                </div>
                <div className="mt-1.5 flex items-stretch gap-1.5">
                  <LoadingTile className="h-[5.1rem] min-w-0 flex-1 rounded-[0.55rem]" />
                  <LoadingTile className="size-[5.1rem] shrink-0 rounded-[0.7rem]" />
                </div>
                <LoadingLine className="mx-auto mt-[20px] h-4 w-20" />
              </div>
            </Panel>
          </div>
          <div className="legend-board-shell min-h-[17.875rem] min-w-0">
            <Panel className="legend-board flex h-full flex-col px-0 py-1 text-[#fff6ea]">
              <LoadingLine className="mx-auto h-3 w-4/5" />
              <div className="mt-2 flex-1">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="flex items-center gap-2.5 py-2">
                    <LoadingTile className="size-7 shrink-0 rounded-full" />
                    <LoadingLine className="h-4 flex-1" />
                    <LoadingLine className="h-4 w-10" />
                  </div>
                ))}
              </div>
              <LoadingLine className="mx-auto mt-[20px] h-4 w-16" />
            </Panel>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:items-start sm:gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(17.5rem,0.9fr)] xl:gap-5">
        <div className="flex flex-col gap-[18px]">
          <div className="hidden sm:block">
            <div className="table-sheet-shell h-[24.3125rem]">
              <Panel className="table-sheet h-[24.3125rem] p-3.5 text-[#fff1dc] sm:p-4">
                <div className="relative flex flex-col gap-2.5 lg:flex-row lg:items-stretch lg:gap-5">
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="space-y-1">
                      <LoadingLine className="h-3 w-20" />
                      <LoadingLine className="h-10 w-3/5" />
                      <LoadingLine className="h-5 w-4/5" />
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                      <LoadingTile className="h-14" />
                      <LoadingTile className="h-14" />
                      <LoadingTile className="h-14" />
                    </div>
                  </div>
                  <LoadingTile className="hidden w-32 shrink-0 self-stretch lg:block" />
                </div>
              </Panel>
            </div>
          </div>

          <section className="space-y-2.5">
            <LoadingLine className="mx-auto h-[1.32rem] w-36 text-[#fff1dc] sm:mx-0 sm:h-[2.05rem]" />
            <div className="grid auto-rows-fr gap-x-2 gap-y-2 md:grid-cols-2">
              {Array.from({ length: 2 }, (_, index) => (
                <Panel key={index} className="paper-wash h-[9.0625rem] p-4 sm:h-[10.125rem]">
                  <LoadingLine className="h-4 w-2/5 text-[#5f4738]" />
                  <LoadingLine className="mt-3 h-5 w-4/5 text-[#5f4738]" />
                  <LoadingLine className="mt-2 h-3 w-full text-[#5f4738]" />
                </Panel>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <div className="hidden sm:block">
            <div className="legend-board-shell h-[23.75rem]">
            <Panel className="legend-board h-[23.75rem] p-3.5 text-[#fff6ea]">
              <LoadingLine className="h-3 w-32" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 5 }, (_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <LoadingTile className="size-8 shrink-0 rounded-full" />
                    <LoadingLine className="h-4 flex-1" />
                    <LoadingLine className="h-4 w-14" />
                  </div>
                ))}
              </div>
            </Panel>
            </div>
          </div>
          <Panel className="paper-wash hidden h-40 overflow-hidden p-4 text-[#5f4738] sm:block">
            <LoadingLine className="h-3 w-36" />
            <LoadingLine className="mt-3 h-7 w-4/5" />
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_5.7rem] gap-3">
              <div className="space-y-2">
                <LoadingTile className="h-10" />
                <LoadingTile className="h-10" />
                <LoadingTile className="h-10" />
              </div>
              <LoadingTile className="h-28" />
            </div>
          </Panel>
          <div className="chronicle-feed">
            <section className="chronicle-page min-h-[23.5625rem] text-[#5f4738]">
              <div className="flex items-baseline justify-between gap-2">
                <LoadingLine className="h-3 w-28" />
                <LoadingLine className="h-3 w-24" />
              </div>
              <LoadingLine className="mt-1 h-4 w-4/5" />
              <div className="mt-2.5 space-y-1.5">
                {Array.from({ length: 5 }, (_, index) => (
                  <LoadingTile key={index} className="h-12 rounded-[0.95rem]" />
                ))}
              </div>
            </section>
          </div>
          <Panel className="paper-wash flex h-[3.75rem] items-center justify-between gap-4 p-3.5 text-[#5f4738] sm:h-16">
            <LoadingLine className="h-4 w-24" />
            <LoadingLine className="h-4 w-28" />
          </Panel>
        </div>
      </div>
    </LoadingRegion>
  );
}

export function ShelfRouteLoading() {
  return (
    <LoadingRegion label="Ładowanie Półki" className="space-y-7">
      <header className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-6">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-[#e3ae67] uppercase">
            Wspólna kolekcja
          </p>
          <h1 className="font-display text-cream mt-1.5 text-4xl font-extrabold sm:text-[2.8rem]">
            Półka
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:justify-end md:justify-self-end">
          <LoadingLine className="h-8 w-28 rounded-full text-[#f4ead3]" />
          <LoadingTile className="ml-auto h-10 w-36 text-[#e3ae67] md:ml-0" />
        </div>
      </header>

      <section className="premium-edge material-panel rounded-[1.7rem] px-3 py-3 text-[#5f4738] sm:px-4 sm:py-3.5 md:min-h-[8.75rem]">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <LoadingLine className="h-3 w-28" />
          <LoadingLine className="h-4 w-52" />
        </div>
        <div className="mt-4 hidden md:grid md:grid-cols-4 md:gap-2 xl:grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(0,0.8fr))_auto]">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className={index === 0 ? "md:col-span-2 xl:col-span-1" : ""}>
              <LoadingLine className="mb-1.5 h-3 w-20" />
              <LoadingTile className="h-10 w-full" />
            </div>
          ))}
          <div className="mt-[1.55rem] flex flex-wrap items-center justify-end gap-2 md:col-span-2 xl:col-span-1 xl:justify-start">
            <LoadingTile className="h-10 w-20" />
            <LoadingTile className="h-10 w-24" />
            <LoadingTile className="h-10 w-20" />
          </div>
        </div>
        <div className="mt-4 space-y-3 md:hidden">
          <div>
            <LoadingLine className="mb-1.5 h-3 w-24" />
            <LoadingTile className="h-10 w-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <LoadingTile className="h-10 w-[5.2rem]" />
            <LoadingTile className="h-10 w-24" />
            <LoadingTile className="h-10 w-[4.8rem]" />
            <LoadingTile className="h-10 w-[5.2rem]" />
            <LoadingTile className="h-10 w-[5.4rem]" />
          </div>
        </div>
      </section>

      <section className="wood-grain fire-glow premium-edge text-cream relative isolate overflow-visible rounded-[2rem] p-4 sm:p-5 lg:p-6">
        <div className="space-y-4 sm:space-y-5 md:hidden">
          {Array.from({ length: 2 }, (_, rowIndex) => (
            <div key={rowIndex} className="shelf-row-bg premium-edge relative overflow-visible rounded-[1.5rem] px-3 pt-6 pb-6 shadow-[inset_0_16px_34px_rgba(8,4,3,0.42)] sm:px-5 sm:pt-7 sm:pb-7 xl:pt-8 xl:pb-8">
              <div className="absolute inset-0 rounded-[inherit] bg-[linear-gradient(180deg,rgba(12,6,4,0.08),rgba(12,6,4,0.12)_45%,rgba(12,6,4,0.58))]" />
              <div className="shelf-segment-grid relative h-[5.8125rem] items-end">
                {Array.from({ length: 2 }, (_, index) => (
                  <div key={index} className="relative flex min-w-0 items-end justify-center">
                    <LoadingTile className="mx-auto h-full aspect-[2/3] w-auto text-[#f3e6d0]" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="hidden md:block">
          <div className="shelf-row-bg premium-edge relative h-[11.5rem] overflow-visible rounded-[1.5rem] px-3 pt-6 pb-6 shadow-[inset_0_16px_34px_rgba(8,4,3,0.42)] sm:px-5 sm:pt-7 sm:pb-7 xl:pt-8 xl:pb-8">
            <div className="absolute inset-0 rounded-[inherit] bg-[linear-gradient(180deg,rgba(12,6,4,0.08),rgba(12,6,4,0.12)_45%,rgba(12,6,4,0.58))]" />
            <div className="shelf-segment-grid relative h-[7.5rem] items-end">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="relative flex min-w-0 items-end justify-center">
                  <LoadingTile className="mx-auto h-full aspect-[2/3] w-auto text-[#f3e6d0]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </LoadingRegion>
  );
}

export function LegendariumRouteLoading({
  includeHeader = true,
}: {
  includeHeader?: boolean;
}) {
  return (
    <LoadingRegion
      label="Ładowanie Legendarium"
      className="space-y-5 sm:space-y-6"
    >
      {includeHeader ? (
        <header className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-[#e3ae67] uppercase">
              Legendy przy ognisku
            </p>
            <h1 className="font-display text-cream mt-2 text-4xl font-extrabold sm:text-5xl">
              Legendarium
            </h1>
          </div>
          <LoadingTile className="size-16 shrink-0 rounded-full border-[#d8bd90]/60 bg-black/20 md:hidden" />
        </header>
      ) : null}
      <section className="cork-board-bg premium-edge relative isolate overflow-hidden rounded-[2rem] p-2 sm:p-4 lg:p-5">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_0%,rgba(255,232,185,0.14),transparent_35%),linear-gradient(180deg,rgba(32,16,9,0.08),rgba(22,10,7,0.34))]" />
        <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(25rem,0.95fr)] 2xl:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)]">
          <section className="leaderboard-rug-panel premium-edge min-h-[31.25rem] min-w-0 rounded-[1.55rem] p-1 text-[#fff6ea] sm:min-h-0 sm:p-3 xl:h-full">
            <div className="rounded-[1.25rem] p-2 sm:p-5">
              <LoadingLine className="h-7 w-44" />
              <ol className="mt-4 ml-10 translate-x-[-19px] space-y-2.5 sm:ml-12 sm:translate-x-0">
                {Array.from({ length: 4 }, (_, index) => (
                  <li
                    key={index}
                    className={`relative mr-[-23px] flex min-w-0 items-center gap-2.5 overflow-visible rounded-[1.25rem] border border-[#d8bd90]/55 bg-black/20 px-3 pl-14 pr-[17px] shadow-[0_9px_18px_rgba(76,44,23,0.14)] sm:mr-0 sm:gap-3.5 sm:px-4 sm:pl-18 sm:pr-4 ${index < 3 ? "min-h-25 py-3 sm:min-h-28 sm:py-3.5" : "min-h-24 py-2.5 sm:min-h-21 sm:py-3"}`}
                  >
                    <LoadingTile className={`absolute top-1/2 -translate-y-1/2 rounded-full ${index === 0 ? "left-[-3.6rem] size-[7.2rem] sm:left-[-4.2rem] sm:size-[8.4rem]" : index < 3 ? "-left-12 size-24 sm:left-[-3.3rem] sm:size-[6.6rem]" : "left-[-2.1rem] size-[4.2rem] sm:left-[-2.4rem] sm:size-[4.8rem]"}`} />
                    <LoadingTile className="relative z-10 size-9 shrink-0 translate-x-[-20px] rounded-full sm:size-10 sm:translate-x-0" />
                    <span className="relative z-10 min-w-0 flex-1 translate-x-[-20px] space-y-1.5 sm:translate-x-0">
                      <LoadingLine className="h-3 w-2/5" />
                      <LoadingLine className="h-4 w-4/5" />
                      <LoadingLine className="h-3 w-1/2" />
                    </span>
                    <span className="relative z-10 flex shrink-0 -space-x-2">
                      {Array.from({ length: 3 }, (_, badgeIndex) => (
                        <LoadingTile key={badgeIndex} className={`${index === 0 ? "size-10 sm:size-12" : index < 3 ? "size-9 sm:size-11" : "size-8 sm:size-10"} rounded-full`} />
                      ))}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
          <div className="flex min-w-0 flex-col gap-4 xl:h-full">
            <section className="parchment-card premium-edge hidden rounded-[1.55rem] p-4 text-[#5f4738] md:block md:min-h-[25.125rem] md:p-5">
              <LoadingLine className="h-7 w-48" />
              <LoadingLine className="mt-2 h-4 w-4/5" />
              <LoadingLine className="mt-3 h-3 w-28" />
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                {Array.from({ length: 8 }, (_, index) => (
                  <LoadingTile key={index} className="min-h-16" />
                ))}
              </div>
              <LoadingLine className="mt-4 h-5 w-full border-t border-[#c89d73]/45 pt-3" />
            </section>
            <section className="loot-texture premium-edge text-cream flex min-h-[30rem] min-w-0 flex-col rounded-[1.55rem] p-4 sm:p-5 md:min-h-[29.75rem] xl:flex-1">
              <LoadingLine className="h-7 w-40" />
              <div className="mt-3 space-y-2">
                {Array.from({ length: 5 }, (_, index) => (
                  <LoadingTile key={index} className="h-16" />
                ))}
              </div>
              <LoadingLine className="mx-auto mt-3 h-10 w-24 rounded-full" />
            </section>
          </div>
        </div>
        <section className="parchment-card premium-edge mt-4 min-h-[435.1875rem] rounded-[1.55rem] p-4 text-[#5f4738] sm:min-h-0 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-2">
              <LoadingLine className="h-3 w-32" />
              <LoadingLine className="h-7 w-28" />
            </div>
            <LoadingLine className="h-7 w-28 rounded-full" />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Array.from({ length: 6 }, (_, index) => <LoadingLine key={index} className="h-7 w-16" />)}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {Array.from({ length: 4 }, (_, index) => <LoadingLine key={index} className="h-7 w-20" />)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 51 }, (_, index) => (
              <LoadingTile key={index} className="h-[15.625rem] rounded-[1.15rem] xl:h-[14.0625rem]" />
            ))}
          </div>
        </section>
        <section className="wood-grain premium-edge text-cream mt-4 rounded-[1.55rem] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="space-y-2">
              <LoadingLine className="h-3 w-36" />
              <LoadingLine className="h-7 w-36" />
            </div>
            <LoadingLine className="h-8 w-64" />
          </div>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 14 }, (_, index) => (
              <LoadingTile key={index} className="h-[13.5rem]" />
            ))}
          </div>
        </section>
      </section>
    </LoadingRegion>
  );
}

export function CalendarRouteLoading({
  includeHeader = true,
}: {
  includeHeader?: boolean;
}) {
  return (
    <LoadingRegion
      label="Ładowanie Kalendarium"
      className="space-y-3.5 lg:space-y-4"
    >
      {includeHeader ? (
        <header className="space-y-1 px-1 py-0.5 sm:py-1">
          <p className="text-xs font-bold tracking-[0.22em] text-[#e3ae67] uppercase">
            Planowanie wieczorów
          </p>
          <h1 className="font-display text-cream text-[2.1rem] font-extrabold sm:text-[2.65rem]">
            Kalendarium
          </h1>
        </header>
      ) : null}
      <Panel className="premium-edge paper-wash translate-y-1.5 overflow-hidden px-2.5 py-2 text-[#5f4738] sm:translate-y-0 sm:px-3 sm:py-2.5">
        <LoadingTile className="min-h-[15.0625rem] w-full rounded-[2rem] sm:min-h-[12.5625rem]" />
      </Panel>
      <Panel className="calendar-wood-panel premium-edge min-h-[68.0625rem] translate-y-1.5 overflow-hidden p-2 text-[#fff6ea] sm:min-h-0 sm:translate-y-0 sm:p-2.5 lg:min-h-[73.8125rem] lg:p-3">
        <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <LoadingTile className="h-9 w-24 rounded-full" />
            <LoadingTile className="h-9 w-24 rounded-full" />
            <LoadingTile className="ml-auto h-9 w-32 sm:ml-0" />
          </div>
        </div>
        <div className="space-y-2.5">
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <LoadingLine className="h-6 w-32" />
            </div>
            <div className="grid grid-cols-7 gap-0.75 sm:gap-1">
              {Array.from({ length: 7 }, (_, index) => (
                <LoadingLine key={`weekday-${index}`} className="mx-auto h-3 w-5" />
              ))}
              {Array.from({ length: 42 }, (_, index) => (
                <LoadingTile key={index} className="min-h-[4.65rem] rounded-[0.8rem] sm:min-h-[5.3rem]" />
              ))}
            </div>
          </section>
          <section className="opacity-82">
            <div className="mb-2 flex items-center justify-between gap-2">
              <LoadingLine className="h-6 w-32" />
            </div>
            <div className="grid grid-cols-7 gap-0.75 sm:gap-1">
              {Array.from({ length: 7 }, (_, index) => (
                <LoadingLine key={`next-weekday-${index}`} className="mx-auto h-3 w-5" />
              ))}
              {Array.from({ length: 35 }, (_, index) => (
                <LoadingTile key={index} className="min-h-[4.65rem] rounded-[0.8rem] sm:min-h-[5.3rem]" />
              ))}
            </div>
          </section>
        </div>
      </Panel>
    </LoadingRegion>
  );
}

export function ChronicleRouteLoading({
  includeHeader = true,
}: {
  includeHeader?: boolean;
}) {
  return (
    <LoadingRegion label="Ładowanie Kroniki" className="space-y-4">
      {includeHeader ? (
        <header className="-mb-0.5 flex flex-col gap-3 pt-1.5 sm:mb-0 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-[#e3ae67] uppercase">
              Historia stołu
            </p>
            <h1 className="font-display text-cream mt-2 text-[1.85rem] font-extrabold sm:text-[2.2rem]">
              Kronika
            </h1>
          </div>
          <LoadingTile className="h-11 w-36 self-end text-[#7d5a89]" />
        </header>
      ) : null}
      <div className="chronicle-feed relative space-y-4 sm:top-2.5">
        <section className="chronicle-column space-y-2.5">
          <div className="flex items-center gap-3">
            <LoadingLine className="h-3 w-28 text-[#e3ae67]" />
            <span className="h-px flex-1 bg-white/25" />
          </div>
          <div className="space-y-2.5">
            {Array.from({ length: 5 }, (_, index) => (
              <ChronicleLoadingEntry
                key={index}
                className={index === 4 ? "h-[12.1875rem] sm:h-[18.5625rem]" : undefined}
              />
            ))}
          </div>
        </section>
        <section className="chronicle-column space-y-2.5">
          <div className="flex items-center gap-3">
            <LoadingLine className="h-3 w-24 text-[#e3ae67]" />
            <span className="h-px flex-1 bg-white/25" />
          </div>
          <ChronicleLoadingEntry className="h-[14.75rem] sm:h-[19.375rem]" />
        </section>
        <section className="chronicle-column space-y-2.5">
          <div className="flex items-center gap-3">
            <LoadingLine className="h-3 w-24 text-[#e3ae67]" />
            <span className="h-px flex-1 bg-white/25" />
          </div>
          <ChronicleLoadingEntry className="h-[12.9375rem] sm:h-[19.375rem]" />
        </section>
      </div>
    </LoadingRegion>
  );
}

export function ProfileRouteLoading() {
  return (
    <LoadingRegion
      label="Ładowanie Profilu"
      className="mx-auto max-w-[96rem] space-y-4 lg:pt-1"
    >
      <div className="space-y-4">
        <Panel className="wood-grain relative h-[18.4375rem] isolate overflow-hidden border-[#d3a45c]/60 p-4 text-[#fff0dc] sm:h-auto sm:p-5 lg:p-6">
          <div className="grid grid-cols-[35%_minmax(0,1fr)] gap-3 sm:gap-5 lg:grid-cols-[minmax(13.75rem,17.5rem)_minmax(0,1fr)] lg:items-stretch">
            <div className="flex justify-center lg:justify-start">
              <LoadingTile className="aspect-[17/29] w-full max-w-[9rem] sm:max-w-[11rem] lg:w-[clamp(13.75rem,16vw,16.5rem)] lg:max-w-[16.5rem]" />
            </div>
            <div className="flex min-w-0 flex-col justify-center gap-3 sm:gap-4 lg:py-2">
              <div className="space-y-2">
                <LoadingLine className="h-3 w-28" />
                <LoadingLine className="h-9 w-3/5" />
                <div className="flex min-w-0 items-center gap-2">
                  <LoadingTile className="size-[3.75rem] shrink-0 rounded-[1.15rem]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <LoadingLine className="h-4 w-2/5" />
                    <LoadingLine className="h-1.5 w-full" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                  <LoadingTile key={index} className="h-[3.65rem] rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {Array.from({ length: 2 }, (_, index) => (
            <LoadingTile key={index} className="h-16 rounded-2xl text-[#f4ead3]" />
          ))}
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-12">
          <Panel className="paper-wash h-[17.75rem] overflow-hidden p-4 text-[#5f4738] sm:h-auto sm:p-5 xl:col-span-6 xl:min-h-[17.5625rem]">
            <div className="space-y-2">
              <LoadingLine className="h-3 w-32" />
              <LoadingLine className="h-7 w-52" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2 xl:gap-1.5">
              {Array.from({ length: 9 }, (_, index) => (
                <LoadingTile key={index} className="min-h-[3.8rem] rounded-xl sm:min-h-[4.4rem] xl:min-h-[3.25rem]" />
              ))}
            </div>
          </Panel>
          <Panel className="paper-wash h-[11.375rem] overflow-hidden p-4 text-[#5f4738] sm:h-auto sm:p-5 xl:col-span-6 xl:h-[9.125rem]">
            <div className="flex items-end justify-between gap-3">
              <div className="space-y-2">
                <LoadingLine className="h-3 w-32" />
                <LoadingLine className="h-7 w-48" />
              </div>
              <LoadingLine className="h-4 w-20" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-4 xl:gap-2">
              {Array.from({ length: 4 }, (_, index) => (
                <LoadingTile key={index} className="min-h-15 rounded-xl" />
              ))}
            </div>
          </Panel>
          <Panel className="paper-wash h-[8.6875rem] overflow-hidden p-4 text-[#5f4738] sm:h-auto sm:p-5 xl:col-span-5 xl:h-[9.9375rem]">
            <div className="flex items-end justify-between gap-3">
              <div className="space-y-2">
                <LoadingLine className="h-3 w-28" />
                <LoadingLine className="h-7 w-40" />
              </div>
              <LoadingLine className="h-4 w-24" />
            </div>
            <div className="mt-3 grid grid-cols-2 items-start gap-1.5 sm:gap-2">
              {Array.from({ length: 4 }, (_, index) => (
                <LoadingTile key={index} className="h-14 rounded-xl" />
              ))}
            </div>
          </Panel>
          <Panel className="paper-wash h-[19.625rem] overflow-hidden p-4 text-[#5f4738] sm:h-auto sm:p-5 xl:col-span-7 xl:h-[11.5rem]">
            <div className="space-y-2">
              <LoadingLine className="h-3 w-28" />
              <LoadingLine className="h-7 w-44" />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <LoadingTile key={index} className="h-16 rounded-xl" />
              ))}
            </div>
          </Panel>
          <Panel className="paper-wash h-[14.8125rem] overflow-hidden p-4 text-[#5f4738] sm:h-auto sm:p-5 xl:col-span-8 xl:h-[10.6875rem]">
            <div className="flex items-end justify-between gap-3">
              <div className="space-y-2">
                <LoadingLine className="h-3 w-20" />
                <LoadingLine className="h-7 w-44" />
              </div>
              <LoadingLine className="h-4 w-20" />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <LoadingTile key={index} className="h-16 rounded-xl" />
              ))}
            </div>
          </Panel>
          <Panel className="paper-wash h-[20.4375rem] overflow-hidden p-4 text-[#5f4738] sm:h-auto sm:p-5 xl:col-span-4 xl:h-[21.1875rem]">
            <div className="space-y-2">
              <LoadingLine className="h-3 w-32" />
              <LoadingLine className="h-7 w-28" />
            </div>
            <div className="mt-3 space-y-2">
              {Array.from({ length: 3 }, (_, index) => (
                <LoadingTile key={index} className="h-12 rounded-xl" />
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel className="paper-wash h-[23.1875rem] overflow-hidden p-5 text-[#5f4738] sm:h-auto sm:p-6">
          <LoadingLine className="h-3 w-40" />
          <LoadingLine className="mt-2 h-8 w-52" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index}>
                <LoadingLine className="mb-2 h-4 w-24" />
                <LoadingTile className="h-14 w-full rounded-xl" />
              </div>
            ))}
          </div>
          <LoadingTile className="mt-5 h-12 w-full" />
          <LoadingLine className="mx-auto mt-4 h-4 w-24" />
        </Panel>
        <Panel className="paper-wash h-[11.3125rem] overflow-hidden p-5 text-[#5f4738] sm:h-auto sm:p-6">
          <LoadingLine className="h-3 w-36" />
          <LoadingLine className="mt-2 h-8 w-48" />
          <LoadingLine className="mt-3 h-4 w-4/5" />
          <LoadingTile className="mt-5 h-12 w-full rounded-xl" />
          <LoadingTile className="mt-3 h-12 w-full rounded-xl" />
        </Panel>
      </div>
    </LoadingRegion>
  );
}
