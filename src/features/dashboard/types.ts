export type DashboardQuestType = "action" | "question" | "info";

export type DashboardQuestTone = "decision" | "action" | "success" | "neutral";

export type DashboardQuestReward = {
  immediatePoints: number;
  immediateLabel?: string;
  followUpPoints?: number;
  followUpLabel?: string;
  totalPreviewPoints?: number;
  rewardTone?: "immediate" | "split" | "follow-up";
};

export type DashboardQuest = {
  id: string;
  type: DashboardQuestType;
  title: string;
  description?: string;
  href: string;
  ctaLabel: string;
  optionalPoints?: number;
  reward: DashboardQuestReward;
  priority: number;
  createdAt?: string;
  tone?: DashboardQuestTone;
};

export type DashboardQuestSourceMeeting = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: "planned" | "confirmed";
  ownResponse: boolean | null;
  hasOwnVote: boolean;
};

export type DashboardQuestSourceUnratedGame = {
  playId: string;
  gameId: string;
  gameTitle: string;
  playedAt: string;
};

export type DashboardQuestSourceFinishedMeeting = {
  id: string;
  title: string;
  endsAt: string;
  status: "confirmed" | "completed";
};

export type DashboardQuestSource = {
  futureMeetings: DashboardQuestSourceMeeting[];
  unratedGames: DashboardQuestSourceUnratedGame[];
  finishedMeetingsWithoutPlay: DashboardQuestSourceFinishedMeeting[];
  ownGamesCount: number;
  totalActiveGames: number;
  now: Date;
};

export type DashboardHeroSummary = {
  title: string;
  subtitle: string;
  emptyCtaHref: string;
  emptyCtaLabel: string;
  questCount: number;
  availablePoints: number;
  followUpPoints: number;
};

export type DashboardPointsSummary = {
  currentPoints: number;
  availablePoints: number;
  followUpPoints: number;
};

export type DashboardUpcomingMeeting = {
  id: string;
  title: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
  status: "planned" | "confirmed";
  ownResponse: boolean | null;
  confirmedAttendeesCount: number;
  visualLabel: string;
  visualState:
    "confirmed" | "decision-required" | "awaiting-group" | "completed";
  needsAction: boolean;
  href: string;
  leadingGame: {
    gameId: string;
    title: string;
    coverUrl: string | null;
    votesCount: number;
  } | null;
};

export type DashboardLeaderboardEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalPoints: number;
  rank: number;
};

export type DashboardLeaderboardPreview = {
  currentPoints: number;
  entries: DashboardLeaderboardEntry[];
  viewerRank: number | null;
};

export type DashboardRecentPlayPreview = {
  id: string;
  gameId: string;
  gameTitle: string;
  playedAt: string;
  playersCount: number;
  winnerLabel: string;
  href: string;
};

export type DashboardData = {
  memberName: string;
  summary: DashboardHeroSummary;
  pointsSummary: DashboardPointsSummary;
  quests: DashboardQuest[];
  upcomingMeeting: DashboardUpcomingMeeting | null;
  leaderboard: DashboardLeaderboardPreview;
  recentPlays: DashboardRecentPlayPreview[];
};
