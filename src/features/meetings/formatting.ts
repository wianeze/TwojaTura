import { DEFAULT_MEETING_STATUS } from "./types.ts";
import type { MeetingCardItem, MeetingFormValues } from "./types.ts";

const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Warsaw",
});

const compactDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "short",
  timeZone: "Europe/Warsaw",
});

const weekdayFormatter = new Intl.DateTimeFormat("pl-PL", {
  weekday: "long",
  timeZone: "Europe/Warsaw",
});

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Warsaw",
});

export const MEETING_STATUS_LABELS = {
  planned: "Planowane",
  confirmed: "Potwierdzone",
  completed: "Zakończone",
} as const;

function readZonedParts(iso: string) {
  const parts = partsFormatter.formatToParts(new Date(iso));

  return {
    day: parts.find((part) => part.type === "day")?.value ?? "",
    month: parts.find((part) => part.type === "month")?.value ?? "",
    year: parts.find((part) => part.type === "year")?.value ?? "",
    hour: parts.find((part) => part.type === "hour")?.value ?? "",
    minute: parts.find((part) => part.type === "minute")?.value ?? "",
  };
}

export function formatDateKeyForDisplay(dateKey?: string | null) {
  if (!dateKey) return "";
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function parseMeetingDisplayDateToDateKey(value: string) {
  const normalized = value.trim();
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${match[2]}-${match[1]}`;
}

export function formatMeetingDateRange(option: {
  startsAt: string;
  endsAt: string;
}) {
  const start = new Date(option.startsAt);
  const end = new Date(option.endsAt);
  const startParts = readZonedParts(option.startsAt);
  const endParts = readZonedParts(option.endsAt);
  const sameDay =
    startParts.day === endParts.day &&
    startParts.month === endParts.month &&
    startParts.year === endParts.year;

  return {
    weekday: weekdayFormatter.format(start),
    startDate: dateFormatter.format(start),
    endDate: dateFormatter.format(end),
    compactStartDate: compactDateFormatter.format(start).replace(".", ""),
    compactEndDate: compactDateFormatter.format(end).replace(".", ""),
    startTime: `${startParts.hour}:${startParts.minute}`,
    endTime: `${endParts.hour}:${endParts.minute}`,
    sameDay,
  };
}

export function formatMeetingListBadge(meeting: {
  startsAt: string;
  endsAt: string;
}) {
  const formatted = formatMeetingDateRange(meeting);

  if (formatted.sameDay) {
    return `${formatted.compactStartDate} · ${formatted.startTime}–${formatted.endTime}`;
  }

  return `${formatted.compactStartDate} ${formatted.startTime} – ${formatted.compactEndDate} ${formatted.endTime}`;
}

export function getMeetingFormValues(
  meeting?: MeetingCardItem,
  prefilledDateKey?: string,
): MeetingFormValues {
  if (!meeting) {
    const prefilledDate = formatDateKeyForDisplay(prefilledDateKey);

    return {
      title: "",
      description: "",
      location: "",
      startDate: prefilledDate,
      endDate: prefilledDate,
      startTime: "18:00",
      endTime: "23:00",
    };
  }

  const startParts = readZonedParts(meeting.startsAt);
  const endParts = readZonedParts(meeting.endsAt);

  return {
    title: meeting.title,
    description: meeting.description ?? "",
    location: meeting.location ?? "",
    startDate: `${startParts.day}/${startParts.month}/${startParts.year}`,
    endDate: `${endParts.day}/${endParts.month}/${endParts.year}`,
    startTime: `${startParts.hour}:${startParts.minute}`,
    endTime: `${endParts.hour}:${endParts.minute}`,
  };
}

export function getMeetingStatusClass(
  status: keyof typeof MEETING_STATUS_LABELS,
) {
  if (status === "confirmed") return "bg-moss-soft text-moss";
  if (status === "completed") return "bg-[#ead9bd] text-[#76542d]";
  return "bg-accent-soft text-accent";
}

export function normalizeMeetingLocationSuggestions(
  locations: Array<string | null>,
) {
  const unique = new Map<string, string>();

  for (const location of locations) {
    const normalized = location?.trim() ?? "";
    if (!normalized) continue;

    const key = normalized.toLocaleLowerCase("pl-PL");
    if (!unique.has(key)) {
      unique.set(key, normalized);
    }
  }

  return [...unique.values()].sort((left, right) =>
    left.localeCompare(right, "pl", { sensitivity: "base" }),
  );
}

export function getMeetingPrefillDateValue(dateKey?: string | null) {
  return formatDateKeyForDisplay(dateKey);
}

export { DEFAULT_MEETING_STATUS };
