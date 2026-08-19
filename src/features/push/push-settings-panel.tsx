"use client";

import { useEffect, useState } from "react";
import { ActionButton } from "@/components/ui/action-button";
import {
  disablePushSubscriptionAction,
  getPushSubscriptionStateAction,
  savePushSubscriptionAction,
} from "./actions";
import {
  serializePushSubscription,
  urlBase64ToUint8Array,
} from "./subscription-payload";
import type { PushPermissionState } from "./types";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Safari na iOS udostępnia Push API wyłącznie aplikacji dodanej do ekranu
 * głównego. W zwykłej karcie `Notification.requestPermission` nie zadziała,
 * więc zamiast martwego przycisku pokazujemy instrukcję.
 */
function isIosWithoutStandalone(): boolean {
  if (typeof window === "undefined") return false;

  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS podaje się za Maca; rozpoznajemy go po ekranie dotykowym.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (!isIos) return false;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return !isStandalone;
}

/**
 * Service worker rejestruje się normalnie tylko w produkcji
 * (`ServiceWorkerRegistration`). Kontrolka rejestruje go w razie potrzeby
 * sama, żeby push dało się przetestować także lokalnie — SW nie ma Cache API,
 * więc nie ma tu czego zepsuć.
 */
async function ensureServiceWorker(): Promise<globalThis.ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing) {
    await navigator.serviceWorker.register("/sw.js");
  }

  return navigator.serviceWorker.ready;
}

async function createSubscription(
  registration: globalThis.ServiceWorkerRegistration,
): Promise<PushSubscription> {
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

/**
 * Zwraca stan zamiast go ustawiać — dzięki temu komponent aktualizuje stan
 * dopiero w kontynuacji po `await`, a nie synchronicznie w ciele efektu.
 */
async function resolvePushState(): Promise<PushPermissionState> {
  if (!isPushSupported() || VAPID_PUBLIC_KEY.length === 0) {
    return "unsupported";
  }

  if (isIosWithoutStandalone()) return "ios-needs-install";
  if (Notification.permission === "denied") return "denied";

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();

  if (!subscription) return "disabled";

  // Subskrypcja w przeglądarce nie wystarczy — mogła zostać wyłączona
  // po stronie serwera (np. przy rotacji kluczy VAPID).
  const serverState = await getPushSubscriptionStateAction(
    subscription.endpoint,
  );

  return serverState.isEnabled ? "enabled" : "disabled";
}

export function PushSettingsPanel() {
  const [state, setState] = useState<PushPermissionState | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    // Świadomie NIE wołamy tu requestPermission: systemowe pytanie o zgodę
    // pojawia się wyłącznie po kliknięciu przycisku.
    let cancelled = false;

    void (async () => {
      try {
        const next = await resolvePushState();
        if (!cancelled) setState(next);
      } catch {
        if (!cancelled) setState("unsupported");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEnable() {
    setIsBusy(true);
    setMessage(null);
    setIsError(false);

    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "disabled");
        setMessage(
          permission === "denied"
            ? "Zgoda została odrzucona. Możesz ją przywrócić w ustawieniach przeglądarki."
            : "Bez zgody nie wyślemy powiadomień na to urządzenie.",
        );
        setIsError(true);
        return;
      }

      const registration = await ensureServiceWorker();
      let subscription =
        (await registration.pushManager.getSubscription()) ??
        (await createSubscription(registration));

      let result = await savePushSubscriptionAction({
        ...serializePushSubscription(subscription),
        userAgent: navigator.userAgent,
      });

      // Endpoint tego urządzenia jest przypisany do innego konta, a klucze się
      // nie zgadzają. Kasujemy lokalną subskrypcję i bierzemy nową — dostawca
      // wyda wtedy inny endpoint. Dokładnie jedna próba, bez pętli.
      if (!result.ok && result.code === "endpoint_taken") {
        await subscription.unsubscribe();
        subscription = await createSubscription(registration);

        result = await savePushSubscriptionAction({
          ...serializePushSubscription(subscription),
          userAgent: navigator.userAgent,
        });
      }

      if (!result.ok) {
        setMessage(result.message);
        setIsError(true);
        return;
      }

      setState("enabled");
      setMessage("Powiadomienia są włączone na tym urządzeniu.");
    } catch {
      setMessage("Nie udało się włączyć powiadomień na tym urządzeniu.");
      setIsError(true);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDisable() {
    setIsBusy(true);
    setMessage(null);
    setIsError(false);

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();

      if (!subscription) {
        setState("disabled");
        return;
      }

      // Najpierw serwer: gdyby unsubscribe poszedł pierwszy, przy błędzie
      // sieci stracilibyśmy endpoint i subskrypcja zostałaby aktywna w bazie.
      const result = await disablePushSubscriptionAction(subscription.endpoint);

      if (!result.ok) {
        setMessage(result.message);
        setIsError(true);
        return;
      }

      await subscription.unsubscribe();

      setState("disabled");
      setMessage("Powiadomienia są wyłączone na tym urządzeniu.");
    } catch {
      setMessage("Nie udało się wyłączyć powiadomień na tym urządzeniu.");
      setIsError(true);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div>
      <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
        Powiadomienia
      </p>
      <h2 className="font-display mt-1 text-2xl font-bold text-[#4c3528]">
        Powiadomienia push
      </h2>
      <div className="mt-4">{renderState(state)}</div>

      {message ? (
        <p
          role={isError ? "alert" : "status"}
          className={`mt-3 rounded-xl px-4 py-3 text-sm ${
            isError ? "bg-[#8f3528]/10 text-[#8f3528]" : "bg-moss/12 text-moss"
          }`}
        >
          {message}
        </p>
      ) : null}

      {state === "disabled" ? (
        <ActionButton
          action="meeting"
          size="default"
          type="button"
          onClick={handleEnable}
          disabled={isBusy}
          loading={isBusy}
          loadingLabel="Włączamy powiadomienia…"
          className="mt-4"
        >
          Włącz powiadomienia push
        </ActionButton>
      ) : null}

      {state === "enabled" ? (
        <ActionButton
          action="neutral"
          size="default"
          emphasis="secondary"
          type="button"
          onClick={handleDisable}
          disabled={isBusy}
          loading={isBusy}
          loadingLabel="Wyłączamy powiadomienia…"
          className="mt-4"
        >
          Wyłącz na tym urządzeniu
        </ActionButton>
      ) : null}
    </div>
  );
}

function renderState(state: PushPermissionState | null) {
  if (state === null) {
    return (
      <p className="text-sm text-[#6f5640]">Sprawdzamy stan urządzenia…</p>
    );
  }

  const badges: Record<
    PushPermissionState,
    { label: string; className: string }
  > = {
    enabled: {
      label: "Powiadomienia włączone",
      className: "bg-moss/15 text-moss",
    },
    disabled: {
      label: "Powiadomienia wyłączone",
      className: "bg-black/5 text-[#6f5640]",
    },
    denied: {
      label: "Zgoda odrzucona",
      className: "bg-[#8f3528]/10 text-[#8f3528]",
    },
    "ios-needs-install": {
      label: "Wymaga dodania do ekranu głównego",
      className: "bg-[#f7e7b8] text-[#6d5319]",
    },
    unsupported: {
      label: "Przeglądarka nieobsługiwana",
      className: "bg-black/5 text-[#6f5640]",
    },
  };

  const badge = badges[state];

  return (
    <div>
      <span
        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}
      >
        {badge.label}
      </span>

      {state === "denied" ? (
        <p className="mt-2 text-sm text-[#6f5640]">
          Przeglądarka zapamiętała odmowę. Zmień ją w ustawieniach witryny, a
          potem wróć tutaj.
        </p>
      ) : null}

      {state === "ios-needs-install" ? (
        <p className="mt-2 text-sm text-[#6f5640]">
          Na iPhonie i iPadzie powiadomienia działają dopiero po dodaniu
          aplikacji do ekranu głównego: Udostępnij → „Do ekranu początkowego”.
          Otwórz ją stamtąd i wróć na tę stronę.
        </p>
      ) : null}

      {state === "unsupported" ? (
        <p className="mt-2 text-sm text-[#6f5640]">
          Ta przeglądarka nie obsługuje powiadomień push albo nie są one
          skonfigurowane na serwerze.
        </p>
      ) : null}
    </div>
  );
}
