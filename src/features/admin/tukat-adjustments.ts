/**
 * Korekty Tukatów — warstwa czysta panelu administratora.
 *
 * Odpowiednik `point-adjustments.ts` dla drugiej waluty. Wszystko, co da się
 * rozstrzygnąć bez bazy (kształt kwoty, długość notatki, tłumaczenie błędu
 * z RPC na zdanie po polsku), mieszka tutaj i jest testowane jednostkowo.
 * Reguła ekonomiczna — zakaz zera i zakaz zejścia poniżej zera — jest i tak
 * egzekwowana w SQL; ta walidacja tylko oszczędza użytkownikowi round-tripa.
 */

export type AdminTukatOperation = "grant" | "revoke";

export type AdminTukatAdjustmentRow = {
  adjustmentId: string;
  adminUserId: string;
  adminDisplayName: string;
  targetUserId: string;
  targetDisplayName: string;
  operation: AdminTukatOperation;
  delta: number;
  reason: string | null;
  createdAt: string;
};

/** Saldo z widoku `tukat_balances`, czyli z sumy append-only ledgera. */
export type AdminTukatBalanceRow = {
  userId: string;
  totalTukats: number;
};

/**
 * Sufit pojedynczej korekty. To nie jest reguła balansu ekonomii, tylko
 * bezpiecznik na literówkę w polu liczbowym — i zarazem gwarancja, że kwota
 * mieści się w `integer` po stronie ledgera.
 */
export const TUKAT_ADJUSTMENT_MAX_AMOUNT = 100_000;

export const TUKAT_ADJUSTMENT_REASON_MAX_LENGTH = 500;

/**
 * Identyfikator gracza przychodzi Z BAZY i jego wersja nie jest naszą decyzją.
 * Konta zaproszone przez Supabase Auth dostają UUID v4, ale konta zakładane w
 * seedzie i fixture'ach QA mają identyfikatory w rodzaju
 * `10000000-0000-0000-0000-000000000002` — poprawne UUID-y co do kształtu, za
 * to bez nibbli wersji i wariantu wymaganych przez RFC 4122.
 *
 * Sprawdzanie tu wersji odrzucało KAŻDEGO takiego gracza komunikatem „Wybierz
 * gracza.”, mimo że select podawał prawidłowe `user_id` — walidacja ucinała
 * korektę, zanim żądanie dotarło do `admin_adjust_tukats`. Bramką tożsamości
 * jest i tak baza (klucz obcy na `profiles` plus `is_gamification_eligible`),
 * więc tutaj weryfikujemy KSZTAŁT, nie wersję.
 */
const USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Klucz idempotencji generuje panel przez `crypto.randomUUID()`, więc pełny
 * kształt RFC 4122 jest tu realnym niezmiennikiem, a nie formalnością: wartość
 * spoza niego oznacza klucz wpisany ręcznie albo współdzielony między
 * korektami, czyli dokładnie to, przed czym idempotencja ma chronić.
 */
const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AdjustmentInput = {
  targetUserId: string;
  operation: AdminTukatOperation;
  /** Wartość prosto z pola formularza — zawsze dodatnia, znak daje operacja. */
  amount: string;
  reason?: string;
  requestId: string;
};

function validateReason(reason?: string) {
  const normalized = reason?.trim() ?? "";
  if (normalized.length > TUKAT_ADJUSTMENT_REASON_MAX_LENGTH) {
    return {
      ok: false as const,
      message: `Powód może mieć maksymalnie ${TUKAT_ADJUSTMENT_REASON_MAX_LENGTH} znaków.`,
    };
  }
  return { ok: true as const, value: normalized || undefined };
}

export function validateAdminTukatAdjustment(input: AdjustmentInput) {
  if (!USER_ID_PATTERN.test(input.targetUserId)) {
    return { ok: false as const, message: "Wybierz gracza." };
  }
  if (input.operation !== "grant" && input.operation !== "revoke") {
    return { ok: false as const, message: "Wybierz Nadaj albo Odbierz." };
  }
  if (!REQUEST_ID_PATTERN.test(input.requestId)) {
    return {
      ok: false as const,
      message: "Nieprawidłowy identyfikator żądania.",
    };
  }

  const rawAmount = input.amount.trim();
  if (rawAmount.length === 0) {
    return { ok: false as const, message: "Podaj liczbę Tukatów." };
  }
  if (!/^-?\d+$/.test(rawAmount)) {
    return {
      ok: false as const,
      message: "Liczba Tukatów musi być liczbą całkowitą.",
    };
  }

  const amount = Number.parseInt(rawAmount, 10);
  if (amount === 0) {
    return {
      ok: false as const,
      message: "Korekta o zero Tukatów nic nie zmienia — podaj inną liczbę.",
    };
  }
  if (amount < 0) {
    return {
      ok: false as const,
      message: "Podaj liczbę dodatnią — kierunek wybiera Nadaj albo Odbierz.",
    };
  }
  if (amount > TUKAT_ADJUSTMENT_MAX_AMOUNT) {
    return {
      ok: false as const,
      message: `Jednorazowa korekta nie może przekroczyć ${TUKAT_ADJUSTMENT_MAX_AMOUNT.toLocaleString("pl-PL")} Tukatów.`,
    };
  }

  const reason = validateReason(input.reason);
  if (!reason.ok) return reason;

  return {
    ok: true as const,
    value: {
      targetUserId: input.targetUserId,
      delta: input.operation === "grant" ? amount : -amount,
      reason: reason.value,
      requestId: input.requestId,
    },
  };
}

const BELOW_ZERO_PATTERN =
  /balance cannot fall below zero \(balance (-?\d+), requested (-?\d+)\)/;

/**
 * Błędy z `admin_adjust_tukats` są po angielsku (jak w całej warstwie SQL) —
 * panel widzi administrator, więc muszą zostać zdaniami po polsku. Przypadek
 * salda tłumaczymy z liczbami z treści błędu, żeby komunikat mówił, ile
 * dokładnie zabrakło, zamiast ogólnego „operacja odrzucona”.
 */
export function translateTukatAdjustmentError(error: {
  code?: string | null;
  message: string;
}) {
  const belowZero = BELOW_ZERO_PATTERN.exec(error.message);
  if (belowZero) {
    const balance = Number.parseInt(belowZero[1], 10);
    const requested = Math.abs(Number.parseInt(belowZero[2], 10));
    return `Nie można odebrać ${requested.toLocaleString("pl-PL")} Tukatów — gracz ma ${balance.toLocaleString("pl-PL")}. Saldo nie może spaść poniżej zera.`;
  }

  if (error.message.includes("Tukat adjustment must not be zero")) {
    return "Korekta o zero Tukatów nic nie zmienia — podaj inną liczbę.";
  }
  if (error.message.includes("Tukat recipient must be an active player")) {
    return "Tukaty może dostać wyłącznie aktywny gracz.";
  }
  if (error.message.includes("Administrator access is required")) {
    return "Wymagane uprawnienia administratora.";
  }
  if (error.message.includes("Request id has already been used")) {
    return "Ten identyfikator korekty został już użyty do innej operacji.";
  }

  return error.message;
}

/**
 * Liczba Tukatów w tekście. Aplikacja używa wszędzie nieodmiennej formy
 * „Tukatów” (patrz karta Misji na Stole) — trzymamy się jej, zamiast wprowadzać
 * drugą konwencję tylko w panelu.
 */
export function formatTukats(amount: number) {
  return `${amount.toLocaleString("pl-PL")} Tukatów`;
}

export function formatTukatDelta(delta: number) {
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${formatTukats(Math.abs(delta))}`;
}

export function formatAdminTukatAdjustmentTitle(
  adjustment: Pick<AdminTukatAdjustmentRow, "targetDisplayName" | "operation">,
) {
  return `${adjustment.targetDisplayName} · ${
    adjustment.operation === "grant" ? "Nadanie" : "Odebranie"
  }`;
}
