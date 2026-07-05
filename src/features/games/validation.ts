import type { CurrentMember } from "@/features/auth/types";
import { parseGameExpansionDrafts } from "./expansions.ts";
import type {
  GameExpansionFormValue,
  GameFormFieldName,
  GameFormState,
  GameStatus,
  RatingFormFieldName,
} from "./types";

type FieldErrors<T extends string> = Partial<Record<T, string>>;

type GameValidationResult =
  | {
      ok: true;
      data: {
        title: string;
        coverUrl: string | null;
        bggUrl: string | null;
        bggRank: number | null;
        gameType: string | null;
        minPlayers: number | null;
        maxPlayers: number | null;
        playTimeMinutes: number | null;
        releaseYear: number | null;
        mechanics: string[];
        categories: string[];
        bggWeight: number | null;
        minAge: number | null;
        designer: string | null;
        publisher: string | null;
        expansions: GameExpansionFormValue[];
        description: string | null;
        status: GameStatus;
        ownerId: string;
        currentHolderId: string | null;
      };
    }
  | {
      ok: false;
      message: string;
      fieldErrors: FieldErrors<GameFormFieldName>;
    };

type RatingValidationResult =
  | {
      ok: true;
      data: {
        overall: number;
        replayability: number;
        theme: number;
        wantsToPlayAgain: boolean;
        comment: string | null;
      };
    }
  | {
      ok: false;
      message: string;
      fieldErrors: FieldErrors<RatingFormFieldName>;
    };

type ActiveMemberLike = Pick<CurrentMember, "id" | "role">;

const VALID_STATUSES = new Set<GameStatus>([
  "available",
  "unavailable",
  "loaned",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function isSafeLocalPublicPath(input: string) {
  return input.startsWith("/") && !input.startsWith("//");
}

function isHttpUrl(input: string) {
  try {
    const url = new URL(input);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateCoverUrl(
  rawValue: string,
  errors: FieldErrors<GameFormFieldName>,
) {
  const normalized = rawValue.trim();
  if (!normalized) return null;

  if (isSafeLocalPublicPath(normalized) || isHttpUrl(normalized)) {
    return normalized;
  }

  pushError(
    errors,
    "coverUrl",
    "Podaj poprawny adres okładki albo lokalną ścieżkę zaczynającą się od /.",
  );
  return null;
}

function validateHttpUrl(
  rawValue: string,
  field: "bggUrl",
  errors: FieldErrors<GameFormFieldName>,
) {
  const normalized = rawValue.trim();
  if (!normalized) return null;

  if (isHttpUrl(normalized)) {
    return normalized;
  }

  pushError(
    errors,
    field,
    "Podaj poprawny adres URL zaczynający się od http lub https.",
  );
  return null;
}

function parsePositiveInteger(
  rawValue: string,
  field: GameFormFieldName,
  errors: FieldErrors<GameFormFieldName>,
  message: string,
) {
  const normalized = rawValue.trim();
  if (!normalized) return null;
  if (!/^\d+$/.test(normalized)) {
    pushError(errors, field, message);
    return null;
  }

  const value = Number.parseInt(normalized, 10);
  if (value <= 0) {
    pushError(errors, field, message);
    return null;
  }

  return value;
}

function parseNullableIntegerInRange(
  rawValue: string,
  field: GameFormFieldName,
  errors: FieldErrors<GameFormFieldName>,
  {
    min,
    max,
    message,
  }: {
    min: number;
    max?: number;
    message: string;
  },
) {
  const normalized = rawValue.trim();
  if (!normalized) return null;
  if (!/^\d+$/.test(normalized)) {
    pushError(errors, field, message);
    return null;
  }

  const value = Number.parseInt(normalized, 10);
  if (value < min || (typeof max === "number" && value > max)) {
    pushError(errors, field, message);
    return null;
  }

  return value;
}

function parseWeight(rawValue: string, errors: FieldErrors<GameFormFieldName>) {
  const normalized = rawValue.trim().replace(",", ".");
  if (!normalized) return null;
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    pushError(errors, "bggWeight", "Trudność BGG musi być liczbą od 1 do 5.");
    return null;
  }

  const value = Number.parseFloat(normalized);
  if (value < 1 || value > 5) {
    pushError(errors, "bggWeight", "Trudność BGG musi być liczbą od 1 do 5.");
    return null;
  }

  return Number(value.toFixed(2));
}

function parseTagList(rawValue: string) {
  const unique = new Map<string, string>();
  for (const chunk of rawValue.split(/[\n,]/)) {
    const normalized = chunk.trim();
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase("pl-PL");
    if (!unique.has(key)) {
      unique.set(key, normalized);
    }
  }

  return [...unique.values()];
}

function parseUuid(
  rawValue: string,
  field: GameFormFieldName,
  errors: FieldErrors<GameFormFieldName>,
  required = false,
) {
  const normalized = rawValue.trim();
  if (!normalized) {
    if (required) {
      pushError(errors, field, "Wybierz użytkownika z listy.");
    }
    return null;
  }

  if (!UUID_PATTERN.test(normalized)) {
    pushError(errors, field, "Wybierz użytkownika z listy.");
    return null;
  }

  return normalized;
}

export function validateGameFormData(
  formData: FormData,
  actor: ActiveMemberLike,
  activeMemberIds: string[],
  mode: "create" | "update",
): GameValidationResult {
  const fieldErrors: FieldErrors<GameFormFieldName> = {};
  const title = value(formData, "title").trim();
  const isAdmin = actor.role === "admin";

  if (!title) {
    pushError(fieldErrors, "title", "Podaj tytuł gry.");
  }

  const ownerId =
    isAdmin && mode === "update"
      ? parseUuid(value(formData, "ownerId"), "ownerId", fieldErrors, true)
      : actor.id;

  const statusValue = value(formData, "status").trim();
  const status = VALID_STATUSES.has(statusValue as GameStatus)
    ? (statusValue as GameStatus)
    : null;

  if (!status) {
    pushError(fieldErrors, "status", "Wybierz poprawny status.");
  }

  const coverUrl = validateCoverUrl(value(formData, "coverUrl"), fieldErrors);
  const bggUrl = validateHttpUrl(
    value(formData, "bggUrl"),
    "bggUrl",
    fieldErrors,
  );
  const bggRank = parsePositiveInteger(
    value(formData, "bggRank"),
    "bggRank",
    fieldErrors,
    "BGG Rank musi być dodatnią liczbą całkowitą.",
  );
  const minPlayers = parsePositiveInteger(
    value(formData, "minPlayers"),
    "minPlayers",
    fieldErrors,
    "Minimum graczy musi być dodatnią liczbą całkowitą.",
  );
  const maxPlayers = parsePositiveInteger(
    value(formData, "maxPlayers"),
    "maxPlayers",
    fieldErrors,
    "Maksimum graczy musi być dodatnią liczbą całkowitą.",
  );
  const playTimeMinutes = parsePositiveInteger(
    value(formData, "playTimeMinutes"),
    "playTimeMinutes",
    fieldErrors,
    "Czas gry musi być dodatnią liczbą całkowitą.",
  );
  const releaseYear = parseNullableIntegerInRange(
    value(formData, "releaseYear"),
    "releaseYear",
    fieldErrors,
    {
      min: 1900,
      max: 2100,
      message: "Rok wydania musi mieścić się w zakresie 1900–2100.",
    },
  );
  const bggWeight = parseWeight(value(formData, "bggWeight"), fieldErrors);
  const minAge = parseNullableIntegerInRange(
    value(formData, "minAge"),
    "minAge",
    fieldErrors,
    {
      min: 0,
      message: "Minimalny wiek nie może być ujemny.",
    },
  );

  if (minPlayers !== null && maxPlayers !== null && minPlayers > maxPlayers) {
    pushError(
      fieldErrors,
      "maxPlayers",
      "Maksymalna liczba graczy nie może być mniejsza niż minimalna.",
    );
  }

  const currentHolderId =
    parseUuid(
      value(formData, "currentHolderId"),
      "currentHolderId",
      fieldErrors,
    ) ?? (mode === "create" ? actor.id : null);

  const mechanics = parseTagList(value(formData, "mechanics"));
  const categories = parseTagList(value(formData, "categories"));
  const gameType = normalizeNullableText(value(formData, "gameType"));
  const designer = normalizeNullableText(value(formData, "designer"));
  const publisher = normalizeNullableText(value(formData, "publisher"));
  const parsedExpansions = parseGameExpansionDrafts(
    value(formData, "expansions"),
  );
  const description = normalizeNullableText(value(formData, "description"));

  if (!parsedExpansions.ok) {
    pushError(fieldErrors, "expansions", parsedExpansions.message);
  }

  const activeMemberSet = new Set(activeMemberIds);
  if (typeof ownerId === "string" && !activeMemberSet.has(ownerId)) {
    pushError(
      fieldErrors,
      "ownerId",
      "Właściciel musi być aktywnym członkiem grupy.",
    );
  }

  if (currentHolderId && !activeMemberSet.has(currentHolderId)) {
    pushError(
      fieldErrors,
      "currentHolderId",
      "Aktualny posiadacz musi być aktywnym członkiem grupy.",
    );
  }

  if (
    status === "loaned" &&
    (!currentHolderId || currentHolderId === ownerId)
  ) {
    pushError(
      fieldErrors,
      "currentHolderId",
      "Dla statusu „pożyczona” wskaż inną osobę, która ma grę aktualnie.",
    );
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    !status ||
    typeof ownerId !== "string"
  ) {
    return {
      ok: false,
      message: "Popraw pola formularza i spróbuj ponownie.",
      fieldErrors,
    };
  }

  return {
    ok: true,
    data: {
      title,
      coverUrl,
      bggUrl,
      bggRank,
      gameType,
      minPlayers,
      maxPlayers,
      playTimeMinutes,
      releaseYear,
      mechanics,
      categories,
      bggWeight,
      minAge,
      designer,
      publisher,
      expansions: parsedExpansions.ok ? parsedExpansions.data : [],
      description,
      status,
      ownerId,
      currentHolderId,
    },
  };
}

function parseRatingInteger(
  rawValue: string,
  field: Exclude<RatingFormFieldName, "wantsToPlayAgain" | "comment">,
  errors: FieldErrors<RatingFormFieldName>,
) {
  const normalized = rawValue.trim();
  if (!/^\d+$/.test(normalized)) {
    pushError(errors, field, "Wybierz ocenę od 1 do 10.");
    return null;
  }

  const value = Number.parseInt(normalized, 10);
  if (value < 1 || value > 10) {
    pushError(errors, field, "Wybierz ocenę od 1 do 10.");
    return null;
  }

  return value;
}

export function validateRatingFormData(
  formData: FormData,
): RatingValidationResult {
  const fieldErrors: FieldErrors<RatingFormFieldName> = {};

  const overall = parseRatingInteger(
    value(formData, "overall"),
    "overall",
    fieldErrors,
  );
  const replayability = parseRatingInteger(
    value(formData, "replayability"),
    "replayability",
    fieldErrors,
  );
  const theme = parseRatingInteger(
    value(formData, "theme"),
    "theme",
    fieldErrors,
  );

  const wantsToPlayAgainValue = value(formData, "wantsToPlayAgain").trim();
  const wantsToPlayAgain =
    wantsToPlayAgainValue === "true"
      ? true
      : wantsToPlayAgainValue === "false"
        ? false
        : null;

  if (wantsToPlayAgain === null) {
    pushError(
      fieldErrors,
      "wantsToPlayAgain",
      "Wybierz, czy chcesz zagrać ponownie.",
    );
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    overall === null ||
    replayability === null ||
    theme === null ||
    wantsToPlayAgain === null
  ) {
    return {
      ok: false,
      message: "Popraw ocenę i spróbuj ponownie.",
      fieldErrors,
    };
  }

  return {
    ok: true,
    data: {
      overall,
      replayability,
      theme,
      wantsToPlayAgain,
      comment: normalizeNullableText(value(formData, "comment")),
    },
  };
}

export function toGameFormErrorState(
  validation: Extract<GameValidationResult, { ok: false }>,
): GameFormState {
  return {
    status: "error",
    message: validation.message,
    fieldErrors: validation.fieldErrors,
  };
}
