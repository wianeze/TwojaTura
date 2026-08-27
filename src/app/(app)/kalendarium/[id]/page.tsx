import Link from "next/link";
import { PlayerDisplayName } from "@/components/ui/player-display-name";
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
import type { MeetingChronicleLock } from "@/features/meetings/meeting-deletion";
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
import {
  getMeetingDetails,
  listContinuablePlays,
} from "@/features/meetings/queries";

/*
  Cienka linia działowa na pergaminie — ciemniejszy włos + jasny refleks pod
  spodem (wytłoczenie w papierze), ten sam wzorzec co w szczegółach partii
  Kroniki, żeby oba widoki „jednej strony" mówiły tym samym językiem.
*/
function SheetRule() {
  return (
    <span
      aria-hidden="true"
      className="block h-px bg-[#8b6743]/70 shadow-[0_1px_0_rgba(255,255,255,0.5)]"
    />
  );
}

/*
  Jeden, wspólny kolor dla wszystkich separatorów na tej kartce (poziomych
  border-t/border-b i nowego pionowego border-l) — musi iść przez inline
  `style`, nie przez Tailwindową klasę `border-[...]`/`divide-[...]`: globalna,
  NIELAYEROWANA reguła `* { border-color: var(--border) }` (globals.css) bije
  każdą warstwowaną utility koloru obramowania niezależnie od specyficzności,
  więc np. `divide-[#8b6743]/70` renderowałoby się i tak jako neutralny,
  blady `--border` (#dacdbb) — dokładnie ten sam efekt, który sprawiał, że
  linie „zlewały się z pergaminem". Inline style bezwarunkowo tę regułę bije.
*/
const SEPARATOR_LINE_COLOR = "rgba(139, 103, 67, 0.65)";

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
  const [meeting, continuablePlays] = await Promise.all([
    getMeetingDetails(id),
    listContinuablePlays(null, { includeRunning: false }),
  ]);
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
  // Obie krawędzie do Kroniki blokują usunięcie spotkania; komunikat mówi,
  // którą z nich trzeba zdjąć najpierw (to samo rozstrzyga RPC delete_meeting).
  const chronicleLock: MeetingChronicleLock | null = meeting.hasChroniclePlay
    ? "start"
    : meeting.continuedPlay
      ? "continuation"
      : null;
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
          className="anim-rise-in-fast mb-2 flex flex-wrap justify-end gap-2"
        >
          {/* Przy kontynuacji „Wróć do partii” należy do sekcji gier niżej —
              tutaj zostaje wyłącznie możliwość zapisania INNEJ partii z tego
              samego wieczoru, i to jako akcja drugoplanowa, żeby nie zachęcać
              do założenia drugiego wpisu o tej samej rozgrywce. */}
          <ActionLink
            action="chronicle"
            size="compact"
            emphasis={meeting.continuedPlay ? "secondary" : "primary"}
            href={`/kronika/nowa?meeting=${meeting.id}`}
          >
            {meeting.continuedPlay ? "Zapisz inną partię" : "Zapisz partię"}
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
              chronicleLock={chronicleLock}
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

          {/* Kapsułka kontynuacji prowadzi do wpisu Kroniki, a nie do jego
              edycji — z karty partii widać całą historię sesji. */}
          {meeting.continuedPlay ? (
            <Link
              href={`/kronika/${meeting.continuedPlay.playId}`}
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#b9884a]/60 bg-[#f7e7c4] px-3.5 py-1.5 text-[0.8rem] font-semibold text-[#5c3f1f] transition hover:bg-[#f2dcae]"
            >
              <span className="shrink-0 text-[0.65rem] font-bold tracking-[0.14em] uppercase opacity-70">
                Kontynuacja
              </span>
              <span className="min-w-0 truncate">
                {meeting.continuedPlay.gameTitle}
              </span>
            </Link>
          ) : null}

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

            {/*
              Pionowy separator = border-l na tej kolumnie, nie osobny
              element — bo domyślne `align-items: stretch` flexboksa (rodzic
              nie ma własnego items-*) rozciąga obie kolumny do wysokości
              wyższej z nich, więc linia zaczyna i kończy się dokładnie na
              wysokości tego wiersza, nigdy nie dotykając ramki kartki.
              Wstawienie osobnego elementu-slupka między kolumny podwoiłoby
              odstęp (gap po obu jego stronach) — border na istniejącej
              kolumnie nie rusza `gap-4 sm:gap-6` w ogóle.
            */}
            <div
              className="min-w-0 flex-1 border-l pl-3 sm:pl-4"
              style={{ borderLeftColor: SEPARATOR_LINE_COLOR }}
            >
              <div
                className="border-b pb-2"
                style={{ borderBottomColor: SEPARATOR_LINE_COLOR }}
              >
                <h1 className="font-display text-[1.25rem] leading-tight font-semibold text-[#3f2a1a] sm:text-[1.55rem]">
                  {meeting.title}
                </h1>
              </div>

              {meeting.location ? (
                <p
                  className="border-b py-2 text-[0.85rem] text-[#6c5644]"
                  style={{ borderBottomColor: SEPARATOR_LINE_COLOR }}
                >
                  {meeting.location}
                </p>
              ) : null}

              <p
                className={`py-2 text-[0.85rem] text-[#6c5644] ${meeting.description ? "border-b" : ""}`}
                style={
                  meeting.description
                    ? { borderBottomColor: SEPARATOR_LINE_COLOR }
                    : undefined
                }
              >
                Organizuje{" "}
                <PlayerDisplayName
                  variant="compact"
                  displayName={meeting.createdBy.displayName}
                  title={meeting.createdBy.equippedTitle}
                  className="inline-block align-bottom font-semibold text-[#4e3528]"
                />
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
            <h2 className="font-display text-[1.2rem] font-bold text-[#4a3018] sm:text-[1.35rem]">
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

        {/* SEKCJA 3 — wspólny plan wieczoru. Wybrana wcześniej kontynuacja nie
            ukrywa pozostałych gier ani głosowania. */}
        <div
          style={{ animationDelay: `${getEntranceStaggerDelayMs(4)}ms` }}
          className="anim-rise-in-fast"
        >
          <MeetingGameProposals
            meetingId={meeting.id}
            games={meeting.gameVotes}
            continuationVotes={meeting.continuationVotes}
            selectedContinuation={meeting.continuedPlay}
            availableGames={meeting.availableGames}
            recommendedGames={meeting.recommendedGames}
            continuablePlays={continuablePlays}
          />
        </div>
      </section>
    </div>
  );
}
