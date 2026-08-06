import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionLink } from "@/components/ui/action-button";
import { SectionHeading } from "@/components/ui/section-heading";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { updateMeetingAction } from "@/features/meetings/actions";
import { MeetingForm } from "@/features/meetings/meeting-form";
import {
  getMeetingFormData,
  getMeetingLocationSuggestions,
} from "@/features/meetings/queries";

export const metadata: Metadata = { title: "Edytuj spotkanie" };

export default async function EditMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const memberState = await getCurrentMember();
  if (memberState.status !== "active-member") notFound();

  const { id } = await params;
  const [formData, locationSuggestions] = await Promise.all([
    getMeetingFormData(id),
    getMeetingLocationSuggestions(),
  ]);
  if (!formData) notFound();

  if (
    memberState.member.role !== "admin" &&
    memberState.member.id !== formData.meeting.createdBy.id
  ) {
    notFound();
  }

  return (
    // Ta sama kolumna co formularz Kroniki (chronicle-sheet-stack-wide) i co
    // ekran tworzenia spotkania — oba formularze mają wyglądać identycznie.
    <div className="chronicle-sheet-stack chronicle-sheet-stack-wide space-y-7">
      <div
        style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
        className="anim-rise-in-fast"
      >
        <SectionHeading
          eyebrow="Korekta wieczoru"
          title="Edytuj spotkanie"
          description="Możesz poprawić opis, lokalizację oraz dokładny zakres czasu spotkania."
          action={
            <ActionLink
              action="neutral"
              size="compact"
              emphasis="secondary"
              href={`/kalendarium/${id}`}
            >
              Wróć do szczegółów
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
          action={updateMeetingAction.bind(null, id)}
          initialValues={formData.values}
          locationSuggestions={locationSuggestions}
          invitableMembers={formData.invitableMembers}
          submitLabel="Zapisz zmiany"
          pendingLabel="Zapisujemy spotkanie…"
        />
      </section>
    </div>
  );
}
