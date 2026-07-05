import type {
  MeetingFormFieldName,
  MeetingFormState,
  MeetingFormValues,
} from "./types.ts";

type FieldErrors<T extends string> = Partial<Record<T, string>>;

type MeetingValidationResult =
  | {
      ok: true;
      data: {
        title: string;
        description: string | null;
        location: string | null;
        startsAt: string;
        endsAt: string;
      };
    }
  | {
      ok: false;
      message: string;
      fieldErrors: FieldErrors<MeetingFormFieldName>;
      submittedValues: MeetingFormValues;
    };

type ParsedDateParts = {
  year: number;
  month: number;
  day: number;
};

type ParsedTimeParts = {
  hour: number;
  minute: number;
};

function value(formData: FormData, key: string) {
  const field = formData.get(key);
  return typeof field === "string" ? field : "";
}

function pushError<T extends string>(
  errors: FieldErrors<T>,
  field: T,
  message: string,
) {
  if (!errors[field]) {
    errors[field] = message;
  }
}

function normalizeNullableText(input: string) {
  const normalized = input.trim();
  return normalized ? normalized : null;
}

function parsePolishDate(rawValue: string) {
  const normalized = rawValue.trim();
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  const parsed = {
    day: Number(day),
    month: Number(month),
    year: Number(year),
  };

  const candidate = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day),
  );

  if (
    candidate.getUTCFullYear() !== parsed.year ||
    candidate.getUTCMonth() !== parsed.month - 1 ||
    candidate.getUTCDate() !== parsed.day
  ) {
    return null;
  }

  return parsed satisfies ParsedDateParts;
}

function parseTime(rawValue: string) {
  const normalized = rawValue.trim();
  const match = normalized.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  } satisfies ParsedTimeParts;
}

function parseOffsetMinutes(offsetLabel: string) {
  const match = offsetLabel.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  return sign * (hours * 60 + minutes);
}

function getWarsawOffsetMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
    timeZoneName: "shortOffset",
    year: "numeric",
  }).formatToParts(date);

  return parseOffsetMinutes(
    parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0",
  );
}

function toWarsawIso(date: ParsedDateParts, time: ParsedTimeParts) {
  const baseUtcMs = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    time.hour,
    time.minute,
  );

  let utcMs = baseUtcMs;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const offsetMinutes = getWarsawOffsetMinutes(new Date(utcMs));
    utcMs = baseUtcMs - offsetMinutes * 60_000;
  }

  return new Date(utcMs).toISOString();
}

export function buildMeetingSubmittedValues(
  formData: FormData,
): MeetingFormValues {
  return {
    title: value(formData, "title"),
    description: value(formData, "description"),
    location: value(formData, "location"),
    startDate: value(formData, "startDate"),
    endDate: value(formData, "endDate"),
    startTime: value(formData, "startTime"),
    endTime: value(formData, "endTime"),
  };
}

export function hasMeetingAvailabilityGap(
  meeting: Pick<
    { status: string; ownResponse: boolean | null },
    "status" | "ownResponse"
  >,
) {
  return meeting.status === "planned" && meeting.ownResponse === null;
}

export function countConfirmedResponses(
  responses: Array<boolean | null | undefined>,
) {
  return responses.reduce(
    (count, response) => count + (response === true ? 1 : 0),
    0,
  );
}

export function sortMeetingRanking<
  T extends { votesCount: number; title: string },
>(games: T[]) {
  return [...games].sort((left, right) => {
    if (right.votesCount !== left.votesCount) {
      return right.votesCount - left.votesCount;
    }

    return left.title.localeCompare(right.title, "pl", {
      sensitivity: "base",
    });
  });
}

export function validateMeetingFormData(
  formData: FormData,
): MeetingValidationResult {
  const submittedValues = buildMeetingSubmittedValues(formData);
  const fieldErrors: FieldErrors<MeetingFormFieldName> = {};
  const title = submittedValues.title.trim();
  const description = normalizeNullableText(submittedValues.description);
  const location = normalizeNullableText(submittedValues.location);

  if (!title) {
    pushError(fieldErrors, "title", "Tytuł spotkania jest wymagany.");
  }

  const startDate = parsePolishDate(submittedValues.startDate);
  const endDate = parsePolishDate(submittedValues.endDate);
  const startTime = parseTime(submittedValues.startTime);
  const endTime = parseTime(submittedValues.endTime);

  if (!startDate) {
    pushError(
      fieldErrors,
      "startDate",
      "Podaj poprawną datę w formacie dd/MM/rrrr.",
    );
  }

  if (!endDate) {
    pushError(
      fieldErrors,
      "endDate",
      "Podaj poprawną datę w formacie dd/MM/rrrr.",
    );
  }

  if (!startTime) {
    pushError(fieldErrors, "startTime", "Podaj godzinę w formacie 24h HH:mm.");
  }

  if (!endTime) {
    pushError(fieldErrors, "endTime", "Podaj godzinę w formacie 24h HH:mm.");
  }

  if (
    Object.keys(fieldErrors).length === 0 &&
    startDate &&
    endDate &&
    startTime &&
    endTime
  ) {
    const startsAt = toWarsawIso(startDate, startTime);
    const endsAt = toWarsawIso(endDate, endTime);

    if (endsAt <= startsAt) {
      pushError(
        fieldErrors,
        "endTime",
        "Koniec spotkania musi być późniejszy niż początek.",
      );
    } else {
      return {
        ok: true,
        data: {
          title,
          description,
          location,
          startsAt,
          endsAt,
        },
      };
    }
  }

  return {
    ok: false,
    message: "Popraw dane spotkania i spróbuj ponownie.",
    fieldErrors,
    submittedValues,
  };
}

export function toMeetingFormErrorState(
  validation: Extract<MeetingValidationResult, { ok: false }>,
): MeetingFormState {
  return {
    status: "error",
    message: validation.message,
    fieldErrors: validation.fieldErrors,
    submittedValues: validation.submittedValues,
  };
}
