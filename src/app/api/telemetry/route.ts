import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseUsageEventPayload } from "@/lib/analytics/catalog";
import { classifyUserAgent } from "@/lib/analytics/user-agent";

const MAX_BODY_BYTES = 4096;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ ok: false }, { status: 415 });
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = parseUsageEventPayload(raw);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = await createClient();
  const agent = classifyUserAgent(request.headers.get("user-agent"));
  const { error } = await supabase.rpc("record_usage_event", {
    p_event_id: parsed.data.eventId ?? crypto.randomUUID(),
    p_event_name: parsed.data.eventName,
    p_route_key: parsed.data.routeKey,
    p_component_key: parsed.data.componentKey,
    p_action: parsed.data.action,
    p_entity_type: parsed.data.entityType,
    p_entity_id: parsed.data.entityId,
    p_correlation_key: parsed.data.correlationKey,
    p_source: "client",
    p_app_version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 40),
    p_device_class: agent.deviceClass,
    p_browser_family: agent.browserFamily,
    p_metadata: parsed.data.metadata ?? {},
  });

  if (error) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}
