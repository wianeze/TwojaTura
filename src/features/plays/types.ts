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
  createdAt: string;
  updatedAt: string;
  game: PlayGameRef;
  meeting: PlayMeetingRef | null;
  createdBy: PlayMember;
  participants: PlayParticipantResult[];
  winners: PlayMember[];
  playersCount: number;
  canEdit: boolean;
};

export type PlayDetails = PlayListItem & {
  photos: PlayPhoto[];
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
  | "stateNote";

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
