"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMemberFromClient } from "@/features/auth/queries/get-current-member";
import type { MemberRole } from "@/features/auth/types";
import type { FeedbackStatus } from "@/features/feedback/types";
import type {
  AdminActionResult,
  AdminPointActionResult,
  AdminTukatActionResult,
} from "./types";
import {
  validateAdminPointAward,
  validateAdminPointReversal,
} from "./point-adjustments";
import {
  translateTukatAdjustmentError,
  validateAdminTukatAdjustment,
  type AdminTukatOperation,
} from "./tukat-adjustments";

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
  revalidatePath("/admin/konta");
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
  revalidatePath("/admin/konta");
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
  revalidatePath("/admin/zgloszenia");
  return { ok: true };
}

export async function adminAwardPointAction(input: {
  targetUserId: string;
  actionType: string;
  reason?: string;
  requestId: string;
}): Promise<AdminPointActionResult> {
  const parsed = validateAdminPointAward(input);
  if (!parsed.ok) return parsed;

  const access = await requireAdminAccess();
  if (!access.ok) return access;

  const { data, error } = await access.supabase.rpc(
    "admin_award_point_action",
    {
      p_target_user_id: parsed.value.targetUserId,
      p_action_type: parsed.value.actionType,
      p_reason: parsed.value.reason,
      p_request_id: parsed.value.requestId,
    },
  );

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/korekty");
  revalidatePath("/admin/statystyki");
  revalidatePath("/");
  revalidatePath("/legendarium");
  revalidatePath("/profil");
  return { ok: true, delta: data?.[0]?.delta ?? 0 };
}

export async function adminReversePointEventAction(input: {
  pointEventId: string;
  reason?: string;
  requestId: string;
}): Promise<AdminPointActionResult> {
  const parsed = validateAdminPointReversal(input);
  if (!parsed.ok) return parsed;

  const access = await requireAdminAccess();
  if (!access.ok) return access;

  const { data, error } = await access.supabase.rpc(
    "admin_reverse_point_event",
    {
      p_point_event_id: parsed.value.pointEventId,
      p_reason: parsed.value.reason,
      p_request_id: parsed.value.requestId,
    },
  );

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/korekty");
  revalidatePath("/admin/statystyki");
  revalidatePath("/");
  revalidatePath("/legendarium");
  revalidatePath("/profil");
  return { ok: true, delta: data?.[0]?.delta ?? 0 };
}

/**
 * Korekta Tukatów. Znak kwoty wyznacza operacja wybrana w panelu, a saldo
 * po operacji wraca prosto z bazy — panel nigdy nie dolicza niczego lokalnie.
 *
 * `requestId` przychodzi z panelu (jedno `crypto.randomUUID()` na kliknięcie),
 * więc retry tego samego żądania trafia w idempotencję RPC, a druga świadoma
 * korekta ma własny klucz i wchodzi normalnie.
 */
export async function adminAdjustTukatsAction(input: {
  targetUserId: string;
  operation: AdminTukatOperation;
  amount: string;
  reason?: string;
  requestId: string;
}): Promise<AdminTukatActionResult> {
  const parsed = validateAdminTukatAdjustment(input);
  if (!parsed.ok) return parsed;

  const access = await requireAdminAccess();
  if (!access.ok) return access;

  const { data, error } = await access.supabase.rpc("admin_adjust_tukats", {
    p_target_user_id: parsed.value.targetUserId,
    p_amount: parsed.value.delta,
    p_reason: parsed.value.reason,
    p_request_id: parsed.value.requestId,
  });

  if (error) {
    return { ok: false, message: translateTukatAdjustmentError(error) };
  }

  const row = data?.[0];
  if (!row) {
    return { ok: false, message: "Nie udało się zapisać korekty Tukatów." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/korekty");
  revalidatePath("/");
  revalidatePath("/profil");
  return { ok: true, delta: row.delta, balanceAfter: row.balance_after };
}
