import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";
import {
  assertCurrentMemberQuerySuccess,
  mapCurrentMember,
} from "../current-member";
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

  assertCurrentMemberQuerySuccess("membership", userId, membershipError);

  const membership = membershipRows?.[0] ?? null;

  if (!membership || !membership.is_active) {
    return mapCurrentMember(userId, membership, null);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, display_name, email, avatar_url, active_portrait_frame_key, active_class_key, equipped_title:title_definitions!profiles_equipped_title_id_fkey(id, name, rarity)",
    )
    .eq("id", userId)
    .maybeSingle();

  assertCurrentMemberQuerySuccess("profile", userId, profileError);

  return mapCurrentMember(userId, membership, profile);
}

export const getCurrentMember = cache(async function getCurrentMember() {
  const supabase = await createClient();
  return getCurrentMemberFromClient(supabase);
});
