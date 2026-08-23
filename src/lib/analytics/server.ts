import "server-only";

import { headers } from "next/headers";
import type { Json } from "@/types/database.generated";
import type { createClient } from "@/lib/supabase/server";
import type { UsageEventInput } from "./catalog";
import { classifyUserAgent } from "./user-agent";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

function appVersion() {
  return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 40) ?? null;
}

export async function recordUsageEventSafely(
  supabase: ServerSupabase,
  input: UsageEventInput,
) {
  try {
    // Critical domain events are often flushed with Next `after()`, where
    // request headers are no longer guaranteed to be available. Device data
    // is therefore reserved for client telemetry and auth audit events.
    const agent = classifyUserAgent(null);
    await supabase.rpc("record_usage_event", {
      p_event_id: input.eventId ?? crypto.randomUUID(),
      p_event_name: input.eventName,
      p_route_key: input.routeKey,
      p_component_key: input.componentKey,
      p_action: input.action,
      p_entity_type: input.entityType,
      p_entity_id: input.entityId,
      p_correlation_key: input.correlationKey,
      p_source: "server",
      p_app_version: appVersion() ?? undefined,
      p_device_class: agent.deviceClass,
      p_browser_family: agent.browserFamily,
      p_metadata: (input.metadata ?? {}) as Json,
    });
  } catch {
    // Telemetry is deliberately best-effort and never changes domain actions.
  }
}

type AuditEventType =
  | "auth.login.success"
  | "auth.logout"
  | "auth.password.changed"
  | "server_action.error";

export async function recordAuditEventSafely(
  supabase: ServerSupabase,
  input: {
    eventType: AuditEventType;
    status: "success" | "failure" | "denied" | "error";
    routeKey?:
      | "login"
      | "profile"
      | "password"
      | "table"
      | "calendar"
      | "chronicle"
      | "shelf"
      | "legendarium"
      | "admin"
      | "admin.statistics";
    requestId?: string;
    idempotencyKey?: string;
    metadata?: { error_action?: string; error_code?: string };
  },
) {
  try {
    const requestHeaders = await headers();
    const agent = classifyUserAgent(requestHeaders.get("user-agent"));
    await supabase.rpc("record_audit_event", {
      p_event_id: crypto.randomUUID(),
      p_event_type: input.eventType,
      p_status: input.status,
      p_route_key: input.routeKey,
      p_device_class: agent.deviceClass,
      p_browser_family: agent.browserFamily,
      p_request_id: input.requestId,
      p_idempotency_key: input.idempotencyKey,
      p_metadata: (input.metadata ?? {}) as Json,
    });
  } catch {
    // Authentication and domain behavior must not depend on telemetry.
  }
}

function safeAuditToken(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim().slice(0, 80);
  return normalized && /^[a-z0-9._:-]+$/i.test(normalized)
    ? normalized
    : fallback;
}

export async function recordServerActionErrorSafely(
  supabase: ServerSupabase,
  input: {
    routeKey: NonNullable<
      Parameters<typeof recordAuditEventSafely>[1]["routeKey"]
    >;
    action: string;
    errorCode?: string | null;
  },
) {
  await recordAuditEventSafely(supabase, {
    eventType: "server_action.error",
    status: "error",
    routeKey: input.routeKey,
    requestId: crypto.randomUUID(),
    metadata: {
      error_action: safeAuditToken(input.action, "unknown_action"),
      error_code: safeAuditToken(input.errorCode, "unknown_error"),
    },
  });
}
