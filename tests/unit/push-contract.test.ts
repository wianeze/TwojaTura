import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
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
  assert.deepEqual(summary, { claimed: 0, sent: 0, retrying: 0, failed: 0 });
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
});
