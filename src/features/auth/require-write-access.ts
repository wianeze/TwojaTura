import { createClient } from "@/lib/supabase/server";
import { getCurrentMemberFromClient } from "./queries/get-current-member";
import type { CurrentMember } from "./types";

/**
 * Shared write-access guard for every Server Action that mutates data.
 * Consolidates what used to be four near-identical local
 * `requireActiveMember()` copies (games/meetings/plays/plays-photo actions)
 * — a single choke point means the observer-role check can't be missed in
 * one of them. RLS (private.current_user_can_write()) is the real backstop
 * regardless; this just gives callers a fast, readable error before the
 * database round-trip.
 */
export async function requireWriteAccess(): Promise<
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      member: CurrentMember;
    }
  | { ok: false; message: string }
> {
  const supabase = await createClient();
  const memberState = await getCurrentMemberFromClient(supabase);

  if (memberState.status !== "active-member") {
    return {
      ok: false,
      message: "Sesja wygasła albo nie masz dostępu do tej sekcji.",
    };
  }

  if (memberState.member.role === "observer") {
    return {
      ok: false,
      message: "To konto ma dostęp tylko do odczytu.",
    };
  }

  return {
    ok: true,
    supabase,
    member: memberState.member,
  };
}
