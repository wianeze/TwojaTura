import { classifyWebPushError } from "./error-classification.ts";
import type { PushDispatchSummary, PushSendOutcome } from "./types";

/** Rekordów przejmowanych jednym `claim_push_deliveries`. */
export const PUSH_BATCH_SIZE = 50;

/**
 * Równoległych żądań do dostawców. Kilkadziesiąt naraz to prosty sposób na
 * rate-limit u FCM i na wyczerpanie puli połączeń funkcji serverless.
 */
export const PUSH_CONCURRENCY = 10;

/** Sufit na jedno uruchomienie — chroni przed limitem czasu funkcji. */
export const PUSH_MAX_BATCHES = 5;

export type PushDeliveryTask = {
  deliveryId: string;
  subscriptionId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  title: string;
  body: string;
  actionUrl: string | null;
  attemptCount: number;
};

export type PushDispatchDeps = {
  claimDeliveries: (limit: number) => Promise<PushDeliveryTask[]>;
  sendDelivery: (task: PushDeliveryTask) => Promise<PushSendOutcome>;
  completeDelivery: (
    deliveryId: string,
    outcome: PushSendOutcome,
  ) => Promise<void>;
};

export type PushDispatchOptions = {
  batchSize?: number;
  concurrency?: number;
  maxBatches?: number;
};

/**
 * Pula workerów o stałym rozmiarze, bez dodatkowej zależności. Każdy worker
 * zdejmuje zadania z tej samej kolejki, więc w locie nigdy nie ma więcej
 * równoczesnych żądań niż `concurrency`, a wolniejsze urządzenie nie blokuje
 * pozostałych.
 */
export async function runWorkerPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;

  const queue = [...items];
  const workerCount = Math.max(1, Math.min(concurrency, queue.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
        await worker(item);
      }
    }),
  );
}

/**
 * Pętla dispatchera, wydzielona z warstwy `server-only`, żeby dała się
 * przetestować z zamockowanymi zależnościami — bez prawdziwych żądań do
 * dostawców push i bez klienta service_role.
 *
 * Przetwarza wyłącznie to, co zwróci `claimDeliveries` (czyli rekordy
 * `queued` z `next_attempt_at <= now()`), i jest idempotentna: przejęcie
 * rekordu odbywa się po stronie bazy przez `for update skip locked`.
 */
export async function runPushDispatchLoop(
  deps: PushDispatchDeps,
  options: PushDispatchOptions = {},
): Promise<PushDispatchSummary> {
  const batchSize = options.batchSize ?? PUSH_BATCH_SIZE;
  const concurrency = options.concurrency ?? PUSH_CONCURRENCY;
  const maxBatches = options.maxBatches ?? PUSH_MAX_BATCHES;

  const summary: PushDispatchSummary = {
    claimed: 0,
    sent: 0,
    retrying: 0,
    failed: 0,
  };

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const tasks = await deps.claimDeliveries(batchSize);

    if (tasks.length === 0) break;

    summary.claimed += tasks.length;

    await runWorkerPool(tasks, concurrency, async (task) => {
      let outcome: PushSendOutcome;

      // Błąd jednego urządzenia nie może przerwać pozostałych — każdy wyjątek
      // zamienia się w wynik, który i tak trzeba zapisać.
      try {
        outcome = await deps.sendDelivery(task);
      } catch (error) {
        outcome = classifyWebPushError(error);
      }

      try {
        await deps.completeDelivery(task.deliveryId, outcome);
      } catch {
        // Zapis wyniku padł: dostawa zostaje w `processing` i wróci do
        // kolejki przez odzysk rekordów starszych niż 10 minut.
        return;
      }

      if (outcome.kind === "sent") {
        summary.sent += 1;
      } else if (outcome.kind === "retryable_failure") {
        // O tym, czy to naprawdę kolejna próba, czy już wyczerpany limit,
        // decyduje complete_push_delivery — tu raportujemy zamiar.
        summary.retrying += 1;
      } else {
        summary.failed += 1;
      }
    });

    // Niepełna partia oznacza, że kolejka jest pusta.
    if (tasks.length < batchSize) break;
  }

  return summary;
}
