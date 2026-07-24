import Image from "next/image";
import Link from "next/link";
import type { CalendarMonthView } from "./calendar-view";
import {
  getDayPanelId,
  getMeetingVisualClasses,
  getNewMeetingPrefillHref,
} from "./calendar-view";
import { MEETING_STATUS_LABELS, getMeetingStatusClass } from "./formatting";

type CalendarMonthGridProps = {
  month: CalendarMonthView;
  weekdayLabels: string[];
  muted?: boolean;
};

function getVisibleMarkers<T>(items: T[], count = 1) {
  return {
    visible: items.slice(0, count),
    hidden: items.slice(count),
  };
}

export function CalendarMonthGrid({
  month,
  weekdayLabels,
  muted = false,
}: CalendarMonthGridProps) {
  return (
    <section className={muted ? "opacity-82" : ""}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3
          className={`font-display text-lg font-semibold ${
            muted ? "text-[#d9c2a0]" : "text-cream"
          }`}
        >
          {month.monthLabel}
        </h3>
        {muted ? (
          <span className="rounded-full bg-[rgba(248,237,220,0.14)] px-2 py-0.5 text-[0.55rem] font-bold tracking-[0.16em] text-[#d9c2a0] uppercase">
            Dalej
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-7 gap-0.75 sm:gap-1">
        {weekdayLabels.map((label) => (
          <div
            key={`${month.monthParam}-${label}`}
            className={`px-1 pb-0.5 text-center text-[0.5rem] font-bold tracking-[0.14em] uppercase sm:px-1.5 ${
              muted ? "text-[#cdb18e]" : "text-[#eed8b6]"
            }`}
          >
            {label}
          </div>
        ))}

        {month.weeks.flat().map((day) => {
          const { visible, hidden } = getVisibleMarkers(day.meetings);
          const hasExtra = hidden.length > 0;
          const dayPanelId = getDayPanelId(day.dateKey);
          // Mobile shows up to 2 inline chips (vs desktop's 1 + popover) —
          // see the sm:hidden block below for why.
          const mobileSplit = getVisibleMarkers(day.meetings, 2);

          if (day.isPlaceholder) {
            return (
              <div
                key={`${month.monthParam}-${day.dateKey}`}
                className="relative min-h-[4.65rem] overflow-hidden rounded-[0.8rem] border border-[#f0c487]/6 bg-[rgba(21,11,8,0.12)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:min-h-[5.3rem]"
              >
                <div className="h-full rounded-[0.65rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.015),rgba(0,0,0,0.02))]" />
              </div>
            );
          }

          return (
            <div
              key={`${month.monthParam}-${day.dateKey}`}
              className={`relative min-h-[4.65rem] overflow-hidden rounded-[0.8rem] border p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:min-h-[5.3rem] ${
                day.inCurrentMonth
                  ? muted
                    ? "border-[#f0c487]/12 bg-[rgba(31,18,14,0.46)]"
                    : "border-[#f0c487]/18 bg-[rgba(36,20,15,0.46)]"
                  : "border-[#f0c487]/8 bg-[rgba(24,12,9,0.22)]"
              } ${
                day.isToday
                  ? "bg-[linear-gradient(165deg,rgba(246,218,165,0.22),rgba(36,20,15,0.54))] ring-1 ring-[#f0c487]/45"
                  : ""
              }`}
            >
              <Link
                href={getNewMeetingPrefillHref(day.dateKey)}
                aria-label={`Dodaj spotkanie na ${day.dateKey}`}
                className="absolute inset-0 z-0"
              />

              {/*
               * Desktop/tablet (sm:+) — pristine, unchanged from before.
               * The top-right "Więcej"/"+N" popover's expanded panel is
               * w-60 (240px) — fine on a wide desktop cell, but on a
               * mobile 7-col grid (cells are ~45-50px) it would poke
               * straight out of the cell/viewport, which is exactly the
               * reported "wychodzi poza ramkę" bug. Rather than trying
               * to make one popover work at both sizes, it's simply
               * hidden on mobile (this whole block is) and mobile gets
               * its own non-overflowing block below instead.
               */}
              <div className="pointer-events-none relative z-10 hidden h-full flex-col sm:flex">
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    {day.isToday ? (
                      <span className="mb-0.5 inline-flex rounded-full bg-[#f3d5a4] px-2 py-[0.3rem] text-[0.52rem] font-black tracking-[0.12em] text-[#4b3026] uppercase">
                        Dziś
                      </span>
                    ) : null}
                    <div
                      className={`inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-full px-1 text-[0.78rem] font-bold ${
                        day.isToday
                          ? "bg-[#f3d5a4] text-[#4b3026]"
                          : day.inCurrentMonth
                            ? "text-[#fff2df]"
                            : "text-[#b5997d]"
                      }`}
                    >
                      {day.dayNumber}
                    </div>
                    {day.holidayName ? (
                      <p className="mt-0.5 max-w-[4.6rem] text-[0.48rem] leading-3 font-semibold text-[#efc8b4]">
                        {day.holidayName}
                      </p>
                    ) : null}
                  </div>

                  {(day.meetings.length > 0 || day.holidayName) && (
                    <details className="group pointer-events-auto relative z-30">
                      <summary
                        className="cursor-pointer list-none rounded-full bg-[#f8eddc] px-2 py-[0.3rem] text-[0.58rem] font-bold text-[#6d5037] marker:hidden"
                        aria-controls={dayPanelId}
                      >
                        {hasExtra ? `+${hidden.length}` : "Więcej"}
                      </summary>
                      <div
                        id={dayPanelId}
                        className="paper-wash premium-edge anim-rise-in absolute top-6 right-0 z-40 w-60 rounded-[0.95rem] p-3 text-sm text-[#4e3528] shadow-[0_24px_52px_rgba(18,8,6,0.32)]"
                      >
                        <p className="text-[0.62rem] font-bold tracking-[0.16em] text-[#a36b43] uppercase">
                          {day.dateKey}
                        </p>
                        {day.holidayName ? (
                          <p className="mt-2 text-[0.7rem] font-semibold text-[#8b5b47]">
                            Święto: {day.holidayName}
                          </p>
                        ) : null}
                        <div className="mt-3 space-y-1.5">
                          {day.meetings.length > 0 ? (
                            day.meetings.map((meeting) => (
                              <Link
                                key={`${meeting.id}-panel`}
                                href={meeting.href}
                                className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 transition-colors hover:bg-[#f2e2c8]"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold">
                                    {meeting.title}
                                  </p>
                                  {meeting.location ? (
                                    <p className="text-muted truncate text-[0.68rem]">
                                      {meeting.location}
                                    </p>
                                  ) : null}
                                </div>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[0.58rem] font-bold ${getMeetingStatusClass(meeting.status)}`}
                                >
                                  {MEETING_STATUS_LABELS[meeting.status]}
                                </span>
                              </Link>
                            ))
                          ) : (
                            <p className="text-muted text-xs">
                              Brak spotkań tego dnia.
                            </p>
                          )}
                        </div>
                      </div>
                    </details>
                  )}
                </div>

                <div className="relative z-20 mt-auto pt-2">
                  {visible.map((meeting) => {
                    const visualClasses = getMeetingVisualClasses(meeting);

                    return (
                      <Link
                        key={meeting.id}
                        href={meeting.href}
                        className={`pointer-events-auto flex min-h-[2.25rem] items-center gap-1.5 rounded-[0.7rem] px-2 py-[0.45rem] text-[0.66rem] leading-[1.15] font-semibold transition-transform hover:-translate-y-px ${visualClasses.marker}`}
                      >
                        {meeting.spansMultipleDays && !meeting.isRangeStart ? (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current/75" />
                        ) : null}
                        <span className="truncate">{meeting.title}</span>
                        {meeting.needsAction ? (
                          <Image
                            src="/brand/exclamation-nobg.png"
                            alt="Do decyzji"
                            width={24}
                            height={24}
                            className="ml-auto h-[1.4rem] w-[1.4rem] shrink-0 object-contain"
                          />
                        ) : null}
                      </Link>
                    );
                  })}

                  {hasExtra ? (
                    <details className="group pointer-events-auto relative z-20">
                      <summary className="mt-1 cursor-pointer list-none rounded-md border border-dashed border-[#f0c487]/28 px-1.75 py-1 text-[0.62rem] font-semibold text-[#eed8b6] marker:hidden">
                        +{hidden.length} więcej
                      </summary>
                      <div className="anim-rise-in mt-1 space-y-0.75">
                        {hidden.map((meeting) => {
                          const visualClasses =
                            getMeetingVisualClasses(meeting);

                          return (
                            <Link
                              key={`${meeting.id}-more`}
                              href={meeting.href}
                              className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[0.58rem] font-semibold ${visualClasses.marker}`}
                            >
                              <span className="truncate">{meeting.title}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </details>
                  ) : null}
                </div>
              </div>

              {/*
               * Mobile-only (<sm). Day number gets its own top row (own
               * fixed space — never shared with or covered by anything
               * else, unlike the desktop's justify-between row where a
               * wide "Więcej" badge could crowd it on a narrow cell).
               * Up to 2 meetings render as 1-line truncated chips
               * (min-w-0 on the list + truncate on each chip is what
               * makes long titles ellipsize instead of overflowing);
               * anything beyond that collapses to a plain "+N" label
               * instead of a "Więcej" toggle — no expandable panel here
               * at all, so there is nothing that can ever render outside
               * the cell's own overflow-hidden border (set on the cell
               * wrapper above, line ~77). flex-col justify-end keeps the
               * chips anchored to the bottom of the cell without needing
               * absolute positioning.
               */}
              <div className="pointer-events-none relative z-10 flex h-full flex-col sm:hidden">
                {/*
                 * Day number alone on its own row (own fixed space, top-
                 * left, first element) — the "Dziś" badge used to sit
                 * beside it (justify-between), but a 7-col mobile cell is
                 * only ~40px wide and the number (~21px) + badge (~29px)
                 * together don't fit: measured with Playwright, the badge
                 * overflowed the cell by ~19px, invisibly clipped by the
                 * cell's own overflow-hidden into an unreadable sliver.
                 * Stacking it on its own row below the number instead
                 * gives it the full ~40px to itself.
                 */}
                <div
                  className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center self-start rounded-full px-1 text-[0.7rem] font-bold ${
                    day.isToday
                      ? "bg-[#f3d5a4] text-[#4b3026]"
                      : day.inCurrentMonth
                        ? "text-[#fff2df]"
                        : "text-[#b5997d]"
                  }`}
                >
                  {day.dayNumber}
                </div>
                {day.isToday ? (
                  <span className="mt-0.5 inline-flex w-fit shrink-0 rounded-full bg-[#f3d5a4] px-1.5 py-[0.15rem] text-[0.4rem] font-black tracking-[0.08em] text-[#4b3026] uppercase">
                    Dziś
                  </span>
                ) : null}
                {day.holidayName ? (
                  <p className="mt-0.5 truncate text-[0.42rem] leading-3 font-semibold text-[#efc8b4]">
                    {day.holidayName}
                  </p>
                ) : null}

                <div className="mt-1 flex min-w-0 flex-1 flex-col justify-end gap-0.5">
                  {mobileSplit.visible.map((meeting) => {
                    const visualClasses = getMeetingVisualClasses(meeting);

                    return (
                      <Link
                        key={`${meeting.id}-mobile`}
                        href={meeting.href}
                        className={`pointer-events-auto block min-w-0 truncate rounded-[0.4rem] px-1.5 py-[0.2rem] text-[0.56rem] leading-[1.2] font-semibold ${visualClasses.marker}`}
                      >
                        {meeting.title}
                      </Link>
                    );
                  })}
                  {mobileSplit.hidden.length > 0 ? (
                    <span className="pointer-events-none block text-right text-[0.5rem] leading-none font-bold text-[#eed8b6]">
                      +{mobileSplit.hidden.length}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
