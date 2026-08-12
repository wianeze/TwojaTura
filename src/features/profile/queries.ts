import { createClient } from "@/lib/supabase/server";
import { getUserPointBalanceResult } from "@/features/points/queries";
import type { Tables } from "@/types/database.generated";
import {
  buildPlayerProfileStatistics,
  type ProfileGameSource,
  type ProfilePlaySource,
  type ProfileRatingSource,
} from "./profile-statistics";

type ParticipantRow = Pick<
  Tables<"play_participants">,
  "play_id" | "user_id" | "placement" | "score" | "is_winner"
>;
type PlayRow = Pick<
  Tables<"plays">,
  "id" | "game_id" | "played_at" | "duration_minutes" | "mode" | "team_result"
>;
type GameRow = Pick<Tables<"games">, "id" | "title" | "cover_url">;

export type PlayerProfileData = ReturnType<
  typeof buildPlayerProfileStatistics
> & {
  totalPoints: number;
};

export async function getPlayerProfileData(
  userId: string,
): Promise<PlayerProfileData> {
  const supabase = await createClient();
  const [ownParticipantsResult, ratingsResult, balanceResult] =
    await Promise.all([
      supabase
        .from("play_participants")
        .select("play_id, user_id, placement, score, is_winner")
        .eq("user_id", userId),
      supabase.from("ratings").select("game_id, overall").eq("user_id", userId),
      getUserPointBalanceResult(userId),
    ]);

  if (
    ownParticipantsResult.error ||
    ratingsResult.error ||
    balanceResult.error
  ) {
    throw new Error("Nie udało się pobrać danych Karty Gracza.");
  }

  const ownParticipants = (ownParticipantsResult.data ??
    []) as ParticipantRow[];
  const playIds = [...new Set(ownParticipants.map((row) => row.play_id))];
  const playsResult =
    playIds.length > 0
      ? await supabase
          .from("plays")
          .select("id, game_id, played_at, duration_minutes, mode, team_result")
          .in("id", playIds)
          .eq("status", "completed")
      : { data: [], error: null };

  if (playsResult.error) {
    throw new Error("Nie udało się pobrać historii Karty Gracza.");
  }

  const plays = (playsResult.data ?? []) as PlayRow[];
  const completedPlayIds = plays.map((play) => play.id);
  const gameIds = [
    ...new Set([
      ...plays.map((play) => play.game_id),
      ...(ratingsResult.data ?? []).map((rating) => rating.game_id),
    ]),
  ];
  const [allParticipantsResult, gamesResult] = await Promise.all([
    completedPlayIds.length > 0
      ? supabase
          .from("play_participants")
          .select("play_id, user_id, placement, score, is_winner")
          .in("play_id", completedPlayIds)
      : Promise.resolve({ data: [], error: null }),
    gameIds.length > 0
      ? supabase.from("games").select("id, title, cover_url").in("id", gameIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (allParticipantsResult.error || gamesResult.error) {
    throw new Error("Nie udało się domknąć statystyk Karty Gracza.");
  }

  const allParticipants = (allParticipantsResult.data ??
    []) as ParticipantRow[];
  const ownResultByPlay = new Map(
    ownParticipants.map((row) => [row.play_id, row]),
  );
  const participantsByPlay = new Map<string, string[]>();
  for (const participant of allParticipants) {
    const current = participantsByPlay.get(participant.play_id) ?? [];
    current.push(participant.user_id);
    participantsByPlay.set(participant.play_id, current);
  }
  const games = new Map<string, ProfileGameSource>(
    ((gamesResult.data ?? []) as GameRow[]).map((game) => [
      game.id,
      { id: game.id, title: game.title, coverUrl: game.cover_url },
    ]),
  );
  const profilePlays: ProfilePlaySource[] = plays.flatMap((play) => {
    const ownResult = ownResultByPlay.get(play.id);
    const game = games.get(play.game_id);
    if (!ownResult || !game) return [];
    return [
      {
        id: play.id,
        playedAt: play.played_at,
        durationMinutes: play.duration_minutes,
        mode: play.mode,
        teamResult: play.team_result,
        hasExplicitWinner: allParticipants.some(
          (participant) =>
            participant.play_id === play.id && participant.is_winner,
        ),
        game,
        ownResult: {
          isWinner: ownResult.is_winner,
          placement: ownResult.placement,
          score: ownResult.score,
        },
        participantIds: participantsByPlay.get(play.id) ?? [userId],
      },
    ];
  });
  const ratings: ProfileRatingSource[] = (ratingsResult.data ?? []).map(
    (rating) => ({ gameId: rating.game_id, overall: rating.overall }),
  );

  return {
    ...buildPlayerProfileStatistics({
      userId,
      plays: profilePlays,
      ratings,
      games: [...games.values()],
    }),
    totalPoints: Number(balanceResult.data?.total_points ?? 0),
  };
}
