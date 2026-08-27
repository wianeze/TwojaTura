export const PASSWORD_MIN_LENGTH = 8;
export const DISPLAY_NAME_MAX_LENGTH = 24;

export type ValidationResult<T> =
  { ok: true; data: T } | { ok: false; error: string };

export function validatePasswordChange(
  password: string,
  confirmation: string,
): ValidationResult<{ password: string }> {
  if (!password || !confirmation) {
    return { ok: false, error: "Uzupełnij oba pola hasła." };
  }
  if (password !== confirmation) {
    return { ok: false, error: "Podane hasła nie są takie same." };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      error: `Hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków.`,
    };
  }
  return { ok: true, data: { password } };
}

export function validateProfileInput(
  displayNameValue: string,
  avatarUrlValue: string,
): ValidationResult<{ displayName: string; avatarUrl: string | null }> {
  const displayName = displayNameValue.trim();
  const avatarUrl = avatarUrlValue.trim();

  if (!displayName) {
    return { ok: false, error: "Nazwa gracza nie może być pusta." };
  }
  if (displayName.length < 2) {
    return {
      ok: false,
      error: "Nazwa gracza musi mieć co najmniej 2 znaki.",
    };
  }
  if (/\s/.test(displayName)) {
    return {
      ok: false,
      error: "Nazwa gracza musi być jednym członem i nie może zawierać spacji.",
    };
  }
  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Nazwa gracza może mieć maksymalnie ${DISPLAY_NAME_MAX_LENGTH} znaków.`,
    };
  }
  if (avatarUrl) {
    try {
      const parsed = new URL(avatarUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Unsupported protocol");
      }
    } catch {
      return { ok: false, error: "Podaj poprawny adres URL avatara." };
    }
  }

  return {
    ok: true,
    data: { displayName, avatarUrl: avatarUrl || null },
  };
}
