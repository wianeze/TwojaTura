import {
  isPointActionType,
  pointActionLabels,
  type PointActionType,
} from "../points/action-catalog.ts";

export type AdminPointOperation = "award" | "reversal";

export type AdminPointAdjustmentRow = {
  adjustmentId: string;
  adminUserId: string;
  adminDisplayName: string;
  targetUserId: string;
  targetDisplayName: string;
  actionType: PointActionType;
  operation: AdminPointOperation;
  delta: number;
  reason: string | null;
  pointEventId: string;
  reversedPointEventId: string | null;
  createdAt: string;
};

export type AdminReversiblePointEventRow = {
  pointEventId: string;
  targetUserId: string;
  targetDisplayName: string;
  actionType: PointActionType;
  points: number;
  description: string | null;
  createdAt: string;
};

type AwardInput = {
  targetUserId: string;
  actionType: string;
  reason?: string;
  requestId: string;
};

type ReversalInput = {
  pointEventId: string;
  reason?: string;
  requestId: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateReason(reason?: string) {
  const normalized = reason?.trim() ?? "";
  if (normalized.length > 500) {
    return {
      ok: false as const,
      message: "Powód może mieć maksymalnie 500 znaków.",
    };
  }
  return { ok: true as const, value: normalized || undefined };
}

export function validateAdminPointAward(input: AwardInput) {
  if (!UUID_PATTERN.test(input.targetUserId)) {
    return { ok: false as const, message: "Wybierz użytkownika." };
  }
  if (!isPointActionType(input.actionType)) {
    return {
      ok: false as const,
      message: "Wybierz obsługiwaną akcję punktową.",
    };
  }
  if (!UUID_PATTERN.test(input.requestId)) {
    return {
      ok: false as const,
      message: "Nieprawidłowy identyfikator żądania.",
    };
  }
  const reason = validateReason(input.reason);
  if (!reason.ok) return reason;

  return {
    ok: true as const,
    value: {
      targetUserId: input.targetUserId,
      actionType: input.actionType,
      reason: reason.value,
      requestId: input.requestId,
    },
  };
}

export function validateAdminPointReversal(input: ReversalInput) {
  if (!UUID_PATTERN.test(input.pointEventId)) {
    return {
      ok: false as const,
      message: "Wybierz wpis punktowy do cofnięcia.",
    };
  }
  if (!UUID_PATTERN.test(input.requestId)) {
    return {
      ok: false as const,
      message: "Nieprawidłowy identyfikator żądania.",
    };
  }
  const reason = validateReason(input.reason);
  if (!reason.ok) return reason;

  return {
    ok: true as const,
    value: {
      pointEventId: input.pointEventId,
      reason: reason.value,
      requestId: input.requestId,
    },
  };
}

export function formatAdminPointAdjustmentTitle(
  adjustment: Pick<AdminPointAdjustmentRow, "targetDisplayName" | "actionType">,
) {
  return `${adjustment.targetDisplayName} · ${pointActionLabels[adjustment.actionType]}`;
}
