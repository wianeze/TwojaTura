import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";
import { mapCurrentMember } from "../current-member";
import type { CurrentMemberState } from "../types";

export async function getCurrentMemberFromClient(
  supabase: SupabaseClient<Database>,
): Promise<CurrentMemberState> {
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") {
    return { status: "anonymous" };
  }

  const { data: membershipRows, error: membershipError } = await supabase.rpc(
    "get_own_membership_status",
  );

  if (membershipError) {
    return { status: "authenticated-but-not-member", userId };
  }

  const membership = membershipRows?.[0] ?? null;

  if (!membership || !membership.is_active) {
    return mapCurrentMember(userId, membership, null);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  return mapCurrentMember(userId, membership, profile);
}

export async function getCurrentMember() {
  const supabase = await createClient();
  return getCurrentMemberFromClient(supabase);
}
