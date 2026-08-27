import type { GameItemKind } from "./item-kind.ts";
import type { Enums, Tables } from "@/types/database.generated";
import type { PlayerTitle } from "@/components/ui/player-display-name";

export type GameStatus = Enums<"game_status">;

export type MemberOption = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  equippedTitle?: PlayerTitle | null;
  activePortraitFrameKey?: string | null;
  role?: "member" | "admin";
};

export type GameRatingSummary = {
  averageOverall: number | null;
  averageReplayability: number | null;
  averageTheme: number | null;
  ratingsCount: number;
  wantsToPlayAgainCount: number;
};

export type OwnGameRating = {
  id: string;
  overall: number;
  replayability: number;
  theme: number;
  wantsToPlayAgain: boolean;
  comment: string | null;
};

export type GameRatingComment = {
  id: string;
  author: MemberOption;
  overall: number;
  replayability: number;
  theme: number;
  wantsToPlayAgain: boolean;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GameExpansion = {
  id: string;
  name: string;
  isOwned: boolean;
};

export type GameExpansionFormValue = {
  id?: string;
  name: string;
  isOwned: boolean;
};

export type ActiveGameLoan = {
  id: string;
  lender: MemberOption;
  borrower: MemberOption;
  loanedAt: string;
  note: string | null;
};

export type GameShelfItem = {
  id: string;
  title: string;
  /** Patrz item-kind.ts — null oznacza „nierozstrzygnięte”, nie „gra bazowa”. */
  isExpansion: boolean | null;
  coverUrl: string | null;
  owner: MemberOption;
  currentHolder: MemberOption | null;
  status: GameStatus;
  description: string | null;
  gameType: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playTimeMinutes: number | null;
  releaseYear: number | null;
  bggRank: number | null;
  bggWeight: number | null;
  minAge: number | null;
  mechanics: string[];
  categories: string[];
  designer: string | null;
  publisher: string | null;
  expansions: GameExpansion[];
  bggUrl: string | null;
  ratingSummary: GameRatingSummary;
  activeLoan: ActiveGameLoan | null;
};

export type GameDetails = GameShelfItem & {
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  ownRating: OwnGameRating | null;
  ratingComments: GameRatingComment[];
};

export type GameFilters = {
  q: string;
  owner?: string;
  status?: GameStatus;
  players?: number;
  maxTime?: number;
  type?: string;
  mechanics: string[];
  categories: string[];
  loanedOnly: boolean;
};

export type GameFilterOptions = {
  owners: MemberOption[];
  types: string[];
  mechanics: string[];
  categories: string[];
};

export type GameFormValues = {
  title: string;
  itemKind: GameItemKind;
  coverUrl: string;
  bggUrl: string;
  bggRank: string;
  gameType: string;
  minPlayers: string;
  maxPlayers: string;
  playTimeMinutes: string;
  releaseYear: string;
  mechanics: string;
  categories: string;
  bggWeight: string;
  minAge: string;
  designer: string;
  publisher: string;
  expansions: GameExpansionFormValue[];
  description: string;
  status: GameStatus;
  currentHolderId: string;
  ownerId: string;
};

export type GameFormFieldName =
  | "title"
  | "itemKind"
  | "coverUrl"
  | "bggUrl"
  | "bggRank"
  | "gameType"
  | "minPlayers"
  | "maxPlayers"
  | "playTimeMinutes"
  | "releaseYear"
  | "mechanics"
  | "categories"
  | "bggWeight"
  | "minAge"
  | "designer"
  | "publisher"
  | "expansions"
  | "description"
  | "status"
  | "currentHolderId"
  | "ownerId";

export type GameFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<GameFormFieldName, string>>;
};

export type BggAutofillActionState =
  | { status: "success"; data: import("./bgg").BggGameDetails }
  | { status: "error"; message: string };

export type ToggleGameExpansionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export type GameLoanActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export type RatingFormFieldName =
  "overall" | "replayability" | "theme" | "wantsToPlayAgain" | "comment";

export type RatingFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<RatingFormFieldName, string>>;
};

export type GameRecord = Tables<"games">;
export type GameExpansionRecord = Tables<"game_expansions">;
export type GameRecordWithExpansions = GameRecord & {
  expansions: GameExpansion[];
};
export type RatingRecord = Tables<"ratings">;
