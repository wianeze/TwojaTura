import type { MemberRole } from "@/features/auth/types";

export type AdminAccountRow = {
  userId: string;
  displayName: string;
  email: string;
  role: MemberRole;
  isActive: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

export type AdminActionResult = { ok: true } | { ok: false; message: string };

export type AdminPointActionResult =
  { ok: true; delta: number } | { ok: false; message: string };
