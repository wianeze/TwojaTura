import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel } from "@/components/ui/panel";
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
    <div className="space-y-7">
      <div
        style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
        className="anim-rise-in-fast"
      >
        <SectionHeading
          eyebrow="Korekta wieczoru"
          title="Edytuj spotkanie"
          description="Możesz poprawić opis, lokalizację oraz dokładny zakres czasu spotkania."
          action={
            <Link
              href={`/kalendarium/${id}`}
              className="paper-wash rounded-full px-4 py-2 text-xs font-bold text-[#6a4d36]"
            >
              Wróć do szczegółów
            </Link>
          }
        />
      </div>

      <Panel
        style={{ animationDelay: `${getEntranceStaggerDelayMs(1)}ms` }}
        className="anim-rise-in-fast paper-wash p-5 sm:p-7"
      >
        <MeetingForm
          action={updateMeetingAction.bind(null, id)}
          initialValues={formData.values}
          locationSuggestions={locationSuggestions}
          submitLabel="Zapisz zmiany"
          pendingLabel="Zapisujemy spotkanie…"
        />
      </Panel>
    </div>
  );
}
