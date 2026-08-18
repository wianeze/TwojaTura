import type { ActiveClassView } from "@/features/legendarium/achievement-view-model";
import type {
  PlayTablePhase,
  TableSessionGameChoice,
  TableSessionResultTone,
  TableSessionState,
} from "@/features/meetings/live-play";

export type DashboardQuestType = "action" | "question" | "info";

export type DashboardQuestTone = "decision" | "action" | "success" | "neutral";

/**
 * Zlecenie operacyjne pokazywane w sekcji „Zlecenia”.
 *
 * `renownPoints` to Renoma, którą baza naprawdę naliczy po wykonaniu czynności.
 * Brak pola oznacza, że czynność nie daje Renomy — i wtedy karta nie pokazuje
 * żadnej nagrody. Nie ma tu miejsca na nagrody „potem”: wcześniejsze pola
 * followUpPoints/totalPreviewPoints nie miały pokrycia w `point_reward_for`.
 */
export type DashboardQuest = {
  id: string;
  type: DashboardQuestType;
  title: string;
  description?: string;
  href: string;
  ctaLabel: string;
  renownPoints?: number;
  /** 1 = blokuje dane, 2 = ma deadline, 3 = housekeeping. */
  priority: number;
  /** Moment, względem którego Zlecenie jest pilne (P2) albo wygasa (P1). */
  deadlineAt?: string;
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
  meetingId?: string | null;
};

export type DashboardQuestSourceFinishedMeeting = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
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
};

export type DashboardPointsSummary = {
  currentPoints: number;
  availablePoints: number;
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
    yesCount: number;
  } | null;
};

export type DashboardLeaderboardEntry = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalPoints: number;
  rank: number;
  activeClass: ActiveClassView | null;
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

export type TableSessionMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isViewer: boolean;
  /** Aktualna Renoma z rankingu (get_leaderboard) — 0, gdy członek go nie ma. */
  points: number;
};

export type TableSessionLivePlay = {
  playId: string;
  gameId: string;
  gameTitle: string;
  coverUrl: string | null;
  /** Zapisany w bazie start BIEŻĄCEJ sesji — źródło prawdy dla licznika. */
  startedAt: string;
  /** Łączny czas zamkniętych wcześniej sesji tej rozgrywki. */
  accumulatedMinutes: number | null;
  /** Wracamy do odłożonej rozgrywki, a nie zaczynamy nowej. */
  isContinuation: boolean;
  players: TableSessionMember[];
  resultHref: string;
};

export type TableSessionEndedPlay = {
  playId: string;
  gameId: string;
  gameTitle: string;
  coverUrl: string | null;
  /** Łączny czas rozgrywki, ze wszystkich sesji. */
  durationMinutes: number | null;
  playersCount: number;
  phase: PlayTablePhase;
  /** Wypełnione dopiero dla partii rozliczonej. */
  resultLabel: string | null;
  resultTone: TableSessionResultTone;
  stateNote: string | null;
  href: string;
  resultHref: string;
};

/**
 * Stan sekcji spotkania na Stole. `null` znaczy „zwykły widok najbliższego
 * spotkania” — dokładnie ten sprzed wdrożenia GRAMY!.
 */
export type DashboardTableSession = {
  state: TableSessionState;
  meeting: DashboardUpcomingMeeting;
  participants: TableSessionMember[];
  gameChoices: TableSessionGameChoice[];
  /** Partia przypisana przez meetings.continued_play_id, nie nowy wpis. */
  continuedPlay: {
    playId: string;
    gameTitle: string;
    status: "in_progress" | "completed";
    resultHref: string;
  } | null;
  livePlay: TableSessionLivePlay | null;
  /** Ostatnio zamknięta sesja — podstawa ekranu podsumowania. */
  lastEndedPlay: TableSessionEndedPlay | null;
  endedPlays: TableSessionEndedPlay[];
  /**
   * Partiami wieczoru steruje każdy JEGO UCZESTNIK (organizator, zaproszony,
   * potwierdzona obecność) oraz admin — lustro private.is_meeting_participant.
   */
  canManagePlays: boolean;
  /** Zakończyć wieczór może organizator albo admin (complete_meeting). */
  canFinishMeeting: boolean;
};

/**
 * Jedna pozycja przełącznika równoległych wieczorów. Powstaje tylko wtedy, gdy
 * widz należy do więcej niż jednego spotkania mogącego teraz zająć sekcję —
 * przy jednym (czyli praktycznie zawsze) lista ma jeden element i przełącznik
 * się nie pokazuje.
 */
export type TableSessionOption = {
  meetingId: string;
  meetingTitle: string;
  /** Tytuł gry, w którą przy tym stole właśnie się gra. */
  gameTitle: string | null;
  isLive: boolean;
  isSelected: boolean;
  href: string;
};

export type DashboardData = {
  memberName: string;
  summary: DashboardHeroSummary;
  pointsSummary: DashboardPointsSummary;
  quests: DashboardQuest[];
  tableSession: DashboardTableSession | null;
  /** Patrz TableSessionOption — przełącznik renderuje się przy length > 1. */
  tableSessionOptions: TableSessionOption[];
  upcomingMeeting: DashboardUpcomingMeeting | null;
  leaderboard: DashboardLeaderboardPreview;
  recentPlays: DashboardRecentPlayPreview[];
};
