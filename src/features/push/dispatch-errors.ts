/**
 * Błędy samego dispatchera — warstwa piętro wyżej niż `error-classification.ts`,
 * które zajmuje się wyłącznie odpowiedziami dostawców push dla pojedynczego
 * urządzenia.
 *
 * Rozróżnienie jest praktyczne: awaria jednego endpointu to normalny stan
 * kolejki i kończy się wpisem w `push_deliveries`. Awaria claimu albo braku
 * konfiguracji oznacza, że kolejka NIE ZOSTAŁA przetworzona w ogóle — i to
 * nie ma prawa wyglądać jak pusta kolejka.
 *
 * Plik jest celowo wolny od aliasów `@/`, importów `server-only` i zależności
 * runtime'owych, żeby dało się go uruchomić w `node --test`.
 */

export type PushDispatchErrorCode =
  | "push_dispatch_claim_failed"
  | "push_dispatch_complete_failed"
  | "push_dispatch_not_configured";

/**
 * Kontrolowany błąd dispatchera. Niesie wyłącznie kod maszynowy i już
 * zsanityzowane szczegóły diagnostyczne — nigdy oryginalnej treści błędu
 * Supabase, która mogłaby zawierać materiał subskrypcji.
 */
export class PushDispatchError extends Error {
  readonly code: PushDispatchErrorCode;

  constructor(code: PushDispatchErrorCode, message: string) {
    super(message);
    this.name = "PushDispatchError";
    this.code = code;
  }
}

export function isPushDispatchError(
  error: unknown,
): error is PushDispatchError {
  return error instanceof PushDispatchError;
}

const SAFE_CODE_CHARACTERS = /[^a-zA-Z0-9_:.-]/g;
const MAX_SAFE_MESSAGE_LENGTH = 200;

/**
 * Sufit długości tokenu w komunikacie. Endpointy, klucze p256dh/auth i JWT są
 * długimi ciągami bez spacji — obcięcie po długości łapie je nawet wtedy, gdy
 * nie wyglądają jak URL.
 */
const MAX_SAFE_TOKEN_LENGTH = 40;

export function toSafeErrorCode(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "brak_kodu";

  const sanitized = value.replace(SAFE_CODE_CHARACTERS, "").slice(0, 40);

  return sanitized.length > 0 ? sanitized : "brak_kodu";
}

/**
 * Komunikat błędu przycięty do postaci, którą wolno zapisać w logu.
 *
 * Zasada jest odwrotna niż „usuń znane sekrety”: przepuszczamy tylko krótkie
 * tokeny bez schematu URL, więc nowy, nieprzewidziany kształt danych wrażliwych
 * też zostanie wycięty.
 */
export function toSafeErrorMessage(value: unknown): string {
  const raw =
    typeof value === "string"
      ? value
      : value instanceof Error
        ? value.message
        : typeof value === "object" && value !== null
          ? typeof (value as { message?: unknown }).message === "string"
            ? (value as { message: string }).message
            : ""
          : "";

  if (raw.length === 0) return "brak treści błędu";

  const redacted = raw
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) =>
      token.includes("://") || token.length > MAX_SAFE_TOKEN_LENGTH
        ? "[usunięto]"
        : token,
    )
    .join(" ");

  return redacted.slice(0, MAX_SAFE_MESSAGE_LENGTH);
}

export type SupabaseTargetDescription = {
  hostname: string;
  projectRef: string;
};

/**
 * Host i identyfikator projektu wyciągnięte z URL-a Supabase — dokładnie tyle,
 * ile trzeba, żeby rozpoznać najczęstszą przyczynę tej awarii: klucz
 * service_role z innego projektu niż URL albo URL wskazujący na localhost
 * w środowisku produkcyjnym.
 *
 * URL Supabase nie jest sekretem (trafia do bundla jako NEXT_PUBLIC_), więc
 * zapisanie go w logu niczego nie ujawnia — w przeciwieństwie do klucza.
 */
export function describeSupabaseTarget(url: string): SupabaseTargetDescription {
  let hostname: string;

  try {
    hostname = new URL(url).hostname;
  } catch {
    return { hostname: "niepoprawny-url", projectRef: "nieznany" };
  }

  const [firstLabel, ...rest] = hostname.split(".");

  // Ref projektu to pierwszy człon hosta w domenie Supabase (np.
  // `abcdefghijklmnopqrst.supabase.co`). Adresy lokalne i IP nie mają refa.
  const looksLikeProjectRef =
    rest.length >= 2 && /^[a-z0-9]{16,}$/i.test(firstLabel);

  return {
    hostname,
    projectRef: looksLikeProjectRef ? firstLabel : "lokalny",
  };
}

export type PushDispatchHttpResponse = {
  status: number;
  body: { error: string };
};

/**
 * Odwzorowanie kontrolowanego błędu na odpowiedź HTTP Route Handlera.
 *
 * 503 dla braku konfiguracji (środowisko nie jest gotowe — cron ma odpuścić),
 * 500 dla nieudanego claimu (konfiguracja jest, ale baza odmówiła — to awaria
 * do zbadania). Nigdy 200: „przetworzono 0” zarezerwowane jest dla naprawdę
 * pustej kolejki.
 *
 * `push_dispatch_complete_failed` normalnie tu NIE dociera: awaria finalizacji
 * dotyczy pojedynczej dostawy, więc pętla łapie ją i zlicza w `internalFailed`,
 * a bieg kończy się 200 z podsumowaniem, w którym to pole jest niezerowe. Ta
 * gałąź istnieje dla przypadku, w którym ten sam kod wypłynąłby poza pętlę —
 * wtedy bieg jest nieudany i 500 jest właściwą odpowiedzią.
 */
export function pushDispatchErrorResponse(
  error: unknown,
): PushDispatchHttpResponse {
  if (isPushDispatchError(error)) {
    return {
      status: error.code === "push_dispatch_not_configured" ? 503 : 500,
      body: { error: error.code },
    };
  }

  return { status: 500, body: { error: "push_dispatch_claim_failed" } };
}

/**
 * Ostrzeżenie dla panelu administratora, gdy część wyników wysyłki nie została
 * zapisana. Świadomie mówi o ponowieniu, a nie o utracie: dostawa wisi
 * w `processing` i wróci do kolejki — czyli push może dojść po raz drugi.
 */
export const PUSH_INTERNAL_FAILURE_WARNING =
  "Część wyników wysyłki nie została poprawnie zapisana. Kolejka spróbuje odzyskać je ponownie.";

/** Komunikat dla administratora w panelu — bez szczegółów technicznych. */
export function pushDispatchErrorMessage(error: unknown): string {
  if (!isPushDispatchError(error)) {
    return "Dispatcher nie mógł przejąć kolejki wysyłek (push_dispatch_claim_failed). Dostawy czekają w kolejce — sprawdź logi serwera.";
  }

  switch (error.code) {
    case "push_dispatch_not_configured":
      return "Dispatcher powiadomień nie jest skonfigurowany (push_dispatch_not_configured). Sprawdź zmienne środowiskowe wdrożenia.";
    case "push_dispatch_complete_failed":
      return `Dispatcher nie zapisał wyników wysyłki (push_dispatch_complete_failed). ${PUSH_INTERNAL_FAILURE_WARNING}`;
    default:
      return "Dispatcher nie mógł przejąć kolejki wysyłek (push_dispatch_claim_failed). Dostawy czekają w kolejce — sprawdź logi serwera.";
  }
}
