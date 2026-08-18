import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.generated";
import {
  formatMeetingListBadge,
  getMeetingFormValues,
  normalizeMeetingLocationSuggestions,
} from "./formatting";
import {
  hasUsableContinuationContext,
  isMeetingContinuationCandidate,
} from "./continuation";
import { buildMeetingGameRecommendations } from "./game-recommendations";
import type {
  MeetingAttendanceRow,
  MeetingCardItem,
  MeetingContinuationVoteItem,
  MeetingContinuablePlay,
  MeetingDetails,
  MeetingGameCandidateOption,
  MeetingGameRecommendation,
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
type MeetingResponseRow = Tables<"meeting_game_responses">;
type MeetingContinuationResponseRow =
  Tables<"meeting_continuation_responses">;
type GameRow = Tables<"games">;
type ProfileRow = Pick<
  Tables<"profiles">,
  "id" | "display_name" | "avatar_url"
>;
type RankingRow = Tables<"meeting_game_rankings">;
type ContinuationRankingRow = Tables<"meeting_continuation_rankings">;
type RatingRow = Tables<"ratings">;

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

async function listActiveMemberProfiles(
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

/**
 * Pula osób, które organizator może zaprosić: aktywni member, bez niego
 * samego (organizator nie jest "zwykłą" osobą do zaproszenia — patrz
 * meeting-invited-field.tsx).
 */
export async function getInvitableMembers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizerId: string,
) {
  const members = await listActiveMemberProfiles(supabase);
  return members.filter((member) => member.id !== organizerId);
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
  ownResponses: Map<string, boolean>,
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
          yesCount: Number(ranking.yes_count ?? 0),
          noCount: Number(ranking.no_count ?? 0),
          ownResponse: ownResponses.get(game.id) ?? null,
        } satisfies MeetingGameVoteItem;
      })
      .filter((game): game is MeetingGameVoteItem => game !== null),
  );
}

function buildAvailableGames(
  games: GameRow[],
  rankings: RankingRow[],
  ownResponses: Map<string, boolean>,
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
          ownResponse: ownResponses.get(game.id) ?? null,
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

/*
 * Wspólna lista istniejących wpisów Kroniki ze statusem `in_progress` — zarówno
 * utworzonych ręcznie, jak i przez Stół. Formularz i modal mogą pokazać także
 * wpis biegnący teraz, bo zapisują/otwierają ten sam play_id. `result_pending`
 * nadal jest `in_progress`, więc również pozostaje na liście. Picker drugiego
 * Stołu przekazuje `includeRunning: false`, ponieważ dopiero faktyczne wznowienie
 * musi spełnić `private.is_continuable_play`. Jednoznacznie zakończona partia
 * nie jest nowym kandydatem.
 *
 * `includePlayId` obsługuje jeden przypadek brzegowy edycji: spotkanie
 * wskazuje partię, którą w międzyczasie zamknięto. Bez tego pozycja zniknęłaby
 * z listy i formularz wyglądałby, jakby kontynuacji nigdy nie było — a zapis
 * po cichu zdjąłby powiązanie.
 */
export async function listContinuablePlays(
  includePlayId?: string | null,
  options: { includeRunning?: boolean } = {},
): Promise<MeetingContinuablePlay[]> {
  const supabase = await createClient();
  let playsQuery = supabase
    .from("plays")
    .select(
      "id, game_id, meeting_id, status, played_at, state_note, duration_minutes, live_started_at, live_ended_at, result_pending",
    );

  playsQuery = includePlayId
    ? playsQuery.or(`status.eq.in_progress,id.eq.${includePlayId}`)
    : playsQuery.eq("status", "in_progress");

  const { data, error } = await playsQuery.order("played_at", {
    ascending: false,
  });

  if (error) {
    throw new Error("Nie udało się pobrać rozpoczętych partii.");
  }

  const rows = (data ?? []).filter((row) =>
    isMeetingContinuationCandidate(
      {
        id: row.id,
        meetingId: row.meeting_id,
        status: row.status,
        resultPending: row.result_pending,
        liveStartedAt: row.live_started_at,
        liveEndedAt: row.live_ended_at,
      },
      { includePlayId, includeRunning: options.includeRunning },
    ),
  );
  if (rows.length === 0) return [];

  const playIds = rows.map((row) => row.id);
  const startMeetingIds = [
    ...new Set(
      rows
        .map((row) => row.meeting_id)
        .filter((meetingId): meetingId is string => Boolean(meetingId)),
    ),
  ];
  const [gamesResult, startMeetingsResult, assignmentsResult] =
    await Promise.all([
      supabase
        .from("games")
        .select("id, title, cover_url")
        .in("id", [...new Set(rows.map((row) => row.game_id))]),
      startMeetingIds.length > 0
        ? supabase
            .from("meetings")
            .select("id")
            .in("id", startMeetingIds)
            .is("deleted_at", null)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("meetings")
        .select("id, title, status, starts_at, continued_play_id")
        .in("continued_play_id", playIds)
        .is("deleted_at", null)
        .neq("status", "completed")
        .order("starts_at", { ascending: true }),
    ]);

  if (
    gamesResult.error ||
    startMeetingsResult.error ||
    assignmentsResult.error
  ) {
    throw new Error("Nie udało się pobrać tytułów rozpoczętych partii.");
  }

  const gamesById = new Map(
    (gamesResult.data ?? []).map((game) => [game.id, game]),
  );
  const visibleStartMeetingIds = new Set(
    (startMeetingsResult.data ?? []).map((meeting) => meeting.id),
  );
  const assignmentsByPlayId = new Map<string, { id: string; title: string }>();
  for (const meeting of assignmentsResult.data ?? []) {
    if (!meeting.continued_play_id) continue;
    assignmentsByPlayId.set(meeting.continued_play_id, {
      id: meeting.id,
      title: meeting.title,
    });
  }

  return rows
    .filter((row) =>
      hasUsableContinuationContext({
        startMeetingId: row.meeting_id,
        startMeetingExists:
          row.meeting_id !== null && visibleStartMeetingIds.has(row.meeting_id),
        hasAssignedMeeting: assignmentsByPlayId.has(row.id),
      }),
    )
    .map((row) => ({
      playId: row.id,
      gameId: row.game_id,
      gameTitle: gamesById.get(row.game_id)?.title ?? "Nieznana gra",
      coverUrl: gamesById.get(row.game_id)?.cover_url ?? null,
      status: row.status,
      startMeetingId: row.meeting_id,
      isRunning: row.live_started_at !== null && row.live_ended_at === null,
      assignedMeeting: assignmentsByPlayId.get(row.id) ?? null,
      playedAt: row.played_at,
      stateNote: row.state_note,
      // Łączny czas dotychczasowych sesji — „wracamy do partii, w której mamy
      // już 3 godziny” to zupełnie inna decyzja niż start czegoś nowego.
      accumulatedMinutes: row.duration_minutes,
    }));
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
      "id, created_by, title, description, location, status, starts_at, ends_at, continued_play_id, created_at, updated_at",
    )
    .eq("id", meetingId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error("Nie udało się pobrać spotkania.");
  }

  if (!meeting) return null;

  const [
    invitationsResult,
    availabilityResult,
    votesResult,
    rankingResult,
    continuationResponsesResult,
    continuationRankingsResult,
    gamesResult,
    relatedPlaysResult,
  ] = await Promise.all([
    supabase
      .from("meeting_invitations")
      .select("meeting_id, user_id")
      .eq("meeting_id", meetingId),
    supabase
      .from("meeting_availability")
      .select("meeting_id, user_id, is_available, updated_at")
      .eq("meeting_id", meetingId),
    supabase
      .from("meeting_game_responses")
      .select("meeting_id, game_id, user_id, wants_to_play")
      .eq("meeting_id", meetingId),
    supabase
      .from("meeting_game_rankings")
      .select("meeting_id, game_id, yes_count, no_count")
      .eq("meeting_id", meetingId),
    supabase
      .from("meeting_continuation_responses")
      .select("meeting_id, continued_play_id, user_id, wants_to_play")
      .eq("meeting_id", meetingId),
    supabase
      .from("meeting_continuation_rankings")
      .select(
        "meeting_id, continued_play_id, yes_count, no_count",
      )
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
    invitationsResult.error ||
    availabilityResult.error ||
    votesResult.error ||
    rankingResult.error ||
    continuationResponsesResult.error ||
    continuationRankingsResult.error ||
    gamesResult.error ||
    relatedPlaysResult.error
  ) {
    throw new Error("Nie udało się pobrać szczegółów spotkania.");
  }

  const invitedUserIds = (invitationsResult.data ?? []).map(
    (row) => row.user_id,
  );
  // "Kto będzie?" pokazuje organizatora + zaproszonych — nie każdego aktywnego
  // członka. Organizator jest zawsze na liście, nawet jeśli sam siebie
  // (poprawnie) nie zaprasza.
  const attendanceMemberIds = [
    ...new Set([meeting.created_by, ...invitedUserIds]),
  ];
  const [attendanceProfilesMap, profilesMap] = await Promise.all([
    getProfilesMap(supabase, attendanceMemberIds),
    getProfilesMap(supabase, [meeting.created_by]),
  ]);
  const attendanceMembers = attendanceMemberIds
    .map((id) => attendanceProfilesMap.get(id) ?? memberFallback(id))
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "pl", {
        sensitivity: "base",
      }),
    );

  const availabilityRows = (availabilityResult.data ??
    []) as MeetingAvailabilityRow[];
  const attendanceRows = buildAttendanceRows(
    attendanceMembers,
    availabilityRows,
  );
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
  const ownResponses = new Map(
    ((votesResult.data ?? []) as MeetingResponseRow[])
      .filter((row) => row.user_id === actor?.id)
      .map((row) => [row.game_id, row.wants_to_play] as const),
  );

  const gameVotes = buildCandidateGames(
    (gamesResult.data ?? []) as GameRow[],
    (rankingResult.data ?? []) as RankingRow[],
    ownResponses,
    gameOwners,
  );
  const availableGames = buildAvailableGames(
    (gamesResult.data ?? []) as GameRow[],
    (rankingResult.data ?? []) as RankingRow[],
    ownResponses,
    gameOwners,
  );

  const continuationOwnResponses = new Map(
    ((continuationResponsesResult.data ??
      []) as MeetingContinuationResponseRow[])
      .filter((row) => row.user_id === actor?.id)
      .map(
        (row) => [row.continued_play_id, row.wants_to_play] as const,
      ),
  );
  const continuationRankings = (continuationRankingsResult.data ??
    []) as ContinuationRankingRow[];
  const continuationPlayIds = continuationRankings
    .map((row) => row.continued_play_id)
    .filter((id): id is string => Boolean(id));
  let continuationVotes: MeetingContinuationVoteItem[] = [];

  if (continuationPlayIds.length > 0) {
    const { data: continuationPlayRows, error: continuationPlayError } =
      await supabase
        .from("plays")
        .select(
          "id, game_id, status, played_at, state_note, duration_minutes",
        )
        .in("id", continuationPlayIds)
        .eq("status", "in_progress");

    if (continuationPlayError) {
      throw new Error("Nie udało się pobrać propozycji kontynuacji.");
    }

    const proposedGameIds = [
      ...new Set((continuationPlayRows ?? []).map((play) => play.game_id)),
    ];
    const continuationGamesResult =
      proposedGameIds.length > 0
        ? await supabase
            .from("games")
            .select("id, title, cover_url")
            .in("id", proposedGameIds)
        : { data: [], error: null };

    if (continuationGamesResult.error) {
      throw new Error("Nie udało się pobrać gier kontynuowanych partii.");
    }

    const continuationGamesById = new Map(
      (continuationGamesResult.data ?? []).map((game) => [game.id, game]),
    );
    const rankingsByPlayId = new Map(
      continuationRankings.map((ranking) => [
        ranking.continued_play_id,
        ranking,
      ]),
    );

    continuationVotes = (continuationPlayRows ?? [])
      .flatMap((play) => {
        const ranking = rankingsByPlayId.get(play.id);
        if (!ranking) return [];
        const game = continuationGamesById.get(play.game_id);

        return [
          {
            playId: play.id,
            gameId: play.game_id,
            title: game?.title ?? "Nieznana gra",
            coverUrl: game?.cover_url ?? null,
            playedAt: play.played_at,
            stateNote: play.state_note,
            accumulatedMinutes: play.duration_minutes,
            yesCount: Number(ranking.yes_count ?? 0),
            noCount: Number(ranking.no_count ?? 0),
            ownResponse: continuationOwnResponses.get(play.id) ?? null,
          } satisfies MeetingContinuationVoteItem,
        ];
      })
      .sort(
        (left, right) =>
          right.yesCount - left.yesCount ||
          left.noCount - right.noCount ||
          new Date(right.playedAt).getTime() -
            new Date(left.playedAt).getTime(),
      );
  }

  // Rekomendacje dotyczą faktycznej ekipy: organizatora oraz osób, które
  // odpowiedziały TAK. Osoby niezdecydowane i RSVP NIE nie wpływają na wynik.
  const recommendationParticipantIds = [
    ...new Set([
      meeting.created_by,
      ...availabilityRows
        .filter((row) => row.is_available)
        .map((row) => row.user_id),
    ]),
  ];
  const [ratingsResult, historicalResponsesResult] = await Promise.all([
    supabase
      .from("ratings")
      .select("game_id, user_id, overall, wants_to_play_again")
      .in("user_id", recommendationParticipantIds),
    supabase
      .from("meeting_game_responses")
      .select("game_id, user_id")
      .in("user_id", recommendationParticipantIds)
      .eq("wants_to_play", true)
      .neq("meeting_id", meetingId),
  ]);

  // Rekomendacje są warstwą pomocniczą. Ewentualny brak dostępu do historii
  // nie może zepsuć podstawowego wyboru gry — wtedy pełna lista działa jak
  // wcześniej, a inteligentna sekcja po prostu się nie pojawia.
  let recommendedGames: MeetingGameRecommendation[] = [];
  if (!ratingsResult.error && !historicalResponsesResult.error) {
    const recommendationScores = buildMeetingGameRecommendations({
      participantIds: recommendationParticipantIds,
      games: availableGames
        .filter((game) => !game.alreadyProposed)
        .map((game) => ({ gameId: game.gameId, title: game.title })),
      ratings: (
        (ratingsResult.data ?? []) as Pick<
          RatingRow,
          "game_id" | "user_id" | "overall" | "wants_to_play_again"
        >[]
      ).map((rating) => ({
        gameId: rating.game_id,
        userId: rating.user_id,
        overall: rating.overall,
        wantsToPlayAgain: rating.wants_to_play_again,
      })),
      historicalPositiveResponses: (historicalResponsesResult.data ?? []).map(
        (response) => ({
          gameId: response.game_id,
          userId: response.user_id,
        }),
      ),
      limit: 5,
    });
    const availableGamesById = new Map(
      availableGames.map((game) => [game.gameId, game] as const),
    );
    recommendedGames = recommendationScores.flatMap((score) => {
      const game = availableGamesById.get(score.gameId);
      return game ? [{ ...game, ...score }] : [];
    });
  }

  const canEdit = Boolean(
    actor && (actor.role === "admin" || actor.id === meeting.created_by),
  );

  // Kontynuowana partia zostaje przy spotkaniu także po zamknięciu (status
  // 'completed') — to jej historia, nie stan chwilowy — więc pobieramy ją bez
  // filtra po statusie.
  let continuedPlay: MeetingContinuablePlay | null = null;
  if (meeting.continued_play_id) {
    const { data: playRow, error: playError } = await supabase
      .from("plays")
      .select(
        "id, game_id, meeting_id, status, played_at, state_note, duration_minutes, live_started_at, live_ended_at",
      )
      .eq("id", meeting.continued_play_id)
      .maybeSingle();

    if (playError) {
      throw new Error("Nie udało się pobrać kontynuowanej partii.");
    }

    if (playRow) {
      const { data: gameRow } = await supabase
        .from("games")
        .select("title, cover_url")
        .eq("id", playRow.game_id)
        .maybeSingle();

      continuedPlay = {
        playId: playRow.id,
        gameId: playRow.game_id,
        gameTitle: gameRow?.title ?? "Nieznana gra",
        coverUrl: gameRow?.cover_url ?? null,
        status: playRow.status,
        startMeetingId: playRow.meeting_id,
        isRunning:
          playRow.live_started_at !== null && playRow.live_ended_at === null,
        assignedMeeting: { id: meeting.id, title: meeting.title },
        playedAt: playRow.played_at,
        stateNote: playRow.state_note,
        accumulatedMinutes: playRow.duration_minutes,
      };
    }
  }

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
    continuedPlay,
    canConfirm: canEdit && meeting.status === "planned",
    hasResponded: typeof ownResponse === "boolean",
    attendanceRows,
    invitedUserIds,
    gameVotes,
    continuationVotes,
    availableGames,
    recommendedGames,
  };
}

export async function getMeetingFormData(meetingId: string) {
  const details = await getMeetingDetails(meetingId);
  if (!details) return null;

  const supabase = await createClient();
  const [invitableMembers, continuablePlays] = await Promise.all([
    getInvitableMembers(supabase, details.createdBy.id),
    // Wybrana/wznowiona kontynuacja nie wraca do formularza jako nowa
    // propozycja. Picker pokazuje tylko partie, które można dopiero zgłosić.
    listContinuablePlays(),
  ]);

  return {
    meeting: details,
    values: getMeetingFormValues(details),
    invitableMembers,
    continuablePlays,
  };
}

export async function getMeetingCreateFormData() {
  const supabase = await createClient();
  const memberState = await getCurrentMember();

  if (memberState.status !== "active-member") {
    return {
      invitableMembers: [] as MeetingMember[],
      continuablePlays: [] as MeetingContinuablePlay[],
    };
  }

  const [invitableMembers, continuablePlays] = await Promise.all([
    getInvitableMembers(supabase, memberState.member.id),
    listContinuablePlays(),
  ]);

  return { invitableMembers, continuablePlays };
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
