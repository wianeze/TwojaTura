import {
  describeSupabaseTarget,
  PushDispatchError,
  toSafeErrorCode,
  toSafeErrorMessage,
} from "./dispatch-errors.ts";
import type { PushSendOutcome } from "./types";

/**
 * `complete_push_delivery` jest zadeklarowana jako `returns void` (w typach
 * generowanych: `Returns: undefined`), więc nie ma tu wyniku do sprawdzenia —
 * jedynym sygnałem powodzenia jest brak `error`. Gdyby funkcja kiedyś zaczęła
 * zwracać wartość, to jest miejsce, w którym trzeba dołożyć kontrolę `data`.
 */
export type CompleteRpcResult = {
  error: { code?: string | null; message?: string | null } | null;
};

export type CompleteDeliveryDeps = {
  callCompleteRpc: (
    deliveryId: string,
    outcome: PushSendOutcome,
  ) => Promise<CompleteRpcResult>;
  /** URL Supabase użyty przez klienta service_role — wyłącznie do diagnostyki. */
  supabaseUrl: string;
  logError?: (message: string) => void;
};

/**
 * Buduje `completeDelivery` dla pętli dispatchera.
 *
 * Wcześniej wynik tego RPC był ignorowany (`await client.rpc(...)` bez odczytu
 * `error`), a pętla łapała wyłącznie wyjątki. Klient Supabase w tej sytuacji
 * NIE rzuca — zwraca `{ error }` — więc nieudany zapis statusu przechodził
 * bezszelestnie i dostawa była doliczana do `sent`. Efekt: raport mówił
 * „wysłane”, a w bazie dostawa dalej wisiała w `processing` i po 10 minutach
 * wracała do kolejki, dając duplikat na urządzeniu.
 *
 * Teraz błąd kończy się rzuconym `push_dispatch_complete_failed`. Pętla łapie
 * go per dostawa, zlicza w `internalFailed` i przetwarza pozostałe urządzenia.
 */
export function createCompleteDelivery(
  deps: CompleteDeliveryDeps,
): (deliveryId: string, outcome: PushSendOutcome) => Promise<void> {
  const log = deps.logError ?? ((message: string) => console.error(message));

  return async (deliveryId, outcome) => {
    const { error } = await deps.callCompleteRpc(deliveryId, outcome);

    if (!error) return;

    const { hostname, projectRef } = describeSupabaseTarget(deps.supabaseUrl);

    // Log niesie wyłącznie identyfikatory własne (delivery_id to UUID z naszej
    // bazy) i adres projektu. Nigdy endpointu, p256dh, auth, klucza
    // service_role ani VAPID_PRIVATE_KEY — komunikat przechodzi przez
    // `toSafeErrorMessage`, które wycina URL-e i długie tokeny.
    log(
      `[push] push_dispatch_complete_failed code=${toSafeErrorCode(error.code)} deliveryId=${toSafeErrorCode(deliveryId)} outcome=${toSafeErrorCode(outcome.kind)} host=${hostname} projectRef=${projectRef} message=${toSafeErrorMessage(error)}`,
    );

    throw new PushDispatchError(
      "push_dispatch_complete_failed",
      "Nie udało się zapisać wyniku dostawy push.",
    );
  };
}
