import { createClient } from "@/lib/supabase/server";
import type {
  AdminFeedbackSubmissionRow,
  FeedbackStatus,
} from "@/features/feedback/types";
import type { AdminAccountRow } from "./types";
import type {
  AdminPointAdjustmentRow,
  AdminReversiblePointEventRow,
} from "./point-adjustments";
import type { AnalyticsSnapshot } from "./analytics-types";
import {
  parseHistoricalBusinessSnapshot,
  type HistoricalBusinessSnapshot,
} from "./historical-analytics";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function rows(value: unknown) {
  return Array.isArray(value) ? value.map(record) : [];
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export async function getAdminAnalyticsSnapshot(
  days = 30,
): Promise<AnalyticsSnapshot> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_analytics_snapshot", {
    p_days: days,
  });
  if (error) throw new Error("Nie udało się pobrać statystyk aplikacji.");

  const snapshot = record(data);
  const kpis = record(snapshot.kpis);
  const questUsage = record(snapshot.quest_usage);

  return {
    rangeDays: numberValue(snapshot.range_days) || days,
    generatedAt: stringValue(snapshot.generated_at),
    kpis: {
      activeToday: numberValue(kpis.active_today),
      active7Days: numberValue(kpis.active_7_days),
      active30Days: numberValue(kpis.active_30_days),
      loginSuccess: numberValue(kpis.login_success),
      loginFailure: numberValue(kpis.login_failure),
      actionErrors: numberValue(kpis.action_errors),
    },
    dailyActivity: rows(snapshot.daily_activity).map((item) => ({
      date: stringValue(item.metric_date),
      eventsCount: numberValue(item.events_count),
      activeUsers: numberValue(item.active_users),
    })),
    routes: rows(snapshot.routes).map((item) => ({
      label: stringValue(item.route_key),
      eventsCount: numberValue(item.events_count),
      uniqueUsers: numberValue(item.unique_users),
    })),
    topComponents: rows(snapshot.top_components).map((item) => ({
      label: stringValue(item.component_key),
      action: stringValue(item.action),
      eventsCount: numberValue(item.events_count),
      uniqueUsers: numberValue(item.unique_users),
    })),
    questUsage: {
      presented: numberValue(questUsage.presented),
      clicked: numberValue(questUsage.clicked),
      completed: numberValue(questUsage.completed),
      expired: numberValue(questUsage.expired),
    },
    funnel: rows(snapshot.funnel).map((item) => ({
      label: stringValue(item.stage),
      eventsCount: numberValue(item.events_count),
    })),
    continuations: rows(snapshot.continuations).map((item) => ({
      label: stringValue(item.stage),
      eventsCount: numberValue(item.events_count),
    })),
    recentLogins: rows(snapshot.recent_logins).map((item) => ({
      displayName: stringValue(item.display_name) || "Nieznany użytkownik",
      createdAt: stringValue(item.created_at),
      deviceClass: stringValue(item.device_class) || "unknown",
      browserFamily: stringValue(item.browser_family) || "Other",
      status: stringValue(item.status),
    })),
    userActivity: rows(snapshot.user_activity).map((item) => ({
      userId: stringValue(item.user_id),
      displayName: stringValue(item.display_name),
      loginCount: numberValue(item.login_count),
      lastLoginAt: nullableString(item.last_login_at),
      lastActivityAt: nullableString(item.last_activity_at),
    })),
    errors: rows(snapshot.errors).map((item) => ({
      createdAt: stringValue(item.created_at),
      displayName: stringValue(item.display_name) || "Nieznany użytkownik",
      errorAction: stringValue(item.error_action),
      errorCode: stringValue(item.error_code),
    })),
    continuedGames: rows(snapshot.continued_games).map((item) => ({
      label: stringValue(item.title),
      eventsCount: numberValue(item.events_count),
    })),
  };
}

export async function getAdminHistoricalBusinessSnapshot(): Promise<HistoricalBusinessSnapshot> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "admin_historical_business_snapshot",
  );
  if (error) {
    throw new Error(
      "Nie udało się pobrać historii odtworzonej z danych aplikacji.",
    );
  }

  return parseHistoricalBusinessSnapshot(data);
}

/**
 * Every account, unfiltered by role/visibility — this is the one place in
 * the app that's meant to see admin/observer rows. Gated entirely by
 * admin_list_accounts()'s own is_admin() check; the /admin route layout is
 * a second, independent guard in front of this.
 */
export async function listAdminAccounts(): Promise<AdminAccountRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_accounts", {});

  if (error) {
    throw new Error("Nie udało się pobrać listy kont.");
  }

  return (data ?? []).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastSignInAt: row.last_sign_in_at,
  }));
}

/**
 * Every feedback submission, including admin_note — gated entirely by
 * admin_list_feedback_submissions()'s own is_admin() check. Regular users
 * never reach this: their own-row RLS select policy on feedback_submissions
 * doesn't even grant them the admin_note column (see the migration).
 */
export async function listAdminFeedbackSubmissions(
  statusFilter?: FeedbackStatus,
): Promise<AdminFeedbackSubmissionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "admin_list_feedback_submissions",
    { p_status_filter: statusFilter },
  );

  if (error) {
    throw new Error("Nie udało się pobrać zgłoszeń użytkowników.");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    authorDisplayName: row.author_display_name,
    content: row.content,
    status: row.status,
    adminNote: row.admin_note,
    createdAt: row.created_at,
  }));
}

export async function listAdminPointAdjustments(): Promise<
  AdminPointAdjustmentRow[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_point_adjustments", {
    p_limit: 40,
  });

  if (error) {
    throw new Error("Nie udało się pobrać historii korekt punktowych.");
  }

  return (data ?? []).map((row) => ({
    adjustmentId: row.adjustment_id,
    adminUserId: row.admin_user_id,
    adminDisplayName: row.admin_display_name,
    targetUserId: row.target_user_id,
    targetDisplayName: row.target_display_name,
    actionType: row.action_type as AdminPointAdjustmentRow["actionType"],
    operation: row.operation as AdminPointAdjustmentRow["operation"],
    delta: row.delta,
    reason: row.reason,
    pointEventId: row.point_event_id,
    reversedPointEventId: row.reversed_point_event_id,
    createdAt: row.created_at,
  }));
}

export async function listAdminReversiblePointEvents(): Promise<
  AdminReversiblePointEventRow[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "admin_list_reversible_point_events",
    { p_limit: 150 },
  );

  if (error) {
    console.error("[admin] reversible point events RPC failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error("Nie udało się pobrać wpisów możliwych do cofnięcia.");
  }

  return (data ?? []).map((row) => ({
    pointEventId: row.point_event_id,
    targetUserId: row.target_user_id,
    targetDisplayName: row.target_display_name,
    actionType: row.action_type as AdminReversiblePointEventRow["actionType"],
    points: row.points,
    description: row.description,
    createdAt: row.created_at,
  }));
}
