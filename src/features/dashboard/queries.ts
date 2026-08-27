import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import type { PlayerTitle } from "@/components/ui/player-display-name";
import { mapActiveClassesByUser } from "@/features/legendarium/achievement-view-model";
import {
  getMeetingVisualLabel,
  getMeetingVisualState,
} from "@/features/meetings/calendar-view";
import {
  TABLE_SESSION_GRACE_MS,
  buildFinishedPlayResult,
  buildTableSessionGameChoices,
  getPlayTablePhase,
  listTableSessions,
  pickTableSession,
} from "@/features/meetings/live-play";
import {
  getViewerMeetingParticipation,
  getViewerMeetingQuestEligibility,
} from "@/features/meetings/participation";
import {
  getMeetingDetails,
  listContinuablePlays,
} from "@/features/meetings/queries";
import { sortMeetingRanking } from "@/features/meetings/validation";
import {
  getDashboardMissions,
  scheduleMissionReconcile,
} from "@/features/missions/queries";
import { PLAY_PHASE_LABELS } from "@/features/plays/formatting";
import {
  listMeetingPlays,
  listRecentMemberPlays,
} from "@/features/plays/queries";
import type { PlayListItem } from "@/features/plays/types";
import { createClient } from "@/lib/supabase/server";
import { getUserPointBalanceResult } from "@/features/points/queries";
import type { Tables } from "@/types/database.generated";
import {
  buildDashboardHeroSummary,
  buildDashboardPointsSummary,
  buildLeaderboardPreview,
  buildRecentPlayPreviews,
  formatDashboardWinnerSummary,
  pickUpcomingMeeting,
} from "./formatting";
import {
  buildDashboardQuests,
  filterDashboardQuestSourceForMeetingEligibility,
  pickVisibleDashboardQuests,
} from "./quests";
import type {
  DashboardData,
  DashboardLeaderboardEntry,
  DashboardQuestSource,
  DashboardRecentPlayPreview,
  DashboardTableSession,
  DashboardUpcomingMeeting,
  TableSessionEndedPlay,
  TableSessionMember,
  TableSessionOption,
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
type ResponseRow = Pick<
  Tables<"meeting_game_responses">,
  "meeting_id" | "user_id"
>;
type RankingRow = Tables<"meeting_game_rankings">;
type GameRow = Pick<Tables<"games">, "id" | "title" | "cover_url">;
type RatingRow = Pick<Tables<"ratings">, "game_id">;
type PlayRow = Pick<
  Tables<"plays">,
  | "id"
  | "game_id"
  | "played_at"
  | "status"
  | "live_started_at"
  | "live_ended_at"
  | "result_pending"
>;
type PlayParticipantRow = Pick<
  Tables<"play_participants">,
  "play_id" | "user_id" | "is_winner"
>;
type ProfileRow = Pick<
  Tables<"profiles">,
  "id" | "display_name" | "avatar_url"
> & {
  equipped_title: Pick<Tables<"title_definitions">, "id" | "name" | "rarity"> | null;
};
type UserPointBalanceRow = Tables<"user_point_balances">;

async function getProfilesMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, ProfileRow>();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, avatar_url, equipped_title:title_definitions!profiles_equipped_title_id_fkey(id, name, rarity)",
    )
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
  responseRows: ResponseRow[];
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
          yesCount: Number(row.yes_count ?? 0),
          noCount: Number(row.no_count ?? 0),
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
            yesCount: ranking.yesCount,
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
        ? PLAY_PHASE_LABELS[
            getPlayTablePhase({
              status: play.status,
              liveStartedAt: play.live_started_at,
              liveEndedAt: play.live_ended_at,
              resultPending: play.result_pending,
            })
          ]
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
    .select(
      "id, game_id, played_at, status, live_started_at, live_ended_at, result_pending",
    )
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

type TableSessionMeetingRow = Pick<
  Tables<"meetings">,
  "id" | "starts_at" | "ends_at"
>;

const TABLE_SESSION_MEETING_COLUMNS = "id, starts_at, ends_at";

function toTableSessionMember(
  member: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    equippedTitle?: PlayerTitle | null;
  },
  viewerId: string,
): TableSessionMember {
  return {
    id: member.id,
    displayName: member.displayName,
    avatarUrl: member.avatarUrl,
    equippedTitle: member.equippedTitle,
    isViewer: member.id === viewerId,
    // Uzupełniane w getDashboardData z tego samego get_leaderboard, którego
    // już woła podgląd rankingu — getTableSession nie dubluje tego zapytania.
    points: 0,
  };
}

/**
 * Dopisuje Renomę do uczestników Stołu z rankingu pobranego RÓWNOLEGLE w
 * getDashboardData (get_leaderboard) — bez osobnego zapytania w
 * getTableSession, które i tak biegnie w tym samym Promise.all.
 */
function withParticipantPoints(
  members: TableSessionMember[],
  pointsByUserId: Map<string, number>,
): TableSessionMember[] {
  return members.map((member) => ({
    ...member,
    points: pointsByUserId.get(member.id) ?? member.points,
  }));
}

function toEndedPlay(
  play: PlayListItem,
  viewerId: string,
): TableSessionEndedPlay {
  const phase = getPlayTablePhase(play);
  // Wynik ma sens dopiero dla partii rozliczonej. Dla „zagrane, wynik później”
  // i „odłożone” nie ma czego pokazywać — i nie wolno tego udawać.
  const result =
    phase === "completed"
      ? buildFinishedPlayResult({
          mode: play.mode,
          teamResult: play.teamResult,
          winnerNames: play.winners.map((winner) => winner.displayName),
          viewerIsWinner: play.winners.some((winner) => winner.id === viewerId),
        })
      : null;

  return {
    playId: play.id,
    gameId: play.game.id,
    gameTitle: play.game.title,
    coverUrl: play.game.coverUrl,
    durationMinutes: play.durationMinutes,
    playersCount: play.playersCount,
    phase,
    resultLabel: result?.label ?? null,
    resultTone: result?.tone ?? "neutral",
    stateNote: play.stateNote,
    href: `/kronika/${play.id}`,
    resultHref: `/kronika/${play.id}/edytuj?powrot=stol`,
  };
}

/**
 * Który wieczór zajmuje teraz sekcję Stołu — i wszystko, czego ta sekcja
 * potrzebuje, żeby przejść przez stany „drużyna przy stole” → „GRAMY!” →
 * „podsumowanie partii”.
 *
 * Zapytania są celowo wąskie: najpierw ustalamy KANDYDATÓW (kilka wierszy),
 * dopiero dla zwycięzcy dociągamy pełne dane istniejącymi funkcjami domeny
 * (getMeetingDetails — głosy, rekomendacje, obecność; listMeetingPlays —
 * partie wieczoru). Dzięki temu Stół bez trwającego spotkania kosztuje dwa
 * lekkie zapytania i ani jednego dodatkowego joina.
 */
async function getTableSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  viewerId: string,
  now: Date,
  preferredMeetingId: string | null,
): Promise<{
  session: DashboardTableSession | null;
  options: TableSessionOption[];
}> {
  const empty = { session: null, options: [] as TableSessionOption[] };
  const nowIso = now.toISOString();
  const graceStartIso = new Date(
    now.getTime() - TABLE_SESSION_GRACE_MS,
  ).toISOString();

  const [startedMeetingsResult, livePlaysResult] = await Promise.all([
    supabase
      .from("meetings")
      .select(TABLE_SESSION_MEETING_COLUMNS)
      .is("deleted_at", null)
      .in("status", ["planned", "confirmed"])
      .lte("starts_at", nowIso)
      .gte("ends_at", graceStartIso)
      .order("starts_at", { ascending: false })
      .limit(10),
    // Tylko partie FAKTYCZNIE trwające. Te czekające na wynik ani odłożone nie
    // trzymają już sekcji w stanie „GRAMY!”.
    supabase
      .from("plays")
      .select("id, meeting_id, game_id")
      .eq("status", "in_progress")
      .not("live_started_at", "is", null)
      .is("live_ended_at", null)
      .not("meeting_id", "is", null),
  ]);

  if (startedMeetingsResult.error || livePlaysResult.error) {
    throw new Error("Nie udało się sprawdzić stanu wieczoru przy stole.");
  }

  const runningPlays = livePlaysResult.data ?? [];
  // Gra biegnąca przy danym wieczorze — po niej bierze się tytuł do przełącznika
  // równoległych spotkań.
  const runningGameIdByMeeting = new Map<string, string>();
  const liveMeetingIds = new Set<string>();
  for (const row of runningPlays) {
    if (!row.meeting_id) continue;
    liveMeetingIds.add(row.meeting_id);
    runningGameIdByMeeting.set(row.meeting_id, row.game_id);
  }

  // Wznowiona kontynuacja biegnie ze swoim STARTOWYM meeting_id, więc wieczór,
  // przy którym grupa faktycznie siedzi, trzeba dobrać po continued_play_id.
  if (runningPlays.length > 0) {
    const { data: continuationRows, error: continuationError } = await supabase
      .from("meetings")
      .select("id, continued_play_id")
      .in(
        "continued_play_id",
        runningPlays.map((row) => row.id),
      )
      .is("deleted_at", null);

    if (continuationError) {
      throw new Error("Nie udało się sprawdzić stanu wieczoru przy stole.");
    }

    const gameByPlayId = new Map(
      runningPlays.map((row) => [row.id, row.game_id] as const),
    );
    for (const row of continuationRows ?? []) {
      liveMeetingIds.add(row.id);
      const gameId = row.continued_play_id
        ? gameByPlayId.get(row.continued_play_id)
        : undefined;
      if (gameId) runningGameIdByMeeting.set(row.id, gameId);
    }
  }
  const startedMeetings = (startedMeetingsResult.data ??
    []) as TableSessionMeetingRow[];
  const knownMeetingIds = new Set(startedMeetings.map((meeting) => meeting.id));
  const unlistedLiveMeetingIds = [...liveMeetingIds].filter(
    (meetingId) => !knownMeetingIds.has(meetingId),
  );

  // Partia potrafi przeżyć zaplanowany koniec spotkania o więcej niż okno
  // tolerancji. Wtedy wieczór wraca na Stół po samej partii, nie po zegarze —
  // inaczej trwająca gra zniknęłaby razem z sekcją.
  let unlistedLiveMeetings: TableSessionMeetingRow[] = [];
  if (unlistedLiveMeetingIds.length > 0) {
    const { data, error } = await supabase
      .from("meetings")
      .select(TABLE_SESSION_MEETING_COLUMNS)
      .in("id", unlistedLiveMeetingIds)
      .is("deleted_at", null)
      .in("status", ["planned", "confirmed"]);

    if (error) {
      throw new Error("Nie udało się sprawdzić stanu wieczoru przy stole.");
    }

    unlistedLiveMeetings = (data ?? []) as TableSessionMeetingRow[];
  }

  const globalCandidates = [...startedMeetings, ...unlistedLiveMeetings];
  if (globalCandidates.length === 0) return empty;

  /*
   * SCOPING. „GRAMY!” to sekcja OSOBISTA, nie tablica ogłoszeń całej grupy:
   * zawężamy kandydatów do wieczorów, w których widz faktycznie bierze udział,
   * ZANIM cokolwiek wybierzemy. Odwrotna kolejność (wybierz globalnie, potem
   * sprawdź uprawnienia) potrafiła przy dwóch równoległych spotkaniach oddać
   * całą sekcję obcej grupie tylko dlatego, że kończyła się wcześniej — a
   * własna, biegnąca partia znikała użytkownikowi z ekranu.
   *
   * Uprawnienia admina świadomie NIE poszerzają tej listy. Admin może
   * zarządzać cudzą partią po stronie bazy (assert_can_run_meeting_play), ale
   * jego własny Stół ma pokazywać jego własne wieczory — inaczej wracałby
   * dokładnie ten sam błąd, tyle że dla adminów.
   */
  const participation = await getViewerMeetingParticipation(
    supabase,
    viewerId,
    globalCandidates.map((meeting) => meeting.id),
  );
  const candidateMeetings = globalCandidates.filter((meeting) =>
    participation.has(meeting.id),
  );
  if (candidateMeetings.length === 0) return empty;

  // „Coś już zagraliśmy” to każda zamknięta sesja — rozliczona albo czekająca
  // na wynik. Bez tego kliknięcie „Zakończ partię” wracałoby do ekranu wyboru
  // gry zamiast do podsumowania.
  const { data: endedRows, error: endedError } = await supabase
    .from("plays")
    .select("meeting_id")
    .in(
      "meeting_id",
      candidateMeetings.map((meeting) => meeting.id),
    )
    .or("status.eq.completed,live_ended_at.not.is.null");

  if (endedError) {
    throw new Error("Nie udało się sprawdzić partii rozegranych na spotkaniu.");
  }

  const finishedMeetingIds = new Set(
    (endedRows ?? [])
      .map((row) => row.meeting_id)
      .filter((meetingId): meetingId is string => Boolean(meetingId)),
  );

  const sessionCandidates = candidateMeetings.map((meeting) => ({
    id: meeting.id,
    startsAt: meeting.starts_at,
    endsAt: meeting.ends_at,
    hasLivePlay: liveMeetingIds.has(meeting.id),
    hasFinishedPlay: finishedMeetingIds.has(meeting.id),
  }));

  // `preferredMeetingId` pochodzi z adresu (?meeting=), więc trafia tu dopiero
  // po zawężeniu listy do wieczorów widza — obcy identyfikator nie ma czego
  // dopasować i po cichu wraca domyślny wybór.
  const viable = listTableSessions(sessionCandidates, now);
  const picked = pickTableSession(sessionCandidates, now, {
    preferredMeetingId,
  });

  if (!picked) return empty;

  /*
   * Przełącznik dostaje tylko tyle danych, ile potrzebuje na pigułkę — tytuł
   * wieczoru i grę, w którą przy nim właśnie grają. Pełną sesję (głosy,
   * rekomendacje, partie, obecność) budujemy WYŁĄCZNIE dla wybranego
   * spotkania: przy dwóch równoległych wieczorach drugi komplet zapytań byłby
   * zmarnowany, bo i tak nie ma go gdzie pokazać.
   */
  const optionMeetingTitles = new Map(
    (
      (
        await supabase
          .from("meetings")
          .select("id, title")
          .is("deleted_at", null)
          .in(
            "id",
            viable.map((candidate) => candidate.meeting.id),
          )
      ).data ?? []
    ).map((row) => [row.id, row.title] as const),
  );

  const optionGameIds = [
    ...new Set(
      viable
        .map((candidate) => runningGameIdByMeeting.get(candidate.meeting.id))
        .filter((gameId): gameId is string => Boolean(gameId)),
    ),
  ];
  const optionGameTitles = new Map(
    optionGameIds.length > 0
      ? (
          (
            await supabase
              .from("games")
              .select("id, title")
              .in("id", optionGameIds)
          ).data ?? []
        ).map((row) => [row.id, row.title] as const)
      : [],
  );

  const options: TableSessionOption[] = viable.map((candidate) => {
    const gameId = runningGameIdByMeeting.get(candidate.meeting.id);

    return {
      meetingId: candidate.meeting.id,
      meetingTitle:
        optionMeetingTitles.get(candidate.meeting.id) ?? "Spotkanie",
      gameTitle: gameId ? (optionGameTitles.get(gameId) ?? null) : null,
      isLive: candidate.state === "playing",
      isSelected: candidate.meeting.id === picked.meeting.id,
      href: `/?meeting=${candidate.meeting.id}`,
    };
  });

  const [details, plays, continuablePlays] = await Promise.all([
    getMeetingDetails(picked.meeting.id),
    listMeetingPlays(picked.meeting.id),
    // Picker Stołu oferuje wyłącznie wpisy, które można teraz wznowić. Pełna
    // lista (wraz z partiami już biegnącymi) pozostaje w formularzach i modalu
    // Kalendarium, ale nie może próbować uruchomić jej przy drugim Stole.
    listContinuablePlays(null, { includeRunning: false }),
  ]);

  // Spotkanie zamknięte (albo usunięte) między dwoma zapytaniami przestaje być
  // sesją przy stole — Stół po prostu wraca do widoku następnego spotkania.
  if (!details || details.status === "completed") return empty;

  const livePlaySource =
    plays.find((play) => getPlayTablePhase(play) === "running") ?? null;
  // Wszystko, w co już zagrano tego wieczoru: rozliczone, czekające na wynik i
  // odłożone. Odłożona partia zostaje na osi wieczoru — to jej sesja.
  const endedPlays = plays.filter(
    (play) => play.id !== livePlaySource?.id && play.liveEndedAt !== null,
  );
  const lastEndedSource =
    [...endedPlays].sort(
      (left, right) =>
        new Date(right.liveEndedAt ?? right.updatedAt).getTime() -
        new Date(left.liveEndedAt ?? left.updatedAt).getTime(),
    )[0] ?? null;

  const confirmedMembers = details.attendanceRows
    .filter((row) => row.response === true)
    .map((row) => toTableSessionMember(row.member, viewerId));
  const participants = livePlaySource
    ? livePlaySource.participants.map((participant) =>
        toTableSessionMember(participant.member, viewerId),
      )
    : confirmedMembers.length > 0
      ? confirmedMembers
      : details.attendanceRows.map((row) =>
          toTableSessionMember(row.member, viewerId),
        );

  const leadingVote =
    details.gameVotes.find((vote) => vote.yesCount > 0) ?? null;
  const meetingStatus = details.status;
  const visualState = getMeetingVisualState({
    status: meetingStatus,
    ownResponse: details.ownResponse,
  });

  const meeting: DashboardUpcomingMeeting = {
    id: details.id,
    title: details.title,
    location: details.location,
    startsAt: details.startsAt,
    endsAt: details.endsAt,
    status: meetingStatus,
    ownResponse: details.ownResponse,
    confirmedAttendeesCount: details.confirmedAttendeesCount,
    visualLabel: getMeetingVisualLabel({
      status: meetingStatus,
      ownResponse: details.ownResponse,
    }),
    visualState,
    needsAction: visualState === "decision-required",
    href: `/kalendarium/${details.id}`,
    leadingGame: leadingVote
      ? {
          gameId: leadingVote.gameId,
          title: leadingVote.title,
          coverUrl: leadingVote.coverUrl,
          yesCount: leadingVote.yesCount,
        }
      : null,
  };

  const session: DashboardTableSession = {
    // Stan liczony jest z tych samych danych, na których stoi panel: gdyby
    // partia zniknęła między zapytaniem kandydatów a dociągnięciem partii,
    // sekcja pokaże spójny stan, a nie „GRAMY!” bez gry.
    state: livePlaySource
      ? "playing"
      : endedPlays.length > 0
        ? "summary"
        : "gathering",
    meeting,
    participants,
    gameChoices: buildTableSessionGameChoices({
      votes: details.gameVotes,
      continuationVotes: details.continuationVotes.map((proposal) => ({
        gameId: proposal.gameId,
        title: proposal.title,
        coverUrl: proposal.coverUrl,
        playId: proposal.playId,
        stateNote: proposal.stateNote,
        playedAt: proposal.playedAt,
        accumulatedMinutes: proposal.accumulatedMinutes,
        yesCount: proposal.yesCount,
      })),
      recommendations: details.recommendedGames,
      otherGames: details.availableGames,
      continuablePlays: continuablePlays.map((play) => ({
        gameId: play.gameId,
        title: play.gameTitle,
        coverUrl: play.coverUrl,
        playId: play.playId,
        stateNote: play.stateNote,
        playedAt: play.playedAt,
        accumulatedMinutes: play.accumulatedMinutes,
      })),
    }),
    continuedPlay: details.continuedPlay
      ? {
          playId: details.continuedPlay.playId,
          gameTitle: details.continuedPlay.gameTitle,
          status: details.continuedPlay.status,
          resultHref: `/kronika/${details.continuedPlay.playId}/edytuj?powrot=stol`,
        }
      : null,
    livePlay: livePlaySource?.liveStartedAt
      ? {
          playId: livePlaySource.id,
          gameId: livePlaySource.game.id,
          gameTitle: livePlaySource.game.title,
          coverUrl: livePlaySource.game.coverUrl,
          startedAt: livePlaySource.liveStartedAt,
          accumulatedMinutes: livePlaySource.durationMinutes,
          isContinuation:
            details.continuedPlay?.playId === livePlaySource.id ||
            (livePlaySource.durationMinutes ?? 0) > 0,
          players: livePlaySource.participants.map((participant) =>
            toTableSessionMember(participant.member, viewerId),
          ),
          resultHref: `/kronika/${livePlaySource.id}/edytuj?powrot=stol`,
        }
      : null,
    lastEndedPlay: lastEndedSource
      ? toEndedPlay(lastEndedSource, viewerId)
      : null,
    endedPlays: endedPlays.map((play) => toEndedPlay(play, viewerId)),
    // Partiami wieczoru steruje każdy jego uczestnik. `details.canEdit` to
    // organizator/admin, więc uczestnictwo liczymy osobno — tak samo jak robi
    // to private.is_meeting_participant po stronie bazy.
    canManagePlays:
      details.canEdit ||
      details.attendanceRows.some((row) => row.member.id === viewerId),
    canFinishMeeting: details.canEdit,
  };

  return { session, options };
}

export async function getDashboardData(
  options: { preferredMeetingId?: string | null } = {},
): Promise<DashboardData> {
  const memberState = await getCurrentMember();
  if (memberState.status !== "active-member") {
    throw new Error("Stół wymaga aktywnego członkostwa.");
  }

  const member = memberState.member;
  const supabase = await createClient();
  const now = new Date();
  const nowIso = now.toISOString();

  const [
    availableMeetingsResult,
    finishedMeetingsResult,
    ratingsResult,
    activeGamesResult,
    leaderboardResult,
    currentBalanceResult,
    recentPlayPreviews,
    recentMemberPlays,
    tableSessionResult,
    classDefinitionsResult,
    activeClassProfilesResult,
    missions,
  ] = await Promise.all([
    supabase
      .from("meetings")
      .select("id, title, location, status, starts_at, ends_at")
      .is("deleted_at", null)
      .in("status", ["planned", "confirmed"])
      .gte("ends_at", nowIso)
      .order("starts_at", { ascending: true }),
    supabase
      .from("meetings")
      .select("id, title, status, starts_at, ends_at, continued_play_id")
      .is("deleted_at", null)
      .in("status", ["confirmed", "completed"])
      .lt("ends_at", nowIso)
      .order("ends_at", { ascending: false })
      .limit(4),
    supabase.from("ratings").select("game_id").eq("user_id", member.id),
    supabase.from("games").select("owner_id").is("archived_at", null),
    supabase.rpc("get_leaderboard"),
    getUserPointBalanceResult(member.id),
    getRecentPlayPreviews(supabase),
    listRecentMemberPlays(member.id, 12),
    getTableSession(
      supabase,
      member.id,
      now,
      options.preferredMeetingId ?? null,
    ),
    supabase
      .from("class_definitions")
      .select("class_key, name, description, playstyle, icon_path, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase.rpc("get_public_player_profiles"),
    getDashboardMissions(supabase, member.id, now),
  ]);

  // Porządki wokół Misji robimy PO wysłaniu odpowiedzi — render Stołu nigdy na
  // nie nie czeka. Uzasadnienie kosztu i bezpieczeństwa: missions/queries.ts.
  scheduleMissionReconcile(supabase);

  if (
    availableMeetingsResult.error ||
    finishedMeetingsResult.error ||
    ratingsResult.error ||
    activeGamesResult.error ||
    leaderboardResult.error ||
    currentBalanceResult.error ||
    classDefinitionsResult.error ||
    activeClassProfilesResult.error
  ) {
    throw new Error("Nie udało się zbudować danych Stołu.");
  }

  const pointsByUserId = new Map(
    (leaderboardResult.data ?? []).map(
      (entry) => [entry.user_id, entry.total_points] as const,
    ),
  );
  const tableSession = tableSessionResult.session
    ? {
        ...tableSessionResult.session,
        participants: withParticipantPoints(
          tableSessionResult.session.participants,
          pointsByUserId,
        ),
        livePlay: tableSessionResult.session.livePlay
          ? {
              ...tableSessionResult.session.livePlay,
              players: withParticipantPoints(
                tableSessionResult.session.livePlay.players,
                pointsByUserId,
              ),
            }
          : null,
      }
    : null;

  const futureMeetings = (availableMeetingsResult.data ?? []) as MeetingRow[];
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
          .from("meeting_game_responses")
          .select("meeting_id, user_id")
          .in("meeting_id", futureMeetingIds)
          .eq("user_id", member.id)
      : Promise.resolve({ data: [], error: null }),
    futureMeetingIds.length > 0
      ? supabase
          .from("meeting_game_rankings")
          .select("meeting_id, game_id, yes_count, no_count")
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
    responseRows: (votesResult.data ?? []) as ResponseRow[],
    rankingRows,
    gamesMap: new Map(
      ((gamesForRankingsResult.data ?? []) as GameRow[]).map((game) => [
        game.id,
        game,
      ]),
    ),
    currentUserId: member.id,
  });

  // Jedna definicja uczestnictwa (lustro private.is_meeting_participant) —
  // używana niżej wyłącznie do kafla „Najbliższe spotkanie”. Questy zostają
  // globalne, patrz komentarz przy nextMeeting.
  const viewerMeetingIds = await getViewerMeetingParticipation(
    supabase,
    member.id,
    futureMeetingIds,
  );

  const finishedMeetings = (finishedMeetingsResult.data ?? []) as Array<{
    id: string;
    title: string;
    status: "confirmed" | "completed";
    starts_at: string;
    ends_at: string | null;
    continued_play_id: string | null;
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
    // Oceniać można wyłącznie rozegraną partię. Odkąd wieczór przy stole ma
    // swój wpis w Kronice już w trakcie gry, bez tego filtra Stół prosiłby o
    // ocenę gry, w którą właśnie gramy.
    .filter((play) => play.status === "completed")
    .filter((play) => !ratedGameIds.has(play.game.id))
    .reduce<
      Array<{
        playId: string;
        gameId: string;
        gameTitle: string;
        playedAt: string;
        meetingId: string | null;
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
        meetingId: play.meeting?.id ?? null,
      });

      return result;
    }, []);

  const questMeetingIds = [
    ...new Set([
      ...futureMeetingIds,
      ...finishedMeetingIds,
      ...recentMemberPlays
        .map((play) => play.meeting?.id)
        .filter((meetingId): meetingId is string => Boolean(meetingId)),
    ]),
  ];
  const eligibleQuestMeetingIds = await getViewerMeetingQuestEligibility(
    supabase,
    member.id,
    questMeetingIds,
  );

  const questSource: DashboardQuestSource =
    filterDashboardQuestSourceForMeetingEligibility(
      {
        futureMeetings: upcomingMeetings.map((meeting) => ({
          id: meeting.id,
          title: meeting.title,
          startsAt: meeting.startsAt,
          endsAt: meeting.endsAt,
          status: meeting.status,
          ownResponse: meeting.ownResponse,
          // Quest zaliczony przy dowolnej odpowiedzi — także odmownej.
          hasOwnVote: ((votesResult.data ?? []) as ResponseRow[]).some(
            (response) => response.meeting_id === meeting.id,
          ),
        })),
        unratedGames,
        // Spotkanie-kontynuacja nie ma własnego wiersza w plays — wynik wieczoru
        // jest zapisany w partii rozpoczętej wcześniej. Bez tego filtra quest
        // „Uzupełnij wynik spotkania” wisiałby na nim w nieskończoność i wprost
        // zachęcał do założenia drugiego wpisu o tej samej rozgrywce.
        finishedMeetingsWithoutPlay: finishedMeetings
          .filter(
            (meeting) =>
              !meetingsWithPlays.has(meeting.id) && !meeting.continued_play_id,
          )
          .map((meeting) => ({
            id: meeting.id,
            title: meeting.title,
            startsAt: meeting.starts_at,
            endsAt: meeting.ends_at,
            status: meeting.status,
          })),
        ownGamesCount: (activeGamesResult.data ?? []).filter(
          (game) => game.owner_id === member.id,
        ).length,
        totalActiveGames: activeGamesResult.data?.length ?? 0,
        now,
      },
      eligibleQuestMeetingIds,
    );

  // Stół pokazuje wyłącznie czubek listy — reszta czeka, aż zwolni się miejsce.
  // Podsumowania liczymy z tego samego, przyciętego zbioru, żeby nagłówek nie
  // obiecywał Renomy za karty, których nie widać.
  const quests = pickVisibleDashboardQuests(
    buildDashboardQuests(questSource),
    now,
  );
  const pointsSummary = buildDashboardPointsSummary(
    (currentBalanceResult.data as UserPointBalanceRow | null)?.total_points ??
      0,
    quests,
  );
  /*
   * Kafel „Najbliższe spotkanie” też jest osobisty: pokazuje wieczór, w którym
   * widz bierze udział, a nie pierwszy z brzegu wieczór grupy.
   *
   * Świadomie NIE dotyczy to questów niżej ani Kalendarium — widoczność spotkań
   * i RSVP są w tej aplikacji celowo globalne (patrz 20260806090000: „każdy
   * aktywny member nadal widzi każde spotkanie w Kalendarium i może na nie
   * odpowiedzieć”). Questy dalej zapraszają do odpowiedzi na cudzy wieczór, a
   * gdy widz odpowie „będę”, staje się jego uczestnikiem i wieczór pojawia się
   * także tutaj. Rozdział jest zamierzony: Kalendarium i questy = odkrywanie
   * grupowe, Stół = mój własny stan.
   *
   * Wykluczamy przy tym wieczór trzymający sekcję „GRAMY!”, żeby to samo
   * spotkanie nie pojawiło się na Stole dwa razy.
   */
  const nextMeeting = pickUpcomingMeeting(
    upcomingMeetings.filter((meeting) => viewerMeetingIds.has(meeting.id)),
    now,
    { excludeMeetingId: tableSession?.meeting.id ?? null },
  );
  const summary = buildDashboardHeroSummary({
    memberName: member.displayName,
    quests,
    hasFutureMeeting: nextMeeting !== null,
  });

  /* Class data started with the first query wave above.
    [
      supabase
        .from("class_definitions")
        .select(
          "class_key, name, description, playstyle, icon_path, sort_order",
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      // Wąska projekcja zamiast odczytu z `profiles`: polityka na tej tabeli
      // ukrywa wiersze admina przed zwykłym członkiem, przez co ranking
      // pokazywałby aktywnego admina bez klasy postaci.
      leaderboardUserIds.length > 0
        ? supabase.rpc("get_public_player_profiles")
        : Promise.resolve({ data: [], error: null }),
    ],
  */

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
      userId: profile.user_id,
      activeClassKey: profile.active_class_key,
    })),
  );
  const publicProfilesByUser = new Map(
    (activeClassProfilesResult.data ?? []).map((profile) => [
      profile.user_id,
      profile,
    ]),
  );

  const leaderboardEntries: DashboardLeaderboardEntry[] = (
    leaderboardResult.data ?? []
  ).map((entry) => {
    const publicProfile = publicProfilesByUser.get(entry.user_id);
    const rarity = publicProfile?.equipped_title_rarity;
    return {
      userId: entry.user_id,
      displayName: entry.display_name,
      avatarUrl: entry.avatar_url,
      totalPoints: entry.total_points,
      rank: entry.rank,
      activeClass: activeClassesByUser[entry.user_id] ?? null,
      equippedTitle:
        publicProfile?.equipped_title_id && publicProfile.equipped_title_name
          ? {
              id: publicProfile.equipped_title_id,
              name: publicProfile.equipped_title_name,
              rarity: (["common", "rare", "epic", "legendary"].includes(rarity ?? "") ? rarity : "common") as "common" | "rare" | "epic" | "legendary",
            }
          : null,
    };
  });

  return {
    memberName: member.displayName,
    summary,
    pointsSummary,
    quests,
    missions,
    tableSession,
    tableSessionOptions: tableSessionResult.options,
    upcomingMeeting: nextMeeting,
    leaderboard: buildLeaderboardPreview({
      currentPoints: pointsSummary.currentPoints,
      entries: leaderboardEntries,
      currentUserId: member.id,
    }),
    recentPlays: recentPlayPreviews,
  };
}
