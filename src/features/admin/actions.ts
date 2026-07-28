"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMemberFromClient } from "@/features/auth/queries/get-current-member";
import type { MemberRole } from "@/features/auth/types";
import type { FeedbackStatus } from "@/features/feedback/types";
import type { AdminActionResult } from "./types";

/**
 * Independent of the /admin route's own layout guard — Server Actions can
 * be invoked directly (bypassing whatever page rendered the button), so
 * this re-checks admin status itself. admin_change_role/
 * admin_deactivate_and_anonymize_account also check is_admin() again on
 * the database side; this is defense in depth, not the only gate.
 */
async function requireAdminAccess() {
  const supabase = await createClient();
  const memberState = await getCurrentMemberFromClient(supabase);

  if (
    memberState.status !== "active-member" ||
    memberState.member.role !== "admin"
  ) {
    return {
      ok: false as const,
      message: "Wymagane uprawnienia administratora.",
    };
  }

  return { ok: true as const, supabase, member: memberState.member };
}

export async function adminChangeRoleAction(
  targetUserId: string,
  newRole: MemberRole,
  reason?: string,
): Promise<AdminActionResult> {
  const access = await requireAdminAccess();
  if (!access.ok) return access;

  const { error } = await access.supabase.rpc("admin_change_role", {
    p_target_user_id: targetUserId,
    p_new_role: newRole,
    p_reason: reason,
  });

  if (error) {
    // The RPC raises plain-language Polish exceptions (self-demotion,
    // last-admin, not-found) — pass them straight through instead of
    // genericizing them away.
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function adminDeactivateAccountAction(
  targetUserId: string,
  reason?: string,
): Promise<AdminActionResult> {
  const access = await requireAdminAccess();
  if (!access.ok) return access;

  const { error } = await access.supabase.rpc(
    "admin_deactivate_and_anonymize_account",
    { p_target_user_id: targetUserId, p_reason: reason },
  );

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function adminUpdateFeedbackSubmissionAction(
  submissionId: string,
  status: FeedbackStatus,
  adminNote: string,
): Promise<AdminActionResult> {
  const access = await requireAdminAccess();
  if (!access.ok) return access;

  const { error } = await access.supabase.rpc(
    "admin_update_feedback_submission",
    {
      p_id: submissionId,
      p_status: status,
      p_admin_note: adminNote.trim(),
    },
  );

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin");
  return { ok: true };
}
