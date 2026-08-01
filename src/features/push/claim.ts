import {
  describeSupabaseTarget,
  PushDispatchError,
  toSafeErrorCode,
  toSafeErrorMessage,
} from "./dispatch-errors.ts";
import type { PushDeliveryTask } from "./dispatch-loop.ts";

/**
 * Wiersz zwracany przez `claim_push_deliveries`. Kształt jest tu powtórzony
 * strukturalnie (a nie zaimportowany z `database.generated`), bo ten plik musi
 * dawać się uruchomić bez aliasów `@/` w `node --test`. Typ generowany i tak
 * pilnuje zgodności w miejscu wywołania.
 */
export type ClaimedDeliveryRow = {
  delivery_id: string;
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
  title: string;
  body: string;
  action_url: string | null;
  attempt_count: number;
};

export type ClaimRpcResult = {
  data: ClaimedDeliveryRow[] | null;
  error: { code?: string | null; message?: string | null } | null;
};

export type ClaimDeliveriesDeps = {
  callClaimRpc: (limit: number) => Promise<ClaimRpcResult>;
  /** URL Supabase użyty przez klienta service_role — wyłącznie do diagnostyki. */
  supabaseUrl: string;
  logError?: (message: string) => void;
};

/**
 * Buduje `claimDeliveries` dla pętli dispatchera.
 *
 * Kluczowa zasada: błąd RPC NIE jest pustą partią. Wcześniejsza wersja robiła
 * `if (error) return []`, przez co awaria uprawnień, nieistniejąca funkcja albo
 * klient wskazujący na inny projekt kończyły się sumarium `claimed: 0` —
 * nieodróżnialnym od poprawnie pustej kolejki. Teraz każdy błąd claimu kończy
 * bieg kontrolowanym `push_dispatch_claim_failed`.
 *
 * `data === null` bez błędu traktujemy tak samo: RPC deklaruje zwrot tabeli,
 * więc brak wiersza to pusta tablica, a `null` oznacza, że coś poszło nie tak
 * po drodze.
 */
export function createClaimDeliveries(
  deps: ClaimDeliveriesDeps,
): (limit: number) => Promise<PushDeliveryTask[]> {
  const log = deps.logError ?? ((message: string) => console.error(message));

  return async (limit) => {
    const { data, error } = await deps.callClaimRpc(limit);

    if (error || !data) {
      const { hostname, projectRef } = describeSupabaseTarget(deps.supabaseUrl);

      // Log zawiera wyłącznie: kod błędu, przycięty komunikat oraz adres
      // projektu Supabase. Nigdy klucza service_role, endpointu subskrypcji
      // ani kluczy p256dh/auth.
      log(
        `[push] push_dispatch_claim_failed code=${toSafeErrorCode(error?.code)} host=${hostname} projectRef=${projectRef} message=${toSafeErrorMessage(error)}`,
      );

      throw new PushDispatchError(
        "push_dispatch_claim_failed",
        "Nie udało się przejąć dostaw push z kolejki.",
      );
    }

    return data.map((row): PushDeliveryTask => ({
      deliveryId: row.delivery_id,
      subscriptionId: row.subscription_id,
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth_secret,
      title: row.title,
      body: row.body,
      actionUrl: row.action_url,
      attemptCount: row.attempt_count,
    }));
  };
}
