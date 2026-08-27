import { createClient } from "@/lib/supabase/server";
import { getUserPointBalanceResult } from "@/features/points/queries";
import type { CurrentMember } from "@/features/auth/types";
import { createLegendariumReadPlan } from "./read-plan";
import {
  buildAchievementProgressMap,
  isRealLastPlace,
} from "./achievement-progress";
import {
  getCurrentLegendariumRank,
  mapLegendariumLeaderboard,
} from "./view-model";
import {
  mapAchievementCatalog,
  mapActiveClassesByUser,
  mapCharacterClasses,
  mapLeaderboardBadges,
  type AchievementAwardSource,
  type AchievementDefinitionSource,
  type AchievementView,
  type ActiveClassView,
  type ClassDefinitionSource,
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
  activeClass: ActiveClassView | null;
  activePortraitFrameKey: string | null;
  equippedTitle: {
    id: string;
    name: string;
    rarity: "common" | "rare" | "epic" | "legendary";
  } | null;
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
  currentActiveClass: ActiveClassView | null;
};

export type AchievementClassData = {
  achievements: AchievementView[];
  classes: CharacterClassView[];
  recentAchievements: AchievementView[];
  badgesByUser: ReturnType<typeof mapLeaderboardBadges>;
  activeClassesByUser: Record<string, ActiveClassView>;
  activePortraitFramesByUser: Record<string, string | null>;
  playerTitlesByUser: Record<
    string,
    { id: string | null; name: string | null; rarity: "common" | "rare" | "epic" | "legendary" }
  >;
  currentActiveClass: ActiveClassView | null;
};

export async function getAchievementClassData(
  currentUserId: string,
): Promise<AchievementClassData> {
  const supabase = await createClient();
  const plan = createLegendariumReadPlan(currentUserId);
  const [
    definitionsResult,
    awardsResult,
    classesResult,
    requirementsResult,
    ownedMeetingsResult,
    ratingsResult,
    ownedGamesResult,
    ownPlaysResult,
    responsesResult,
    ownParticipantsResult,
    profilesResult,
  ] = await Promise.all([
    supabase
      .from(plan.achievements.definitionsTable)
      .select(
        "achievement_key, name, description, condition_text, rarity, points, icon_path, is_secret, is_manual, sort_order",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from(plan.achievements.awardsTable)
      .select("user_id, achievement_key, awarded_at")
      .order("awarded_at", { ascending: false }),
    supabase
      .from(plan.classes.definitionsTable)
      .select("class_key, name, description, playstyle, icon_path, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from(plan.classes.requirementsTable)
      .select("class_key, achievement_key"),
    supabase
      .from("meetings")
      .select("id, status")
      .eq("created_by", currentUserId)
      .is("deleted_at", null),
    supabase
      .from("ratings")
      .select("game_id, overall, wants_to_play_again, comment")
      .eq("user_id", currentUserId),
    supabase
      .from("games")
      .select("id")
      .eq("owner_id", currentUserId)
      .is("archived_at", null),
    supabase
      .from("plays")
      .select("id, meeting_id")
      .eq("created_by", currentUserId)
      .eq("status", "completed"),
    supabase
      .from("meeting_availability")
      .select("meeting_id")
      .eq("user_id", currentUserId),
    supabase
      .from("play_participants")
      .select("play_id, placement, is_winner")
      .eq("user_id", currentUserId),
    // Wąska projekcja zamiast odczytu z `profiles`: polityka na tej tabeli
    // ukrywa wiersze admina przed zwykłym członkiem, przez co aktywny admin
    // trafiałby do Legendarium bez klasy postaci i bez ramki portretu.
    // Funkcja zwraca wyłącznie dane publiczne — email jest poza jej listą
    // kolumn.
    supabase.rpc("get_public_player_profiles"),
  ]);

  if (
    definitionsResult.error ||
    awardsResult.error ||
    classesResult.error ||
    requirementsResult.error ||
    ownedMeetingsResult.error ||
    ratingsResult.error ||
    ownedGamesResult.error ||
    ownPlaysResult.error ||
    responsesResult.error ||
    ownParticipantsResult.error ||
    profilesResult.error
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
    isManual: definition.is_manual,
    sortOrder: definition.sort_order,
  }));
  const awards: AchievementAwardSource[] = (awardsResult.data ?? []).map(
    (award) => ({
      userId: award.user_id,
      achievementKey: award.achievement_key,
      awardedAt: award.awarded_at,
    }),
  );
  const classDefinitions: ClassDefinitionSource[] = (
    classesResult.data ?? []
  ).map((characterClass) => ({
    classKey: characterClass.class_key,
    name: characterClass.name,
    description: characterClass.description,
    playstyle: characterClass.playstyle,
    iconPath: characterClass.icon_path,
    sortOrder: characterClass.sort_order,
  }));
  const activeClassesByUser = mapActiveClassesByUser(
    classDefinitions,
    (profilesResult.data ?? []).map((profile) => ({
      userId: profile.user_id,
      activeClassKey: profile.active_class_key,
    })),
  );
  const currentActiveClass = activeClassesByUser[currentUserId] ?? null;
  const activePortraitFramesByUser = Object.fromEntries(
    (profilesResult.data ?? []).map((profile) => [
      profile.user_id,
      profile.active_portrait_frame_key,
    ]),
  );
  const playerTitlesByUser = Object.fromEntries(
    (profilesResult.data ?? []).map((profile) => {
      const rarity = profile.equipped_title_rarity;
      return [
        profile.user_id,
        {
          id: profile.equipped_title_id,
          name: profile.equipped_title_name,
          rarity: (["common", "rare", "epic", "legendary"].includes(rarity ?? "") ? rarity : "common") as "common" | "rare" | "epic" | "legendary",
        },
      ];
    }),
  );
  const ownMeetingIds = (ownedMeetingsResult.data ?? []).map(
    (meeting) => meeting.id,
  );
  const ownParticipantPlayIds = (ownParticipantsResult.data ?? []).map(
    (participant) => participant.play_id,
  );

  const [
    completedPlaysResult,
    ownCompletedPlaysResult,
    allParticipantsResult,
  ] = await Promise.all([
    ownMeetingIds.length > 0
      ? supabase
          .from("plays")
          .select("meeting_id")
          .in("meeting_id", ownMeetingIds)
          .eq("status", "completed")
      : Promise.resolve({ data: [], error: null }),
    ownParticipantPlayIds.length > 0
      ? supabase
          .from("plays")
          .select(
            "id, game_id, meeting_id, played_at, created_at, mode, team_result",
          )
          .in("id", ownParticipantPlayIds)
          .eq("status", "completed")
      : Promise.resolve({ data: [], error: null }),
    ownParticipantPlayIds.length > 0
      ? supabase
          .from("play_participants")
          .select("play_id, user_id, placement")
          .in("play_id", ownParticipantPlayIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (
    completedPlaysResult.error ||
    ownCompletedPlaysResult.error ||
    allParticipantsResult.error
  ) {
    throw new Error("Nie udaÅ‚o siÄ™ obliczyÄ‡ progresu odznak.");
  }

  const completedGameIds = Array.from(
    new Set(
      (ownCompletedPlaysResult.data ?? []).map((play) => play.game_id),
    ),
  );
  const playedGamesResult =
    completedGameIds.length > 0
      ? await supabase
          .from("games")
          .select("id, bgg_weight")
          .in("id", completedGameIds)
      : { data: [], error: null };

  if (playedGamesResult.error) {
    throw new Error("Nie udało się obliczyć progresu trudnych gier.");
  }

  // Only completed plays may feed result-based achievement progress
  // (win/last-place streaks, party size) — an in_progress game has no final
  // placements/winner yet.
  const completedOwnParticipantPlayIds = (
    ownCompletedPlaysResult.data ?? []
  ).map((play) => play.id);

  if (allParticipantsResult.error) {
    throw new Error("Nie udaÅ‚o siÄ™ obliczyÄ‡ progresu odznak.");
  }

  const completedOwnParticipantIdSet = new Set(completedOwnParticipantPlayIds);
  const participantsByPlay = new Map<
    string,
    Array<{ placement: number | null }>
  >();
  for (const participant of allParticipantsResult.data ?? []) {
    if (!completedOwnParticipantIdSet.has(participant.play_id)) continue;
    const existing = participantsByPlay.get(participant.play_id) ?? [];
    existing.push({ placement: participant.placement });
    participantsByPlay.set(participant.play_id, existing);
  }
  const playsById = new Map(
    (ownCompletedPlaysResult.data ?? []).map((play) => [play.id, play]),
  );
  const weightByGameId = new Map(
    (playedGamesResult.data ?? []).map((game) => [
      game.id,
      game.bgg_weight === null ? null : Number(game.bgg_weight),
    ]),
  );
  const ownResults = (ownParticipantsResult.data ?? [])
    .filter((participant) =>
      completedOwnParticipantIdSet.has(participant.play_id),
    )
    .map((participant) => ({
      ...participant,
      play: playsById.get(participant.play_id),
    }));
  const lastPlaceFinishes = ownResults.filter((participant) => {
    const players = participantsByPlay.get(participant.play_id) ?? [];
    const placements = players.map((player) => player.placement);
    return isRealLastPlace(placements, participant.placement);
  }).length;
  const orderedResults = ownResults
    .filter((participant) => participant.play)
    .sort(
      (a, b) =>
        a.play!.played_at.localeCompare(b.play!.played_at) ||
        a.play!.created_at.localeCompare(b.play!.created_at) ||
        a.play_id.localeCompare(b.play_id),
    );
  // Musi odpowiadać regule dark_urge z private.qualifies_for_achievement:
  // zwycięstwo to wyłącznie is_winner (człon `placement === 1` zniknął razem z
  // wprowadzeniem trybu kooperacyjnego), a partia bez rozstrzygnięcia —
  // kooperacja bez zapisanego wyniku drużyny — nie jest liczona ani jako
  // zwycięstwo, ani jako przerwanie serii. Rozjazd tych dwóch implementacji
  // objawiłby się paskiem postępu niezgodnym z faktycznie przyznaną odznaką.
  let currentWinStreak = 0;
  for (const participant of orderedResults) {
    const hasResult =
      participant.play!.mode === "competitive" ||
      participant.play!.team_result !== null;
    if (!hasResult) continue;

    if (participant.is_winner) {
      currentWinStreak += 1;
    } else {
      currentWinStreak = 0;
    }
  }
  const progressByKey = buildAchievementProgressMap({
    completedMeetingsOrganized: (ownedMeetingsResult.data ?? []).filter(
      (meeting) => meeting.status === "completed",
    ).length,
    completedMeetingsHosted: new Set(
      (completedPlaysResult.data ?? [])
        .map((play) => play.meeting_id)
        .filter((meetingId): meetingId is string => Boolean(meetingId)),
    ).size,
    ratingComments: (ratingsResult.data ?? []).filter((rating) =>
      Boolean(rating.comment?.trim()),
    ).length,
    playsCreated: (ownPlaysResult.data ?? []).length,
    meetingResponses: (responsesResult.data ?? []).length,
    activeOwnedGames: (ownedGamesResult.data ?? []).length,
    perfectRatings: new Set(
      (ratingsResult.data ?? [])
        .filter((rating) => rating.overall === 10)
        .map((rating) => rating.game_id),
    ).size,
    replayRatings: new Set(
      (ratingsResult.data ?? [])
        .filter((rating) => rating.wants_to_play_again)
        .map((rating) => rating.game_id),
    ).size,
    hasFirstWin: ownResults.some((participant) => participant.is_winner),
    lastPlaceFinishes,
    hasFullParty: ownResults.some(
      (participant) =>
        (participantsByPlay.get(participant.play_id)?.length ?? 0) >= 5,
    ),
    hasSoloPlay: ownResults.some(
      (participant) =>
        (participantsByPlay.get(participant.play_id)?.length ?? 0) === 1,
    ),
    hasSideQuest: ownResults.some(
      (participant) => participant.play?.meeting_id === null,
    ),
    currentWinStreak,
    heavyGamesPlayed: new Set(
      ownResults
        .filter(
          (participant) =>
            participant.play &&
            (weightByGameId.get(participant.play.game_id) ?? 0) >= 3.5,
        )
        .map((participant) => participant.play!.game_id),
    ).size,
    heavyGamesWon: new Set(
      ownResults
        .filter(
          (participant) =>
            participant.is_winner &&
            participant.play &&
            (weightByGameId.get(participant.play.game_id) ?? 0) >= 4,
        )
        .map((participant) => participant.play!.game_id),
    ).size,
  });
  const achievements = mapAchievementCatalog(
    definitions,
    awards,
    currentUserId,
    undefined,
    progressByKey,
  );

  return {
    achievements,
    classes: mapCharacterClasses(
      classDefinitions,
      (requirementsResult.data ?? []).map((requirement) => ({
        classKey: requirement.class_key,
        achievementKey: requirement.achievement_key,
      })),
      definitions,
      awards,
      currentUserId,
      undefined,
      currentActiveClass?.key ?? null,
    ),
    recentAchievements: achievements
      .filter((achievement) => achievement.state === "acquired")
      .sort((a, b) => (b.awardedAt ?? "").localeCompare(a.awardedAt ?? "")),
    badgesByUser: mapLeaderboardBadges(definitions, awards),
    activeClassesByUser,
    activePortraitFramesByUser,
    playerTitlesByUser,
    currentActiveClass,
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
    getUserPointBalanceResult(plan.balance.userId),
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
    (leaderboardResult.data ?? []).map((entry) => {
      const title = achievementData.playerTitlesByUser[entry.user_id];
      return {
        userId: entry.user_id,
        displayName: entry.display_name,
        avatarUrl: entry.avatar_url,
        totalPoints: Number(entry.total_points ?? 0),
        rank: Number(entry.rank ?? 0),
        badges: achievementData.badgesByUser[entry.user_id] ?? [],
        activeClass: achievementData.activeClassesByUser[entry.user_id] ?? null,
        activePortraitFrameKey:
          achievementData.activePortraitFramesByUser[entry.user_id] ?? null,
        equippedTitle:
          title?.id && title.name
            ? { id: title.id, name: title.name, rarity: title.rarity }
            : null,
      };
    }),
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
    currentActiveClass: achievementData.currentActiveClass,
  };
}
