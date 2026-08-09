import { createClient } from "@/lib/supabase/server";

/*
 * Uczestnictwo w spotkaniu — JEDNA definicja po stronie TS, lustro
 * `private.is_meeting_participant` z bazy (20260809150000): organizator,
 * zaproszony albo potwierdzona obecność (RSVP „będę”).
 *
 * Ten moduł istnieje po to, żeby ta definicja nie rozjechała się między
 * warstwami: Kronika używa jej do wyliczenia `canEdit` na wpisie partii, a
 * Stół do tego, KTÓRE spotkania w ogóle mogą zająć sekcję „GRAMY!”. Autorytetem
 * pozostaje baza (RPC i tak odbiją nieuprawnione wywołanie) — tu chodzi o to,
 * żeby UI pokazywał dokładnie to, co baza przepuści.
 *
 * Świadomie NIE obejmuje „każdego aktywnego członka”: widoczność spotkań i samo
 * RSVP są w tej aplikacji celowo globalne (patrz 20260806090000), ale bycie
 * UCZESTNIKIEM konkretnego wieczoru już nie.
 */
export async function getViewerMeetingParticipation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  viewerId: string,
  meetingIds: string[],
): Promise<Set<string>> {
  if (meetingIds.length === 0) return new Set<string>();

  const [organizedResult, invitedResult, availableResult] = await Promise.all([
    supabase
      .from("meetings")
      .select("id")
      .in("id", meetingIds)
      .eq("created_by", viewerId)
      .is("deleted_at", null),
    supabase
      .from("meeting_invitations")
      .select("meeting_id")
      .in("meeting_id", meetingIds)
      .eq("user_id", viewerId),
    supabase
      .from("meeting_availability")
      .select("meeting_id")
      .in("meeting_id", meetingIds)
      .eq("user_id", viewerId)
      .eq("is_available", true),
  ]);

  const participation = new Set<string>();
  for (const row of organizedResult.data ?? []) participation.add(row.id);
  for (const row of invitedResult.data ?? []) participation.add(row.meeting_id);
  for (const row of availableResult.data ?? []) {
    participation.add(row.meeting_id);
  }

  return participation;
}

/**
 * Uprawnienie do questów konkretnego spotkania: wyłącznie organizator albo
 * osoba jawnie zaproszona. Potwierdzone RSVP celowo nie wystarcza — samo
 * pytanie o obecność nie może trafiać do osoby spoza listy zaproszonych.
 */
export async function getViewerMeetingQuestEligibility(
  supabase: Awaited<ReturnType<typeof createClient>>,
  viewerId: string,
  meetingIds: string[],
): Promise<Set<string>> {
  if (meetingIds.length === 0) return new Set<string>();

  const [organizedResult, invitedResult] = await Promise.all([
    supabase
      .from("meetings")
      .select("id")
      .in("id", meetingIds)
      .eq("created_by", viewerId)
      .is("deleted_at", null),
    supabase
      .from("meeting_invitations")
      .select("meeting_id")
      .in("meeting_id", meetingIds)
      .eq("user_id", viewerId),
  ]);

  if (organizedResult.error || invitedResult.error) {
    throw new Error("Nie udało się sprawdzić zaproszeń na spotkania.");
  }

  const eligibility = new Set<string>();
  for (const row of organizedResult.data ?? []) eligibility.add(row.id);
  for (const row of invitedResult.data ?? []) eligibility.add(row.meeting_id);

  return eligibility;
}
