"use client";

import type { UsageEventInput } from "./catalog";

export function trackUsage(input: UsageEventInput) {
  const payload = JSON.stringify({
    ...input,
    eventId: input.eventId ?? crypto.randomUUID(),
  });

  void fetch("/api/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}
