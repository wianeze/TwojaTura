import type { MemberRole } from "@/features/auth/types";

export const ROLE_LABELS: Record<MemberRole, string> = {
  member: "Członek",
  admin: "Administrator",
  observer: "Obserwator",
};

export function formatAdminDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
