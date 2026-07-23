import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { CalendarMonthGrid } from "@/features/meetings/calendar-month-grid";
import {
  buildCalendarMonthView,
  buildContinuationMonthView,
  buildTimelineMeetings,
  formatCalendarMonthLink,
  formatTimelineDayLabel,
  getCalendarWeekdayLabels,
  getMeetingVisualClasses,
  getMeetingVisualLabel,
  getTodayTimelineDateLabel,
} from "@/features/meetings/calendar-view";
import { listMeetings } from "@/features/meetings/queries";

type CalendarPageProps = {
  searchParams?: Promise<{
    month?: string | string[];
  }>;
};

function readMonthParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CalendarPage({
  searchParams,
}: CalendarPageProps) {
  const memberState = await getCurrentMember();
  if (memberState.status !== "active-member") notFound();

  const now = new Date();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const monthParam = readMonthParam(resolvedSearchParams?.month);
  const meetings = await listMeetings();
  const timelineItems = buildTimelineMeetings(meetings, now);
  const calendar = buildCalendarMonthView(meetings, monthParam, now, {
    showOutsideMonthDays: false,
  });
  const continuationMonth = buildContinuationMonthView(calendar, meetings, now);
  const weekdayLabels = getCalendarWeekdayLabels();
  const todayLabel = getTodayTimelineDateLabel(now);

  return (
    <div className="space-y-3.5 lg:space-y-4">
      <header
        style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
        className="anim-rise-in-fast space-y-1 px-1 py-0.5 sm:py-1"
      >
        <p className="text-[0.62rem] font-bold tracking-[0.22em] text-[#e3ae67] uppercase">
          Planowanie wieczorów
        </p>
        <h1 className="font-display text-cream text-[2.1rem] font-semibold tracking-tight drop-shadow-[0_2px_12px_rgba(20,10,7,0.28)] sm:text-[2.65rem]">
          Kalendarium
        </h1>
      </header>

      <Panel
        style={{ animationDelay: `${getEntranceStaggerDelayMs(1)}ms` }}
        className="anim-rise-in-fast premium-edge paper-wash overflow-hidden px-2.5 py-2 sm:px-3 sm:py-2.5"
      >
        {timelineItems.length === 0 ? (
          <EmptyState variant="meetings" compact />
        ) : (
          <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
            <div className="relative flex min-w-max items-end gap-2 pt-1 pr-3">
              <div className="pointer-events-none absolute right-3 bottom-0 left-2 h-px bg-gradient-to-r from-[#c89d62]/60 via-[#b67a4b]/35 to-transparent" />

              <div className="relative flex w-[5rem] shrink-0 flex-col items-center justify-end">
                <div className="paper-wash premium-edge relative z-10 flex w-full shrink-0 flex-col items-center justify-center rounded-[0.95rem] px-2 py-1.75 text-center">
                  <span className="text-[0.52rem] font-bold tracking-[0.16em] text-[#9c6c41] uppercase">
                    {todayLabel}
                  </span>
                  <span className="mt-0.5 text-[0.78rem] font-black tracking-[0.12em] text-[#4e3528] uppercase">
                    Dziś
                  </span>
                </div>
                <div className="h-5.5 w-px bg-gradient-to-b from-[#b67a4b]/70 to-[#c89d62]/18" />
              </div>

              {timelineItems.map((meeting, index) => {
                const visualClasses = getMeetingVisualClasses(meeting);

                return (
                  <div
                    key={meeting.id}
                    style={{
                      animationDelay: `${getEntranceStaggerDelayMs(index)}ms`,
                    }}
                    className="anim-rise-in-fast relative flex w-[9.2rem] shrink-0 flex-col items-center justify-end"
                  >
                    <Link
                      href={meeting.href}
                      className={`premium-edge fire-glow relative z-10 flex w-full shrink-0 flex-col gap-1.5 rounded-[0.95rem] px-2.5 py-2 transition-transform duration-200 hover:-translate-y-0.5 ${visualClasses.card}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[0.86rem] leading-none font-black tracking-[0.05em] uppercase">
                            {formatTimelineDayLabel(meeting.startsAt)}
                          </p>
                        </div>

                        <div className="shrink-0 text-right leading-none">
                          <p className="text-[1.05rem] font-black">
                            {meeting.confirmedAttendeesCount}
                          </p>
                          <p className="mt-0.5 text-[0.5rem] font-bold tracking-[0.08em] uppercase opacity-80">
                            osób
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex rounded-full px-1.75 py-[0.3rem] text-[0.52rem] font-bold ${visualClasses.badge}`}
                        >
                          {getMeetingVisualLabel(meeting)}
                        </span>
                        {meeting.needsAction ? (
                          <Image
                            src="/brand/exclamation-nobg.png"
                            alt="Do decyzji"
                            width={28}
                            height={28}
                            className="h-[1.2rem] w-[1.2rem] object-contain"
                          />
                        ) : null}
                      </div>

                      <div className="space-y-0.75">
                        <h2 className="font-display text-[0.84rem] font-semibold">
                          {meeting.title}
                        </h2>
                        {meeting.location ? (
                          <p className="text-[0.62rem] leading-4 opacity-90">
                            {meeting.location}
                          </p>
                        ) : null}
                      </div>
                    </Link>

                    <div className="h-5 w-px bg-gradient-to-b from-[#b67a4b]/70 to-[#c89d62]/18" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Panel>

      <Panel
        style={{ animationDelay: `${getEntranceStaggerDelayMs(2)}ms` }}
        className="anim-rise-in-fast calendar-wood-panel premium-edge overflow-hidden p-2 sm:p-2.5 lg:p-3"
      >
        <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Link
              href={formatCalendarMonthLink(calendar.previousMonthParam)}
              className="paper-wash rounded-full px-2.5 py-1.5 text-xs font-semibold text-[#6d5037]"
            >
              Poprzedni
            </Link>
            <Link
              href={formatCalendarMonthLink(calendar.nextMonthParam)}
              className="paper-wash rounded-full px-2.5 py-1.5 text-xs font-semibold text-[#6d5037]"
            >
              Następny
            </Link>
            <Link
              href="/kalendarium/nowe"
              className="inline-flex rounded-full bg-[#7d2f3d] px-3.5 py-1.5 text-xs font-bold text-[#fff3ec] shadow-[0_10px_24px_rgba(73,21,31,0.22)] transition-colors hover:bg-[#8d3747]"
            >
              Dodaj spotkanie
            </Link>
          </div>
        </div>

        <div className="space-y-2.5">
          <div key={calendar.monthParam} className="anim-rise-in">
            <CalendarMonthGrid month={calendar} weekdayLabels={weekdayLabels} />
          </div>
          {continuationMonth.weeks.length > 0 ? (
            <div key={continuationMonth.monthParam} className="anim-rise-in">
              <CalendarMonthGrid
                month={continuationMonth}
                weekdayLabels={weekdayLabels}
                muted
              />
            </div>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
