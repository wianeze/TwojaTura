import { createClient } from "@/lib/supabase/server";
import type { CurrentMember } from "@/features/auth/types";
import { createLegendariumReadPlan } from "./read-plan";
import {
  getCurrentLegendariumRank,
  mapLegendariumLeaderboard,
} from "./view-model";

export type LegendariumLeaderboardEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string;
  totalPoints: number;
  rank: number;
  isCurrentMember: boolean;
};

export type LegendariumPointEvent = {
  id: string;
  actionType: string;
  description: string | null;
  points: number;
  createdAt: string;
};

export type LegendariumData = {
  currentPoints: number;
  currentRank: number | null;
  leaderboard: LegendariumLeaderboardEntry[];
  recentEvents: LegendariumPointEvent[];
};

export async function getLegendariumData(
  member: CurrentMember,
): Promise<LegendariumData> {
  const supabase = await createClient();
  const plan = createLegendariumReadPlan(member.id);

  const [balanceResult, leaderboardResult, recentEventsResult] =
    await Promise.all([
      supabase
        .from(plan.balance.table)
        .select("total_points")
        .eq("user_id", plan.balance.userId)
        .maybeSingle(),
      supabase.rpc(plan.leaderboardRpc),
      supabase
        .from(plan.recentEvents.table)
        .select("id, action_type, description, points, created_at")
        .eq("user_id", plan.recentEvents.userId)
        .order("created_at", { ascending: false })
        .limit(plan.recentEvents.limit),
    ]);

  if (
    balanceResult.error ||
    leaderboardResult.error ||
    recentEventsResult.error
  ) {
    throw new Error("Nie udało się pobrać danych Legendarium.");
  }

  const leaderboard = mapLegendariumLeaderboard(
    (leaderboardResult.data ?? []).map((entry) => ({
      userId: entry.user_id,
      displayName: entry.display_name,
      avatarUrl: entry.avatar_url,
      totalPoints: Number(entry.total_points ?? 0),
      rank: Number(entry.rank ?? 0),
    })),
    member.id,
  );

  return {
    currentPoints: Number(balanceResult.data?.total_points ?? 0),
    currentRank: getCurrentLegendariumRank(leaderboard),
    leaderboard,
    recentEvents: (recentEventsResult.data ?? []).map((event) => ({
      id: event.id,
      actionType: event.action_type,
      description: event.description,
      points: Number(event.points),
      createdAt: event.created_at,
    })),
  };
}
