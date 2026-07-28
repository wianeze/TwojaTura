import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.generated";
import {
  formatMeetingListBadge,
  getMeetingFormValues,
  normalizeMeetingLocationSuggestions,
} from "./formatting";
import type {
  MeetingAttendanceRow,
  MeetingCardItem,
  MeetingDetails,
  MeetingGameCandidateOption,
  MeetingGameVoteItem,
  MeetingMember,
} from "./types";
import {
  countConfirmedResponses,
  hasMeetingAvailabilityGap,
  sortMeetingRanking,
} from "./validation";

type MeetingRow = Tables<"meetings">;
type MeetingAvailabilityRow = Tables<"meeting_availability">;
type MeetingVoteRow = Tables<"meeting_game_votes">;
type GameRow = Tables<"games">;
type ProfileRow = Pick<
  Tables<"profiles">,
  "id" | "display_name" | "avatar_url"
>;
type RankingRow = Tables<"meeting_game_rankings">;

function mapMember(profile: ProfileRow): MeetingMember {
  return {
    id: profile.id,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
  };
}

function memberFallback(id: string): MeetingMember {
  return {
    id,
    displayName: `Gracz ${id.slice(0, 8)}`,
    avatarUrl: null,
  };
}

async function getProfilesMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, MeetingMember>();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", ids);

  if (error) {
    throw new Error("Nie udało się pobrać profili graczy.");
  }

  return new Map(
    (data ?? []).map((profile) => [profile.id, mapMember(profile)]),
  );
}

function mapMeetingCardItem(
  meeting: MeetingRow,
  profilesMap: Map<string, MeetingMember>,
  ownResponses: Map<string, boolean | null>,
  confirmedCounts: Map<string, number>,
): MeetingCardItem {
  return {
    id: meeting.id,
    title: meeting.title,
    description: meeting.description,
    location: meeting.location,
    status: meeting.status,
    startsAt: meeting.starts_at,
    endsAt: meeting.ends_at,
    confirmedAttendeesCount: confirmedCounts.get(meeting.id) ?? 0,
    createdAt: meeting.created_at,
    updatedAt: meeting.updated_at,
    createdBy:
      profilesMap.get(meeting.created_by) ?? memberFallback(meeting.created_by),
    ownResponse: ownResponses.get(meeting.id) ?? null,
  };
}

function sortMeetings(items: MeetingCardItem[]) {
  const statusRank = { confirmed: 0, planned: 1, completed: 2 } as const;

  return [...items].sort((left, right) => {
    if (statusRank[left.status] !== statusRank[right.status]) {
      return statusRank[left.status] - statusRank[right.status];
    }

    if (left.status === "completed" && right.status === "completed") {
      return (
        new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime()
      );
    }

    return (
      new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
    );
  });
}

async function listActiveMeetingMembers(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { data, error } = await supabase
    .from("app_members")
    .select("user_id")
    .eq("is_active", true)
    .eq("role", "member");

  if (error) {
    throw new Error("Nie udało się pobrać aktywnych członków.");
  }

  const ids = (data ?? []).map((row) => row.user_id);
  const profiles = await getProfilesMap(supabase, ids);

  return ids
    .map((id) => profiles.get(id) ?? memberFallback(id))
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "pl", {
        sensitivity: "base",
      }),
    );
}

function buildAttendanceRows(
  members: MeetingMember[],
  availabilityRows: MeetingAvailabilityRow[],
): MeetingAttendanceRow[] {
  const answers = new Map(
    availabilityRows.map((row) => [row.user_id, row.is_available] as const),
  );

  return members.map((member) => ({
    member,
    response: answers.get(member.id) ?? null,
  }));
}

function buildCandidateGames(
  games: GameRow[],
  rankings: RankingRow[],
  votedGameIds: Set<string>,
  gameOwners: Map<string, MeetingMember>,
) {
  const gamesById = new Map(games.map((game) => [game.id, game]));

  return sortMeetingRanking(
    rankings
      .map((ranking) => {
        if (!ranking.game_id) return null;
        const game = gamesById.get(ranking.game_id);
        if (!game) return null;

        return {
          gameId: game.id,
          title: game.title,
          coverUrl: game.cover_url,
          owner: gameOwners.get(game.owner_id) ?? memberFallback(game.owner_id),
          votesCount: Number(ranking.votes_count ?? 0),
          hasOwnVote: votedGameIds.has(game.id),
        } satisfies MeetingGameVoteItem;
      })
      .filter((game): game is MeetingGameVoteItem => game !== null),
  );
}

function buildAvailableGames(
  games: GameRow[],
  rankings: RankingRow[],
  votedGameIds: Set<string>,
  gameOwners: Map<string, MeetingMember>,
) {
  const rankedGameIds = new Set(rankings.map((row) => row.game_id));

  return games
    .map(
      (game) =>
        ({
          gameId: game.id,
          title: game.title,
          coverUrl: game.cover_url,
          owner: gameOwners.get(game.owner_id) ?? memberFallback(game.owner_id),
          alreadyProposed: rankedGameIds.has(game.id),
          hasOwnVote: votedGameIds.has(game.id),
        }) satisfies MeetingGameCandidateOption,
    )
    .sort((left, right) =>
      left.title.localeCompare(right.title, "pl", { sensitivity: "base" }),
    );
}

function buildConfirmedCounts(
  meetingIds: string[],
  availabilityRows: MeetingAvailabilityRow[],
) {
  return new Map(
    meetingIds.map((meetingId) => [
      meetingId,
      countConfirmedResponses(
        availabilityRows
          .filter((row) => row.meeting_id === meetingId)
          .map((row) => row.is_available),
      ),
    ]),
  );
}

export async function listMeetings(): Promise<MeetingCardItem[]> {
  const supabase = await createClient();
  const memberState = await getCurrentMember();
  const currentUserId =
    memberState.status === "active-member" ? memberState.member.id : undefined;
  const { data: meetings, error } = await supabase
    .from("meetings")
    .select(
      "id, created_by, title, description, location, status, starts_at, ends_at, created_at, updated_at",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Nie udało się pobrać listy spotkań.");
  }

  if (!meetings || meetings.length === 0) {
    return [];
  }

  const meetingIds = meetings.map((meeting) => meeting.id);
  const createdByIds = [
    ...new Set(meetings.map((meeting) => meeting.created_by)),
  ];

  const [profilesMap, availabilityResult] = await Promise.all([
    getProfilesMap(supabase, createdByIds),
    supabase
      .from("meeting_availability")
      .select("meeting_id, user_id, is_available, updated_at")
      .in("meeting_id", meetingIds),
  ]);

  if (availabilityResult.error) {
    throw new Error("Nie udało się pobrać odpowiedzi RSVP.");
  }

  const availabilityRows = (availabilityResult.data ??
    []) as MeetingAvailabilityRow[];
  const ownResponses = new Map(
    availabilityRows
      .filter((row) => row.user_id === currentUserId)
      .map((row) => [row.meeting_id, row.is_available] as const),
  );
  const confirmedCounts = buildConfirmedCounts(meetingIds, availabilityRows);

  return sortMeetings(
    meetings.map((meeting) =>
      mapMeetingCardItem(
        meeting as MeetingRow,
        profilesMap,
        ownResponses,
        confirmedCounts,
      ),
    ),
  );
}

export async function getMeetingDetails(
  meetingId: string,
): Promise<MeetingDetails | null> {
  const supabase = await createClient();
  const memberState = await getCurrentMember();

  const { data: meeting, error } = await supabase
    .from("meetings")
    .select(
      "id, created_by, title, description, location, status, starts_at, ends_at, created_at, updated_at",
    )
    .eq("id", meetingId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error("Nie udało się pobrać spotkania.");
  }

  if (!meeting) return null;

  const [
    activeMembers,
    profilesMap,
    availabilityResult,
    votesResult,
    rankingResult,
    gamesResult,
    relatedPlaysResult,
  ] = await Promise.all([
    listActiveMeetingMembers(supabase),
    getProfilesMap(supabase, [meeting.created_by]),
    supabase
      .from("meeting_availability")
      .select("meeting_id, user_id, is_available, updated_at")
      .eq("meeting_id", meetingId),
    supabase
      .from("meeting_game_votes")
      .select("meeting_id, game_id, user_id, created_at")
      .eq("meeting_id", meetingId),
    supabase
      .from("meeting_game_rankings")
      .select("meeting_id, game_id, votes_count")
      .eq("meeting_id", meetingId),
    supabase
      .from("games")
      .select("id, title, cover_url, owner_id, archived_at")
      .is("archived_at", null)
      .order("title", { ascending: true }),
    supabase
      .from("plays")
      .select("id", { count: "exact", head: true })
      .eq("meeting_id", meetingId),
  ]);

  if (
    availabilityResult.error ||
    votesResult.error ||
    rankingResult.error ||
    gamesResult.error ||
    relatedPlaysResult.error
  ) {
    throw new Error("Nie udało się pobrać szczegółów spotkania.");
  }

  const availabilityRows = (availabilityResult.data ??
    []) as MeetingAvailabilityRow[];
  const attendanceRows = buildAttendanceRows(activeMembers, availabilityRows);
  const actor =
    memberState.status === "active-member" ? memberState.member : null;
  const ownResponse = actor
    ? (availabilityRows.find((row) => row.user_id === actor.id)?.is_available ??
      null)
    : null;
  const confirmedAttendeesCount = countConfirmedResponses(
    availabilityRows.map((row) => row.is_available),
  );

  const ownerIds = [
    ...new Set(
      ((gamesResult.data ?? []) as GameRow[]).map((game) => game.owner_id),
    ),
  ];
  const gameOwners = await getProfilesMap(supabase, ownerIds);
  const votedGameIds = new Set(
    ((votesResult.data ?? []) as MeetingVoteRow[])
      .filter((row) => row.user_id === actor?.id)
      .map((row) => row.game_id),
  );

  const gameVotes = buildCandidateGames(
    (gamesResult.data ?? []) as GameRow[],
    (rankingResult.data ?? []) as RankingRow[],
    votedGameIds,
    gameOwners,
  );
  const availableGames = buildAvailableGames(
    (gamesResult.data ?? []) as GameRow[],
    (rankingResult.data ?? []) as RankingRow[],
    votedGameIds,
    gameOwners,
  );

  const canEdit = Boolean(
    actor && (actor.role === "admin" || actor.id === meeting.created_by),
  );

  return {
    ...mapMeetingCardItem(
      meeting as MeetingRow,
      profilesMap,
      new Map([[meeting.id, ownResponse]]),
      new Map([[meeting.id, confirmedAttendeesCount]]),
    ),
    canEdit,
    canDelete: canEdit,
    hasChroniclePlay: (relatedPlaysResult.count ?? 0) > 0,
    canConfirm: canEdit && meeting.status === "planned",
    hasResponded: typeof ownResponse === "boolean",
    attendanceRows,
    gameVotes,
    availableGames,
  };
}

export async function getMeetingFormData(meetingId: string) {
  const details = await getMeetingDetails(meetingId);
  if (!details) return null;

  return {
    meeting: details,
    values: getMeetingFormValues(details),
  };
}

export async function getMeetingLocationSuggestions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("location")
    .is("deleted_at", null)
    .not("location", "is", null)
    .order("location", { ascending: true });

  if (error) {
    throw new Error("Nie udało się pobrać sugestii lokalizacji.");
  }

  return normalizeMeetingLocationSuggestions(
    (data ?? []).map((row) => row.location),
  );
}

export function getMeetingListBadge(meeting: MeetingCardItem) {
  const badge = formatMeetingListBadge(meeting);

  if (meeting.status === "confirmed") {
    return badge;
  }

  if (hasMeetingAvailabilityGap(meeting)) {
    return `Do decyzji · ${badge}`;
  }

  if (meeting.status === "completed") {
    return `Zakończone · ${badge}`;
  }

  return `Do ustalenia · ${badge}`;
}
