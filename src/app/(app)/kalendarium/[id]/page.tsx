import { notFound } from "next/navigation";
import { ActionButton, ActionLink } from "@/components/ui/action-button";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import {
  confirmMeetingAction,
  deleteMeetingAction,
  saveMeetingAvailabilityAction,
} from "@/features/meetings/actions";
import { DeleteMeetingButton } from "@/features/meetings/delete-meeting-button";
import {
  formatConfirmedAttendeesLabel,
  formatMeetingDateRange,
  getMeetingDateBadgeParts,
} from "@/features/meetings/formatting";
import { MeetingAvailabilityForm } from "@/features/meetings/meeting-availability-form";
import { MeetingGameProposals } from "@/features/meetings/meeting-game-proposals";
import {
  canManageMeetingConfirmation,
  getMeetingConfirmationActionLabel,
} from "@/features/meetings/meeting-status";
import { getMeetingDetails } from "@/features/meetings/queries";

/*
  Cienka linia działowa na pergaminie — ciemniejszy włos + jasny refleks pod
  spodem (wytłoczenie w papierze), ten sam wzorzec co w szczegółach partii
  Kroniki, żeby oba widoki „jednej strony" mówiły tym samym językiem.
*/
function SheetRule() {
  return (
    <span
      aria-hidden="true"
      className="block h-px bg-[#8b6743]/30 shadow-[0_1px_0_rgba(255,255,255,0.5)]"
    />
  );
}

/*
  Status potwierdzenia spotkania ma dwa miejsca na kartce: tekst "N osób
  potwierdziło" u góry i słowo "Niepotwierdzone"/"Potwierdzone" przy
  przycisku — oba współdzielą te same dwa odcienie (bordo dla "planned",
  zielony dla reszty), żeby nie duplikować palety w dwóch miejscach.
*/
const CONFIRMATION_TONE_CLASS = {
  unconfirmed: "text-[#7a2418]",
  confirmed: "text-[#255429]",
} as const;

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
  const dateBadge = getMeetingDateBadgeParts(meeting.startsAt);
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
  // "Zapisz partię" ma sens dopiero, gdy wieczór faktycznie się odbył —
  // przed zakończeniem spotkania nie ma jeszcze czego zapisywać w Kronice.
  const canLogPlay = meeting.status === "completed";
  // Ile osób realnie odpowiedziało "Będę" — niezależnie od statusu
  // potwierdzenia terminu przez organizatora/admina.
  const confirmedAttendeesCount = meeting.attendanceRows.filter(
    (row) => row.response === true,
  ).length;
  // Bordo tylko dla spotkania jeszcze nie potwierdzonego przez organizatora;
  // potwierdzone i zakończone mówią tym samym zielonym tonem.
  const confirmationTone =
    meeting.status === "planned" ? "unconfirmed" : "confirmed";

  return (
    <div className="chronicle-sheet-stack chronicle-sheet-stack-wide">
      {canLogPlay ? (
        <div
          style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
          className="anim-rise-in-fast mb-2 flex justify-end"
        >
          <ActionLink
            action="chronicle"
            size="compact"
            href={`/kronika/nowa?meeting=${meeting.id}`}
          >
            Zapisz partię
          </ActionLink>
        </div>
      ) : null}

      {/* Pasek akcji NAD kartką — Wróć po lewej, Edytuj + Usuń spotkanie
          zgrupowane po prawej (Edytuj pierwsze, Usuń drugie). */}
      <div
        style={{ animationDelay: `${getEntranceStaggerDelayMs(1)}ms` }}
        className="anim-rise-in-fast mb-3 flex items-center justify-between gap-2 sm:mb-4"
      >
        <ActionLink
          action="neutral"
          size="compact"
          emphasis="secondary"
          href="/kalendarium"
        >
          Wróć
        </ActionLink>

        <div className="flex items-center gap-2">
          {meeting.canEdit ? (
            <ActionLink
              action="meeting"
              size="compact"
              emphasis="secondary"
              href={`/kalendarium/${meeting.id}/edytuj`}
            >
              Edytuj
            </ActionLink>
          ) : null}
          {meeting.canEdit && meeting.canDelete ? (
            <DeleteMeetingButton
              action={deleteMeetingAction.bind(null, meeting.id)}
              hasChroniclePlay={meeting.hasChroniclePlay}
            />
          ) : null}
        </div>
      </div>

      <section
        style={{ animationDelay: `${getEntranceStaggerDelayMs(2)}ms` }}
        className="meeting-form-sheet anim-rise-in-fast space-y-5 sm:space-y-6"
      >
        {/* SEKCJA 1 — Nagłówek spotkania: duży typograficzny blok daty po
            lewej (część papieru, nie osobna kartka), treść wydarzenia po
            prawej w wierszach rozdzielonych cienką linią jak wpis w
            papierowym kalendarzu. */}
        <div className="space-y-3">
          {/* Sam tekst, bez kapsułki/tła/obramowania — status potwierdzenia
              wyraża tu wyłącznie kolor i liczba, słowna etykieta
              "Niepotwierdzone"/"Potwierdzone" jest niżej, przy przycisku. */}
          <p
            className={`text-left text-[0.85rem] font-semibold sm:text-base ${CONFIRMATION_TONE_CLASS[confirmationTone]}`}
          >
            {formatConfirmedAttendeesLabel(confirmedAttendeesCount)}
          </p>

          <div className="flex gap-4 sm:gap-6">
            <div className="w-[7rem] shrink-0 text-center sm:w-[8rem]">
              <p className="text-[0.8rem] font-semibold text-[#8a6a3d]">
                {dateBadge.year}
              </p>
              <p className="text-[0.82rem] leading-tight font-bold tracking-[0.08em] text-[#6b4a2e] uppercase sm:text-[0.92rem]">
                {dateBadge.month}
              </p>
              <p className="font-display text-[3.4rem] leading-[0.85] font-bold text-[#8f3528] sm:text-[4rem]">
                {dateBadge.day}
              </p>
              <p className="mt-1.5 text-[0.94rem] text-[#8a6a3d]">
                {schedule.weekday}
              </p>

              <p className="mt-3 text-[0.85rem] font-bold text-[#7a5937]">
                {schedule.startTime}–{schedule.endTime}
              </p>
              {!schedule.sameDay ? (
                <p className="mt-0.5 text-[0.62rem] text-[#8a6a3d]">
                  do {schedule.endDate}
                </p>
              ) : null}
            </div>

            <div className="min-w-0 flex-1 divide-y divide-[#c9aa7f]/30">
              <div className="pb-2">
                <h1 className="font-display text-[1.25rem] leading-tight font-semibold text-[#3f2a1a] sm:text-[1.55rem]">
                  {meeting.title}
                </h1>
              </div>

              {meeting.location ? (
                <p className="py-2 text-[0.85rem] text-[#6c5644]">
                  {meeting.location}
                </p>
              ) : null}

              <p className="py-2 text-[0.85rem] text-[#6c5644]">
                Organizuje{" "}
                <span className="font-semibold text-[#4e3528]">
                  {meeting.createdBy.displayName}
                </span>
              </p>

              {meeting.description ? (
                <p className="pt-2 text-[0.85rem] leading-6 text-[#6c5644]">
                  {meeting.description}
                </p>
              ) : null}
            </div>
          </div>

          {/* Etykieta statusu zawsze po lewej stronie przycisku (widoczna
              dla wszystkich, nie tylko dla osób mogących potwierdzać) —
              przycisk dokłada się obok wyłącznie dla organizatora/admina. */}
          {confirmationStatus ? (
            <div className="flex items-center justify-end gap-3">
              <span
                className={`text-[0.85rem] font-bold ${CONFIRMATION_TONE_CLASS[confirmationTone]}`}
              >
                {confirmationStatus === "confirmed"
                  ? "Potwierdzone"
                  : "Niepotwierdzone"}
              </span>

              {canManageConfirmation && confirmationActionLabel ? (
                <form
                  action={confirmMeetingAction.bind(
                    null,
                    meeting.id,
                    confirmationStatus,
                  )}
                >
                  <ActionButton
                    type="submit"
                    size="compact"
                    action={
                      meeting.status === "planned" ? "meeting" : "neutral"
                    }
                    emphasis={
                      meeting.status === "planned" ? "primary" : "secondary"
                    }
                  >
                    {confirmationActionLabel}
                  </ActionButton>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* SEKCJA 2 — RSVP: zwarty nagłówek bez dużego eyebrow-a, żeby nie
            konkurował z nagłówkiem spotkania powyżej. */}
        <div
          style={{ animationDelay: `${getEntranceStaggerDelayMs(3)}ms` }}
          className="anim-rise-in-fast space-y-2.5"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-[1.2rem] font-semibold text-[#4a3018] sm:text-[1.35rem]">
              Kto będzie?
            </h2>
            <span className="text-[0.72rem] font-bold text-[#8a6a3d]">
              {meeting.attendanceRows.length} osób
            </span>
          </div>
          <SheetRule />

          <MeetingAvailabilityForm
            action={saveMeetingAvailabilityAction.bind(null, meeting.id)}
            rows={meeting.attendanceRows}
            currentUserId={memberState.member.id}
            ownResponse={meeting.ownResponse}
          />
        </div>

        {/* SEKCJA 3 — Propozycje gier: nagłówek + przycisk „Proponuj grę"
            renderuje MeetingGameProposals we własnym, jednym wierszu. */}
        <div
          style={{ animationDelay: `${getEntranceStaggerDelayMs(4)}ms` }}
          className="anim-rise-in-fast"
        >
          <MeetingGameProposals
            meetingId={meeting.id}
            games={meeting.gameVotes}
            availableGames={meeting.availableGames}
            recommendedGames={meeting.recommendedGames}
          />
        </div>
      </section>
    </div>
  );
}
