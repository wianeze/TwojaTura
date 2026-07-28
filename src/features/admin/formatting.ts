import type { MemberRole } from "@/features/auth/types";
import type { FeedbackStatus } from "@/features/feedback/types";

export const ROLE_LABELS: Record<MemberRole, string> = {
  member: "Członek",
  admin: "Administrator",
  observer: "Obserwator",
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "Nowe",
  in_progress: "W trakcie",
  completed: "Zrealizowane",
  rejected: "Odrzucone",
};

export function formatAdminDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
