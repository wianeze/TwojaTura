export type AchievementProgress = {
  current: number;
  target: number;
  label: string;
  isComplete: boolean;
};

export type AchievementProgressMetrics = {
  completedMeetingsOrganized: number;
  completedMeetingsHosted: number;
  ratingComments: number;
  playsCreated: number;
  meetingResponses: number;
  activeOwnedGames: number;
  perfectRatings: number;
  replayRatings: number;
  hasFirstWin: boolean;
  lastPlaceFinishes: number;
  hasFullParty: boolean;
  hasSoloPlay: boolean;
  hasSideQuest: boolean;
  currentWinStreak: number;
};

export function isRealLastPlace(
  placements: Array<number | null>,
  placement: number | null,
) {
  if (
    placements.length < 2 ||
    placement === null ||
    placements.some((value) => value === null)
  ) {
    return false;
  }

  const rankedPlacements = placements as number[];
  return (
    new Set(rankedPlacements).size >= 2 &&
    placement === Math.max(...rankedPlacements)
  );
}

function progress(current: number, target: number): AchievementProgress {
  return {
    current: Math.min(current, target),
    target,
    label: `${Math.min(current, target)}/${target}`,
    isComplete: current >= target,
  };
}

export function buildAchievementProgressMap(
  metrics: AchievementProgressMetrics,
): Record<string, AchievementProgress> {
  return {
    initiative_master: progress(metrics.completedMeetingsOrganized, 5),
    camp_host: progress(metrics.completedMeetingsHosted, 5),
    party_bard: progress(metrics.ratingComments, 10),
    coast_chronicler: progress(metrics.playsCreated, 25),
    guidance: progress(metrics.meetingResponses, 10),
    loot_goblin: progress(metrics.activeOwnedGames, 25),
    bag_of_holding: progress(metrics.activeOwnedGames, 50),
    fanboy: progress(metrics.perfectRatings, 5),
    one_more_turn: progress(metrics.replayRatings, 20),
    critical_roll: progress(Number(metrics.hasFirstWin), 1),
    natural_one: progress(metrics.lastPlaceFinishes, 3),
    full_party: progress(Number(metrics.hasFullParty), 1),
    lone_wolf: progress(Number(metrics.hasSoloPlay), 1),
    side_quest: progress(Number(metrics.hasSideQuest), 1),
    dark_urge: progress(metrics.currentWinStreak, 3),
  };
}
