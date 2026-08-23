export const USAGE_EVENT_NAMES = [
  "route.viewed",
  "quest.presented",
  "quest.clicked",
  "quest.completed",
  "meeting.created",
  "meeting.rsvp.submitted",
  "meeting.vote.submitted",
  "meeting.game.proposed",
  "meeting.continuation.proposed",
  "meeting.table.opened",
  "meeting.play.resumed",
  "meeting.play.paused",
  "meeting.play.finished",
  "game.opened",
  "game.added",
  "play.created",
  "rating.submitted",
  "class.changed",
  "achievement.viewed",
] as const;

export const ROUTE_KEYS = [
  "table",
  "shelf",
  "legendarium",
  "calendar",
  "chronicle",
  "profile",
  "admin",
  "admin.statistics",
] as const;

export const COMPONENT_KEYS = [
  "app.route",
  "dashboard.quest",
  "meeting.form",
  "meeting.rsvp",
  "meeting.vote",
  "meeting.game_proposal",
  "meeting.continuation",
  "meeting.table",
  "game.card",
  "game.form",
  "play.form",
  "rating.form",
  "profile.class",
  "legendarium.achievement",
] as const;

export const ANALYTICS_ACTIONS = [
  "viewed",
  "presented",
  "clicked",
  "completed",
  "created",
  "submitted",
  "proposed",
  "opened",
  "resumed",
  "paused",
  "finished",
  "added",
  "changed",
] as const;

export const ENTITY_TYPES = [
  "meeting",
  "game",
  "play",
  "quest",
  "class",
  "achievement",
] as const;

export type UsageEventName = (typeof USAGE_EVENT_NAMES)[number];
export type AnalyticsRouteKey = (typeof ROUTE_KEYS)[number];
export type AnalyticsComponentKey = (typeof COMPONENT_KEYS)[number];
export type AnalyticsAction = (typeof ANALYTICS_ACTIONS)[number];
export type AnalyticsEntityType = (typeof ENTITY_TYPES)[number];

export type AnalyticsMetadata = Partial<{
  quest_type: string;
  expires_at: string;
  meeting_id: string;
  game_id: string;
  play_id: string;
  class_key: string;
  achievement_key: string;
}>;

export type UsageEventInput = {
  eventId?: string;
  eventName: UsageEventName;
  routeKey?: AnalyticsRouteKey;
  componentKey?: AnalyticsComponentKey;
  action?: AnalyticsAction;
  entityType?: AnalyticsEntityType;
  entityId?: string;
  correlationKey?: string;
  metadata?: AnalyticsMetadata;
};

const eventNames = new Set<string>(USAGE_EVENT_NAMES);
const routeKeys = new Set<string>(ROUTE_KEYS);
const componentKeys = new Set<string>(COMPONENT_KEYS);
const actions = new Set<string>(ANALYTICS_ACTIONS);
const entityTypes = new Set<string>(ENTITY_TYPES);

const metadataKeysByEvent: Record<UsageEventName, ReadonlySet<string>> = {
  "route.viewed": new Set(),
  "quest.presented": new Set([
    "quest_type",
    "expires_at",
    "meeting_id",
    "game_id",
    "play_id",
  ]),
  "quest.clicked": new Set([
    "quest_type",
    "expires_at",
    "meeting_id",
    "game_id",
    "play_id",
  ]),
  "quest.completed": new Set([
    "quest_type",
    "expires_at",
    "meeting_id",
    "game_id",
    "play_id",
  ]),
  "meeting.created": new Set(["meeting_id"]),
  "meeting.rsvp.submitted": new Set(["meeting_id"]),
  "meeting.vote.submitted": new Set(["meeting_id", "game_id", "play_id"]),
  "meeting.game.proposed": new Set(["meeting_id", "game_id"]),
  "meeting.continuation.proposed": new Set([
    "meeting_id",
    "game_id",
    "play_id",
  ]),
  "meeting.table.opened": new Set(["meeting_id"]),
  "meeting.play.resumed": new Set(["meeting_id", "game_id", "play_id"]),
  "meeting.play.paused": new Set(["meeting_id", "game_id", "play_id"]),
  "meeting.play.finished": new Set(["meeting_id", "game_id", "play_id"]),
  "game.opened": new Set(["game_id"]),
  "game.added": new Set(["game_id"]),
  "play.created": new Set(["meeting_id", "game_id", "play_id"]),
  "rating.submitted": new Set(["meeting_id", "game_id", "play_id"]),
  "class.changed": new Set(["class_key"]),
  "achievement.viewed": new Set(["achievement_key"]),
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalCatalogValue<T extends string>(
  value: unknown,
  catalog: ReadonlySet<string>,
): T | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === "string" && catalog.has(value)
    ? (value as T)
    : null;
}

function isSafeMetadataValue(key: string, value: unknown) {
  if (typeof value !== "string" || value.length === 0 || value.length > 180) {
    return false;
  }

  if (key.endsWith("_id")) return UUID_PATTERN.test(value);
  if (key === "expires_at") return !Number.isNaN(Date.parse(value));
  return /^[a-z0-9_.:-]+$/i.test(value);
}

export function parseUsageEventPayload(
  payload: unknown,
): { ok: true; data: UsageEventInput } | { ok: false; error: string } {
  if (!isRecord(payload)) return { ok: false, error: "invalid_payload" };

  const serializedSize = JSON.stringify(payload).length;
  if (serializedSize > 4096) return { ok: false, error: "payload_too_large" };

  if (typeof payload.eventName !== "string" || !eventNames.has(payload.eventName)) {
    return { ok: false, error: "unknown_event" };
  }
  const eventName = payload.eventName as UsageEventName;

  const eventId = payload.eventId;
  if (eventId !== undefined && (typeof eventId !== "string" || !UUID_PATTERN.test(eventId))) {
    return { ok: false, error: "invalid_event_id" };
  }

  const routeKey = optionalCatalogValue<AnalyticsRouteKey>(payload.routeKey, routeKeys);
  const componentKey = optionalCatalogValue<AnalyticsComponentKey>(
    payload.componentKey,
    componentKeys,
  );
  const action = optionalCatalogValue<AnalyticsAction>(payload.action, actions);
  const entityType = optionalCatalogValue<AnalyticsEntityType>(
    payload.entityType,
    entityTypes,
  );
  if ([routeKey, componentKey, action, entityType].includes(null)) {
    return { ok: false, error: "unknown_catalog_value" };
  }

  const entityId = payload.entityId;
  if (entityId !== undefined && (typeof entityId !== "string" || !UUID_PATTERN.test(entityId))) {
    return { ok: false, error: "invalid_entity_id" };
  }

  const correlationKey = payload.correlationKey;
  if (
    correlationKey !== undefined &&
    (typeof correlationKey !== "string" ||
      correlationKey.length === 0 ||
      correlationKey.length > 180 ||
      !/^[a-z0-9_.:-]+$/i.test(correlationKey))
  ) {
    return { ok: false, error: "invalid_correlation_key" };
  }

  const metadata = payload.metadata ?? {};
  if (!isRecord(metadata)) return { ok: false, error: "invalid_metadata" };
  const allowedKeys = metadataKeysByEvent[eventName];
  for (const [key, value] of Object.entries(metadata)) {
    if (!allowedKeys.has(key) || !isSafeMetadataValue(key, value)) {
      return { ok: false, error: "unsupported_metadata" };
    }
  }

  return {
    ok: true,
    data: {
      eventId,
      eventName,
      routeKey: routeKey ?? undefined,
      componentKey: componentKey ?? undefined,
      action: action ?? undefined,
      entityType: entityType ?? undefined,
      entityId,
      correlationKey,
      metadata: metadata as AnalyticsMetadata,
    },
  };
}

export function mapPathnameToRouteKey(
  pathname: string,
): AnalyticsRouteKey | null {
  const path = pathname.split("?")[0]?.replace(/\/+$/, "") || "/";
  if (path === "/") return "table";
  if (path === "/admin/statystyki") return "admin.statistics";
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  if (path === "/gry" || path.startsWith("/gry/")) return "shelf";
  if (path === "/legendarium" || path.startsWith("/legendarium/")) {
    return "legendarium";
  }
  if (path === "/kalendarium" || path.startsWith("/kalendarium/")) {
    return "calendar";
  }
  if (path === "/kronika" || path.startsWith("/kronika/")) {
    return "chronicle";
  }
  if (path === "/profil" || path.startsWith("/profil/")) return "profile";
  return null;
}
