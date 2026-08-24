export const HISTORICAL_BUSINESS_TITLE =
  "Historia odtworzona z danych aplikacji";

export const HISTORICAL_BUSINESS_DESCRIPTION =
  "Agregaty operacji zapisanych przed wdrożeniem statystyk. Nie obejmują wejść na ekrany, kliknięć ani czasu w aplikacji.";

export const HISTORICAL_RESPONSES_NOTE =
  "Dla RSVP i głosów pokazujemy zapisany stan odpowiedzi, nie historię wszystkich zmian.";

export type HistoricalBusinessKpis = {
  meetings: number;
  plays: number;
  ratings: number;
  games: number;
  renownNet: number;
  achievements: number;
  loans: number;
  feedback: number;
};

export type HistoricalWeeklyActivity = {
  weekStart: string;
  recordsCount: number;
  activeUsers: number;
};

export type HistoricalPlayerActivity = {
  userId: string;
  displayName: string;
  meetingsCreated: number;
  proposals: number;
  responses: number;
  playParticipations: number;
  wins: number;
  ratings: number;
  gamesAdded: number;
  renownNet: number;
  achievements: number;
};

export type HistoricalGameActivity = {
  gameId: string;
  title: string;
  playsCount: number;
  uniquePlayers: number;
  averageDurationMinutes: number | null;
  ratingsCount: number;
  averageRating: number | null;
};

export type HistoricalRenownBreakdown = {
  actionType: string;
  sourceType: string;
  eventsCount: number;
  pointsTotal: number;
};

export type HistoricalAchievement = {
  achievementKey: string;
  name: string;
  rarity: string;
  awardedCount: number;
};

export type HistoricalBusinessSnapshot = {
  source: "derived";
  generatedAt: string;
  timezone: string;
  dataSince: string | null;
  kpis: HistoricalBusinessKpis;
  weeklyActivity: HistoricalWeeklyActivity[];
  playerActivity: HistoricalPlayerActivity[];
  topGames: HistoricalGameActivity[];
  renownBreakdown: HistoricalRenownBreakdown[];
  renownAdjustments: {
    adminCorrectionPoints: number;
    businessReversalPoints: number;
    rebaseRuns: number;
    rebasePointsDelta: number;
    rebaseEventsWritten: number;
  };
  topAchievements: HistoricalAchievement[];
  responseState: {
    rsvpTotal: number;
    rsvpYes: number;
    gameResponsesTotal: number;
    gameResponsesYes: number;
    continuationResponsesTotal: number;
    continuationResponsesYes: number;
  };
  quality: {
    excludedSoftDeletedMeetings: number;
    responsesAreCurrentState: boolean;
    achievementDatesMayBeBackfilled: boolean;
    renownDatesMayIncludeReconciliation: boolean;
    gameOwnerIsCurrentOwner: boolean;
  };
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function rows(value: unknown) {
  return Array.isArray(value) ? value.map(record) : [];
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function booleanValue(value: unknown) {
  return value === true;
}

export function parseHistoricalBusinessSnapshot(
  value: unknown,
): HistoricalBusinessSnapshot {
  const snapshot = record(value);
  if (snapshot.source !== "derived") {
    throw new Error("Nieprawidłowe źródło historycznych statystyk.");
  }

  const kpis = record(snapshot.kpis);
  const adjustments = record(snapshot.renown_adjustments);
  const responses = record(snapshot.response_state);
  const quality = record(snapshot.quality);

  return {
    source: "derived",
    generatedAt: stringValue(snapshot.generated_at),
    timezone: stringValue(snapshot.timezone) || "Europe/Warsaw",
    dataSince: nullableString(snapshot.data_since),
    kpis: {
      meetings: numberValue(kpis.meetings),
      plays: numberValue(kpis.plays),
      ratings: numberValue(kpis.ratings),
      games: numberValue(kpis.games),
      renownNet: numberValue(kpis.renown_net),
      achievements: numberValue(kpis.achievements),
      loans: numberValue(kpis.loans),
      feedback: numberValue(kpis.feedback),
    },
    weeklyActivity: rows(snapshot.weekly_activity).map((item) => ({
      weekStart: stringValue(item.week_start),
      recordsCount: numberValue(item.records_count),
      activeUsers: numberValue(item.active_users),
    })),
    playerActivity: rows(snapshot.player_activity).map((item) => ({
      userId: stringValue(item.user_id),
      displayName: stringValue(item.display_name),
      meetingsCreated: numberValue(item.meetings_created),
      proposals: numberValue(item.proposals),
      responses: numberValue(item.responses),
      playParticipations: numberValue(item.play_participations),
      wins: numberValue(item.wins),
      ratings: numberValue(item.ratings),
      gamesAdded: numberValue(item.games_added),
      renownNet: numberValue(item.renown_net),
      achievements: numberValue(item.achievements),
    })),
    topGames: rows(snapshot.top_games).map((item) => ({
      gameId: stringValue(item.game_id),
      title: stringValue(item.title),
      playsCount: numberValue(item.plays_count),
      uniquePlayers: numberValue(item.unique_players),
      averageDurationMinutes: nullableNumber(item.average_duration_minutes),
      ratingsCount: numberValue(item.ratings_count),
      averageRating: nullableNumber(item.average_rating),
    })),
    renownBreakdown: rows(snapshot.renown_breakdown).map((item) => ({
      actionType: stringValue(item.action_type),
      sourceType: stringValue(item.source_type),
      eventsCount: numberValue(item.events_count),
      pointsTotal: numberValue(item.points_total),
    })),
    renownAdjustments: {
      adminCorrectionPoints: numberValue(adjustments.admin_correction_points),
      businessReversalPoints: numberValue(adjustments.business_reversal_points),
      rebaseRuns: numberValue(adjustments.rebase_runs),
      rebasePointsDelta: numberValue(adjustments.rebase_points_delta),
      rebaseEventsWritten: numberValue(adjustments.rebase_events_written),
    },
    topAchievements: rows(snapshot.top_achievements).map((item) => ({
      achievementKey: stringValue(item.achievement_key),
      name: stringValue(item.name),
      rarity: stringValue(item.rarity),
      awardedCount: numberValue(item.awarded_count),
    })),
    responseState: {
      rsvpTotal: numberValue(responses.rsvp_total),
      rsvpYes: numberValue(responses.rsvp_yes),
      gameResponsesTotal: numberValue(responses.game_responses_total),
      gameResponsesYes: numberValue(responses.game_responses_yes),
      continuationResponsesTotal: numberValue(
        responses.continuation_responses_total,
      ),
      continuationResponsesYes: numberValue(
        responses.continuation_responses_yes,
      ),
    },
    quality: {
      excludedSoftDeletedMeetings: numberValue(
        quality.excluded_soft_deleted_meetings,
      ),
      responsesAreCurrentState: booleanValue(
        quality.responses_are_current_state,
      ),
      achievementDatesMayBeBackfilled: booleanValue(
        quality.achievement_dates_may_be_backfilled,
      ),
      renownDatesMayIncludeReconciliation: booleanValue(
        quality.renown_dates_may_include_reconciliation,
      ),
      gameOwnerIsCurrentOwner: booleanValue(
        quality.game_owner_is_current_owner,
      ),
    },
  };
}
