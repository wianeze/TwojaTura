import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import type { MemberRole } from "@/features/auth/types";
import { getViewerMeetingParticipation } from "@/features/meetings/participation";
import { createClient } from "@/lib/supabase/server";
import { toPublicStorageUrl } from "@/lib/supabase/env";
import type { Tables } from "@/types/database.generated";
import {
  buildPlaySessions,
  getPlayFormValues,
  sortPlayParticipants,
  sortPlaysByPlayedAtDesc,
  toRecentPlaySummary,
} from "./formatting";
import type {
  PlayDetails,
  PlayFormData,
  PlayFormGameOption,
  PlayFormMeetingOption,
  PlayListItem,
  PlayMember,
  PlayParticipantResult,
  PlayPhoto,
  RecentPlaySummary,
} from "./types";

const PLAY_PHOTOS_BUCKET = "play-photos";
const PLAY_PHOTO_SIGNED_URL_TTL_SECONDS = 3600;

type PlayRow = Tables<"plays">;
type PlayParticipantRow = Tables<"play_participants">;
type ProfileRow = Pick<
  Tables<"profiles">,
  "id" | "display_name" | "avatar_url"
>;
type HistoricalProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};
type GameRow = Pick<Tables<"games">, "id" | "title" | "cover_url" | "owner_id">;
type MeetingRow = Pick<
  Tables<"meetings">,
  "id" | "title" | "starts_at" | "ends_at" | "location"
>;

function toMember(profile: ProfileRow): PlayMember {
  return {
    id: profile.id,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
  };
}

function memberFallback(id: string): PlayMember {
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
  if (ids.length === 0) return new Map<string, PlayMember>();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", ids);

  if (error) {
    throw new Error("Nie udało się pobrać profili graczy.");
  }

  const profilesMap = new Map(
    (data ?? []).map((profile) => [profile.id, toMember(profile)]),
  );

  const missingIds = ids.filter((id) => !profilesMap.has(id));
  if (missingIds.length === 0) {
    return profilesMap;
  }

  const { data: historicalProfiles, error: historicalProfilesError } =
    await supabase.rpc("get_play_profiles", {
      p_user_ids: missingIds,
    });

  if (historicalProfilesError) {
    throw new Error("Nie udało się domknąć historycznych profili graczy.");
  }

  for (const profile of (historicalProfiles ?? []) as HistoricalProfileRow[]) {
    profilesMap.set(profile.id, toMember(profile));
  }

  return profilesMap;
}

function buildParticipantsMap(
  participantRows: PlayParticipantRow[],
  profiles: Map<string, PlayMember>,
) {
  const participantsMap = new Map<string, PlayParticipantResult[]>();

  for (const row of participantRows) {
    if (!participantsMap.has(row.play_id)) {
      participantsMap.set(row.play_id, []);
    }

    participantsMap.get(row.play_id)?.push({
      member: profiles.get(row.user_id) ?? memberFallback(row.user_id),
      placement: row.placement,
      score: row.score,
      isWinner: row.is_winner,
    });
  }

  for (const [playId, participants] of participantsMap.entries()) {
    participantsMap.set(playId, sortPlayParticipants(participants));
  }

  return participantsMap;
}

async function hydratePlayItems(
  playRows: PlayRow[],
  viewer?: { id: string; role: MemberRole } | null,
) {
  if (playRows.length === 0) return [] as PlayListItem[];

  const supabase = await createClient();
  const playIds = playRows.map((play) => play.id);
  const gameIds = [...new Set(playRows.map((play) => play.game_id))];
  const meetingIds = [
    ...new Set(
      playRows
        .map((play) => play.meeting_id)
        .filter((meetingId): meetingId is string => Boolean(meetingId)),
    ),
  ];

  const [participantsResult, gamesResult, meetingsResult, continuationsResult] =
    await Promise.all([
    supabase
      .from("play_participants")
      .select("play_id, user_id, placement, score, is_winner")
      .in("play_id", playIds),
    supabase
      .from("games")
      .select("id, title, cover_url, owner_id")
      .in("id", gameIds),
      meetingIds.length > 0
      ? supabase
          .from("meetings")
          .select("id, title, starts_at, ends_at, location")
          .in("id", meetingIds)
          .is("deleted_at", null)
        : Promise.resolve({ data: [], error: null }),
      viewer
        ? supabase
            .from("meetings")
            .select("id, continued_play_id")
            .in("continued_play_id", playIds)
            .is("deleted_at", null)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (participantsResult.error || gamesResult.error || meetingsResult.error) {
    throw new Error("Nie udało się pobrać pełnej historii partii.");
  }

  const participantRows = (participantsResult.data ??
    []) as PlayParticipantRow[];
  const games = (gamesResult.data ?? []) as GameRow[];
  const meetings = (meetingsResult.data ?? []) as MeetingRow[];

  const profileIds = [
    ...new Set(
      [
        ...playRows.map((play) => play.created_by),
        ...participantRows.map((participant) => participant.user_id),
      ].filter(Boolean),
    ),
  ];
  /*
   * Uczestnik spotkania może rozliczyć partię tego wieczoru — także taką, której
   * nie założył. Uprawnienie kończy się na spotkaniu: wpis Kroniki bez
   * meeting_id zostaje przy dotychczasowej regule autor/admin. Liczy się również
   * spotkanie, na którym partia jest KONTYNUOWANA, bo tam też siedzi się przy
   * tym samym stole.
   */
  const continuationMeetingsByPlay = new Map<string, string[]>();
  for (const row of continuationsResult.data ?? []) {
    if (!row.continued_play_id) continue;
    const current = continuationMeetingsByPlay.get(row.continued_play_id) ?? [];
    current.push(row.id);
    continuationMeetingsByPlay.set(row.continued_play_id, current);
  }

  const participationMeetingIds = [
    ...new Set([
      ...meetingIds,
      ...[...continuationMeetingsByPlay.values()].flat(),
    ]),
  ];
  const [profiles, participation] = await Promise.all([
    getProfilesMap(supabase, profileIds),
    viewer
      ? getViewerMeetingParticipation(
          supabase,
          viewer.id,
          participationMeetingIds,
        )
      : Promise.resolve(new Set<string>()),
  ]);
  const participantsMap = buildParticipantsMap(participantRows, profiles);
  const gamesMap = new Map(games.map((game) => [game.id, game]));
  const meetingsMap = new Map(meetings.map((meeting) => [meeting.id, meeting]));

  return playRows.map((play) => {
    const game = gamesMap.get(play.game_id);
    const participants = participantsMap.get(play.id) ?? [];
    const winners = participants
      .filter((participant) => participant.isWinner)
      .map((participant) => participant.member);

    return {
      id: play.id,
      playedAt: play.played_at,
      durationMinutes: play.duration_minutes,
      comment: play.comment,
      status: play.status,
      stateNote: play.state_note,
      liveStartedAt: play.live_started_at,
      liveEndedAt: play.live_ended_at,
      resultPending: play.result_pending,
      mode: play.mode,
      teamResult: play.team_result,
      createdAt: play.created_at,
      updatedAt: play.updated_at,
      game: {
        id: play.game_id,
        title: game?.title ?? "Nieznana gra",
        coverUrl: game?.cover_url ?? null,
      },
      meeting: play.meeting_id
        ? (() => {
            const meeting = meetingsMap.get(play.meeting_id);
            if (!meeting) return null;
            return {
              id: meeting.id,
              title: meeting.title,
              startsAt: meeting.starts_at,
              endsAt: meeting.ends_at,
              location: meeting.location,
            };
          })()
        : null,
      createdBy:
        profiles.get(play.created_by) ?? memberFallback(play.created_by),
      participants,
      winners,
      playersCount: participants.length,
      canEdit: Boolean(
        viewer &&
        (viewer.role === "admin" ||
          viewer.id === play.created_by ||
          (play.meeting_id !== null && participation.has(play.meeting_id)) ||
          (continuationMeetingsByPlay.get(play.id) ?? []).some((meetingId) =>
            participation.has(meetingId),
          )),
      ),
      canDelete: Boolean(
        viewer && (viewer.role === "admin" || viewer.id === play.created_by),
      ),
    } satisfies PlayListItem;
  });
}

export async function listChroniclePlays(): Promise<PlayListItem[]> {
  const supabase = await createClient();
  const memberState = await getCurrentMember();
  const viewer =
    memberState.status === "active-member" ? memberState.member : null;

  const { data, error } = await supabase
    .from("plays")
    .select(
      "id, game_id, meeting_id, created_by, played_at, duration_minutes, comment, status, state_note, live_started_at, live_ended_at, result_pending, mode, team_result, created_at, updated_at",
    )
    .order("played_at", { ascending: false });

  if (error) {
    throw new Error("Nie udało się pobrać Kroniki.");
  }

  const items = await hydratePlayItems((data ?? []) as PlayRow[], viewer);
  return sortPlaysByPlayedAtDesc(items);
}

async function getPlayPhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  playId: string,
): Promise<PlayPhoto[]> {
  const { data, error } = await supabase
    .from("play_photos")
    .select("id, storage_path, position, width, height, byte_size")
    .eq("play_id", playId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error("Nie udało się pobrać zdjęć partii.");
  }

  const rows = data ?? [];

  if (rows.length === 0) return [];

  const { data: signedUrls, error: signError } = await supabase.storage
    .from(PLAY_PHOTOS_BUCKET)
    .createSignedUrls(
      rows.map((row) => row.storage_path),
      PLAY_PHOTO_SIGNED_URL_TTL_SECONDS,
    );

  if (signError) {
    throw new Error("Nie udało się przygotować podglądu zdjęć.");
  }

  const urlByPath = new Map(
    (signedUrls ?? []).map((entry) => [
      entry.path,
      entry.signedUrl ? toPublicStorageUrl(entry.signedUrl) : "",
    ]),
  );

  return rows
    .map((row) => ({
      id: row.id,
      url: urlByPath.get(row.storage_path) ?? "",
      position: row.position,
      width: row.width,
      height: row.height,
      byteSize: row.byte_size,
    }))
    .filter((photo) => photo.url !== "");
}

export async function getPlayDetails(
  playId: string,
): Promise<PlayDetails | null> {
  const supabase = await createClient();
  const memberState = await getCurrentMember();
  const viewer =
    memberState.status === "active-member" ? memberState.member : null;

  const { data, error } = await supabase
    .from("plays")
    .select(
      "id, game_id, meeting_id, created_by, played_at, duration_minutes, comment, status, state_note, live_started_at, live_ended_at, result_pending, mode, team_result, created_at, updated_at",
    )
    .eq("id", playId)
    .maybeSingle();

  if (error) {
    throw new Error("Nie udało się pobrać szczegółów partii.");
  }

  if (!data) return null;

  const [item] = await hydratePlayItems([data as PlayRow], viewer);
  if (!item) return null;

  // Spotkania, na których grupa wracała do tej partii. Wpis Kroniki zostaje
  // jeden — to wyłącznie jego oś czasu.
  const [photos, continuationsResult] = await Promise.all([
    getPlayPhotos(supabase, playId),
    supabase
      .from("meetings")
      .select("id, title, starts_at, ends_at, location")
      .eq("continued_play_id", playId)
      .is("deleted_at", null),
  ]);

  if (continuationsResult.error) {
    throw new Error("Nie udało się pobrać kolejnych sesji partii.");
  }

  const continuationMeetings = (
    (continuationsResult.data ?? []) as MeetingRow[]
  ).map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    startsAt: meeting.starts_at,
    endsAt: meeting.ends_at,
    location: meeting.location,
  }));

  return {
    ...item,
    photos,
    sessions: buildPlaySessions(item.meeting, continuationMeetings),
  };
}

export async function getPlayFormOptions(): Promise<
  Pick<PlayFormData, "games" | "meetings" | "members">
> {
  const supabase = await createClient();
  const [gamesResult, meetingsResult, membersResult] = await Promise.all([
    supabase
      .from("games")
      .select("id, title, cover_url, owner_id, archived_at")
      .is("archived_at", null)
      .order("title", { ascending: true }),
    supabase
      .from("meetings")
      .select("id, title, starts_at, ends_at, location")
      .is("deleted_at", null)
      .order("starts_at", { ascending: false }),
    supabase
      .from("app_members")
      .select("user_id, role, is_active")
      .eq("is_active", true)
      .eq("role", "member"),
  ]);

  if (gamesResult.error || meetingsResult.error || membersResult.error) {
    throw new Error("Nie udało się przygotować formularza partii.");
  }

  const gamesRows = (gamesResult.data ?? []) as Array<
    GameRow & { archived_at: string | null }
  >;
  const memberRows = (membersResult.data ?? []) as Array<{
    user_id: string;
    role: "member" | "admin";
    is_active: boolean;
  }>;

  const ownerIds = [...new Set(gamesRows.map((game) => game.owner_id))];
  const memberIds = memberRows.map((member) => member.user_id);
  const profiles = await getProfilesMap(supabase, [
    ...new Set([...ownerIds, ...memberIds]),
  ]);

  const games: PlayFormGameOption[] = gamesRows.map((game) => ({
    id: game.id,
    title: game.title,
    coverUrl: game.cover_url,
    ownerName:
      profiles.get(game.owner_id)?.displayName ??
      memberFallback(game.owner_id).displayName,
  }));

  const meetings: PlayFormMeetingOption[] = (
    (meetingsResult.data ?? []) as MeetingRow[]
  ).map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    startsAt: meeting.starts_at,
    endsAt: meeting.ends_at,
    location: meeting.location,
  }));

  const members: PlayMember[] = memberRows
    .reduce<PlayMember[]>((result, member) => {
      const profile = profiles.get(member.user_id);
      if (!profile) return result;

      result.push({
        ...profile,
        role: member.role,
      });

      return result;
    }, [])
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "pl", {
        sensitivity: "base",
      }),
    );

  return { games, meetings, members };
}

export async function getPlayCreateFormData(
  meetingId?: string,
): Promise<PlayFormData> {
  const { games, meetings, members } = await getPlayFormOptions();
  const prefilledMeeting = meetingId
    ? (meetings.find((meeting) => meeting.id === meetingId) ?? null)
    : null;

  return {
    initialValues: getPlayFormValues(undefined, prefilledMeeting),
    games,
    meetings,
    members,
  };
}

export async function getPlayEditFormData(
  playId: string,
): Promise<(PlayFormData & { play: PlayDetails }) | null> {
  const [play, { games, meetings, members }] = await Promise.all([
    getPlayDetails(playId),
    getPlayFormOptions(),
  ]);

  if (!play) return null;

  return {
    play,
    initialValues: getPlayFormValues(play),
    games,
    meetings,
    members,
  };
}

export async function listRecentGamePlays(
  gameId: string,
  limit = 5,
): Promise<PlayListItem[]> {
  const supabase = await createClient();
  const memberState = await getCurrentMember();
  const viewer =
    memberState.status === "active-member" ? memberState.member : null;

  const { data, error } = await supabase
    .from("plays")
    .select(
      "id, game_id, meeting_id, created_by, played_at, duration_minutes, comment, status, state_note, live_started_at, live_ended_at, result_pending, mode, team_result, created_at, updated_at",
    )
    .eq("game_id", gameId)
    .order("played_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error("Nie udało się pobrać historii tej gry.");
  }

  const items = await hydratePlayItems((data ?? []) as PlayRow[], viewer);
  return sortPlaysByPlayedAtDesc(items);
}

/**
 * Wszystkie partie jednego wieczoru — te grane przy stole, te dopisane ręcznie
 * ORAZ rozgrywka kontynuowana na tym spotkaniu (meetings.continued_play_id),
 * której kotwicą jest wcześniejsze spotkanie. Bez tej ostatniej Stół nie
 * widziałby partii, przy której grupa właśnie siedzi.
 *
 * Świadomie ta sama ścieżka hydratacji co reszta Kroniki, żeby wynik znaczył
 * wszędzie to samo.
 */
export async function listMeetingPlays(
  meetingId: string,
): Promise<PlayListItem[]> {
  const supabase = await createClient();
  const memberState = await getCurrentMember();
  const viewer =
    memberState.status === "active-member" ? memberState.member : null;

  const { data: meetingRow } = await supabase
    .from("meetings")
    .select("continued_play_id")
    .eq("id", meetingId)
    .is("deleted_at", null)
    .maybeSingle();

  const continuedPlayId = meetingRow?.continued_play_id ?? null;
  const filter = continuedPlayId
    ? `meeting_id.eq.${meetingId},id.eq.${continuedPlayId}`
    : `meeting_id.eq.${meetingId}`;

  const { data, error } = await supabase
    .from("plays")
    .select(
      "id, game_id, meeting_id, created_by, played_at, duration_minutes, comment, status, state_note, live_started_at, live_ended_at, result_pending, mode, team_result, created_at, updated_at",
    )
    .or(filter)
    .order("played_at", { ascending: true });

  if (error) {
    throw new Error("Nie udało się pobrać partii tego spotkania.");
  }

  return hydratePlayItems((data ?? []) as PlayRow[], viewer);
}

export async function listRecentMemberPlays(
  userId: string,
  limit = 5,
): Promise<RecentPlaySummary[]> {
  const supabase = await createClient();
  const { data: participantRows, error: participantError } = await supabase
    .from("play_participants")
    .select("play_id")
    .eq("user_id", userId);

  if (participantError) {
    throw new Error("Nie udało się pobrać historii tego gracza.");
  }

  const playIds = [
    ...new Set((participantRows ?? []).map((row) => row.play_id)),
  ];
  if (playIds.length === 0) return [];

  const { data: playRows, error: playError } = await supabase
    .from("plays")
    .select(
      "id, game_id, meeting_id, created_by, played_at, duration_minutes, comment, status, state_note, live_started_at, live_ended_at, result_pending, mode, team_result, created_at, updated_at",
    )
    .in("id", playIds)
    .order("played_at", { ascending: false })
    .limit(limit);

  if (playError) {
    throw new Error("Nie udało się pobrać historii tego gracza.");
  }

  const items = await hydratePlayItems((playRows ?? []) as PlayRow[]);

  return sortPlaysByPlayedAtDesc(items)
    .slice(0, limit)
    .map((item) => toRecentPlaySummary(item, userId));
}

export async function getVisibleMemberProfile(memberId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", memberId)
    .maybeSingle();

  if (error) {
    throw new Error("Nie udało się pobrać karty gracza.");
  }

  if (!data) return null;

  return {
    id: data.id,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
  };
}
