import type { SafeAuthErrorInfo } from "./recovery-session";

/**
 * Supabase's updateUser() returns this specific error code when the new
 * password matches the current one — a normal, expected outcome for the
 * visitor (not a system failure), so it gets its own UI treatment rather
 * than the generic "something went wrong" message.
 */
export function isSamePasswordError(info: SafeAuthErrorInfo): boolean {
  return info.code === "same_password";
}

/**
 * Where a successful password update sends the visitor. Only the recovery
 * flow (marked via the hidden `flow=recovery` field set by
 * confirmPasswordRecoveryAction's redirect) goes back to /logowanie — the
 * invite flow reaches this same action without that marker and keeps its
 * existing behavior of landing straight in the app.
 */
export function resolvePasswordUpdateRedirectTarget(
  flow: string,
  isActiveMember: boolean,
): string {
  if (flow === "recovery") return "/logowanie?passwordUpdated=1";
  return isActiveMember ? "/" : "/brak-dostepu";
}
