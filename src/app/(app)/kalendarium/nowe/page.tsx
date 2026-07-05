import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/section-heading";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { createMeetingAction } from "@/features/meetings/actions";
import { getMeetingFormValues } from "@/features/meetings/formatting";
import { MeetingForm } from "@/features/meetings/meeting-form";
import { getMeetingLocationSuggestions } from "@/features/meetings/queries";

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
  const locationSuggestions = await getMeetingLocationSuggestions();

  return (
    <div className="space-y-7">
      <SectionHeading
        eyebrow="Nowy wieczór"
        title="Dodaj spotkanie"
        description="Tworzysz jedno wydarzenie w Kalendarium z konkretną datą, godziną i miejscem."
        action={
          <Link
            href="/kalendarium"
            className="paper-wash rounded-full px-4 py-2 text-xs font-bold text-[#6a4d36]"
          >
            Wróć do Kalendarium
          </Link>
        }
      />

      <Panel className="paper-wash p-5 sm:p-7">
        <MeetingForm
          action={createMeetingAction}
          initialValues={getMeetingFormValues(undefined, prefilledDateKey)}
          locationSuggestions={locationSuggestions}
          submitLabel="Utwórz spotkanie"
          pendingLabel="Tworzymy spotkanie…"
        />
      </Panel>
    </div>
  );
}
