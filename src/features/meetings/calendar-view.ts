import { getPolishPublicHolidaysMap } from "../../lib/dates/polish-holidays.ts";
import type { MeetingCardItem } from "./types.ts";

export const WARSAW_TIME_ZONE = "Europe/Warsaw";

const monthLabelFormatter = new Intl.DateTimeFormat("pl-PL", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const monthTokenFormatter = new Intl.DateTimeFormat("pl-PL", {
  month: "short",
  timeZone: WARSAW_TIME_ZONE,
});

const todayLabelFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "short",
  timeZone: WARSAW_TIME_ZONE,
});

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getZonedDateParts(input: Date | string, timeZone = WARSAW_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(input));

  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? 0),
    month: Number(parts.find((part) => part.type === "month")?.value ?? 0),
    day: Number(parts.find((part) => part.type === "day")?.value ?? 0),
  };
}

function fromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function getWarsawDateKey(input: Date | string) {
  const { year, month, day } = getZonedDateParts(input);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function getTodayTimelineDateLabel(today = new Date()) {
  return todayLabelFormatter.format(today).replace(".", "").toUpperCase();
}

export function parseCalendarMonth(
  monthParam?: string | null,
  today = new Date(),
) {
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [year, month] = monthParam.split("-").map(Number);
    if (month >= 1 && month <= 12) {
      return {
        year,
        monthIndex: month - 1,
      };
    }
  }

  const zoned = getZonedDateParts(today);
  return {
    year: zoned.year,
    monthIndex: zoned.month - 1,
  };
}

function toMonthParam(year: number, monthIndex: number) {
  return `${year}-${pad(monthIndex + 1)}`;
}

function addMonth(year: number, monthIndex: number, offset: number) {
  const date = new Date(Date.UTC(year, monthIndex + offset, 1));
  return {
    year: date.getUTCFullYear(),
    monthIndex: date.getUTCMonth(),
  };
}

export type TimelineMeetingItem = {
  id: string;
  title: string;
  location: string | null;
  status: MeetingCardItem["status"];
  href: string;
  startsAt: string;
  endsAt: string;
  dateKey: string;
  needsAction: boolean;
  confirmedAttendeesCount: number;
};

export type MeetingVisualState =
  "confirmed" | "decision-required" | "awaiting-group" | "completed";

type MeetingVisualInput =
  | Pick<MeetingCardItem, "status" | "ownResponse">
  | {
      status: MeetingCardItem["status"];
      needsAction: boolean;
    };

function hasVisualDecisionRequirement(
  meeting: Pick<MeetingCardItem, "status" | "ownResponse">,
) {
  return meeting.status !== "completed" && meeting.ownResponse === null;
}

function hasDecisionRequirement(meeting: MeetingVisualInput) {
  return "needsAction" in meeting
    ? meeting.needsAction
    : hasVisualDecisionRequirement(meeting);
}

export function getMeetingVisualState(meeting: MeetingVisualInput) {
  if (meeting.status === "completed")
    return "completed" satisfies MeetingVisualState;
  if (hasDecisionRequirement(meeting)) {
    return "decision-required" satisfies MeetingVisualState;
  }
  if (meeting.status === "confirmed")
    return "confirmed" satisfies MeetingVisualState;
  return "awaiting-group" satisfies MeetingVisualState;
}

export function getMeetingVisualLabel(meeting: MeetingVisualInput) {
  const state = getMeetingVisualState(meeting);
  if (state === "confirmed") return "Potwierdzone";
  if (state === "decision-required") return "Do decyzji";
  if (state === "completed") return "Zakończone";
  return "Do ustalenia";
}

export function getMeetingVisualClasses(meeting: MeetingVisualInput) {
  const state = getMeetingVisualState(meeting);
  if (state === "confirmed") {
    return {
      card: "bg-[linear-gradient(145deg,rgba(226,239,226,0.98),rgba(208,228,209,0.95))] text-[#304436] ring-1 ring-[#88a383]/40",
      badge: "bg-[#eef5ea] text-[#466047]",
      marker: "bg-[#dbe6d6] text-[#42523f]",
    };
  }

  if (state === "decision-required") {
    return {
      card: "bg-[linear-gradient(145deg,rgba(246,226,177,0.98),rgba(235,208,135,0.96))] text-[#5f461d] ring-1 ring-[#d1a64a]/35",
      badge: "bg-[#fff4cf] text-[#775919]",
      marker: "bg-[#f1dfbf] text-[#6c5125]",
    };
  }

  if (state === "completed") {
    return {
      card: "bg-[linear-gradient(145deg,rgba(224,213,197,0.95),rgba(205,191,174,0.94))] text-[#5e5348] ring-1 ring-[#b6a38e]/28",
      badge: "bg-[#f3ece0] text-[#76685b]",
      marker: "bg-[#e5d7c5] text-[#6f6152]",
    };
  }

  return {
    card: "bg-[linear-gradient(145deg,rgba(113,47,57,0.96),rgba(92,31,41,0.96))] text-[#fff3ec] ring-1 ring-[#b66f7d]/28",
    badge: "bg-[#f7d9dc] text-[#7a2f3a]",
    marker: "bg-[#7d2f3d] text-[#fff3ec]",
  };
}

export function buildTimelineMeetings(
  meetings: MeetingCardItem[],
  now = new Date(),
): TimelineMeetingItem[] {
  return meetings
    .filter((meeting) => meeting.status !== "completed")
    .filter((meeting) => new Date(meeting.startsAt).getTime() >= now.getTime())
    .map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      location: meeting.location,
      status: meeting.status,
      href: `/kalendarium/${meeting.id}`,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      dateKey: getWarsawDateKey(meeting.startsAt),
      needsAction: hasVisualDecisionRequirement(meeting),
      confirmedAttendeesCount: meeting.confirmedAttendeesCount,
    }))
    .sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    );
}

export function getCalendarDateRange(startsAt: string, endsAt: string) {
  const startKey = getWarsawDateKey(startsAt);
  const endKey = getWarsawDateKey(endsAt);
  const startDate = fromDateKey(startKey);
  const endDate = fromDateKey(endKey);

  if (endDate.getTime() < startDate.getTime()) {
    return [startKey];
  }

  const keys: string[] = [];
  for (
    let cursor = startDate;
    cursor.getTime() <= endDate.getTime();
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    keys.push(getWarsawDateKey(cursor));
  }

  return keys;
}

export type CalendarMeetingMarker = {
  id: string;
  meetingId: string;
  title: string;
  location: string | null;
  status: MeetingCardItem["status"];
  href: string;
  dateKey: string;
  startsAt: string;
  needsAction: boolean;
  spansMultipleDays: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
};

export function groupMeetingsByCalendarDay(meetings: MeetingCardItem[]) {
  const grouped = new Map<string, CalendarMeetingMarker[]>();

  for (const meeting of meetings) {
    const dateKeys = getCalendarDateRange(meeting.startsAt, meeting.endsAt);

    dateKeys.forEach((dateKey, index) => {
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }

      grouped.get(dateKey)?.push({
        id: `${meeting.id}:${dateKey}`,
        meetingId: meeting.id,
        title: meeting.title,
        location: meeting.location,
        status: meeting.status,
        href: `/kalendarium/${meeting.id}`,
        dateKey,
        startsAt: meeting.startsAt,
        needsAction: hasVisualDecisionRequirement(meeting),
        spansMultipleDays: dateKeys.length > 1,
        isRangeStart: index === 0,
        isRangeEnd: index === dateKeys.length - 1,
      });
    });
  }

  for (const [key, items] of grouped) {
    grouped.set(
      key,
      [...items].sort((left, right) => {
        const byTime =
          new Date(left.startsAt).getTime() -
          new Date(right.startsAt).getTime();
        if (byTime !== 0) return byTime;

        return left.title.localeCompare(right.title, "pl", {
          sensitivity: "base",
        });
      }),
    );
  }

  return grouped;
}

export type CalendarDayCell = {
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isPlaceholder: boolean;
  isToday: boolean;
  holidayName: string | null;
  meetings: CalendarMeetingMarker[];
};

export type CalendarMonthView = {
  monthLabel: string;
  monthParam: string;
  previousMonthParam: string;
  nextMonthParam: string;
  weeks: CalendarDayCell[][];
};

type CalendarMonthViewOptions = {
  showOutsideMonthDays?: boolean;
};

export function buildCalendarMonthView(
  meetings: MeetingCardItem[],
  monthParam?: string | null,
  today = new Date(),
  options?: CalendarMonthViewOptions,
): CalendarMonthView {
  const { year, monthIndex } = parseCalendarMonth(monthParam, today);
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const startOffset = (firstDay.getUTCDay() + 6) % 7;
  const weekCount = Math.ceil((startOffset + daysInMonth) / 7);
  const gridStart = new Date(firstDay.getTime() - startOffset * 86_400_000);
  const holidays = getPolishPublicHolidaysMap(year);
  const extraYear =
    monthIndex === 0 || monthIndex === 11
      ? getPolishPublicHolidaysMap(monthIndex === 0 ? year - 1 : year + 1)
      : new Map();
  const meetingsByDay = groupMeetingsByCalendarDay(meetings);
  const todayKey = getWarsawDateKey(today);
  const showOutsideMonthDays = options?.showOutsideMonthDays ?? true;
  const weeks: CalendarDayCell[][] = [];

  for (let week = 0; week < weekCount; week += 1) {
    const cells: CalendarDayCell[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = new Date(
        gridStart.getTime() + (week * 7 + dayIndex) * 86_400_000,
      );
      const dayYear = date.getUTCFullYear();
      const dateKey = `${dayYear}-${pad(date.getUTCMonth() + 1)}-${pad(
        date.getUTCDate(),
      )}`;
      const holiday =
        holidays.get(dateKey) ??
        (dayYear !== year ? (extraYear.get(dateKey) ?? null) : null);

      cells.push({
        dateKey,
        dayNumber: date.getUTCDate(),
        inCurrentMonth: date.getUTCMonth() === monthIndex,
        isPlaceholder:
          !showOutsideMonthDays && date.getUTCMonth() !== monthIndex,
        isToday: dateKey === todayKey && date.getUTCMonth() === monthIndex,
        holidayName:
          !showOutsideMonthDays && date.getUTCMonth() !== monthIndex
            ? null
            : (holiday?.name ?? null),
        meetings:
          !showOutsideMonthDays && date.getUTCMonth() !== monthIndex
            ? []
            : (meetingsByDay.get(dateKey) ?? []),
      });
    }

    weeks.push(cells);
  }

  const previous = addMonth(year, monthIndex, -1);
  const next = addMonth(year, monthIndex, 1);

  return {
    monthLabel: capitalize(monthLabelFormatter.format(firstDay)),
    monthParam: toMonthParam(year, monthIndex),
    previousMonthParam: toMonthParam(previous.year, previous.monthIndex),
    nextMonthParam: toMonthParam(next.year, next.monthIndex),
    weeks,
  };
}

export function buildContinuationMonthView(
  currentMonth: CalendarMonthView,
  meetings: MeetingCardItem[],
  today = new Date(),
) {
  return buildCalendarMonthView(meetings, currentMonth.nextMonthParam, today, {
    showOutsideMonthDays: false,
  });
}

export function formatTimelineDayLabel(iso: string) {
  const date = new Date(iso);
  const month = monthTokenFormatter.format(date).replace(".", "").toUpperCase();
  const { day } = getZonedDateParts(date);
  return `${day} ${month}`;
}

export function getCalendarWeekdayLabels() {
  return ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];
}

export function formatCalendarMonthLink(monthParam: string) {
  return `/kalendarium?month=${monthParam}`;
}

export function getDayPanelId(dateKey: string) {
  return `calendar-day-${dateKey}`;
}

export function getNewMeetingPrefillHref(dateKey: string) {
  return `/kalendarium/nowe?date=${dateKey}`;
}
