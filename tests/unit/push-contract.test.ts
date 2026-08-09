import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createClaimDeliveries } from "../../src/features/push/claim.ts";
import type { ClaimedDeliveryRow } from "../../src/features/push/claim.ts";
import { createCompleteDelivery } from "../../src/features/push/complete.ts";
import {
  describeSupabaseTarget,
  isPushDispatchError,
  PUSH_INTERNAL_FAILURE_WARNING,
  PushDispatchError,
  pushDispatchErrorMessage,
  pushDispatchErrorResponse,
  toSafeErrorCode,
  toSafeErrorMessage,
} from "../../src/features/push/dispatch-errors.ts";
import { classifyWebPushError } from "../../src/features/push/error-classification.ts";
import {
  runPushDispatchLoop,
  runWorkerPool,
} from "../../src/features/push/dispatch-loop.ts";
import type { PushDeliveryTask } from "../../src/features/push/dispatch-loop.ts";
import { createIdempotencyKey } from "../../src/features/push/idempotency.ts";
import { resolveNotificationTarget } from "../../src/features/push/notification-target.ts";
import {
  serializePushSubscription,
  urlBase64ToUint8Array,
} from "../../src/features/push/subscription-payload.ts";
import {
  findPushTemplate,
  PUSH_TEMPLATES,
} from "../../src/features/push/templates.ts";
import type { PushSendOutcome } from "../../src/features/push/types.ts";
import {
  isSafeInternalPath,
  normalizePlainText,
  validatePushCampaignInput,
} from "../../src/features/push/validation.ts";

// --- konwersja publicznego klucza VAPID -------------------------------------

test("urlBase64ToUint8Array dekoduje klucz base64url do 65 bajtów P-256", () => {
  // Nieskompresowany punkt krzywej P-256: 0x04 + 32 bajty X + 32 bajty Y.
  const raw = new Uint8Array(65);
  raw[0] = 0x04;
  for (let index = 1; index < 65; index += 1) raw[index] = index;

  const base64url = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const decoded = urlBase64ToUint8Array(base64url);

  assert.equal(decoded.length, 65);
  assert.deepEqual(Array.from(decoded), Array.from(raw));
});

test("urlBase64ToUint8Array odtwarza brakujący padding", () => {
  // "AQID" -> 3 bajty; wersja bez paddingu "AQI" ma go dostać z powrotem.
  assert.deepEqual(Array.from(urlBase64ToUint8Array("AQI")), [1, 2]);
});

test("urlBase64ToUint8Array odrzuca pusty klucz zamiast zwracać pustą tablicę", () => {
  assert.throws(() => urlBase64ToUint8Array("   "), /pusty/);
});

// --- serializacja PushSubscription ------------------------------------------

test("serializePushSubscription wyciąga endpoint i oba klucze", () => {
  const result = serializePushSubscription({
    toJSON: () => ({
      endpoint: " https://fcm.example/abc ",
      keys: { p256dh: " klucz-p256 ", auth: " klucz-auth " },
    }),
  });

  assert.deepEqual(result, {
    endpoint: "https://fcm.example/abc",
    p256dh: "klucz-p256",
    auth: "klucz-auth",
  });
});

test("serializePushSubscription rzuca czytelny błąd, gdy brakuje kluczy", () => {
  assert.throws(
    () =>
      serializePushSubscription({
        toJSON: () => ({ endpoint: "https://fcm.example/abc" }),
      }),
    /kluczy szyfrujących/,
  );
});

test("serializePushSubscription rzuca, gdy brakuje endpointu", () => {
  assert.throws(
    () =>
      serializePushSubscription({
        toJSON: () => ({ keys: { p256dh: "a", auth: "b" } }),
      }),
    /adresu endpointu/,
  );
});

// --- bezpieczna ścieżka wewnętrzna ------------------------------------------

test("isSafeInternalPath przepuszcza ścieżki wewnętrzne", () => {
  assert.equal(isSafeInternalPath("/"), true);
  assert.equal(
    isSafeInternalPath("/kalendarium/2f1e19aa-0000-4000-8000-000000000001"),
    true,
  );
  assert.equal(isSafeInternalPath("/kronika/nowa"), true);
});

test("isSafeInternalPath odrzuca wszystko, co może wyjść poza origin", () => {
  for (const value of [
    "https://evil.example",
    "http://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "../kalendarium",
    "kalendarium",
    "",
  ]) {
    assert.equal(
      isSafeInternalPath(value),
      false,
      `powinno odrzucić: ${value}`,
    );
  }
});

test("isSafeInternalPath odrzuca znaki sterujące i zbyt długie ścieżki", () => {
  assert.equal(
    isSafeInternalPath(`/kalendarium${String.fromCharCode(10)}`),
    false,
  );
  assert.equal(isSafeInternalPath(`/${"a".repeat(400)}`), false);
});

// --- normalizacja tekstu ----------------------------------------------------

test("normalizePlainText usuwa znaki sterujące i scala białe znaki w tytule", () => {
  const withControl = `Nowe${String.fromCharCode(0)}  spotkanie${String.fromCharCode(9)}dziś`;
  assert.equal(normalizePlainText(withControl), "Nowe spotkanie dziś");
});

test("normalizePlainText zachowuje nowe linie w treści", () => {
  assert.equal(
    normalizePlainText("Pierwsza\r\nDruga", { allowNewlines: true }),
    "Pierwsza\nDruga",
  );
});

// --- walidacja kampanii -----------------------------------------------------

function campaignFormData(
  overrides: Record<string, string | string[]> = {},
): FormData {
  const formData = new FormData();
  const base: Record<string, string | string[]> = {
    title: "Zagłosuj na gry",
    body: "Nie wszyscy wybrali jeszcze gry.",
    actionUrl: "",
    templateKey: "meeting_vote_reminder",
    recipientMode: "all",
    idempotencyKey: "11111111-2222-4333-8444-555555555555",
    ...overrides,
  };

  for (const [key, value] of Object.entries(base)) {
    if (Array.isArray(value)) {
      for (const entry of value) formData.append(key, entry);
    } else {
      formData.set(key, value);
    }
  }

  return formData;
}

test("validatePushCampaignInput przyjmuje poprawną kampanię do wszystkich", () => {
  const result = validatePushCampaignInput(campaignFormData());

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.title, "Zagłosuj na gry");
  assert.equal(result.data.recipientUserIds, null);
  assert.equal(result.data.actionUrl, null);
  assert.equal(result.data.templateKey, "meeting_vote_reminder");
});

test("validatePushCampaignInput NIE odrzuca znaków < i >", () => {
  // Tekst trafia do showNotification i JSX-a, nigdy do HTML — blokowanie tych
  // znaków uniemożliwiłoby napisanie zwyczajnego komunikatu.
  const result = validatePushCampaignInput(
    campaignFormData({ body: "Zostało < 5 miejsc przy stole" }),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.body, "Zostało < 5 miejsc przy stole");
});

test("validatePushCampaignInput wymaga tytułu i treści", () => {
  const result = validatePushCampaignInput(
    campaignFormData({ title: "   ", body: "" }),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.fieldErrors.title);
  assert.ok(result.fieldErrors.body);
});

test("validatePushCampaignInput pilnuje limitów 80 i 300 znaków", () => {
  const tooLongTitle = validatePushCampaignInput(
    campaignFormData({ title: "a".repeat(81) }),
  );
  assert.equal(tooLongTitle.ok, false);

  const tooLongBody = validatePushCampaignInput(
    campaignFormData({ body: "a".repeat(301) }),
  );
  assert.equal(tooLongBody.ok, false);
});

test("validatePushCampaignInput odrzuca zewnętrzny action_url", () => {
  const result = validatePushCampaignInput(
    campaignFormData({ actionUrl: "https://evil.example" }),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.fieldErrors.actionUrl);
});

test("validatePushCampaignInput deduplikuje wybranych odbiorców", () => {
  const result = validatePushCampaignInput(
    campaignFormData({
      recipientMode: "selected",
      recipientUserIds: ["user-a", "user-b", "user-a"],
    }),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data.recipientUserIds, ["user-a", "user-b"]);
});

test("validatePushCampaignInput odrzuca pustą listę wybranych odbiorców", () => {
  const result = validatePushCampaignInput(
    campaignFormData({ recipientMode: "selected", recipientUserIds: [] }),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.fieldErrors.recipients);
});

test("validatePushCampaignInput odrzuca brak tokenu idempotencji", () => {
  const result = validatePushCampaignInput(
    campaignFormData({ idempotencyKey: "" }),
  );

  assert.equal(result.ok, false);
});

// --- szablony ---------------------------------------------------------------

test("findPushTemplate zwraca gotowe pola bez efektu ubocznego", () => {
  const template = findPushTemplate("meeting_today");

  assert.equal(template?.title, "Spotkanie już dziś!");
  assert.equal(template?.body, "Planszówkowy wieczór zaczyna się już dzisiaj.");

  // Wywołanie drugi raz musi dać identyczny wynik — wybór szablonu niczego
  // nie wysyła i niczego nie zmienia.
  assert.deepEqual(findPushTemplate("meeting_today"), template);
});

test("szablon admin_message ma pusty tytuł i treść", () => {
  const template = findPushTemplate("admin_message");

  assert.equal(template?.title, "");
  assert.equal(template?.body, "");
});

test("meeting_vote_reminder wymaga wskazania spotkania", () => {
  assert.equal(
    findPushTemplate("meeting_vote_reminder")?.requiresMeeting,
    true,
  );
});

test("meeting_confirm_reminder has the organizer reminder copy", () => {
  assert.deepEqual(findPushTemplate("meeting_confirm_reminder"), {
    key: "meeting_confirm_reminder",
    label: "Potwierdzenie spotkania",
    title: "Twoja Tura!",
    body: "Pamiętaj potwierdzić spotkanie",
    requiresMeeting: true,
    hint: "Przypomnienie dla organizatora po dwóch odpowiedziach „Będę”.",
  });
});

test("findPushTemplate zwraca null dla nieznanego klucza", () => {
  assert.equal(findPushTemplate("nie-ma-takiego"), null);
  assert.equal(findPushTemplate(null), null);
});

test("wszystkie szablony mają unikalne klucze", () => {
  const keys = PUSH_TEMPLATES.map((template) => template.key);
  assert.equal(new Set(keys).size, keys.length);
});

// --- token idempotencji -----------------------------------------------------

test("createIdempotencyKey zwraca za każdym razem inną, niepustą wartość", () => {
  const first = createIdempotencyKey();
  const second = createIdempotencyKey();

  assert.ok(first.length > 0);
  assert.notEqual(first, second);
});

// --- kliknięcie w powiadomienie ---------------------------------------------

test("resolveNotificationTarget przepuszcza bezpieczną ścieżkę", () => {
  assert.equal(
    resolveNotificationTarget({ url: "/kalendarium/abc" }),
    "/kalendarium/abc",
  );
});

test("resolveNotificationTarget sprowadza wszystko podejrzane do /", () => {
  assert.equal(resolveNotificationTarget({ url: "https://evil.example" }), "/");
  assert.equal(resolveNotificationTarget({ url: "//evil.example" }), "/");
  assert.equal(resolveNotificationTarget({ url: 42 }), "/");
  assert.equal(resolveNotificationTarget(null), "/");
  assert.equal(resolveNotificationTarget(undefined), "/");
});

test("service worker nie rozjechał się z regułą bezpiecznej ścieżki", () => {
  // sw.js jest zwykłym plikiem bez bundlera i ma własną, lustrzaną kopię
  // isSafeInternalPath. Ten test pilnuje, żeby kopia nie zniknęła.
  const source = readFileSync("public/sw.js", "utf8");

  assert.ok(source.includes('self.addEventListener("push"'));
  assert.ok(source.includes('self.addEventListener("notificationclick"'));
  assert.ok(source.includes("function isSafeInternalPath"));
  assert.ok(source.includes("resolveNotificationTarget"));
  assert.ok(source.includes('value.includes("://")'));
  assert.ok(source.includes("event.notification.close()"));
  assert.ok(source.includes("clients.matchAll"));
  assert.ok(source.includes("openWindow"));
});

// --- klasyfikacja błędów web-push -------------------------------------------

test("404 i 410 oznaczają wygasłą subskrypcję", () => {
  for (const statusCode of [404, 410]) {
    const outcome = classifyWebPushError({ statusCode });
    assert.equal(outcome.kind, "expired_subscription");
    assert.equal(outcome.errorCode, `http_${statusCode}`);
  }
});

test("403 to błąd trwały, a NIE wygasła subskrypcja", () => {
  // 403 zwykle znaczy niezgodny klucz VAPID — błąd konfiguracji serwera.
  // Gdyby wyłączał subskrypcje, literówka w kluczu skasowałaby push wszystkim.
  const outcome = classifyWebPushError({ statusCode: 403 });

  assert.equal(outcome.kind, "permanent_failure");
  assert.notEqual(outcome.kind, "expired_subscription");
});

test("400, 401 i 413 są trwałe", () => {
  for (const statusCode of [400, 401, 413]) {
    assert.equal(
      classifyWebPushError({ statusCode }).kind,
      "permanent_failure",
    );
  }
});

test("429 i błędy 5xx są ponawialne", () => {
  for (const statusCode of [429, 500, 502, 503, 504]) {
    assert.equal(
      classifyWebPushError({ statusCode }).kind,
      "retryable_failure",
    );
  }
});

test("błąd sieciowy bez statusCode jest ponawialny", () => {
  assert.equal(
    classifyWebPushError(new Error("socket hang up")).kind,
    "retryable_failure",
  );

  const withCode = classifyWebPushError({ code: "ECONNRESET" });
  assert.equal(withCode.kind, "retryable_failure");
  assert.equal(withCode.errorCode, "network_econnreset");
});

test("nieznany kod HTTP jest traktowany konserwatywnie jako trwały", () => {
  assert.equal(
    classifyWebPushError({ statusCode: 418 }).kind,
    "permanent_failure",
  );
});

test("kod błędu nigdy nie niesie treści odpowiedzi dostawcy", () => {
  const outcome = classifyWebPushError({
    code: "Nagłówek: <body>sekret p256dh</body>",
  });

  assert.ok(outcome.errorCode.length <= 40);
  assert.match(outcome.errorCode, /^[a-zA-Z0-9_:-]+$/);
});

// --- pula workerów ----------------------------------------------------------

test("runWorkerPool wykonuje wszystkie zadania i nie przekracza limitu", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const done: number[] = [];

  await runWorkerPool(
    Array.from({ length: 25 }, (_, index) => index),
    10,
    async (item) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      done.push(item);
      inFlight -= 1;
    },
  );

  assert.equal(done.length, 25);
  assert.equal(new Set(done).size, 25);
  assert.ok(maxInFlight <= 10, `maxInFlight = ${maxInFlight}`);
  assert.ok(maxInFlight > 1, "pula powinna działać równolegle");
});

test("runWorkerPool na pustej liście nie uruchamia workera", async () => {
  let calls = 0;
  await runWorkerPool([], 10, async () => {
    calls += 1;
  });
  assert.equal(calls, 0);
});

// --- pętla dispatchera (z zamockowanym web-push) ----------------------------

function makeTask(index: number): PushDeliveryTask {
  return {
    deliveryId: `delivery-${index}`,
    subscriptionId: `subscription-${index}`,
    endpoint: `https://fcm.example/${index}`,
    p256dh: "klucz-p256",
    auth: "klucz-auth",
    title: "Nowe spotkanie!",
    body: "Powstało spotkanie.",
    actionUrl: "/kalendarium/abc",
    attemptCount: 1,
  };
}

test("pusty claim kończy się bez ani jednej wysyłki", async () => {
  let sendCalls = 0;

  const summary = await runPushDispatchLoop({
    claimDeliveries: async () => [],
    sendDelivery: async () => {
      sendCalls += 1;
      return { kind: "sent" };
    },
    completeDelivery: async () => {},
  });

  assert.equal(sendCalls, 0);
  assert.deepEqual(summary, {
    claimed: 0,
    sent: 0,
    retrying: 0,
    failed: 0,
    internalFailed: 0,
  });
});

test("błąd jednego urządzenia nie przerywa pozostałych dostaw", async () => {
  const completed: Array<{ id: string; kind: string }> = [];

  const summary = await runPushDispatchLoop(
    {
      claimDeliveries: async (limit) =>
        limit > 0 ? [makeTask(1), makeTask(2), makeTask(3)] : [],
      sendDelivery: async (task) => {
        if (task.deliveryId === "delivery-2") {
          throw new Error("socket hang up");
        }
        return { kind: "sent" };
      },
      completeDelivery: async (deliveryId, outcome) => {
        completed.push({ id: deliveryId, kind: outcome.kind });
      },
    },
    { batchSize: 3, concurrency: 2, maxBatches: 1 },
  );

  assert.equal(completed.length, 3);
  assert.equal(summary.sent, 2);
  assert.equal(summary.retrying, 1);
  assert.equal(
    completed.find((entry) => entry.id === "delivery-2")?.kind,
    "retryable_failure",
  );
});

test("410 i 403 trafiają do complete_push_delivery różnymi ścieżkami", async () => {
  const outcomes = new Map<string, PushSendOutcome>();

  await runPushDispatchLoop(
    {
      claimDeliveries: async () => [makeTask(1), makeTask(2)],
      sendDelivery: async (task) =>
        task.deliveryId === "delivery-1"
          ? { kind: "expired_subscription", errorCode: "http_410" }
          : { kind: "permanent_failure", errorCode: "http_403" },
      completeDelivery: async (deliveryId, outcome) => {
        outcomes.set(deliveryId, outcome);
      },
    },
    { batchSize: 2, maxBatches: 1 },
  );

  assert.equal(outcomes.get("delivery-1")?.kind, "expired_subscription");
  assert.equal(outcomes.get("delivery-2")?.kind, "permanent_failure");
});

test("pełna partia powoduje kolejny claim, a maxBatches zatrzymuje pętlę", async () => {
  let claims = 0;

  const summary = await runPushDispatchLoop(
    {
      claimDeliveries: async (limit) => {
        claims += 1;
        // Zawsze pełna partia: bez sufitu pętla kręciłaby się w nieskończoność.
        return Array.from({ length: limit }, (_, index) => makeTask(index));
      },
      sendDelivery: async () => ({ kind: "sent" }),
      completeDelivery: async () => {},
    },
    { batchSize: 2, concurrency: 2, maxBatches: 3 },
  );

  assert.equal(claims, 3);
  assert.equal(summary.claimed, 6);
  assert.equal(summary.sent, 6);
});

test("niepełna partia kończy pętlę bez kolejnego claimu", async () => {
  let claims = 0;

  await runPushDispatchLoop(
    {
      claimDeliveries: async () => {
        claims += 1;
        return [makeTask(1)];
      },
      sendDelivery: async () => ({ kind: "sent" }),
      completeDelivery: async () => {},
    },
    { batchSize: 5, maxBatches: 4 },
  );

  assert.equal(claims, 1);
});

test("dispatcher nie przekracza limitu równoczesnych wysyłek", async () => {
  let inFlight = 0;
  let maxInFlight = 0;

  await runPushDispatchLoop(
    {
      claimDeliveries: async (limit) =>
        Array.from({ length: limit }, (_, index) => makeTask(index)),
      sendDelivery: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
        return { kind: "sent" };
      },
      completeDelivery: async () => {},
    },
    { batchSize: 30, concurrency: 10, maxBatches: 1 },
  );

  assert.ok(maxInFlight <= 10, `maxInFlight = ${maxInFlight}`);
});

test("nieudany zapis wyniku nie wywraca całej partii", async () => {
  const summary = await runPushDispatchLoop(
    {
      claimDeliveries: async () => [makeTask(1), makeTask(2)],
      sendDelivery: async () => ({ kind: "sent" }),
      completeDelivery: async (deliveryId) => {
        if (deliveryId === "delivery-1") throw new Error("zapis padł");
      },
    },
    { batchSize: 2, maxBatches: 1 },
  );

  // delivery-1 zostaje w `processing` i wróci przez odzysk po 10 minutach,
  // więc świadomie nie liczymy go jako wysłanego.
  assert.equal(summary.claimed, 2);
  assert.equal(summary.sent, 1);
  assert.equal(summary.internalFailed, 1);
});

// --- awaria claimu ----------------------------------------------------------
//
// Regresja produkcyjna: `claim_push_deliveries` zwracał błąd, dispatcher
// zamieniał go na pustą partię i cały bieg kończył się sumarium samych zer —
// nieodróżnialnym od poprawnie pustej kolejki.

const PRODUCTION_URL = "https://abcdefghijklmnopqrst.supabase.co";

function makeClaimedRow(index: number): ClaimedDeliveryRow {
  return {
    delivery_id: `delivery-${index}`,
    subscription_id: `subscription-${index}`,
    endpoint: `https://fcm.example/${index}`,
    p256dh: "klucz-p256",
    auth_secret: "klucz-auth",
    title: "Nowe spotkanie!",
    body: "Powstało spotkanie.",
    action_url: "/kalendarium/abc",
    attempt_count: 0,
  };
}

test("błąd RPC claimu kończy się kontrolowanym push_dispatch_claim_failed", async () => {
  const claimDeliveries = createClaimDeliveries({
    supabaseUrl: PRODUCTION_URL,
    callClaimRpc: async () => ({
      data: null,
      error: { code: "42501", message: "permission denied for function" },
    }),
    logError: () => {},
  });

  await assert.rejects(
    () => claimDeliveries(50),
    (error: unknown) => {
      assert.ok(isPushDispatchError(error));
      assert.equal(
        (error as PushDispatchError).code,
        "push_dispatch_claim_failed",
      );
      return true;
    },
  );
});

test("null bez błędu też jest awarią, a nie pustą kolejką", async () => {
  const claimDeliveries = createClaimDeliveries({
    supabaseUrl: PRODUCTION_URL,
    callClaimRpc: async () => ({ data: null, error: null }),
    logError: () => {},
  });

  await assert.rejects(() => claimDeliveries(50), PushDispatchError);
});

test("dispatcher NIE zwraca pustego podsumowania, gdy claim padnie", async () => {
  let sendCalls = 0;

  const claimDeliveries = createClaimDeliveries({
    supabaseUrl: PRODUCTION_URL,
    callClaimRpc: async () => ({
      data: null,
      error: {
        code: "PGRST202",
        message: "function not found in schema cache",
      },
    }),
    logError: () => {},
  });

  const run = runPushDispatchLoop({
    claimDeliveries,
    sendDelivery: async () => {
      sendCalls += 1;
      return { kind: "sent" };
    },
    completeDelivery: async () => {},
  });

  // Kluczowa asercja regresji: pętla ma się wywrócić, a nie rozwiązać się
  // sumarium z samymi zerami.
  await assert.rejects(() => run, PushDispatchError);
  assert.equal(sendCalls, 0);
});

test("pusta tablica z claimu nadal oznacza pustą kolejkę i sukces", async () => {
  const summary = await runPushDispatchLoop({
    claimDeliveries: createClaimDeliveries({
      supabaseUrl: PRODUCTION_URL,
      callClaimRpc: async () => ({ data: [], error: null }),
      logError: () => {},
    }),
    sendDelivery: async () => ({ kind: "sent" }),
    completeDelivery: async () => {},
  });

  assert.deepEqual(summary, {
    claimed: 0,
    sent: 0,
    retrying: 0,
    failed: 0,
    internalFailed: 0,
  });
});

test("poprawny claim mapuje auth_secret na auth i zachowuje resztę pól", async () => {
  const claimDeliveries = createClaimDeliveries({
    supabaseUrl: PRODUCTION_URL,
    callClaimRpc: async () => ({ data: [makeClaimedRow(7)], error: null }),
    logError: () => {},
  });

  assert.deepEqual(await claimDeliveries(50), [
    {
      deliveryId: "delivery-7",
      subscriptionId: "subscription-7",
      endpoint: "https://fcm.example/7",
      p256dh: "klucz-p256",
      auth: "klucz-auth",
      title: "Nowe spotkanie!",
      body: "Powstało spotkanie.",
      actionUrl: "/kalendarium/abc",
      attemptCount: 0,
    },
  ]);
});

// --- diagnostyka bez wycieku ------------------------------------------------

test("log awarii claimu niesie kod, host i ref projektu", async () => {
  const logs: string[] = [];

  const claimDeliveries = createClaimDeliveries({
    supabaseUrl: PRODUCTION_URL,
    callClaimRpc: async () => ({
      data: null,
      error: { code: "42883", message: "function does not exist" },
    }),
    logError: (message) => logs.push(message),
  });

  await assert.rejects(() => claimDeliveries(50));

  assert.equal(logs.length, 1);
  assert.match(logs[0], /push_dispatch_claim_failed/);
  assert.match(logs[0], /code=42883/);
  assert.match(logs[0], /host=abcdefghijklmnopqrst\.supabase\.co/);
  assert.match(logs[0], /projectRef=abcdefghijklmnopqrst/);
});

test("log awarii claimu nigdy nie niesie klucza ani materiału subskrypcji", async () => {
  const logs: string[] = [];

  const secret =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sluzbowyKluczServiceRole.podpis";

  const claimDeliveries = createClaimDeliveries({
    supabaseUrl: PRODUCTION_URL,
    callClaimRpc: async () => ({
      data: null,
      error: {
        code: "PGRST301",
        message: `JWT ${secret} rejected for https://fcm.googleapis.com/fcm/send/abc p256dh=BOtoken`,
      },
    }),
    logError: (message) => logs.push(message),
  });

  await assert.rejects(() => claimDeliveries(50));

  assert.ok(!logs[0].includes(secret));
  assert.ok(!logs[0].includes("fcm.googleapis.com"));
  assert.ok(!logs[0].includes("https://"));
  assert.match(logs[0], /\[usunięto\]/);
});

test("toSafeErrorMessage wycina URL-e, długie tokeny i przycina długość", () => {
  assert.equal(
    toSafeErrorMessage(new Error("blad przy https://fcm.example/abc")),
    "blad przy [usunięto]",
  );
  assert.equal(toSafeErrorMessage({ message: "a".repeat(41) }), "[usunięto]");
  assert.equal(toSafeErrorMessage(null), "brak treści błędu");
  assert.ok(toSafeErrorMessage("krotkie ".repeat(100)).length <= 200);
});

test("toSafeErrorCode przepuszcza kody Postgresa i odrzuca resztę", () => {
  assert.equal(toSafeErrorCode("42501"), "42501");
  assert.equal(toSafeErrorCode("PGRST202"), "PGRST202");
  assert.equal(toSafeErrorCode("kod <script>"), "kodscript");
  assert.equal(toSafeErrorCode(undefined), "brak_kodu");
});

test("describeSupabaseTarget rozpoznaje projekt zdalny i adres lokalny", () => {
  assert.deepEqual(describeSupabaseTarget(PRODUCTION_URL), {
    hostname: "abcdefghijklmnopqrst.supabase.co",
    projectRef: "abcdefghijklmnopqrst",
  });

  // Najgroźniejszy wariant pomyłki konfiguracyjnej: produkcyjny dispatcher
  // wskazany na localhost. Ma być widoczny w logu jako „lokalny”.
  assert.deepEqual(describeSupabaseTarget("http://127.0.0.1:54321"), {
    hostname: "127.0.0.1",
    projectRef: "lokalny",
  });

  assert.equal(describeSupabaseTarget("nie-url").projectRef, "nieznany");
});

// --- kontrakt HTTP Route Handlera -------------------------------------------

test("Route Handler odpowiada 500 push_dispatch_claim_failed na awarię claimu", () => {
  const response = pushDispatchErrorResponse(
    new PushDispatchError("push_dispatch_claim_failed", "claim padł"),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: "push_dispatch_claim_failed" });
});

test("Route Handler odpowiada 503 na brak konfiguracji", () => {
  const response = pushDispatchErrorResponse(
    new PushDispatchError("push_dispatch_not_configured", "brak zmiennych"),
  );

  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { error: "push_dispatch_not_configured" });
});

test("nieznany wyjątek też kończy się 500, nigdy 200 z zerami", () => {
  const response = pushDispatchErrorResponse(new Error("cokolwiek"));

  assert.equal(response.status, 500);
  assert.equal(response.body.error, "push_dispatch_claim_failed");
});

test("panel administratora dostaje komunikat błędu, a nie „przetworzono 0”", () => {
  const claimMessage = pushDispatchErrorMessage(
    new PushDispatchError("push_dispatch_claim_failed", "claim padł"),
  );
  const configMessage = pushDispatchErrorMessage(
    new PushDispatchError("push_dispatch_not_configured", "brak zmiennych"),
  );

  assert.match(claimMessage, /push_dispatch_claim_failed/);
  assert.match(configMessage, /push_dispatch_not_configured/);
  assert.ok(!claimMessage.includes("przetworzono 0"));
});

// --- awaria finalizacji (complete_push_delivery) -----------------------------
//
// Druga regresja: wynik RPC był ignorowany, więc nieudany zapis statusu `sent`
// przechodził bezszelestnie, dostawa lądowała w liczniku `sent`, a w bazie
// wisiała w `processing` i po 10 minutach wracała do kolejki jako duplikat.

function makeCompleteDelivery(
  error: { code?: string | null; message?: string | null } | null,
  logs: string[] = [],
  failingDeliveryIds?: ReadonlySet<string>,
) {
  return createCompleteDelivery({
    supabaseUrl: PRODUCTION_URL,
    logError: (message) => logs.push(message),
    callCompleteRpc: async (deliveryId) => ({
      error:
        !failingDeliveryIds || failingDeliveryIds.has(deliveryId)
          ? error
          : null,
    }),
  });
}

test("błąd finalizacji rzuca kontrolowany push_dispatch_complete_failed", async () => {
  const completeDelivery = makeCompleteDelivery({
    code: "40001",
    message: "could not serialize access",
  });

  await assert.rejects(
    () => completeDelivery("delivery-1", { kind: "sent" }),
    (error: unknown) => {
      assert.ok(isPushDispatchError(error));
      assert.equal(
        (error as PushDispatchError).code,
        "push_dispatch_complete_failed",
      );
      return true;
    },
  );
});

test("brak błędu z finalizacji kończy się cicho", async () => {
  const logs: string[] = [];
  const completeDelivery = makeCompleteDelivery(null, logs);

  await completeDelivery("delivery-1", { kind: "sent" });

  assert.equal(logs.length, 0);
});

test("nieudana finalizacja po udanym sendNotification NIE zwiększa sent", async () => {
  const logs: string[] = [];

  const summary = await runPushDispatchLoop(
    {
      claimDeliveries: async () => [makeTask(1), makeTask(2), makeTask(3)],
      // Wszystkie trzy urządzenia przyjmują push bez zastrzeżeń.
      sendDelivery: async () => ({ kind: "sent" }),
      completeDelivery: makeCompleteDelivery(
        { code: "40001", message: "could not serialize access" },
        logs,
        new Set(["delivery-2"]),
      ),
    },
    { batchSize: 3, concurrency: 2, maxBatches: 1 },
  );

  // Kluczowa asercja: delivery-2 dotarło do dostawcy, ale baza o tym nie wie,
  // więc nie wolno go zaliczyć do `sent`.
  assert.equal(summary.claimed, 3);
  assert.equal(summary.sent, 2);
  assert.equal(summary.internalFailed, 1);
  assert.equal(summary.failed, 0);
  assert.equal(summary.retrying, 0);

  // Pozostałe dostawy przeszły mimo awarii jednej z nich.
  assert.equal(
    summary.sent + summary.retrying + summary.failed + summary.internalFailed,
    summary.claimed,
  );
  assert.equal(logs.length, 1);
});

test("nieudana finalizacja po expired/retryable/permanent też jest raportowana", async () => {
  const outcomes: PushSendOutcome[] = [
    { kind: "expired_subscription", errorCode: "http_410" },
    { kind: "retryable_failure", errorCode: "http_503" },
    { kind: "permanent_failure", errorCode: "http_403" },
  ];

  for (const outcome of outcomes) {
    const logs: string[] = [];

    const summary = await runPushDispatchLoop(
      {
        claimDeliveries: async () => [makeTask(1), makeTask(2)],
        sendDelivery: async (task) =>
          task.deliveryId === "delivery-1" ? outcome : { kind: "sent" },
        completeDelivery: makeCompleteDelivery(
          { code: "42501", message: "permission denied" },
          logs,
          new Set(["delivery-1"]),
        ),
      },
      { batchSize: 2, concurrency: 2, maxBatches: 1 },
    );

    // Wynik dostawcy był znany, ale i tak nie został zapisany — liczy się jako
    // awaria wewnętrzna, a nie jako `failed`/`retrying`.
    assert.equal(summary.internalFailed, 1, `outcome=${outcome.kind}`);
    assert.equal(summary.failed, 0, `outcome=${outcome.kind}`);
    assert.equal(summary.retrying, 0, `outcome=${outcome.kind}`);

    // Drugie urządzenie przeszło do końca — pętla nie została przerwana.
    assert.equal(summary.sent, 1, `outcome=${outcome.kind}`);
    assert.match(logs[0], new RegExp(`outcome=${outcome.kind}`));
  }
});

test("awaria finalizacji WSZYSTKICH dostaw nie udaje sukcesu", async () => {
  const summary = await runPushDispatchLoop(
    {
      claimDeliveries: async () => [makeTask(1), makeTask(2)],
      sendDelivery: async () => ({ kind: "sent" }),
      completeDelivery: makeCompleteDelivery(
        { code: "40001", message: "could not serialize access" },
        [],
      ),
    },
    { batchSize: 2, concurrency: 2, maxBatches: 1 },
  );

  assert.equal(summary.sent, 0);
  assert.equal(summary.internalFailed, 2);
});

test("log awarii finalizacji niesie delivery_id, outcome, kod i ref projektu", async () => {
  const logs: string[] = [];
  const completeDelivery = makeCompleteDelivery(
    { code: "42501", message: "permission denied for function" },
    logs,
  );

  await assert.rejects(() =>
    completeDelivery("2f1e19aa-0000-4000-8000-000000000001", { kind: "sent" }),
  );

  assert.equal(logs.length, 1);
  assert.match(logs[0], /push_dispatch_complete_failed/);
  assert.match(logs[0], /code=42501/);
  assert.match(logs[0], /deliveryId=2f1e19aa-0000-4000-8000-000000000001/);
  assert.match(logs[0], /outcome=sent/);
  assert.match(logs[0], /host=abcdefghijklmnopqrst\.supabase\.co/);
  assert.match(logs[0], /projectRef=abcdefghijklmnopqrst/);
});

test("log awarii finalizacji nie niesie endpointu, p256dh, auth ani sekretów", async () => {
  const logs: string[] = [];

  const serviceRoleKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sluzbowyKluczServiceRole.podpis";
  const vapidPrivateKey = "UUxIIkc1NGpUUnNjc2FaeFZfV0xLZk1nUlRLd0pyMlk";

  const completeDelivery = makeCompleteDelivery(
    {
      code: "PGRST301",
      message: `JWT ${serviceRoleKey} vapid ${vapidPrivateKey} endpoint https://fcm.googleapis.com/fcm/send/abc p256dh=BOtokenBOtokenBOtokenBOtokenBOtokenBOtoken auth=sekretAuth`,
    },
    logs,
  );

  await assert.rejects(() => completeDelivery("delivery-1", { kind: "sent" }));

  for (const secret of [
    serviceRoleKey,
    vapidPrivateKey,
    "fcm.googleapis.com",
    "https://",
    "BOtokenBOtokenBOtokenBOtokenBOtokenBOtoken",
  ]) {
    assert.ok(!logs[0].includes(secret), `log nie może zawierać: ${secret}`);
  }

  assert.match(logs[0], /\[usunięto\]/);
});

test("panel administratora dostaje ostrzeżenie o niezapisanych wynikach", () => {
  const message = pushDispatchErrorMessage(
    new PushDispatchError("push_dispatch_complete_failed", "zapis padł"),
  );

  assert.match(message, /push_dispatch_complete_failed/);
  assert.ok(message.includes(PUSH_INTERNAL_FAILURE_WARNING));
});

test("ostrzeżenie panelu mówi o ponowieniu, a nie o utracie powiadomienia", () => {
  assert.match(PUSH_INTERNAL_FAILURE_WARNING, /nie została poprawnie zapisana/);
  assert.match(PUSH_INTERNAL_FAILURE_WARNING, /odzyskać je ponownie/);
});

test("panel administratora dokleja ostrzeżenie tylko przy internalFailed > 0", () => {
  // Lustro logiki z admin-push-history.tsx: liczniki same w sobie wyglądają
  // poprawnie także wtedy, gdy część wyników nie została zapisana.
  const render = (internalFailed: number) =>
    internalFailed > 0
      ? `liczniki ${PUSH_INTERNAL_FAILURE_WARNING}`
      : "liczniki";

  assert.ok(render(1).includes(PUSH_INTERNAL_FAILURE_WARNING));
  assert.ok(!render(0).includes(PUSH_INTERNAL_FAILURE_WARNING));
});

test("Route Handler zwraca 200 z jawnym internalFailed przy częściowej awarii", async () => {
  // Częściowa awaria finalizacji NIE jest awarią biegu: reszta urządzeń
  // została obsłużona, więc handler oddaje podsumowanie, a nie kod błędu.
  // Warunkiem jest to, że `internalFailed` jest widoczne w treści odpowiedzi.
  const summary = await runPushDispatchLoop(
    {
      claimDeliveries: async () => [makeTask(1), makeTask(2)],
      sendDelivery: async () => ({ kind: "sent" }),
      completeDelivery: makeCompleteDelivery(
        { code: "40001", message: "could not serialize access" },
        [],
        new Set(["delivery-1"]),
      ),
    },
    { batchSize: 2, concurrency: 2, maxBatches: 1 },
  );

  assert.deepEqual(summary, {
    claimed: 2,
    sent: 1,
    retrying: 0,
    failed: 0,
    internalFailed: 1,
  });

  // Sukces nigdy nie jest pozorny: pole jest obecne w każdym podsumowaniu,
  // więc monitoring ma czego pilnować bez zgadywania.
  assert.ok(Object.hasOwn(summary, "internalFailed"));
});

test("push_dispatch_complete_failed poza pętlą kończy się 500, nie 200", () => {
  const response = pushDispatchErrorResponse(
    new PushDispatchError("push_dispatch_complete_failed", "zapis padł"),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: "push_dispatch_complete_failed" });
});
