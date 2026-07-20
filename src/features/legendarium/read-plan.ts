export function createLegendariumReadPlan(memberId: string) {
  return {
    leaderboardRpc: "get_leaderboard" as const,
    balance: { table: "user_point_balances" as const, userId: memberId },
    recentEvents: {
      table: "point_events" as const,
      userId: memberId,
      limit: 8,
    },
  };
}
