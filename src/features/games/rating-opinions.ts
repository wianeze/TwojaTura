import type { GameRatingComment, MemberOption } from "./types";

type RatingOpinionRow = {
  id: string;
  user_id: string;
  overall: number;
  replayability: number;
  theme: number;
  wants_to_play_again: boolean;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export function mapGameRatingOpinions(
  ratings: RatingOpinionRow[],
  profiles: Map<string, MemberOption>,
  getProfileLabelFallback: (userId: string) => string,
): GameRatingComment[] {
  return ratings.map((rating) => {
    const author = profiles.get(rating.user_id) ?? {
      id: rating.user_id,
      displayName: getProfileLabelFallback(rating.user_id),
      avatarUrl: null,
    };
    const comment = rating.comment?.trim() || null;

    return {
      id: rating.id,
      author,
      overall: rating.overall,
      replayability: rating.replayability,
      theme: rating.theme,
      wantsToPlayAgain: rating.wants_to_play_again,
      comment,
      createdAt: rating.created_at,
      updatedAt: rating.updated_at,
    };
  });
}
