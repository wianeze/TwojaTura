import "server-only";

import { runPushDispatchLoop } from "../dispatch-loop";
import type { PushDeliveryTask } from "../dispatch-loop";
import type { PushDispatchSummary } from "../types";
import { getPushServiceRoleClient } from "./service-role-client";
import { isWebPushConfigured, sendWebPush } from "./web-push-client";

const EMPTY_SUMMARY: PushDispatchSummary = {
  claimed: 0,
  sent: 0,
  retrying: 0,
  failed: 0,
};

/**
 * Wysyła oczekujące powiadomienia Web Push.
 *
 * Wywoływana z trzech miejsc — `after()` po utworzeniu spotkania, `after()`
 * po zatwierdzeniu kampanii administratora oraz Route Handler crona — i we
 * wszystkich trzech NIE MOŻE rzucić: kolejkowanie kampanii jest już
 * zacommitowane, więc awaria wysyłki ma zostawić dostawy w outboxie, a nie
 * zmienić wynik operacji, która ją wywołała.
 *
 * Bezpieczna przy równoległym uruchomieniu: rekordy są przejmowane w bazie
 * przez `for update skip locked`.
 */
export async function dispatchPendingPushDeliveries(): Promise<PushDispatchSummary> {
  // Brak kluczy VAPID to normalny stan środowiska bez skonfigurowanego push
  // (np. świeży klon repo) — nie ma o czym krzyczeć, nie ma czego wysyłać.
  if (!isWebPushConfigured()) return EMPTY_SUMMARY;

  try {
    const client = getPushServiceRoleClient();

    return await runPushDispatchLoop({
      claimDeliveries: async (limit): Promise<PushDeliveryTask[]> => {
        const { data, error } = await client.rpc("claim_push_deliveries", {
          p_limit: limit,
        });

        if (error || !data) return [];

        return data.map((row) => ({
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
      },

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

      completeDelivery: async (deliveryId, outcome) => {
        await client.rpc("complete_push_delivery", {
          p_delivery_id: deliveryId,
          p_outcome: outcome.kind,
          p_error_code: outcome.kind === "sent" ? undefined : outcome.errorCode,
        });
      },
    });
  } catch {
    // Świadomie bez szczegółów w logu: komunikaty błędów potrafią nieść
    // endpointy subskrypcji, a te nie mają prawa trafić do logów.
    console.error("[push] Dispatcher nie mógł przetworzyć kolejki.");
    return EMPTY_SUMMARY;
  }
}
