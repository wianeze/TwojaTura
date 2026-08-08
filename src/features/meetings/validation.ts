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
        invitedUserIds: string[];
        continuedPlayId: string | null;
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

// Ten parser jest tylko wygodą dla Server Action — prawdziwa granica
// bezpieczeństwa to RPC (private.filter_invitable_user_ids w migracji),
// które i tak odrzuca wszystko poza aktywnymi member różnymi od organizatora.
// Tu wystarczy nie wywrócić się na złym JSON-ie i odsiać duplikaty przed
// wysłaniem, żeby liczbę „Zaproszeni: N” po stronie klienta i faktyczny zapis
// nie rozjechały się o nic więcej niż walidację serwera.
export function parseInvitedUserIds(formData: FormData): string[] {
  const raw = value(formData, "invitedUserIds");
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const ids = parsed.filter(
      (id): id is string => typeof id === "string" && id.trim().length > 0,
    );

    return [...new Set(ids)];
  } catch {
    return [];
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Odsiewa wartości, które nie są w ogóle identyfikatorem, zanim trafią do RPC
// (inaczej Postgres odpowiedziałby 22P02 i użytkownik dostałby komunikat
// „nie udało się zapisać”, zamiast błędu przy właściwym polu). Realna
// walidacja — czy partia istnieje, czy jest w toku i czy nie jest to
// samo-kontynuacja — żyje w private.assert_valid_continued_play.
export function parseContinuedPlayId(formData: FormData) {
  const raw = value(formData, "continuedPlayId").trim();
  return UUID_PATTERN.test(raw) ? raw : "";
}

export function isContinuationRequested(formData: FormData) {
  return value(formData, "continuesPlay") === "1";
}

/*
 * Sekcja kontynuacji montuje ukryte pola formularza tylko wtedy, gdy w ogóle
 * się renderuje. Dlatego brak kandydatów NIE może jej ukryć, jeśli spotkanie ma
 * już przypisaną kontynuację: bez tych pól submit nie niósłby continuedPlayId,
 * a zapis po cichu zdjąłby powiązanie — mimo że użytkownik poprawiał tylko
 * godzinę. Ten przypadek jest realny, bo lista kandydatów pokazuje wyłącznie
 * partie `in_progress`, a przypisana kontynuacja bywa już zakończona.
 */
export function shouldRenderContinuationField(
  candidateCount: number,
  currentPlayId: string,
) {
  return candidateCount > 0 || currentPlayId.length > 0;
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
    invitedUserIds: parseInvitedUserIds(formData),
    continuedPlayId: parseContinuedPlayId(formData),
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

// Kolejność kandydatów: najpierw najwięcej chętnych, przy remisie wygrywa gra
// z mniejszym oporem, a dopiero na końcu decyduje alfabet.
export function sortMeetingRanking<
  T extends { yesCount: number; noCount: number; title: string },
>(games: T[]) {
  return [...games].sort((left, right) => {
    if (right.yesCount !== left.yesCount) {
      return right.yesCount - left.yesCount;
    }

    if (left.noCount !== right.noCount) {
      return left.noCount - right.noCount;
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

  // Zaznaczone „dokończymy rozpoczętą grę”, ale bez wskazanej partii — bez
  // tego sprawdzenia spotkanie zapisałoby się po cichu bez kontynuacji.
  if (isContinuationRequested(formData) && !submittedValues.continuedPlayId) {
    pushError(
      fieldErrors,
      "continuedPlayId",
      "Wybierz partię, do której wracacie, albo odznacz kontynuację.",
    );
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
          invitedUserIds: submittedValues.invitedUserIds,
          continuedPlayId: submittedValues.continuedPlayId || null,
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
