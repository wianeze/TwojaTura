import type { PushCampaignFieldName } from "./types";

export const PUSH_TITLE_MAX_LENGTH = 80;
export const PUSH_BODY_MAX_LENGTH = 300;
export const PUSH_ACTION_URL_MAX_LENGTH = 300;

const CONTROL_CHARACTER_MAX = 0x1f;
const DELETE_CHARACTER = 0x7f;

// Sprawdzenie po kodzie znaku zamiast klasy znaków w regexie: zakres
// sterujących zapisany dosłownie oznaczałby niewidoczne bajty w źródle.
function isControlCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) return false;
  return codePoint <= CONTROL_CHARACTER_MAX || codePoint === DELETE_CHARACTER;
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    if (isControlCharacter(character)) return true;
  }
  return false;
}

function stripControlCharacters(
  value: string,
  { keepNewlines }: { keepNewlines: boolean },
): string {
  let result = "";

  for (const character of value) {
    if (keepNewlines && character === "\n") {
      result += character;
      continue;
    }

    if (isControlCharacter(character)) {
      // W tytule znak sterujący sklejałby sąsiednie słowa, więc zostawiamy
      // po nim spację; w treści nowe linie i tak są zachowane osobno.
      result += keepNewlines ? "" : " ";
      continue;
    }

    result += character;
  }

  return result;
}

/**
 * Tytuł i treść trafiają wyłącznie do `showNotification(title, { body })`,
 * które renderuje je jako czysty tekst, a podgląd w panelu admina przechodzi
 * przez zwykłą interpolację JSX. W całej ścieżce nie ma HTML ani
 * dangerouslySetInnerHTML, więc świadomie NIE odrzucamy `<` i `>` — inaczej
 * nie dałoby się napisać „Zostało < 5 miejsc”. Usuwamy tylko znaki sterujące,
 * bo te potrafią rozjechać wyświetlanie powiadomienia systemowego.
 */
export function normalizePlainText(
  value: string,
  options: { allowNewlines?: boolean } = {},
): string {
  const unified = value.replace(/\r\n?/g, "\n");

  if (options.allowNewlines) {
    return stripControlCharacters(unified, { keepNewlines: true })
      .replace(/[^\S\n]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  return stripControlCharacters(unified, { keepNewlines: false })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cel kliknięcia musi zostać wewnątrz aplikacji. Odrzucamy adresy
 * bezwzględne, protocol-relative (`//host`) oraz warianty z backslashem,
 * którymi przeglądarki potrafią dojść do obcego originu.
 *
 * Ta sama reguła jest powtórzona jako `check` w `push_campaigns` i jako
 * walidacja w service workerze — celowo, bo każda z tych warstw może zostać
 * ominięta osobno.
 */
export function isSafeInternalPath(value: string): boolean {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > PUSH_ACTION_URL_MAX_LENGTH) {
    return false;
  }
  if (hasControlCharacter(value)) return false;

  if (value === "/") return true;
  if (!value.startsWith("/")) return false;
  if (value[1] === "/" || value[1] === "\\") return false;
  if (value.includes("://")) return false;

  return true;
}

export type PushCampaignInput = {
  title: string;
  body: string;
  actionUrl: string | null;
  templateKey: string | null;
  recipientUserIds: string[] | null;
  idempotencyKey: string;
};

export type PushCampaignValidationResult =
  | { ok: true; data: PushCampaignInput }
  | {
      ok: false;
      message: string;
      fieldErrors: Partial<Record<PushCampaignFieldName, string>>;
    };

function readValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function validatePushCampaignInput(
  formData: FormData,
): PushCampaignValidationResult {
  const fieldErrors: Partial<Record<PushCampaignFieldName, string>> = {};

  const title = normalizePlainText(readValue(formData, "title"));
  const body = normalizePlainText(readValue(formData, "body"), {
    allowNewlines: true,
  });

  if (title.length === 0) {
    fieldErrors.title = "Podaj tytuł powiadomienia.";
  } else if (title.length > PUSH_TITLE_MAX_LENGTH) {
    fieldErrors.title = `Tytuł może mieć najwyżej ${PUSH_TITLE_MAX_LENGTH} znaków.`;
  }

  if (body.length === 0) {
    fieldErrors.body = "Podaj treść powiadomienia.";
  } else if (body.length > PUSH_BODY_MAX_LENGTH) {
    fieldErrors.body = `Treść może mieć najwyżej ${PUSH_BODY_MAX_LENGTH} znaków.`;
  }

  const rawActionUrl = readValue(formData, "actionUrl").trim();
  let actionUrl: string | null = null;

  if (rawActionUrl.length > 0) {
    if (!isSafeInternalPath(rawActionUrl)) {
      fieldErrors.actionUrl =
        "Podaj ścieżkę wewnątrz aplikacji, zaczynającą się od „/”.";
    } else {
      actionUrl = rawActionUrl;
    }
  }

  const recipientMode = readValue(formData, "recipientMode");
  let recipientUserIds: string[] | null = null;

  if (recipientMode === "selected") {
    const selected = formData
      .getAll("recipientUserIds")
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    recipientUserIds = Array.from(new Set(selected));

    if (recipientUserIds.length === 0) {
      fieldErrors.recipients = "Wybierz co najmniej jednego odbiorcę.";
    }
  } else if (recipientMode !== "all") {
    fieldErrors.recipients = "Wybierz odbiorców powiadomienia.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Popraw formularz i spróbuj ponownie.",
      fieldErrors,
    };
  }

  // Token idempotencji powstaje w formularzu przed otwarciem modala. Jego brak
  // oznacza rozjechany stan klienta, a nie błąd konkretnego pola.
  const idempotencyKey = readValue(formData, "idempotencyKey").trim();

  if (idempotencyKey.length === 0) {
    return {
      ok: false,
      message: "Odśwież stronę i spróbuj ponownie.",
      fieldErrors: {},
    };
  }

  const templateKey = readValue(formData, "templateKey").trim();

  return {
    ok: true,
    data: {
      title,
      body,
      actionUrl,
      templateKey: templateKey.length > 0 ? templateKey : null,
      recipientUserIds,
      idempotencyKey,
    },
  };
}
