import type { MemberRole } from "@/features/auth/types";
import type { Tables } from "@/types/database.generated";

export type PlayMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role?: MemberRole;
};

export type PlayParticipantDraft = {
  userId: string;
  isWinner: boolean;
  placement: string;
  score: string;
};

export type PlayParticipantFieldError = {
  placement?: string;
  score?: string;
};

export type PlayParticipantResult = {
  member: PlayMember;
  placement: number | null;
  score: number | null;
  isWinner: boolean;
};

export type PlayStatus = "in_progress" | "completed";

/**
 * Tryb partii. W `competitive` wynik należy do pojedynczych graczy (miejsca,
 * zwycięzcy). W `cooperative` wynik należy do całej drużyny — miejsc nie ma
 * wcale, a `isWinner` jest techniczną pochodną `teamResult`, jednakową dla
 * wszystkich uczestników.
 */
export type PlayMode = "competitive" | "cooperative";

export type PlayTeamResult = "win" | "loss";

export type PlayGameRef = {
  id: string;
  title: string;
  coverUrl: string | null;
};

export type PlayMeetingRef = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
};

export type PlayPhoto = {
  id: string;
  url: string;
  position: number;
  width: number;
  height: number;
  byteSize: number;
};

export type PlayListItem = {
  id: string;
  playedAt: string;
  durationMinutes: number | null;
  comment: string | null;
  status: PlayStatus;
  stateNote: string | null;
  /*
   * Znaczniki sesji przy stole. Razem ze statusem dają cztery stany, których
   * sam status nie unosi (patrz getPlayTablePhase w meetings/live-play.ts):
   *   in_progress + start, bez końca            → gramy TERAZ,
   *   in_progress + koniec + resultPending      → zagrane, wynik do uzupełnienia,
   *   in_progress + koniec, bez resultPending   → odłożone, wrócimy do tego,
   *   in_progress bez startu                    → odłożone, wpis ręczny z Kroniki,
   *   completed                                 → rozliczone, historia.
   * `durationMinutes` jest ŁĄCZNYM czasem rozgrywki — każda zamknięta sesja
   * dokłada do niego swoje minuty, więc kontynuacja nie kasuje historii.
   */
  liveStartedAt: string | null;
  liveEndedAt: string | null;
  resultPending: boolean;
  mode: PlayMode;
  teamResult: PlayTeamResult | null;
  createdAt: string;
  updatedAt: string;
  game: PlayGameRef;
  meeting: PlayMeetingRef | null;
  createdBy: PlayMember;
  participants: PlayParticipantResult[];
  winners: PlayMember[];
  playersCount: number;
  /**
   * Autor, admin ALBO uczestnik spotkania, z którym partia jest powiązana —
   * ten sam krąg, który przepuszcza update_play_with_participants.
   */
  canEdit: boolean;
  /**
   * Usuwanie zostaje przy autorze i adminie (delete_play). Uczestnik może
   * rozliczyć cudzą partię swojego wieczoru, ale nie skasować jej z Kroniki.
   */
  canDelete: boolean;
};

/*
 * Jeden wieczór z historii jednej rozgrywki. „start” to spotkanie z
 * plays.meeting_id (kotwica, nieprzepinana), „continuation” to każde spotkanie
 * wskazujące tę partię przez meetings.continued_play_id. Partia zawsze
 * pozostaje JEDNYM wpisem Kroniki — sesje to tylko jej oś czasu.
 */
export type PlaySessionKind = "start" | "continuation";

export type PlaySession = {
  kind: PlaySessionKind;
  meeting: PlayMeetingRef;
};

export type PlayDetails = PlayListItem & {
  photos: PlayPhoto[];
  sessions: PlaySession[];
  /** Aktywny Stół związany z tym samym wpisem, nigdy nowa partia. */
  activeTableHref: string | null;
};

export type ChronicleMonthGroup = {
  key: string;
  label: string;
  items: PlayListItem[];
};

export type RecentPlaySummary = {
  id: string;
  playedAt: string;
  game: PlayGameRef;
  meeting: PlayMeetingRef | null;
  isWinner: boolean;
  placement: number | null;
  score: number | null;
  winners: PlayMember[];
  status: PlayStatus;
};

export type PlayFormGameOption = {
  id: string;
  title: string;
  coverUrl: string | null;
  ownerName: string;
};

export type PlayFormMeetingOption = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
};

export type PlayFormValues = {
  gameId: string;
  meetingId: string;
  playedOnDate: string;
  playedOnTime: string;
  durationMinutes: string;
  comment: string;
  status: PlayStatus;
  stateNote: string;
  mode: PlayMode;
  teamResult: PlayTeamResult | "";
  participants: PlayParticipantDraft[];
};

export type PlayFormFieldName =
  | "gameId"
  | "meetingId"
  | "playedOnDate"
  | "playedOnTime"
  | "durationMinutes"
  | "participants"
  | "comment"
  | "status"
  | "stateNote"
  | "mode"
  | "teamResult";

export type PlayFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<PlayFormFieldName, string>>;
  participantFieldErrors?: Record<string, PlayParticipantFieldError>;
  submittedValues?: PlayFormValues;
};

export type PlayFormData = {
  initialValues: PlayFormValues;
  games: PlayFormGameOption[];
  meetings: PlayFormMeetingOption[];
  members: PlayMember[];
};

export type PlayRecord = Tables<"plays">;
export type PlayParticipantRecord = Tables<"play_participants">;
