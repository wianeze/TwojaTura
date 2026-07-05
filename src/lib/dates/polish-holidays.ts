export const POLISH_PUBLIC_HOLIDAY_TIME_ZONE = "Europe/Warsaw";

export type PolishPublicHoliday = {
  dateKey: string;
  name: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

function getEasterSundayUtc(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, day));
}

function getUtcParts(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function getPolishPublicHolidays(year: number): PolishPublicHoliday[] {
  const easterSunday = getEasterSundayUtc(year);
  const easterMonday = addUtcDays(easterSunday, 1);
  const pentecost = addUtcDays(easterSunday, 49);
  const corpusChristi = addUtcDays(easterSunday, 60);

  const movable = [
    { date: easterSunday, name: "Wielkanoc" },
    { date: easterMonday, name: "Poniedziałek Wielkanocny" },
    { date: pentecost, name: "Zesłanie Ducha Świętego" },
    { date: corpusChristi, name: "Boże Ciało" },
  ].map(({ date, name }) => {
    const parts = getUtcParts(date);
    return {
      dateKey: toDateKey(parts.year, parts.month, parts.day),
      name,
    };
  });

  const fixed: PolishPublicHoliday[] = [
    { dateKey: toDateKey(year, 1, 1), name: "Nowy Rok" },
    { dateKey: toDateKey(year, 1, 6), name: "Trzech Króli" },
    { dateKey: toDateKey(year, 5, 1), name: "Święto Pracy" },
    { dateKey: toDateKey(year, 5, 3), name: "Święto Konstytucji 3 Maja" },
    { dateKey: toDateKey(year, 8, 15), name: "Wniebowzięcie NMP" },
    { dateKey: toDateKey(year, 11, 1), name: "Wszystkich Świętych" },
    { dateKey: toDateKey(year, 11, 11), name: "Święto Niepodległości" },
    { dateKey: toDateKey(year, 12, 24), name: "Wigilia Bożego Narodzenia" },
    { dateKey: toDateKey(year, 12, 25), name: "Boże Narodzenie" },
    { dateKey: toDateKey(year, 12, 26), name: "Drugi dzień Bożego Narodzenia" },
  ];

  return [...fixed, ...movable].sort((left, right) =>
    left.dateKey.localeCompare(right.dateKey),
  );
}

export function getPolishPublicHolidaysMap(year: number) {
  return new Map(
    getPolishPublicHolidays(year).map((holiday) => [holiday.dateKey, holiday]),
  );
}
