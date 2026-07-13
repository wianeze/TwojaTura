"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  formatDateKeyForDisplay,
  parseMeetingDisplayDateToDateKey,
} from "./formatting";

type MeetingDateFieldProps = {
  name: string;
  label: string;
  defaultValue: string;
  error?: string;
  inputClassName: string;
};

type PickerDay = {
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
};

const monthLabelFormatter = new Intl.DateTimeFormat("pl-PL", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const warsawDateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const weekdayLabels = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];

function readTodayDateKey() {
  const parts = warsawDateKeyFormatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function createMonthToken(dateKey?: string | null) {
  if (dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return dateKey.slice(0, 7);
  }

  return readTodayDateKey().slice(0, 7);
}

function addMonth(monthToken: string, offset: number) {
  const [year, month] = monthToken.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildPickerDays(monthToken: string) {
  const [year, month] = monthToken.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startOffset = (firstDay.getUTCDay() + 6) % 7;
  const gridStart = new Date(firstDay.getTime() - startOffset * 86_400_000);
  const weekCount = Math.ceil((startOffset + daysInMonth) / 7);
  const weeks: PickerDay[][] = [];

  for (let week = 0; week < weekCount; week += 1) {
    const row: PickerDay[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = new Date(
        gridStart.getTime() + (week * 7 + dayIndex) * 86_400_000,
      );
      row.push({
        dateKey: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`,
        dayNumber: date.getUTCDate(),
        inCurrentMonth: date.getUTCMonth() === month - 1,
      });
    }

    weeks.push(row);
  }

  return {
    monthLabel:
      monthLabelFormatter
        .format(firstDay)
        .replace(/^\p{Ll}/u, (value) => value.toUpperCase()) ?? monthToken,
    weeks,
  };
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[1.05rem] w-[1.05rem]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17" />
    </svg>
  );
}

export function MeetingDateField({
  name,
  label,
  defaultValue,
  error,
  inputClassName,
}: MeetingDateFieldProps) {
  const [value, setValue] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    createMonthToken(parseMeetingDisplayDateToDateKey(defaultValue)),
  );
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dialogId = useId();
  const selectedDateKey = parseMeetingDisplayDateToDateKey(value);
  const todayDateKey = readTodayDateKey();

  const month = useMemo(() => buildPickerDays(visibleMonth), [visibleMonth]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const triggerPicker = () => {
    setVisibleMonth(createMonthToken(selectedDateKey));
    setIsOpen((open) => !open);
  };

  return (
    <label className="block text-sm font-semibold text-[#503828]">
      {label}
      <div ref={wrapperRef} className="relative mt-1.5">
        <input
          className={`${inputClassName} mt-0 pr-11`}
          name={name}
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setValue(nextValue);
            const parsedDateKey = parseMeetingDisplayDateToDateKey(nextValue);
            if (parsedDateKey) {
              setVisibleMonth(createMonthToken(parsedDateKey));
            }
          }}
          placeholder="dd/MM/rrrr"
          inputMode="numeric"
          autoComplete="off"
        />

        <button
          type="button"
          onClick={triggerPicker}
          className="absolute top-1/2 right-3 inline-flex -translate-y-1/2 items-center justify-center rounded-full p-1 text-[#8d674b] transition hover:bg-[#f3e4cf]"
          aria-label={`Wybierz datę dla pola ${label}`}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={dialogId}
        >
          <CalendarIcon />
        </button>

        {isOpen ? (
          <div
            id={dialogId}
            role="dialog"
            aria-label={`Wybór daty dla pola ${label}`}
            className="paper-wash premium-edge absolute top-[calc(100%+0.55rem)] left-0 z-40 w-[18rem] rounded-[1.1rem] p-3 shadow-[0_24px_52px_rgba(18,8,6,0.22)]"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  setVisibleMonth((current) => addMonth(current, -1))
                }
                className="rounded-full px-2 py-1 text-sm font-bold text-[#6f523d] transition hover:bg-[#f1e2cc]"
                aria-label="Poprzedni miesiąc"
              >
                ‹
              </button>
              <p className="font-display text-sm font-semibold text-[#4e3528]">
                {month.monthLabel}
              </p>
              <button
                type="button"
                onClick={() =>
                  setVisibleMonth((current) => addMonth(current, 1))
                }
                className="rounded-full px-2 py-1 text-sm font-bold text-[#6f523d] transition hover:bg-[#f1e2cc]"
                aria-label="Następny miesiąc"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {weekdayLabels.map((day) => (
                <span
                  key={`${name}-${day}`}
                  className="pb-1 text-[0.62rem] font-bold tracking-[0.08em] text-[#9c6c41] uppercase"
                >
                  {day}
                </span>
              ))}

              {month.weeks.flat().map((day) => {
                const isSelected = day.dateKey === selectedDateKey;
                const isToday = day.dateKey === todayDateKey;

                return (
                  <button
                    key={`${name}-${day.dateKey}`}
                    type="button"
                    onClick={() => {
                      setValue(formatDateKeyForDisplay(day.dateKey));
                      setVisibleMonth(createMonthToken(day.dateKey));
                      setIsOpen(false);
                    }}
                    className={`flex h-9 items-center justify-center rounded-xl text-sm font-semibold transition ${
                      isSelected
                        ? "bg-[#7d2f3d] text-[#fff4ec] shadow-[0_10px_22px_rgba(73,21,31,0.22)]"
                        : day.inCurrentMonth
                          ? "text-[#4e3528] hover:bg-[#f2e1ca]"
                          : "text-[#b59b84] hover:bg-[#f6ecde]"
                    } ${isToday && !isSelected ? "ring-1 ring-[#d9ad64]/55" : ""}`}
                  >
                    {day.dayNumber}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-1.5 text-xs font-semibold text-[#8f3528]">{error}</p>
      ) : null}
    </label>
  );
}
