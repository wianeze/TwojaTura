import "server-only";

import { createClaimDeliveries } from "../claim.ts";
import { createCompleteDelivery } from "../complete.ts";
import { runPushDispatchLoop } from "../dispatch-loop.ts";
import {
  PushDispatchError,
  toSafeErrorCode,
  toSafeErrorMessage,
} from "../dispatch-errors.ts";
import type { PushDispatchSummary } from "../types";
import { getPushServiceRoleClient } from "./service-role-client";
import { isWebPushConfigured, sendWebPush } from "./web-push-client";

/**
 * Wysyła oczekujące powiadomienia Web Push.
 *
 * Rzuca `PushDispatchError`, gdy kolejka NIE ZOSTAŁA przetworzona — brak
 * konfiguracji albo nieudany claim. Wcześniej ta funkcja połykała każdy wyjątek
 * i zwracała `{ claimed: 0, ... }`, przez co awaria wyglądała dokładnie tak samo
 * jak pusta kolejka: produkcyjny GET /api/push/dispatch odpowiadał 200 i zerami,
 * mimo że dostawa czekała w bazie i była w pełni kwalifikowalna.
 *
 * Wywołania z `after()` NIE MOGĄ się wywrócić (kolejkowanie kampanii jest już
 * zacommitowane, a wynik wysyłki nie ma prawa zmienić rezultatu operacji, która
 * ją wywołała) — służy im `dispatchPendingPushDeliveriesInBackground()` niżej,
 * jedyny wariant, który tłumi błąd. Route Handler crona i przycisk w panelu
 * administratora używają wariantu rzucającego, bo oba mają komu pokazać awarię.
 *
 * Bezpieczna przy równoległym uruchomieniu: rekordy są przejmowane w bazie
 * przez `for update skip locked`.
 */
export async function dispatchPendingPushDeliveries(): Promise<PushDispatchSummary> {
  if (!isWebPushConfigured()) {
    throw new PushDispatchError(
      "push_dispatch_not_configured",
      "Dispatcher powiadomień push wymaga kluczy VAPID.",
    );
  }

  const { client, supabaseUrl } = getPushServiceRoleClient();

  return runPushDispatchLoop({
    claimDeliveries: createClaimDeliveries({
      supabaseUrl,
      callClaimRpc: async (limit) => {
        const { data, error } = await client.rpc("claim_push_deliveries", {
          p_limit: limit,
        });

        return { data, error };
      },
    }),

    sendDelivery: (task) =>
      sendWebPush(
        {
          endpoint: task.endpoint,
          p256dh: task.p256dh,
          auth: task.auth,
        },
        {
          title: task.title,
          body: task.body,
          url: task.actionUrl ?? "/",
          tag: task.deliveryId,
        },
      ),

    completeDelivery: createCompleteDelivery({
      supabaseUrl,
      callCompleteRpc: async (deliveryId, outcome) => {
        const { error } = await client.rpc("complete_push_delivery", {
          p_delivery_id: deliveryId,
          p_outcome: outcome.kind,
          p_error_code: outcome.kind === "sent" ? undefined : outcome.errorCode,
        });

        return { error };
      },
    }),
  });
}

/**
 * Wariant dla `after()`: nigdy nie rzuca, ale zostawia w logu kod błędu.
 *
 * Brak konfiguracji jest tu normalnym stanem środowiska bez skonfigurowanego
 * push (np. świeży klon repo) — nie ma o czym krzyczeć, nie ma czego wysyłać.
 * Nieudany claim to już awaria i musi być widoczna w logach.
 */
export async function dispatchPendingPushDeliveriesInBackground(): Promise<void> {
  try {
    await dispatchPendingPushDeliveries();
  } catch (error) {
    if (
      error instanceof PushDispatchError &&
      error.code === "push_dispatch_not_configured"
    ) {
      return;
    }

    // `createClaimDeliveries` zalogowało już szczegóły claimu; tu zostaje
    // wyłącznie kod i przycięty komunikat. Pełna treść wyjątku nie trafia do
    // logu, bo komunikaty potrafią nieść endpointy subskrypcji.
    console.error(
      `[push] Dispatcher nie mógł przetworzyć kolejki. code=${toSafeErrorCode(
        error instanceof PushDispatchError ? error.code : null,
      )} message=${toSafeErrorMessage(error)}`,
    );
  }
}
