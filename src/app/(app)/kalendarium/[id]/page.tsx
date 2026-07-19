import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel } from "@/components/ui/panel";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import {
  confirmMeetingAction,
  saveMeetingAvailabilityAction,
} from "@/features/meetings/actions";
import {
  formatMeetingDateRange,
  getMeetingStatusClass,
  MEETING_STATUS_LABELS,
} from "@/features/meetings/formatting";
import { MeetingAvailabilityForm } from "@/features/meetings/meeting-availability-form";
import { MeetingGameProposals } from "@/features/meetings/meeting-game-proposals";
import {
  canManageMeetingConfirmation,
  getMeetingConfirmationActionLabel,
} from "@/features/meetings/meeting-status";
import { getMeetingDetails } from "@/features/meetings/queries";

export default async function MeetingDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const memberState = await getCurrentMember();
  if (memberState.status !== "active-member") notFound();

  const { id } = await params;
  const meeting = await getMeetingDetails(id);
  if (!meeting) notFound();

  const schedule = formatMeetingDateRange({
    startsAt: meeting.startsAt,
    endsAt: meeting.endsAt,
  });
  const canManageConfirmation = canManageMeetingConfirmation(
    {
      id: memberState.member.id,
      role: memberState.member.role,
    },
    {
      createdById: meeting.createdBy.id,
      status: meeting.status,
    },
  );
  const confirmationActionLabel = getMeetingConfirmationActionLabel(
    meeting.status,
  );
  const confirmationStatus =
    meeting.status === "planned" || meeting.status === "confirmed"
      ? meeting.status
      : null;

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-[0.62rem] font-bold tracking-[0.18em] text-[#e3ae67] uppercase">
            Kalendarium
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-cream text-[1.85rem] font-semibold tracking-tight sm:text-[2.2rem]">
              {meeting.title}
            </h1>
            <span
              className={`rounded-full px-3 py-1 text-[0.68rem] font-bold ${getMeetingStatusClass(meeting.status)}`}
            >
              {MEETING_STATUS_LABELS[meeting.status]}
            </span>
          </div>
        </div>

        {meeting.canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/kalendarium"
              className="paper-wash rounded-full px-4 py-2 text-xs font-bold text-[#6a4d36]"
            >
              ← Wróć
            </Link>
            <Link
              href={`/kronika/nowa?meeting=${meeting.id}`}
              className="rounded-full bg-[#7d2f3d] px-4 py-2 text-xs font-bold text-[#fff3ec] transition-colors hover:bg-[#8d3747]"
            >
              Zapisz partię
            </Link>
            <Link
              href={`/kalendarium/${meeting.id}/edytuj`}
              className="paper-wash self-start rounded-full px-4 py-2 text-xs font-bold text-[#6a4d36]"
            >
              Edytuj
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/kalendarium"
              className="paper-wash rounded-full px-4 py-2 text-xs font-bold text-[#6a4d36]"
            >
              ← Wróć
            </Link>
            <Link
              href={`/kronika/nowa?meeting=${meeting.id}`}
              className="rounded-full bg-[#7d2f3d] px-4 py-2 text-xs font-bold text-[#fff3ec] transition-colors hover:bg-[#8d3747]"
            >
              Zapisz partię
            </Link>
          </div>
        )}
      </header>

      <Panel className="parchment-card space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="space-y-0.5">
              <p className="font-display text-[1.55rem] font-semibold text-[#4d3528] sm:text-[1.75rem]">
                {schedule.startDate}
                {!schedule.sameDay ? ` – ${schedule.endDate}` : ""}
              </p>
              <p className="text-sm font-semibold text-[#7a5937] sm:text-[0.95rem]">
                {schedule.startTime}–{schedule.endTime}
              </p>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-[#5f4738]">
              {meeting.location ? <span>{meeting.location}</span> : null}
              <span>Organizuje {meeting.createdBy.displayName}</span>
              <span>{schedule.weekday}</span>
            </div>

            {meeting.description ? (
              <p className="max-w-3xl text-sm leading-6 text-[#6c5644]">
                {meeting.description}
              </p>
            ) : null}
          </div>

          {canManageConfirmation &&
          confirmationActionLabel &&
          confirmationStatus ? (
            <form
              action={confirmMeetingAction.bind(
                null,
                meeting.id,
                confirmationStatus,
              )}
            >
              <button
                type="submit"
                className={
                  meeting.status === "planned"
                    ? "rounded-full bg-[#7d2f3d] px-3.5 py-2 text-xs font-bold text-[#fff3ec] transition-colors hover:bg-[#8d3747]"
                    : "paper-wash rounded-full px-3.5 py-2 text-xs font-bold text-[#6a4d36] transition-colors hover:bg-[#f1e4d0]"
                }
              >
                {confirmationActionLabel}
              </button>
            </form>
          ) : null}
        </div>
      </Panel>

      <Panel className="paper-wash overflow-hidden p-4 sm:p-5">
        <div className="flex flex-col gap-2 border-b border-white/50 pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-accent text-[0.62rem] font-bold tracking-[0.18em] uppercase">
              RSVP grupy
            </p>
            <h2 className="font-display mt-1 text-[1.45rem] font-semibold text-[#4d3528]">
              KTO BĘDZIE?
            </h2>
          </div>
          <span className="paper-wash rounded-full px-3 py-1 text-[0.68rem] font-bold text-[#6a4f38]">
            {meeting.attendanceRows.length} osób
          </span>
        </div>

        <div className="mt-3">
          <MeetingAvailabilityForm
            action={saveMeetingAvailabilityAction.bind(null, meeting.id)}
            rows={meeting.attendanceRows}
            currentUserId={memberState.member.id}
            ownResponse={meeting.ownResponse}
          />
        </div>
      </Panel>

      <Panel className="space-y-4 p-4 sm:p-5">
        <div>
          <p className="text-accent text-[0.62rem] font-bold tracking-[0.18em] uppercase">
            Wieczór przy stole
          </p>
          <h2 className="font-display mt-1 text-[1.45rem] font-semibold text-[#4d3528]">
            PROPOZYCJE GIER
          </h2>
        </div>

        <MeetingGameProposals
          meetingId={meeting.id}
          games={meeting.gameVotes}
          availableGames={meeting.availableGames}
        />
      </Panel>
    </div>
  );
}
