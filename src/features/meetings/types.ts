import type { Enums, Tables } from "@/types/database.generated";
import type { PlayerTitle } from "@/components/ui/player-display-name";
import type { MeetingGameRecommendationScore } from "./game-recommendations";

export type MeetingStatus = Enums<"meeting_status">;

export const DEFAULT_MEETING_STATUS: MeetingStatus = "planned";

export type MeetingMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  equippedTitle?: PlayerTitle | null;
};

export type MeetingFormValues = {
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  invitedUserIds: string[];
  // Pusty string = brak propozycji. Wybrany play_id jest kandydatem do
  // głosowania; meetings.continued_play_id ustawia dopiero Stół przy wznowieniu.
  continuedPlayId: string;
};

export type MeetingFormFieldName =
  | "title"
  | "description"
  | "location"
  | "startDate"
  | "endDate"
  | "startTime"
  | "endTime"
  | "invitedUserIds"
  | "continuedPlayId";

export type MeetingFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<MeetingFormFieldName, string>>;
  submittedValues?: MeetingFormValues;
};

export type MeetingAvailabilityFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  savedResponse?: boolean | null;
};

export type MeetingVoteState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export type MeetingDeleteState = {
  status: "idle" | "error";
  message?: string;
};

// Wynik akcji stanu „GRAMY!” (start partii, zakończenie spotkania). `playId`
// pojawia się tylko po starcie partii — klient używa go, żeby od razu wskazać
// właściwy wpis Kroniki.
export type MeetingTableSessionState = {
  status: "idle" | "error" | "success";
  message?: string;
  playId?: string;
};

export type MeetingCardItem = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  status: MeetingStatus;
  startsAt: string;
  endsAt: string;
  confirmedAttendeesCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: MeetingMember;
  ownResponse: boolean | null;
};

export type MeetingAttendanceRow = {
  member: MeetingMember;
  response: boolean | null;
};

// null oznacza brak odpowiedzi — gracz jeszcze nie zdecydował.
export type MeetingGameResponse = boolean | null;

export type MeetingGameVoteItem = {
  gameId: string;
  title: string;
  coverUrl: string | null;
  owner: MeetingMember;
  yesCount: number;
  noCount: number;
  ownResponse: MeetingGameResponse;
};

export type MeetingContinuationVoteItem = {
  playId: string;
  gameId: string;
  title: string;
  coverUrl: string | null;
  playedAt: string;
  stateNote: string | null;
  accumulatedMinutes: number | null;
  yesCount: number;
  noCount: number;
  ownResponse: MeetingGameResponse;
};

export type MeetingGameCandidateOption = {
  gameId: string;
  title: string;
  coverUrl: string | null;
  owner: MeetingMember;
  alreadyProposed: boolean;
  ownResponse: MeetingGameResponse;
};

export type MeetingGameRecommendation = MeetingGameCandidateOption &
  MeetingGameRecommendationScore;

// Partia „w toku”, do której grupa może wrócić na kolejnym spotkaniu. Ta sama
// struktura służy jako pozycja listy wyboru w formularzu i jako opis
// kontynuacji na karcie spotkania.
export type MeetingContinuablePlay = {
  playId: string;
  gameId: string;
  gameTitle: string;
  coverUrl: string | null;
  status: "in_progress" | "completed";
  /** Spotkanie, na którym powstał wpis; null dla wpisu ręcznego. */
  startMeetingId: string | null;
  /** Bieżąca sesja Stołu nadal trwa. */
  isRunning: boolean;
  /** Istniejące, nieusunięte spotkanie wskazujące tę samą kontynuację. */
  assignedMeeting: { id: string; title: string } | null;
  playedAt: string;
  stateNote: string | null;
  /** Łączny czas dotychczasowych sesji tej rozgrywki. */
  accumulatedMinutes: number | null;
};

export type MeetingDetails = MeetingCardItem & {
  canEdit: boolean;
  canDelete: boolean;
  // Na tym spotkaniu zapisano partię (plays.meeting_id) — spotkanie startowe.
  hasChroniclePlay: boolean;
  // Na tym spotkaniu wracamy do partii rozpoczętej gdzie indziej.
  continuedPlay: MeetingContinuablePlay | null;
  canConfirm: boolean;
  hasResponded: boolean;
  // Organizator + zaproszeni — nie "wszyscy aktywni członkowie". Kto trafia
  // na tę listę kontroluje meeting_invitations, patrz buildAttendanceRows.
  attendanceRows: MeetingAttendanceRow[];
  invitedUserIds: string[];
  gameVotes: MeetingGameVoteItem[];
  continuationVotes: MeetingContinuationVoteItem[];
  availableGames: MeetingGameCandidateOption[];
  recommendedGames: MeetingGameRecommendation[];
};

export type MeetingRecord = Tables<"meetings">;
