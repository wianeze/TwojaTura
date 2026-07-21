import { createClient } from "@/lib/supabase/server";
import type { CurrentMember } from "@/features/auth/types";
import { createLegendariumReadPlan } from "./read-plan";
import {
  getCurrentLegendariumRank,
  mapLegendariumLeaderboard,
} from "./view-model";
import {
  mapAchievementCatalog,
  mapCharacterClasses,
  mapLeaderboardBadges,
  type AchievementAwardSource,
  type AchievementDefinitionSource,
  type AchievementView,
  type CharacterClassView,
} from "./achievement-view-model";

export type LegendariumLeaderboardEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string;
  totalPoints: number;
  rank: number;
  isCurrentMember: boolean;
  badges: ReturnType<typeof mapLeaderboardBadges>[string];
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
  achievements: AchievementView[];
  classes: CharacterClassView[];
};

export type AchievementClassData = {
  achievements: AchievementView[];
  classes: CharacterClassView[];
  recentAchievements: AchievementView[];
  badgesByUser: ReturnType<typeof mapLeaderboardBadges>;
};

export async function getAchievementClassData(
  currentUserId: string,
): Promise<AchievementClassData> {
  const supabase = await createClient();
  const plan = createLegendariumReadPlan(currentUserId);
  const [definitionsResult, awardsResult, classesResult, requirementsResult] =
    await Promise.all([
      supabase
        .from(plan.achievements.definitionsTable)
        .select(
          "achievement_key, name, description, condition_text, rarity, points, icon_path, is_secret, sort_order",
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from(plan.achievements.awardsTable)
        .select("user_id, achievement_key, awarded_at")
        .order("awarded_at", { ascending: false }),
      supabase
        .from(plan.classes.definitionsTable)
        .select(
          "class_key, name, description, playstyle, icon_path, sort_order",
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from(plan.classes.requirementsTable)
        .select("class_key, achievement_key"),
    ]);

  if (
    definitionsResult.error ||
    awardsResult.error ||
    classesResult.error ||
    requirementsResult.error
  ) {
    throw new Error("Nie udało się pobrać odznak i klas postaci.");
  }

  const definitions: AchievementDefinitionSource[] = (
    definitionsResult.data ?? []
  ).map((definition) => ({
    achievementKey: definition.achievement_key,
    name: definition.name,
    description: definition.description,
    conditionText: definition.condition_text,
    rarity: definition.rarity,
    points: definition.points,
    iconPath: definition.icon_path,
    isSecret: definition.is_secret,
    sortOrder: definition.sort_order,
  }));
  const awards: AchievementAwardSource[] = (awardsResult.data ?? []).map(
    (award) => ({
      userId: award.user_id,
      achievementKey: award.achievement_key,
      awardedAt: award.awarded_at,
    }),
  );
  const achievements = mapAchievementCatalog(
    definitions,
    awards,
    currentUserId,
  );

  return {
    achievements,
    classes: mapCharacterClasses(
      (classesResult.data ?? []).map((characterClass) => ({
        classKey: characterClass.class_key,
        name: characterClass.name,
        description: characterClass.description,
        playstyle: characterClass.playstyle,
        iconPath: characterClass.icon_path,
        sortOrder: characterClass.sort_order,
      })),
      (requirementsResult.data ?? []).map((requirement) => ({
        classKey: requirement.class_key,
        achievementKey: requirement.achievement_key,
      })),
      definitions,
      awards,
      currentUserId,
    ),
    recentAchievements: achievements
      .filter((achievement) => achievement.state === "acquired")
      .sort((a, b) => (b.awardedAt ?? "").localeCompare(a.awardedAt ?? "")),
    badgesByUser: mapLeaderboardBadges(definitions, awards),
  };
}

export async function getLegendariumData(
  member: CurrentMember,
): Promise<LegendariumData> {
  const supabase = await createClient();
  const plan = createLegendariumReadPlan(member.id);

  const [
    balanceResult,
    leaderboardResult,
    recentEventsResult,
    achievementData,
  ] = await Promise.all([
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
    getAchievementClassData(member.id),
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
      badges: achievementData.badgesByUser[entry.user_id] ?? [],
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
    achievements: achievementData.achievements,
    classes: achievementData.classes,
  };
}
