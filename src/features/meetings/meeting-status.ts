import type { MeetingStatus } from "./types";

type ConfirmationActor = {
  id: string;
  role: "member" | "admin";
};

type ConfirmationMeeting = {
  createdById: string;
  status: MeetingStatus;
};

export function getMeetingConfirmationTargetStatus(
  status: MeetingStatus,
): MeetingStatus | null {
  if (status === "planned") return "confirmed";
  if (status === "confirmed") return "planned";
  return null;
}

export function buildMeetingConfirmationStatusPatch(status: MeetingStatus) {
  const targetStatus = getMeetingConfirmationTargetStatus(status);
  if (!targetStatus) return null;

  return {
    status: targetStatus,
  } satisfies Pick<{ status: MeetingStatus }, "status">;
}

export function canManageMeetingConfirmation(
  actor: ConfirmationActor,
  meeting: ConfirmationMeeting,
) {
  const targetStatus = getMeetingConfirmationTargetStatus(meeting.status);
  if (!targetStatus) return false;

  return actor.role === "admin" || actor.id === meeting.createdById;
}

export function getMeetingConfirmationActionLabel(status: MeetingStatus) {
  if (status === "planned") return "Potwierdź spotkanie";
  if (status === "confirmed") return "Cofnij potwierdzenie";
  return null;
}
