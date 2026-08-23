export type AnalyticsKpis = {
  activeToday: number;
  active7Days: number;
  active30Days: number;
  loginSuccess: number;
  loginFailure: number;
  actionErrors: number;
};

export type AnalyticsDailyPoint = {
  date: string;
  eventsCount: number;
  activeUsers: number;
};

export type AnalyticsCountRow = {
  label: string;
  eventsCount: number;
  uniqueUsers?: number;
};

export type AnalyticsLoginRow = {
  displayName: string;
  createdAt: string;
  deviceClass: string;
  browserFamily: string;
  status: string;
};

export type AnalyticsUserRow = {
  userId: string;
  displayName: string;
  loginCount: number;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
};

export type AnalyticsErrorRow = {
  createdAt: string;
  displayName: string;
  errorAction: string;
  errorCode: string;
};

export type AnalyticsSnapshot = {
  rangeDays: number;
  generatedAt: string;
  kpis: AnalyticsKpis;
  dailyActivity: AnalyticsDailyPoint[];
  routes: AnalyticsCountRow[];
  topComponents: Array<AnalyticsCountRow & { action: string }>;
  questUsage: {
    presented: number;
    clicked: number;
    completed: number;
    expired: number;
  };
  funnel: AnalyticsCountRow[];
  continuations: AnalyticsCountRow[];
  recentLogins: AnalyticsLoginRow[];
  userActivity: AnalyticsUserRow[];
  errors: AnalyticsErrorRow[];
  continuedGames: AnalyticsCountRow[];
};
