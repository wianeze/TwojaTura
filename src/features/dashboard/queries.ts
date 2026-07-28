import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { mapActiveClassesByUser } from "@/features/legendarium/achievement-view-model";
import {
  getMeetingVisualLabel,
  getMeetingVisualState,
} from "@/features/meetings/calendar-view";
import { sortMeetingRanking } from "@/features/meetings/validation";
import { listRecentMemberPlays } from "@/features/plays/queries";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.generated";
import {
  buildDashboardHeroSummary,
  buildDashboardPointsSummary,
  buildLeaderboardPreview,
  buildRecentPlayPreviews,
  formatDashboardWinnerSummary,
  pickUpcomingMeeting,
} from "./formatting";
import { buildDashboardQuests } from "./quests";
import type {
  DashboardData,
  DashboardLeaderboardEntry,
  DashboardQuestSource,
  DashboardRecentPlayPreview,
  DashboardUpcomingMeeting,
} from "./types";

type MeetingRow = Pick<
  Tables<"meetings">,
  "id" | "title" | "location" | "starts_at" | "ends_at"
> & {
  status: "planned" | "confirmed";
};
type AvailabilityRow = Pick<
  Tables<"meeting_availability">,
  "meeting_id" | "user_id" | "is_available"
>;
type VoteRow = Pick<Tables<"meeting_game_votes">, "meeting_id" | "user_id">;
type RankingRow = Tables<"meeting_game_rankings">;
type GameRow = Pick<Tables<"games">, "id" | "title" | "cover_url">;
type RatingRow = Pick<Tables<"ratings">, "game_id">;
type PlayRow = Pick<Tables<"plays">, "id" | "game_id" | "played_at" | "status">;
type PlayParticipantRow = Pick<
  Tables<"play_participants">,
  "play_id" | "user_id" | "is_winner"
>;
type ProfileRow = Pick<
  Tables<"profiles">,
  "id" | "display_name" | "avatar_url"
>;
type UserPointBalanceRow = Tables<"user_point_balances">;

async function getProfilesMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, ProfileRow>();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", ids);

  if (error) {
    throw new Error("Nie udało się pobrać profili do Stołu.");
  }

  return new Map((data ?? []).map((profile) => [profile.id, profile]));
}

function countConfirmed(rows: AvailabilityRow[], meetingId: string) {
  return rows.reduce(
    (count, row) =>
      count +
      (row.meeting_id === meetingId && row.is_available === true ? 1 : 0),
    0,
  );
}

function mapUpcomingMeetings(input: {
  meetings: MeetingRow[];
  availabilityRows: AvailabilityRow[];
  voteRows: VoteRow[];
  rankingRows: RankingRow[];
  gamesMap: Map<string, GameRow>;
  currentUserId: string;
}): DashboardUpcomingMeeting[] {
  const ownResponses = new Map(
    input.availabilityRows
      .filter((row) => row.user_id === input.currentUserId)
      .map((row) => [row.meeting_id, row.is_available] as const),
  );
  return input.meetings.map((meeting) => {
    const ranking = sortMeetingRanking(
      input.rankingRows
        .filter((row) => row.meeting_id === meeting.id && Boolean(row.game_id))
        .map((row) => ({
          gameId: row.game_id!,
          title: input.gamesMap.get(row.game_id!)?.title ?? "Nieznana gra",
          votesCount: Number(row.votes_count ?? 0),
        })),
    )[0];

    const ownResponse = ownResponses.get(meeting.id) ?? null;
    const visualState = getMeetingVisualState({
      status: meeting.status,
      ownResponse,
    });

    return {
      id: meeting.id,
      title: meeting.title,
      location: meeting.location,
      startsAt: meeting.starts_at,
      endsAt: meeting.ends_at,
      status: meeting.status,
      ownResponse,
      confirmedAttendeesCount: countConfirmed(
        input.availabilityRows,
        meeting.id,
      ),
      visualLabel: getMeetingVisualLabel({
        status: meeting.status,
        ownResponse,
      }),
      visualState,
      needsAction: visualState === "decision-required",
      href: `/kalendarium/${meeting.id}`,
      leadingGame: ranking
        ? {
            gameId: ranking.gameId,
            title: ranking.title,
            coverUrl: input.gamesMap.get(ranking.gameId)?.cover_url ?? null,
            votesCount: ranking.votesCount,
          }
        : null,
    };
  });
}

function mapRecentPlayPreviews(input: {
  plays: PlayRow[];
  participantRows: PlayParticipantRow[];
  gamesMap: Map<string, GameRow>;
  profilesMap: Map<string, ProfileRow>;
}) {
  const winnersByPlayId = new Map<string, string[]>();
  const playersCountByPlayId = new Map<string, number>();

  for (const row of input.participantRows) {
    playersCountByPlayId.set(
      row.play_id,
      (playersCountByPlayId.get(row.play_id) ?? 0) + 1,
    );

    if (!row.is_winner) continue;
    if (!winnersByPlayId.has(row.play_id)) {
      winnersByPlayId.set(row.play_id, []);
    }

    winnersByPlayId
      .get(row.play_id)
      ?.push(
        input.profilesMap.get(row.user_id)?.display_name ??
          `Gracz ${row.user_id.slice(0, 8)}`,
      );
  }

  const previews: DashboardRecentPlayPreview[] = input.plays.map((play) => ({
    id: play.id,
    gameId: play.game_id,
    gameTitle: input.gamesMap.get(play.game_id)?.title ?? "Nieznana gra",
    playedAt: play.played_at,
    playersCount: playersCountByPlayId.get(play.id) ?? 0,
    winnerLabel:
      play.status === "in_progress"
        ? "W toku"
        : formatDashboardWinnerSummary(
            (winnersByPlayId.get(play.id) ?? []).map((displayName, index) => ({
              id: `${play.id}:${index}`,
              displayName,
              avatarUrl: null,
            })),
          ),
    href: `/kronika/${play.id}`,
  }));

  return buildRecentPlayPreviews(previews, 5);
}

async function getRecentPlayPreviews(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { data: playRows, error: playError } = await supabase
    .from("plays")
    .select("id, game_id, played_at, status")
    .order("played_at", { ascending: false })
    .limit(5);

  if (playError) {
    throw new Error("Nie udało się pobrać ostatnich partii.");
  }

  const plays = (playRows ?? []) as PlayRow[];
  if (plays.length === 0) return [] satisfies DashboardRecentPlayPreview[];

  const playIds = plays.map((play) => play.id);
  const gameIds = [...new Set(plays.map((play) => play.game_id))];

  const [participantsResult, gamesResult] = await Promise.all([
    supabase
      .from("play_participants")
      .select("play_id, user_id, is_winner")
      .in("play_id", playIds),
    supabase.from("games").select("id, title").in("id", gameIds),
  ]);

  if (participantsResult.error || gamesResult.error) {
    throw new Error("Nie udało się pobrać podglądu Kroniki.");
  }

  const participantRows = (participantsResult.data ??
    []) as PlayParticipantRow[];
  const profilesMap = await getProfilesMap(supabase, [
    ...new Set(participantRows.map((row) => row.user_id)),
  ]);
  const gamesMap = new Map(
    ((gamesResult.data ?? []) as GameRow[]).map((game) => [game.id, game]),
  );

  return mapRecentPlayPreviews({
    plays,
    participantRows,
    gamesMap,
    profilesMap,
  });
}

export async function getDashboardData(): Promise<DashboardData> {
  const memberState = await getCurrentMember();
  if (memberState.status !== "active-member") {
    throw new Error("Stół wymaga aktywnego członkostwa.");
  }

  const member = memberState.member;
  const supabase = await createClient();
  const now = new Date();
  const nowIso = now.toISOString();

  const [
    futureMeetingsResult,
    finishedMeetingsResult,
    ratingsResult,
    ownGamesCountResult,
    totalGamesCountResult,
    leaderboardResult,
    currentBalanceResult,
    recentPlayPreviews,
    recentMemberPlays,
  ] = await Promise.all([
    supabase
      .from("meetings")
      .select("id, title, location, status, starts_at, ends_at")
      .is("deleted_at", null)
      .in("status", ["planned", "confirmed"])
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true }),
    supabase
      .from("meetings")
      .select("id, title, status, starts_at, ends_at")
      .is("deleted_at", null)
      .in("status", ["confirmed", "completed"])
      .lt("ends_at", nowIso)
      .order("ends_at", { ascending: false })
      .limit(4),
    supabase.from("ratings").select("game_id").eq("user_id", member.id),
    supabase
      .from("games")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", member.id)
      .is("archived_at", null),
    supabase
      .from("games")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null),
    supabase.rpc("get_leaderboard"),
    supabase
      .from("user_point_balances")
      .select("user_id, total_points")
      .eq("user_id", member.id)
      .maybeSingle(),
    getRecentPlayPreviews(supabase),
    listRecentMemberPlays(member.id, 12),
  ]);

  if (
    futureMeetingsResult.error ||
    finishedMeetingsResult.error ||
    ratingsResult.error ||
    ownGamesCountResult.error ||
    totalGamesCountResult.error ||
    leaderboardResult.error ||
    currentBalanceResult.error
  ) {
    throw new Error("Nie udało się zbudować danych Stołu.");
  }

  const futureMeetings = (futureMeetingsResult.data ?? []) as MeetingRow[];
  const futureMeetingIds = futureMeetings.map((meeting) => meeting.id);

  const [availabilityResult, votesResult, rankingResult] = await Promise.all([
    futureMeetingIds.length > 0
      ? supabase
          .from("meeting_availability")
          .select("meeting_id, user_id, is_available")
          .in("meeting_id", futureMeetingIds)
      : Promise.resolve({ data: [], error: null }),
    futureMeetingIds.length > 0
      ? supabase
          .from("meeting_game_votes")
          .select("meeting_id, user_id")
          .in("meeting_id", futureMeetingIds)
          .eq("user_id", member.id)
      : Promise.resolve({ data: [], error: null }),
    futureMeetingIds.length > 0
      ? supabase
          .from("meeting_game_rankings")
          .select("meeting_id, game_id, votes_count")
          .in("meeting_id", futureMeetingIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (availabilityResult.error || votesResult.error || rankingResult.error) {
    throw new Error("Nie udało się pobrać kontekstu najbliższych spotkań.");
  }

  const rankingRows = (rankingResult.data ?? []) as RankingRow[];
  const rankingGameIds = [
    ...new Set(
      rankingRows
        .map((row) => row.game_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const gamesForRankingsResult =
    rankingGameIds.length > 0
      ? await supabase
          .from("games")
          .select("id, title, cover_url")
          .in("id", rankingGameIds)
      : { data: [], error: null };

  if (gamesForRankingsResult.error) {
    throw new Error("Nie udało się pobrać propozycji gier na Stół.");
  }

  const upcomingMeetings = mapUpcomingMeetings({
    meetings: futureMeetings,
    availabilityRows: (availabilityResult.data ?? []) as AvailabilityRow[],
    voteRows: (votesResult.data ?? []) as VoteRow[],
    rankingRows,
    gamesMap: new Map(
      ((gamesForRankingsResult.data ?? []) as GameRow[]).map((game) => [
        game.id,
        game,
      ]),
    ),
    currentUserId: member.id,
  });

  const finishedMeetings = (finishedMeetingsResult.data ?? []) as Array<{
    id: string;
    title: string;
    status: "confirmed" | "completed";
    starts_at: string;
    ends_at: string | null;
  }>;
  const finishedMeetingIds = finishedMeetings.map((meeting) => meeting.id);

  const relatedPlaysResult =
    finishedMeetingIds.length > 0
      ? await supabase
          .from("plays")
          .select("meeting_id")
          .in("meeting_id", finishedMeetingIds)
      : { data: [], error: null };

  if (relatedPlaysResult.error) {
    throw new Error("Nie udało się sprawdzić brakujących wpisów Kroniki.");
  }

  const meetingsWithPlays = new Set(
    (relatedPlaysResult.data ?? [])
      .map((row) => row.meeting_id)
      .filter((value): value is string => Boolean(value)),
  );
  const ratedGameIds = new Set(
    ((ratingsResult.data ?? []) as RatingRow[]).map((row) => row.game_id),
  );

  const unratedGames = recentMemberPlays
    .filter((play) => !ratedGameIds.has(play.game.id))
    .reduce<
      Array<{
        playId: string;
        gameId: string;
        gameTitle: string;
        playedAt: string;
      }>
    >((result, play) => {
      if (result.some((item) => item.gameId === play.game.id)) {
        return result;
      }

      result.push({
        playId: play.id,
        gameId: play.game.id,
        gameTitle: play.game.title,
        playedAt: play.playedAt,
      });

      return result;
    }, []);

  const questSource: DashboardQuestSource = {
    futureMeetings: upcomingMeetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      status: meeting.status,
      ownResponse: meeting.ownResponse,
      hasOwnVote: ((votesResult.data ?? []) as VoteRow[]).some(
        (vote) => vote.meeting_id === meeting.id,
      ),
    })),
    unratedGames,
    finishedMeetingsWithoutPlay: finishedMeetings
      .filter((meeting) => !meetingsWithPlays.has(meeting.id))
      .map((meeting) => ({
        id: meeting.id,
        title: meeting.title,
        startsAt: meeting.starts_at,
        endsAt: meeting.ends_at,
        status: meeting.status,
      })),
    ownGamesCount: ownGamesCountResult.count ?? 0,
    totalActiveGames: totalGamesCountResult.count ?? 0,
    now,
  };

  const quests = buildDashboardQuests(questSource);
  const pointsSummary = buildDashboardPointsSummary(
    (currentBalanceResult.data as UserPointBalanceRow | null)?.total_points ??
      0,
    quests,
  );
  const summary = buildDashboardHeroSummary({
    memberName: member.displayName,
    quests,
    hasFutureMeeting: upcomingMeetings.length > 0,
  });

  const leaderboardUserIds = [
    ...new Set((leaderboardResult.data ?? []).map((entry) => entry.user_id)),
  ];

  const [classDefinitionsResult, activeClassProfilesResult] = await Promise.all(
    [
      supabase
        .from("class_definitions")
        .select(
          "class_key, name, description, playstyle, icon_path, sort_order",
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      leaderboardUserIds.length > 0
        ? supabase
            .from("profiles")
            .select("id, active_class_key")
            .in("id", leaderboardUserIds)
        : Promise.resolve({ data: [], error: null }),
    ],
  );

  if (classDefinitionsResult.error || activeClassProfilesResult.error) {
    throw new Error("Nie udało się pobrać aktywnych klas do rankingu Stołu.");
  }

  const activeClassesByUser = mapActiveClassesByUser(
    (classDefinitionsResult.data ?? []).map((characterClass) => ({
      classKey: characterClass.class_key,
      name: characterClass.name,
      description: characterClass.description,
      playstyle: characterClass.playstyle,
      iconPath: characterClass.icon_path,
      sortOrder: characterClass.sort_order,
    })),
    (activeClassProfilesResult.data ?? []).map((profile) => ({
      userId: profile.id,
      activeClassKey: profile.active_class_key,
    })),
  );

  const leaderboardEntries: DashboardLeaderboardEntry[] = (
    leaderboardResult.data ?? []
  ).map((entry) => ({
    userId: entry.user_id,
    displayName: entry.display_name,
    avatarUrl: entry.avatar_url,
    totalPoints: entry.total_points,
    rank: entry.rank,
    activeClass: activeClassesByUser[entry.user_id] ?? null,
  }));

  return {
    memberName: member.displayName,
    summary,
    pointsSummary,
    quests,
    upcomingMeeting: pickUpcomingMeeting(upcomingMeetings, now),
    leaderboard: buildLeaderboardPreview({
      currentPoints: pointsSummary.currentPoints,
      entries: leaderboardEntries,
      currentUserId: member.id,
    }),
    recentPlays: recentPlayPreviews,
  };
}
