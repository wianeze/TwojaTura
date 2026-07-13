import type {
  PlayFormFieldName,
  PlayFormState,
  PlayFormValues,
  PlayParticipantDraft,
  PlayParticipantFieldError,
} from "./types";

type FieldErrors<T extends string> = Partial<Record<T, string>>;

type PlayValidationSuccess = {
  ok: true;
  data: {
    gameId: string;
    meetingId: string | null;
    playedAt: string;
    durationMinutes: number | null;
    comment: string | null;
    participants: Array<{
      userId: string;
      isWinner: boolean;
      placement: number | null;
      score: number | null;
    }>;
  };
};

type PlayValidationFailure = {
  ok: false;
  message: string;
  fieldErrors: FieldErrors<PlayFormFieldName>;
  participantFieldErrors: Record<string, PlayParticipantFieldError>;
  submittedValues: PlayFormValues;
};

export type PlayValidationResult =
  PlayValidationSuccess | PlayValidationFailure;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function pushParticipantError(
  errors: Record<string, PlayParticipantFieldError>,
  userId: string,
  field: keyof PlayParticipantFieldError,
  message: string,
) {
  if (!errors[userId]) {
    errors[userId] = {};
  }
  if (!errors[userId]![field]) {
    errors[userId]![field] = message;
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

function parsePositiveInteger(
  rawValue: string,
  field: PlayFormFieldName,
  errors: FieldErrors<PlayFormFieldName>,
  message: string,
) {
  const normalized = rawValue.trim();
  if (!normalized) return null;
  if (!/^\d+$/.test(normalized)) {
    pushError(errors, field, message);
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (parsed <= 0) {
    pushError(errors, field, message);
    return null;
  }

  return parsed;
}

function parseScore(
  rawValue: string,
  userId: string,
  errors: Record<string, PlayParticipantFieldError>,
) {
  const normalized = rawValue.trim().replace(",", ".");
  if (!normalized) return null;
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    pushParticipantError(
      errors,
      userId,
      "score",
      "Wynik musi być liczbą albo pustym polem.",
    );
    return null;
  }

  return Number(normalized);
}

function parsePlacement(
  rawValue: string,
  userId: string,
  errors: Record<string, PlayParticipantFieldError>,
) {
  const normalized = rawValue.trim();
  if (!normalized) return null;
  if (!/^\d+$/.test(normalized)) {
    pushParticipantError(
      errors,
      userId,
      "placement",
      "Miejsce musi być dodatnią liczbą całkowitą.",
    );
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (parsed <= 0) {
    pushParticipantError(
      errors,
      userId,
      "placement",
      "Miejsce musi być dodatnią liczbą całkowitą.",
    );
    return null;
  }

  return parsed;
}

function parseParticipantDrafts(rawValue: string) {
  const normalized = rawValue.trim();
  if (!normalized) {
    return { ok: true as const, data: [] as PlayParticipantDraft[] };
  }

  try {
    const parsed = JSON.parse(normalized);
    if (!Array.isArray(parsed)) {
      return {
        ok: false as const,
        message: "Lista graczy ma nieprawidłowy format.",
      };
    }

    const data = parsed.map((entry) => ({
      userId: typeof entry?.userId === "string" ? entry.userId.trim() : "",
      isWinner: Boolean(entry?.isWinner),
      placement:
        entry?.placement === null || entry?.placement === undefined
          ? ""
          : String(entry.placement),
      score:
        entry?.score === null || entry?.score === undefined
          ? ""
          : String(entry.score),
    }));

    return { ok: true as const, data };
  } catch {
    return {
      ok: false as const,
      message: "Lista graczy ma nieprawidłowy format.",
    };
  }
}

export function buildPlaySubmittedValues(formData: FormData): PlayFormValues {
  const parsedParticipants = parseParticipantDrafts(
    value(formData, "participants"),
  );

  return {
    gameId: value(formData, "gameId"),
    meetingId: value(formData, "meetingId"),
    playedOnDate: value(formData, "playedOnDate"),
    playedOnTime: value(formData, "playedOnTime"),
    durationMinutes: value(formData, "durationMinutes"),
    comment: value(formData, "comment"),
    participants: parsedParticipants.ok ? parsedParticipants.data : [],
  };
}

export function validatePlayFormData(
  formData: FormData,
  activeMemberIds: string[],
): PlayValidationResult {
  const submittedValues = buildPlaySubmittedValues(formData);
  const fieldErrors: FieldErrors<PlayFormFieldName> = {};
  const participantFieldErrors: Record<string, PlayParticipantFieldError> = {};
  const activeMemberSet = new Set(activeMemberIds);

  const gameId = submittedValues.gameId.trim();
  if (!UUID_PATTERN.test(gameId)) {
    pushError(fieldErrors, "gameId", "Wybierz grę z listy.");
  }

  const meetingId = submittedValues.meetingId.trim();
  if (meetingId && !UUID_PATTERN.test(meetingId)) {
    pushError(
      fieldErrors,
      "meetingId",
      "Wybierz spotkanie z listy albo zostaw puste pole.",
    );
  }

  const playedDate = parsePolishDate(submittedValues.playedOnDate);
  if (!playedDate) {
    pushError(
      fieldErrors,
      "playedOnDate",
      "Podaj poprawną datę w formacie dd/MM/rrrr.",
    );
  }

  const playedTime = parseTime(submittedValues.playedOnTime);
  if (!playedTime) {
    pushError(
      fieldErrors,
      "playedOnTime",
      "Podaj godzinę w formacie 24h HH:mm.",
    );
  }

  const durationMinutes = parsePositiveInteger(
    submittedValues.durationMinutes,
    "durationMinutes",
    fieldErrors,
    "Czas gry musi być dodatnią liczbą całkowitą.",
  );

  const parsedParticipants = parseParticipantDrafts(
    value(formData, "participants"),
  );
  if (!parsedParticipants.ok) {
    pushError(fieldErrors, "participants", parsedParticipants.message);
  }

  const participants = parsedParticipants.ok ? parsedParticipants.data : [];
  const seen = new Set<string>();
  let winnersCount = 0;

  const normalizedParticipants = participants.map((participant) => {
    if (!participant.userId || !UUID_PATTERN.test(participant.userId)) {
      pushError(
        fieldErrors,
        "participants",
        "Każdy wybrany gracz musi pochodzić z listy członków.",
      );
    } else if (!activeMemberSet.has(participant.userId)) {
      pushError(
        fieldErrors,
        "participants",
        "Lista graczy może zawierać tylko aktywnych członków grupy.",
      );
    }

    if (seen.has(participant.userId)) {
      pushError(
        fieldErrors,
        "participants",
        "Ten sam gracz nie może zostać dodany dwa razy do jednej partii.",
      );
    }
    seen.add(participant.userId);

    const placement = parsePlacement(
      participant.placement,
      participant.userId,
      participantFieldErrors,
    );

    const score = parseScore(
      participant.score,
      participant.userId,
      participantFieldErrors,
    );

    if (participant.isWinner) {
      winnersCount += 1;
    }

    return {
      userId: participant.userId,
      isWinner: participant.isWinner,
      placement: participant.placement.trim() ? placement : null,
      score: participant.score.trim() ? score : null,
    };
  });

  if (participants.length === 0) {
    pushError(
      fieldErrors,
      "participants",
      "Dodaj przynajmniej jednego gracza do tej partii.",
    );
  }

  if (participants.length > 0 && winnersCount === 0) {
    pushError(
      fieldErrors,
      "participants",
      "Zaznacz przynajmniej jednego zwycięzcę.",
    );
  }

  if (
    Object.keys(fieldErrors).length === 0 &&
    Object.keys(participantFieldErrors).length === 0 &&
    playedDate &&
    playedTime
  ) {
    return {
      ok: true,
      data: {
        gameId,
        meetingId: meetingId || null,
        playedAt: toWarsawIso(playedDate, playedTime),
        durationMinutes,
        comment: normalizeNullableText(submittedValues.comment),
        participants: normalizedParticipants.map((participant) => ({
          userId: participant.userId,
          isWinner: participant.isWinner,
          placement: participant.placement,
          score: participant.score,
        })),
      },
    };
  }

  return {
    ok: false,
    message: "Popraw formularz partii i spróbuj ponownie.",
    fieldErrors,
    participantFieldErrors,
    submittedValues,
  };
}

export function toPlayFormErrorState(
  validation: PlayValidationFailure,
): PlayFormState {
  return {
    status: "error",
    message: validation.message,
    fieldErrors: validation.fieldErrors,
    participantFieldErrors: validation.participantFieldErrors,
    submittedValues: validation.submittedValues,
  };
}
