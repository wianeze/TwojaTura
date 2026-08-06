import type { ReactNode } from "react";
import Link from "next/link";
import { ActionLink } from "@/components/ui/action-button";
import { GameCover } from "@/components/ui/game-cover";
import { deletePlayAction } from "./actions";
import { DeletePlayButton } from "./delete-play-button";
import {
  formatPlayDuration,
  formatPlayScore,
  getChronicleParticipantBadgeAsset,
  getPlayDateBadgeParts,
  PLAY_STATUS_LABELS,
  resolveChronicleParticipantPlacement,
  sortPlayParticipants,
} from "./formatting";
import type {
  PlayDetails,
  PlayMode,
  PlayParticipantResult,
  PlayPhoto,
  PlayTeamResult,
} from "./types";

/*
  Widok szczegółów partii składa się z arkuszy pergaminu (.chronicle-sheet) —
  ten sam asset i ta sama technika 9-slice co w karcie wpisu Kroniki. Ramka jest
  częścią borderu arkusza, więc treść nigdy nie wchodzi na postrzępione brzegi i
  nie trzeba jej ręcznie odsuwać paddingiem w każdej sekcji.
*/

function Sheet({
  children,
  delayMs = 0,
  className = "",
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  return (
    <section
      className={`chronicle-sheet anim-rise-in ${className}`}
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </section>
  );
}

function SheetHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
      <div className="min-w-0">
        <p className="text-[0.58rem] font-bold tracking-[0.2em] text-[#a3703f] uppercase">
          {eyebrow}
        </p>
        {title ? (
          <h2 className="font-display mt-0.5 text-[clamp(1.05rem,4.6cqi,1.3rem)] leading-tight font-semibold text-[#4a3018]">
            {title}
          </h2>
        ) : null}
      </div>
      {children ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function MetaChip({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "live" | "gold";
}) {
  const toneClasses =
    tone === "live"
      ? "border-[#5c6d59]/35 bg-[#e4ecd9]/80 text-[#4c5b45]"
      : tone === "gold"
        ? "border-[#b07c31]/45 bg-[linear-gradient(180deg,rgba(255,240,205,0.95),rgba(243,216,154,0.9))] text-[#5d3f14]"
        : "border-[#7a5638]/28 bg-[#fffcf3]/70 text-[#6b4f39]";

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[0.6rem] leading-4 font-bold tracking-[0.06em] uppercase ${toneClasses}`}
    >
      {children}
    </span>
  );
}

/*
  Linia działowa na pergaminie: ciemniejszy włos plus jasny refleks pod spodem,
  czyli wytłoczenie w papierze zamiast płaskiej kreski. Dwa warianty budują
  hierarchię prawej kolumny — „strong” zamyka nagłówek sekcji, „soft” rozdziela
  kolejne fakty. Oba mają ten sam ton i ten sam refleks, różni je wyłącznie
  krycie, więc podział czyta się jako jeden system, a nie przypadkowe kreski.
*/
function SheetRule({
  tone = "soft",
  className = "",
}: {
  tone?: "strong" | "soft";
  className?: string;
}) {
  const toneClasses =
    tone === "strong"
      ? "bg-[#8b6743]/70 shadow-[0_1px_0_rgba(255,255,255,0.65)]"
      : "bg-[#8b6743]/30 shadow-[0_1px_0_rgba(255,255,255,0.5)]";

  return (
    <span
      aria-hidden="true"
      className={`block h-px ${toneClasses} ${className}`}
    />
  );
}

function FactBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1.5 min-w-0">
      <p className="text-[0.56rem] font-bold tracking-[0.16em] text-[#a3703f] uppercase">
        {label}
      </p>
      {/* Ten sam stopień pisma co wartości w dolnych metadanych (MetaRow) —
          obie części karty mówią o partii tym samym głosem. */}
      <p className="mt-0.5 text-[0.85rem] leading-5 font-semibold text-[#4a3018] tabular-nums">
        {value}
      </p>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-[#8b6743]/45 pb-1.5 last:border-b-0 last:pb-0">
      <dt className="shrink-0 text-[0.58rem] font-bold tracking-[0.15em] text-[#a3703f] uppercase">
        {label}
      </dt>
      <dd className="min-w-0 text-right text-[0.85rem] leading-5 font-medium break-words text-[#4a3018]">
        {children}
      </dd>
    </div>
  );
}

/*
  Prawa kolumna wiersza uczestnika. Pokazujemy WYŁĄCZNIE dane realnie zapisane
  przy partii — miejsce z bazy albo rozstrzygnięcie zwycięstwa. Domyślne
  numerowanie z `resolveChronicleParticipantPlacement` służy tylko doborowi
  odznaki i nie może wyciekać do etykiety, bo byłoby zmyśleniem wyniku.
*/
function getParticipantResultLabel(
  participant: PlayParticipantResult,
  mode: PlayMode,
) {
  // W kooperacji miejsc nie ma, a wynik drużyny niosą już odznaka WIN/LOST i
  // baner nad listą — powtórzenie go w każdym wierszu byłoby szumem. Zostaje
  // sam wynik punktowy, jeśli został zapisany.
  if (mode === "cooperative") return null;

  if (participant.placement !== null)
    return `${participant.placement}. miejsce`;
  if (participant.isWinner) return "Zwycięstwo";
  return "Bez miejsca";
}

function ParticipantRow({
  participant,
  placement,
  mode,
  teamResult,
  isHighlighted,
}: {
  participant: PlayParticipantResult;
  placement: number | null;
  mode: PlayMode;
  teamResult: PlayTeamResult | null;
  isHighlighted: boolean;
}) {
  const medalRank =
    placement === 1 || placement === 2 || placement === 3 ? placement : null;
  /*
    Ten sam slot obsługuje oba tryby — w rywalizacji trafia tu odznaka miejsca,
    w kooperacji WIN/LOST z wynikiem drużyny. Wyjątkiem jest kooperacja bez
    rozstrzygnięcia: nie ma czego pokazać, więc zostaje monogram gracza.
    Rozstrzygnięcie jest wspólne z listą wpisów, żeby ta sama partia miała te
    same odznaki w Kronice i w szczegółach.
  */
  const badgeAsset =
    mode === "cooperative" && teamResult === null
      ? null
      : getChronicleParticipantBadgeAsset(participant, mode, medalRank);

  const scoreLabel = formatPlayScore(participant.score);
  const resultLabel = getParticipantResultLabel(participant, mode);

  return (
    <li
      className={`flex items-center gap-2.5 rounded-[0.95rem] border px-2 py-1.5 ${
        isHighlighted
          ? "border-[#b07c31]/50 bg-[linear-gradient(180deg,rgba(255,241,208,0.94),rgba(243,217,157,0.88))] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_10px_rgba(120,80,30,0.14)]"
          : "border-[#7a5638]/20 bg-[#fffcf3]/72"
      }`}
    >
      {badgeAsset ? (
        <span className="grid size-[clamp(2rem,10cqi,2.6rem)] shrink-0 place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- lokalny asset dekoracyjny z public/brand */}
          <img
            src={badgeAsset.src}
            alt={badgeAsset.alt}
            className="size-full object-contain"
          />
        </span>
      ) : (
        <span className="grid size-[clamp(2rem,10cqi,2.6rem)] shrink-0 place-items-center rounded-full border border-[#c8a97c]/60 bg-[#f3e6d0] text-[0.8rem] font-bold text-[#7a5638]">
          {participant.member.displayName
            .trim()
            .charAt(0)
            .toLocaleUpperCase("pl-PL") || "?"}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span
          className={`max-w-full min-w-0 truncate text-[0.92rem] leading-5 ${
            isHighlighted
              ? "font-extrabold text-[#3d2612]"
              : "font-semibold text-[#4a3018]"
          }`}
        >
          {participant.member.displayName}
        </span>
        {participant.isWinner && mode !== "cooperative" ? (
          <MetaChip tone="gold">Zwycięzca</MetaChip>
        ) : null}
      </div>

      {scoreLabel || resultLabel ? (
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          {scoreLabel ? (
            <span className="inline-flex rounded-full bg-[#e8d3ac]/85 px-2 py-0.5 text-[0.66rem] leading-4 font-bold text-[#6f5334] tabular-nums">
              {scoreLabel}
            </span>
          ) : null}
          {resultLabel ? (
            <span className="text-[0.7rem] leading-4 font-semibold whitespace-nowrap text-[#6b5242]">
              {resultLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function GalleryPhoto({ photo, wide }: { photo: PlayPhoto; wide: boolean }) {
  // Znany rozmiar źródła pozwala trzymać kafel w proporcjach zdjęcia — przy
  // pojedynczym zdjęciu nic nie jest przycinane ani rozciągane.
  const aspectRatio =
    wide && photo.width > 0 && photo.height > 0
      ? `${photo.width} / ${photo.height}`
      : undefined;

  return (
    <a
      href={photo.url}
      target="_blank"
      rel="noreferrer noopener"
      className="block overflow-hidden rounded-[0.85rem] border border-[#a5825c]/40 bg-[#f3e6d0] shadow-[0_4px_12px_rgba(93,60,32,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b07c31]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- podpisany URL ze Storage, nie statyczny asset */}
      <img
        src={photo.url}
        alt=""
        loading="lazy"
        style={aspectRatio ? { aspectRatio } : undefined}
        className={`w-full object-cover ${wide ? "max-h-[70vh]" : "aspect-square"}`}
      />
    </a>
  );
}

export function PlayDetailsCard({ play }: { play: PlayDetails }) {
  const participants = sortPlayParticipants(play.participants);
  const playDate = getPlayDateBadgeParts(play.playedAt);
  const durationLabel = formatPlayDuration(play.durationMinutes);
  const isCooperative = play.mode === "cooperative";
  // Remis rozpoznajemy po liczbie zwycięzców — w kooperacji wynik jest
  // drużynowy, więc pojęcie remisu tam nie występuje.
  const isDraw = !isCooperative && play.winners.length > 1;
  const isSinglePhoto = play.photos.length === 1;

  const teamResultLabel = isCooperative
    ? play.teamResult === "win"
      ? "Wygrana drużyny"
      : play.teamResult === "loss"
        ? "Porażka drużyny"
        : "Bez wyniku drużyny"
    : null;

  let delayStep = 0;
  const nextDelay = () => 35 * delayStep++;

  return (
    <div className="chronicle-sheet-stack space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <ActionLink
          action="neutral"
          size="compact"
          emphasis="secondary"
          href="/kronika"
        >
          {"Wróć do Kroniki"}
        </ActionLink>

        {play.canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <DeletePlayButton action={deletePlayAction.bind(null, play.id)} />
            <ActionLink
              action="chronicle"
              size="compact"
              emphasis="secondary"
              href={`/kronika/${play.id}/edytuj`}
            >
              {play.status === "in_progress" ? "Wznów grę" : "Edytuj"}
            </ActionLink>
          </div>
        ) : null}
      </div>

      <Sheet delayMs={nextDelay()}>
        <h1 className="font-display text-center text-[clamp(1.2rem,5.4cqi,1.6rem)] leading-tight font-semibold text-balance text-[#43291a]">
          {play.game.title}
        </h1>

        {play.status === "in_progress" ? (
          <p className="mt-2 flex justify-center">
            <MetaChip tone="live">{PLAY_STATUS_LABELS.in_progress}</MetaChip>
          </p>
        ) : null}

        {/*
          Okładka i blok faktów dzielą jeden wiersz, ale przez flex-wrap i
          minimalne szerokości w rem same przechodzą w pion, gdyby kolumna
          zrobiła się skrajnie wąska — bez nachodzenia i bez poziomego scrolla.
        */}
        <div className="mt-3 flex flex-wrap items-stretch justify-center gap-x-3 gap-y-2.5 sm:gap-x-4">
          <div className="w-[clamp(5.5rem,34%,9.5rem)] min-w-[5.5rem] shrink-0 self-center">
            <GameCover
              title={play.game.title}
              coverUrl={play.game.coverUrl}
              size="card"
              fitParent
              className="w-full"
            />
          </div>

          {/* min-w trzyma „11/07/2026 · 18:30” w jednej linii (tekst potrzebuje
              ~126px przy 0.85rem); poniżej tego progu blok schodzi pod okładkę. */}
          <div className="flex min-w-[8.5rem] flex-1 flex-col justify-center sm:max-w-[15rem]">
            <p className="text-[0.58rem] font-bold tracking-[0.2em] text-[#a3703f] uppercase">
              Karta partii
            </p>

            <SheetRule tone="strong" className="mt-1.5" />

            <FactBlock
              label="Data i godzina"
              value={`${playDate.compactDate} · ${playDate.time}`}
            />

            <SheetRule className="mt-1.5" />

            <FactBlock label="Czas gry" value={durationLabel ?? "—"} />

            <SheetRule className="mt-1.5" />
          </div>
        </div>

        <dl className="mt-4 space-y-1.5">
          <MetaRow label="Zapisana przez">{play.createdBy.displayName}</MetaRow>

          {play.meeting ? (
            <MetaRow label="Spotkanie">
              <Link
                href={`/kalendarium/${play.meeting.id}`}
                className="underline decoration-[#b37a46]/45 underline-offset-4"
              >
                {play.meeting.title}
              </Link>
            </MetaRow>
          ) : null}

          {play.meeting?.location ? (
            <MetaRow label="Miejsce">{play.meeting.location}</MetaRow>
          ) : null}
        </dl>
      </Sheet>

      <Sheet delayMs={nextDelay()}>
        <SheetHeading eyebrow="Wyniki" title="Uczestnicy partii">
          {isDraw ? <MetaChip>Remis</MetaChip> : null}
          {isCooperative ? <MetaChip>Kooperacja</MetaChip> : null}
        </SheetHeading>

        {teamResultLabel ? (
          <p
            className={`mt-2.5 inline-flex items-center rounded-full border px-3 py-1 text-[0.75rem] font-extrabold ${
              play.teamResult === "win"
                ? "border-[#b07c31]/50 bg-[linear-gradient(180deg,rgba(255,240,205,0.95),rgba(243,216,154,0.9))] text-[#5d3f14]"
                : "border-[#7a5638]/28 bg-[#e9e1d6]/80 text-[#5b4a3d]"
            }`}
          >
            {teamResultLabel}
          </p>
        ) : null}

        {participants.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {participants.map((participant, index) => {
              const placement = resolveChronicleParticipantPlacement(
                participant,
                index,
                play.mode,
              );

              return (
                <ParticipantRow
                  key={participant.member.id}
                  participant={participant}
                  placement={placement}
                  mode={play.mode}
                  teamResult={play.teamResult}
                  isHighlighted={
                    !isCooperative && (participant.isWinner || placement === 1)
                  }
                />
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-[0.85rem] leading-6 text-[#6b5242]">
            Ta partia nie ma jeszcze zapisanych uczestników.
          </p>
        )}
      </Sheet>

      {play.comment ? (
        <Sheet delayMs={nextDelay()}>
          <SheetHeading eyebrow="Notatka" />
          <p className="mt-2 text-[0.92rem] leading-6 text-[#54402d]">
            {play.comment}
          </p>
        </Sheet>
      ) : null}

      {play.stateNote ? (
        <Sheet delayMs={nextDelay()}>
          <SheetHeading eyebrow="Stan gry" />
          <p className="mt-2 text-[0.92rem] leading-6 text-[#54402d]">
            {play.stateNote}
          </p>
        </Sheet>
      ) : null}

      {play.photos.length > 0 ? (
        <Sheet delayMs={nextDelay()}>
          <SheetHeading eyebrow="Galeria" title="Zdjęcia z partii" />

          <div
            className={`mt-3 ${
              isSinglePhoto ? "" : "grid grid-cols-2 gap-2.5 sm:grid-cols-3"
            }`}
          >
            {play.photos.map((photo) => (
              <GalleryPhoto key={photo.id} photo={photo} wide={isSinglePhoto} />
            ))}
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
