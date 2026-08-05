import { GameCover } from "@/components/ui/game-cover";
import {
  formatChronicleChipScore,
  formatPlayDuration,
  getChronicleParticipantBadgeAsset,
  getPlayDateBadgeParts,
  PLAY_STATUS_LABELS,
  sortPlayParticipants,
} from "./formatting";
import type { PlayListItem, PlayParticipantResult } from "./types";

/*
  Wszystkie rozmiary w tym komponencie są podane w `em`, a jednostkę ustawia
  `.chronicle-page` (clamp na container query). Dzięki temu typografia, okładka
  i odstępy rosną jednym pokrętłem — ten sam layout obsługuje 320px i desktop,
  bez osobnych wariantów i bez skoków między breakpointami.
*/

function MetaChip({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "live";
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-full border px-[0.45em] py-[0.05em] text-[0.56em] font-bold tracking-[0.06em] uppercase ${
        tone === "live"
          ? "border-[#5c6d59]/30 bg-[#e2ebd6]/62 text-[#4d5c46]"
          : "border-[#7a5638]/22 bg-[#fffcf4]/50 text-[#6b4f39]"
      }`}
    >
      {children}
    </span>
  );
}

function PlayerCapsule({
  participant,
  placement,
  mode,
  teamResult,
  isHighlighted,
}: {
  participant: PlayParticipantResult;
  placement: number | null;
  mode: PlayListItem["mode"];
  teamResult: PlayListItem["teamResult"];
  isHighlighted: boolean;
}) {
  const scoreLabel = formatChronicleChipScore(participant.score);
  const medalRank =
    placement === 1 || placement === 2 || placement === 3 ? placement : null;
  /*
    Ten sam slot obsługuje oba tryby: w rywalizacji trafia tu odznaka miejsca,
    w kooperacji — WIN/LOST z wynikiem drużyny (getChronicleParticipantBadgeAsset
    rozstrzyga to po trybie). Wyjątkiem jest kooperacja bez rozstrzygnięcia:
    wtedy nie ma czego pokazać i zostaje neutralna kropka.
  */
  const badgeAsset =
    mode === "cooperative" && teamResult === null
      ? null
      : getChronicleParticipantBadgeAsset(participant, mode, medalRank);

  return (
    <span
      className={`flex min-w-0 items-center gap-[0.25em] rounded-full border py-[0.1em] pr-[0.4em] pl-[0.05em] ${
        isHighlighted
          ? "border-[#b07c31]/50 bg-[linear-gradient(180deg,rgba(255,240,205,0.92),rgba(243,216,154,0.85))] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
          : "border-[#7a5638]/20 bg-[#fffcf3]/62"
      }`}
    >
      {badgeAsset ? (
        // eslint-disable-next-line @next/next/no-img-element -- lokalny asset dekoracyjny z public/brand
        <img
          src={badgeAsset.src}
          alt={badgeAsset.alt}
          className="size-[1.45em] shrink-0 object-contain"
        />
      ) : (
        <span
          aria-hidden="true"
          className="mx-[0.05em] size-[1.1em] shrink-0 rounded-full bg-[#e3d2b4]/80"
        />
      )}

      <span
        className={`min-w-0 flex-1 truncate text-[0.68em] leading-[1.35] ${
          isHighlighted
            ? "font-extrabold text-[#3d2612]"
            : "font-semibold text-[#4a3122]"
        }`}
      >
        {participant.member.displayName}
      </span>

      {scoreLabel ? (
        <span
          className={`shrink-0 text-[0.64em] leading-[1.35] font-bold tabular-nums ${
            isHighlighted ? "text-[#6d4a1c]" : "text-[#8a6540]"
          }`}
        >
          {scoreLabel}
        </span>
      ) : null}
    </span>
  );
}

export function ChronicleEntryCard({ item }: { item: PlayListItem }) {
  const date = getPlayDateBadgeParts(item.playedAt);
  const isInProgress = item.status === "in_progress";
  const isCooperative = item.mode === "cooperative";
  const durationLabel = formatPlayDuration(item.durationMinutes);
  const placeLabel = item.meeting?.title ?? item.meeting?.location ?? null;
  // Remis rozpoznajemy po liczbie zwycięzców — w kooperacji wynik jest
  // drużynowy, więc pojęcie remisu tam nie występuje.
  const isDraw = !isCooperative && item.winners.length > 1;

  const participants = sortPlayParticipants(item.participants);

  const resolvePlacement = (
    participant: PlayParticipantResult,
    index: number,
  ) =>
    isCooperative
      ? null
      : (participant.placement ?? (participant.isWinner ? 1 : index + 1));

  const teamResultLabel = isCooperative
    ? item.teamResult === "win"
      ? "Wygrana drużyny"
      : item.teamResult === "loss"
        ? "Porażka drużyny"
        : "Bez wyniku drużyny"
    : null;

  return (
    <article className="chronicle-page">
      {/* Na wąskiej karcie obie kolumny mają zbliżoną wysokość i wyśrodkowanie
          zamyka pustkę pod chipami. Na szerokiej kolumna gry jest wyraźnie
          wyższa, więc od 600px karty blok daty wraca do góry — patrz reguła
          @container dla .chronicle-head w globals.css. */}
      <header className="chronicle-head flex items-center gap-[0.5em]">
        <div className="min-w-0 flex-1">
          <p className="text-[0.74em] leading-[1.15] font-bold text-[#4a3122] tabular-nums">
            {date.compactDate} · {date.time}
          </p>

          {placeLabel ? (
            <p className="mt-[0.15em] line-clamp-2 text-[0.72em] leading-[1.25] text-[#6b4f39]">
              {placeLabel}
            </p>
          ) : null}

          <div className="mt-[0.3em] flex flex-wrap gap-[0.25em]">
            {isInProgress ? (
              <MetaChip tone="live">{PLAY_STATUS_LABELS.in_progress}</MetaChip>
            ) : null}
            {durationLabel ? <MetaChip>{durationLabel}</MetaChip> : null}
            {isDraw ? <MetaChip>Remis</MetaChip> : null}
          </div>
        </div>

        {/* Delikatna pionowa linia w tym samym duchu co separator komentarza —
            porządkuje układ, ale nie dzieli karty na dwa panele. */}
        <span
          aria-hidden="true"
          className="w-px self-stretch bg-[linear-gradient(180deg,transparent,rgba(122,86,56,0.34)_22%,rgba(122,86,56,0.34)_78%,transparent)]"
        />

        {/* max-w w em: na wąskiej karcie limit nigdy nie działa (wygrywa 34%),
            a na szerokim desktopie pozwala kolumnie gry urosnąć, żeby separator
            nie uciekał na sam skraj i nie zostawiał pustego pola. */}
        <div className="flex w-[34%] max-w-[12em] min-w-[4.6em] shrink-0 flex-col items-center gap-[0.4em]">
          <h3 className="font-display line-clamp-2 text-center text-[0.82em] leading-[1.15] font-bold text-[#43291a]">
            {item.game.title}
          </h3>
          <div className="h-[4em] w-[4em] shrink-0 overflow-hidden rounded-[0.3em] shadow-[0_2px_5px_rgba(58,32,15,0.32)]">
            <GameCover
              title={item.game.title}
              coverUrl={item.game.coverUrl}
              size="micro"
              fitParent
              className="h-full w-full"
            />
          </div>
        </div>
      </header>

      <p className="mt-[0.5em] text-[0.55em] font-bold tracking-[0.2em] text-[#9a6f45] uppercase">
        Gracze
      </p>

      {teamResultLabel ? (
        <p
          className={`mt-[0.25em] inline-flex items-center rounded-full border px-[0.55em] py-[0.15em] text-[0.66em] font-extrabold ${
            item.teamResult === "win"
              ? "border-[#b07c31]/50 bg-[linear-gradient(180deg,rgba(255,240,205,0.92),rgba(243,216,154,0.85))] text-[#5d3f14]"
              : "border-[#7a5638]/28 bg-[#e8e0d5]/70 text-[#5b4a3d]"
          }`}
        >
          {teamResultLabel}
        </p>
      ) : null}

      {participants.length > 0 ? (
        <div className="chronicle-players mt-[0.25em]">
          {participants.map((participant, index) => {
            const placement = resolvePlacement(participant, index);
            return (
              <PlayerCapsule
                key={participant.member.id}
                participant={participant}
                placement={placement}
                mode={item.mode}
                teamResult={item.teamResult}
                isHighlighted={
                  !isCooperative && (participant.isWinner || placement === 1)
                }
              />
            );
          })}
        </div>
      ) : null}

      {item.comment ? (
        <>
          <span
            aria-hidden="true"
            className="mt-[0.5em] block h-px bg-[linear-gradient(90deg,transparent,rgba(122,86,56,0.34),transparent)]"
          />
          <p className="mt-[0.4em] line-clamp-2 text-[0.68em] leading-[1.35] text-[#6b4f39] italic">
            „{item.comment}”
          </p>
        </>
      ) : null}
    </article>
  );
}
