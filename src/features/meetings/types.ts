import type { Enums, Tables } from "@/types/database.generated";

export type MeetingStatus = Enums<"meeting_status">;

export const DEFAULT_MEETING_STATUS: MeetingStatus = "planned";

export type MeetingMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type MeetingFormValues = {
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
};

export type MeetingFormFieldName =
  | "title"
  | "description"
  | "location"
  | "startDate"
  | "endDate"
  | "startTime"
  | "endTime";

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

export type MeetingGameVoteItem = {
  gameId: string;
  title: string;
  coverUrl: string | null;
  owner: MeetingMember;
  votesCount: number;
  hasOwnVote: boolean;
};

export type MeetingGameCandidateOption = {
  gameId: string;
  title: string;
  coverUrl: string | null;
  owner: MeetingMember;
  alreadyProposed: boolean;
  hasOwnVote: boolean;
};

export type MeetingDetails = MeetingCardItem & {
  canEdit: boolean;
  canDelete: boolean;
  hasChroniclePlay: boolean;
  canConfirm: boolean;
  hasResponded: boolean;
  attendanceRows: MeetingAttendanceRow[];
  gameVotes: MeetingGameVoteItem[];
  availableGames: MeetingGameCandidateOption[];
};

export type MeetingRecord = Tables<"meetings">;
