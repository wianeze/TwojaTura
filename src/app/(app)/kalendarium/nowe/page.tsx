import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionLink } from "@/components/ui/action-button";
import { SectionHeading } from "@/components/ui/section-heading";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { createMeetingAction } from "@/features/meetings/actions";
import { getMeetingFormValues } from "@/features/meetings/formatting";
import { MeetingForm } from "@/features/meetings/meeting-form";
import {
  getMeetingCreateFormData,
  getMeetingLocationSuggestions,
} from "@/features/meetings/queries";

export const metadata: Metadata = { title: "Nowe spotkanie" };

type NewMeetingPageProps = {
  searchParams?: Promise<{
    date?: string | string[];
  }>;
};

function readDateParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewMeetingPage({
  searchParams,
}: NewMeetingPageProps) {
  const memberState = await getCurrentMember();
  if (memberState.status !== "active-member") notFound();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const prefilledDateKey = readDateParam(resolvedSearchParams?.date);
  const [locationSuggestions, createFormData] = await Promise.all([
    getMeetingLocationSuggestions(),
    getMeetingCreateFormData(),
  ]);

  return (
    // Ta sama kolumna co formularz Kroniki (chronicle-sheet-stack-wide): jedno
    // pokrętło szerokości, wyśrodkowana, żeby pergamin wyglądał identycznie.
    <div className="chronicle-sheet-stack chronicle-sheet-stack-wide space-y-7">
      <div
        style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
        className="anim-rise-in-fast"
      >
        <SectionHeading
          eyebrow="Nowy wieczór"
          title="Dodaj spotkanie"
          description=""
          action={
            <ActionLink
              action="neutral"
              size="compact"
              emphasis="secondary"
              href="/kalendarium"
            >
              Wróć do Kalendarium
            </ActionLink>
          }
        />
      </div>

      {/* Border arkusza (9-slice) sam trzyma treść z dala od dziurek i
          postrzępionych brzegów — formularz nie potrzebuje własnego paddingu,
          dokładnie jak .chronicle-sheet w Kronice. */}
      <section
        style={{ animationDelay: `${getEntranceStaggerDelayMs(1)}ms` }}
        className="meeting-form-sheet anim-rise-in-fast"
      >
        <MeetingForm
          action={createMeetingAction}
          initialValues={getMeetingFormValues(undefined, prefilledDateKey)}
          locationSuggestions={locationSuggestions}
          invitableMembers={createFormData.invitableMembers}
          continuablePlays={createFormData.continuablePlays}
          submitLabel="Utwórz spotkanie"
          pendingLabel="Tworzymy spotkanie…"
        />
      </section>
    </div>
  );
}
