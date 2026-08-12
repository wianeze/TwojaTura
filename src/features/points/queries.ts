import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getUserPointBalanceResult = cache(async (userId: string) => {
  const supabase = await createClient();
  return supabase
    .from("user_point_balances")
    .select("total_points")
    .eq("user_id", userId)
    .maybeSingle();
});
