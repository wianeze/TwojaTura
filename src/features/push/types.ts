import type { MemberRole } from "@/features/auth/types";

/**
 * Stan kontrolki push na urządzeniu użytkownika.
 *
 * `ios-needs-install` jest osobnym stanem, a nie odmianą `unsupported`:
 * Safari na iOS udostępnia Push API dopiero aplikacji dodanej do ekranu
 * głównego, więc użytkownik ma tu do wykonania konkretny krok, a nie do
 * przyjęcia informacji, że się nie da.
 */
export type PushPermissionState =
  "unsupported" | "ios-needs-install" | "denied" | "enabled" | "disabled";

export type PushSubscriptionActionResult =
  | { ok: true; state: PushPermissionState }
  | { ok: false; message: string; code?: "endpoint_taken" };

/** Wynik pojedynczej wysyłki zwracany przez adapter web-push. */
export type PushSendOutcome =
  | { kind: "sent" }
  | { kind: "expired_subscription"; errorCode: string }
  | { kind: "retryable_failure"; errorCode: string }
  | { kind: "permanent_failure"; errorCode: string };

export type PushFailureOutcome = Exclude<PushSendOutcome, { kind: "sent" }>;

/**
 * Wynik jednego biegu dispatchera.
 *
 * `claimed` = `sent` + `retrying` + `failed` + `internalFailed` dla każdej
 * partii, która doszła do końca — cztery ostatnie pola są rozłączne i każda
 * przejęta dostawa trafia do dokładnie jednego z nich.
 *
 * `internalFailed` to dostawy, których WYNIK nie został zapisany w bazie:
 * `complete_push_delivery` odmówiło. Świadomie nie mieszamy ich z `failed`
 * (tam trafiają realne odmowy dostawcy) ani tym bardziej z `sent`: push mógł
 * zostać przyjęty przez dostawcę, ale z punktu widzenia bazy dostawa dalej
 * wisi w `processing` i po 10 minutach wróci do kolejki. To jedyne pole,
 * które oznacza błąd po NASZEJ stronie.
 */
export type PushDispatchSummary = {
  claimed: number;
  sent: number;
  retrying: number;
  failed: number;
  internalFailed: number;
};

export type PushQueueRunResult = {
  rescheduled: number;
} & PushDispatchSummary;

export type PushCampaignFieldName =
  "title" | "body" | "actionUrl" | "recipients";

export type PushCampaignFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<PushCampaignFieldName, string>>;
};

export type AdminPushAudienceRow = {
  userId: string;
  displayName: string;
  role: MemberRole;
  activeSubscriptionCount: number;
};

/**
 * Trzy niezależne metryki. `usersWithoutSubscription` to NIE to samo co
 * `skipped` w historii kampanii: tu chodzi o osoby, dla których w ogóle nie
 * powstanie rekord dostawy, bo nie mają aktywnego urządzenia.
 */
export type AdminPushAudienceSummary = {
  userCount: number;
  subscriptionCount: number;
  usersWithoutSubscription: number;
};

export type AdminPushCampaignRow = {
  id: string;
  kind: "meeting_created" | "admin_manual";
  title: string;
  body: string;
  actionUrl: string | null;
  templateKey: string | null;
  createdAt: string;
  createdByName: string | null;
  recipientUserCount: number;
  deviceCount: number;
  sentCount: number;
  queuedCount: number;
  failedCount: number;
  skippedCount: number;
};

export type PushMeetingOption = {
  id: string;
  title: string;
  startsAt: string;
};
