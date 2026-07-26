import { createClient } from "@/lib/supabase/server";
import type {
  AdminFeedbackSubmissionRow,
  FeedbackStatus,
} from "@/features/feedback/types";
import type { AdminAccountRow } from "./types";

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
