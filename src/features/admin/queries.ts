import { createClient } from "@/lib/supabase/server";
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
