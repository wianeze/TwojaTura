import { createClient } from "@/lib/supabase/server";
import type {
  AdminPushAudienceRow,
  AdminPushAudienceSummary,
  AdminPushCampaignRow,
  PushMeetingOption,
} from "./types";

const EMPTY_SUMMARY: AdminPushAudienceSummary = {
  userCount: 0,
  subscriptionCount: 0,
  usersWithoutSubscription: 0,
};

/**
 * Lista odbiorców dla panelu administratora.
 *
 * Zwraca wyłącznie liczbę aktywnych urządzeń — nigdy endpointów ani kluczy
 * subskrypcji. RPC dodatkowo sprawdza rolę administratora po stronie bazy,
 * więc ukrycie linku w UI nie jest tu żadnym zabezpieczeniem.
 */
export async function listAdminPushAudience(): Promise<AdminPushAudienceRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_list_push_audience");

  if (error || !data) return [];

  return data.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    role: row.role,
    activeSubscriptionCount: row.active_subscription_count,
  }));
}

export async function getAdminPushAudienceSummary(
  recipientUserIds: string[] | null,
): Promise<AdminPushAudienceSummary> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_push_audience_summary", {
    // Pominięty argument oznacza w SQL null, czyli „wszyscy aktywni”.
    p_recipient_user_ids: recipientUserIds ?? undefined,
  });

  const row = data?.[0];
  if (error || !row) return EMPTY_SUMMARY;

  return {
    userCount: row.user_count,
    subscriptionCount: row.subscription_count,
    usersWithoutSubscription: row.users_without_subscription,
  };
}

/**
 * Historia techniczna wysyłek — do diagnostyki i retry, nie do czytania przez
 * zwykłych użytkowników. Nie zawiera endpointów ani kluczy.
 */
export async function listAdminPushCampaigns(
  limit = 20,
): Promise<AdminPushCampaignRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_list_push_campaigns", {
    p_limit: limit,
  });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    actionUrl: row.action_url,
    templateKey: row.template_key,
    createdAt: row.created_at,
    createdByName: row.created_by_name,
    recipientUserCount: row.recipient_user_count,
    deviceCount: row.device_count,
    sentCount: row.sent_count,
    queuedCount: row.queued_count,
    failedCount: row.failed_count,
    skippedCount: row.skipped_count,
  }));
}

/**
 * Spotkania możliwe do wskazania w szablonach: wyłącznie przyszłe, nieusunięte
 * i jeszcze nierozegrane. Link z szablonu prowadzi na stronę spotkania.
 */
export async function listUpcomingMeetingsForPush(): Promise<
  PushMeetingOption[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meetings")
    .select("id, title, starts_at")
    .is("deleted_at", null)
    .in("status", ["planned", "confirmed"])
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(30);

  if (error || !data) return [];

  return data.map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    startsAt: meeting.starts_at,
  }));
}
