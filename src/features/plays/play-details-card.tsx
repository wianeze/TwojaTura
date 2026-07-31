import Link from "next/link";
import { ActionLink } from "@/components/ui/action-button";
import { GameCover } from "@/components/ui/game-cover";
import { Panel } from "@/components/ui/panel";
import { deletePlayAction } from "./actions";
import { DeletePlayButton } from "./delete-play-button";
import {
  formatPlayDuration,
  formatPlayScore,
  getChronicleParticipantBadgeAsset,
  getPlayDateBadgeParts,
  PLAY_STATUS_LABELS,
} from "./formatting";
import type { PlayDetails } from "./types";

function PlayDetailsDateTile({
  playedAt,
  durationMinutes,
  meeting,
  status,
}: Pick<PlayDetails, "playedAt" | "durationMinutes" | "meeting" | "status">) {
  const date = getPlayDateBadgeParts(playedAt);
  const isInProgress = status === "in_progress";

  return (
    <div
      className={`premium-edge rounded-[1.25rem] px-3 py-3 text-center shadow-[0_10px_22px_rgba(74,49,30,0.12)] ${
        isInProgress
          ? "bg-[linear-gradient(145deg,rgba(246,226,177,0.98),rgba(235,208,135,0.96))] ring-1 ring-[#d1a64a]/35"
          : "bg-[linear-gradient(180deg,rgba(255,251,244,0.96),rgba(241,229,208,0.92))]"
      }`}
    >
      {isInProgress ? (
        <span className="mb-2 inline-flex max-w-full items-center justify-center rounded-full bg-[#fff4cf] px-2 py-0.75 text-center text-[0.62rem] leading-4 font-bold text-[#775919]">
          {PLAY_STATUS_LABELS.in_progress}
        </span>
      ) : null}
      <p
        className={`text-[1.15rem] font-bold tracking-[0.03em] ${isInProgress ? "text-[#5f461d]" : "text-[#4d3528]"}`}
      >
        {date.day}/{date.month}
      </p>
      <p
        className={`text-[0.62rem] font-semibold tracking-[0.16em] uppercase ${isInProgress ? "text-[#6c5125]" : "text-[#9b7249]"}`}
      >
        {date.year}
      </p>
      <p
        className={`mt-1.5 text-[0.82rem] font-semibold ${isInProgress ? "text-[#6c5125]" : "text-[#6b5242]"}`}
      >
        {date.time}
      </p>

      {durationMinutes ? (
        <span
          className={`mt-2 inline-flex rounded-full px-2 py-0.75 text-[0.64rem] font-semibold ${
            isInProgress
              ? "bg-[#fff4cf] text-[#775919]"
              : "bg-[#ead7b6] text-[#705338]"
          }`}
        >
          {formatPlayDuration(durationMinutes)}
        </span>
      ) : null}

      {meeting ? (
        <Link
          href={`/kalendarium/${meeting.id}`}
          className={`mt-2 block text-[0.66rem] leading-4 font-semibold underline decoration-[#b37a46]/35 underline-offset-3 ${
            isInProgress ? "text-[#6c5125]" : "text-[#705338]"
          }`}
        >
          {meeting.title}
        </Link>
      ) : null}
    </div>
  );
}

export function PlayDetailsCard({ play }: { play: PlayDetails }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <ActionLink
              action="neutral"
              size="compact"
              emphasis="secondary"
              href="/kronika">
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

      <Panel className="anim-rise-in paper-wash p-4 sm:p-5">
        <div className="grid gap-3.5 lg:grid-cols-[11rem_minmax(0,1fr)_10.25rem] lg:gap-5">
          <div className="space-y-3 lg:w-[11rem] lg:shrink-0">
            <h1 className="font-display line-clamp-3 text-center text-[1.1rem] leading-tight font-semibold text-[#4c3528] sm:text-[1.2rem]">
              {play.game.title}
            </h1>

            <div className="grid grid-cols-[10rem_6.75rem] items-start justify-center gap-3 sm:grid-cols-[11rem_7rem] sm:justify-center lg:grid-cols-[8.75rem] lg:justify-items-center">
              <GameCover
                title={play.game.title}
                coverUrl={play.game.coverUrl}
                size="card"
                fitParent
                className="w-[10rem] justify-self-end sm:w-[11rem] lg:w-[8.75rem] lg:justify-self-center"
              />

              <div className="justify-self-start lg:hidden">
                <PlayDetailsDateTile
                  playedAt={play.playedAt}
                  durationMinutes={play.durationMinutes}
                  meeting={play.meeting}
                  status={play.status}
                />
              </div>
            </div>
          </div>

          <div className="min-w-0 self-start">
            <div className="min-w-0 space-y-2.5 lg:space-y-3">
              <div className="min-w-0">
                <p className="text-accent text-[0.56rem] font-bold tracking-[0.18em] uppercase">
                  Karta partii
                </p>
              </div>

              <div className="grid gap-x-4 gap-y-1.5 border-t border-dashed border-[#b99d72] pt-2 text-sm text-[#4d3528] sm:grid-cols-2 sm:pt-2.5">
                <p className="min-w-0">
                  <span className="mr-2 text-[0.58rem] font-bold tracking-[0.15em] text-[#a56c42] uppercase">
                    Zapisana przez
                  </span>
                  <span className="break-words">
                    {play.createdBy.displayName}
                  </span>
                </p>

                {play.meeting ? (
                  <p className="min-w-0">
                    <span className="mr-2 text-[0.58rem] font-bold tracking-[0.15em] text-[#a56c42] uppercase">
                      Spotkanie
                    </span>
                    <Link
                      href={`/kalendarium/${play.meeting.id}`}
                      className="break-words underline decoration-[#b37a46]/40 underline-offset-4"
                    >
                      {play.meeting.title}
                    </Link>
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="hidden lg:block lg:justify-self-end">
            <PlayDetailsDateTile
              playedAt={play.playedAt}
              durationMinutes={play.durationMinutes}
              meeting={play.meeting}
              status={play.status}
            />
          </div>
        </div>
      </Panel>

      <Panel
        className="anim-rise-in paper-wash p-4 sm:p-5"
        style={{ animationDelay: "35ms" }}
      >
        <p className="text-accent text-[0.56rem] font-bold tracking-[0.18em] uppercase">
          Wyniki
        </p>
        <h2 className="font-display mt-1 text-[1.25rem] font-semibold text-[#4c3528]">
          Uczestnicy partii
        </h2>

        <div className="mt-3 space-y-2">
          {play.participants.map((participant) => {
            const badgeAsset = getChronicleParticipantBadgeAsset(
              participant,
              play.mode,
            );

            return (
            <div
              key={participant.member.id}
              className={`flex items-center justify-between gap-3 rounded-[1rem] px-3 py-2 text-sm ${
                participant.isWinner ? "bg-[#e6d3ab]" : "bg-white/72"
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                {badgeAsset ? (
                  <span
                    className={`grid shrink-0 place-items-center rounded-full bg-[#f3e6d0] shadow-[0_8px_18px_rgba(110,72,36,0.18)] ring-1 ring-[#cfaf7d]/55 ${play.mode === "cooperative" ? "size-14" : participant.placement && participant.placement >= 4 ? "size-11 md:size-16" : "size-16 md:size-8"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- local decorative asset from public/brand */}
                    <img
                      src={badgeAsset.src}
                      alt={badgeAsset.alt}
                      className={`${play.mode === "cooperative" ? "size-[3.25rem]" : participant.placement && participant.placement >= 4 ? "size-9 md:size-14" : "size-14 md:size-7"} shrink-0 object-contain`}
                    />
                  </span>
                ) : (
                  <span className="bg-brand text-cream grid size-8 shrink-0 place-items-center rounded-full text-[0.72rem] font-bold">
                    {participant.member.displayName
                      .trim()
                      .charAt(0)
                      .toLocaleUpperCase("pl-PL")}
                  </span>
                )}

                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-semibold text-[#4d3528]">
                    {participant.member.displayName}
                  </span>
                  {participant.isWinner ? (
                    <span className="inline-flex rounded-full bg-[#f2dfb8] px-2 py-0.5 text-[0.62rem] font-bold text-[#71512d]">
                      {"Zwyci\u0119zca"}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2.5 text-right">
                {participant.score !== null ? (
                  <span className="inline-flex rounded-full bg-[#ead7b6] px-2 py-0.5 text-[0.68rem] font-semibold text-[#705338]">
                    {formatPlayScore(participant.score)}
                  </span>
                ) : null}
                <span className="text-[#5d4737]">
                  {participant.placement
                    ? `${participant.placement}. miejsce`
                    : "\u2014"}
                </span>
              </div>
            </div>
            );
          })}
        </div>
      </Panel>

      {play.comment ? (
        <Panel
          className="anim-rise-in paper-wash p-4 sm:p-5"
          style={{ animationDelay: "70ms" }}
        >
          <p className="text-accent text-[0.56rem] font-bold tracking-[0.18em] uppercase">
            Notatka
          </p>
          <p className="mt-2 text-sm leading-6 text-[#5d4737]">
            {play.comment}
          </p>
        </Panel>
      ) : null}

      {play.stateNote ? (
        <Panel
          className="anim-rise-in paper-wash p-4 sm:p-5"
          style={{ animationDelay: play.comment ? "105ms" : "70ms" }}
        >
          <p className="text-accent text-[0.56rem] font-bold tracking-[0.18em] uppercase">
            Stan gry
          </p>
          <p className="mt-2 text-sm leading-6 text-[#5d4737]">
            {play.stateNote}
          </p>
        </Panel>
      ) : null}

      {play.photos.length > 0 ? (
        <Panel
          className="anim-rise-in paper-wash p-4 sm:p-5"
          style={{
            animationDelay: `${35 * (2 + (play.comment ? 1 : 0) + (play.stateNote ? 1 : 0))}ms`,
          }}
        >
          <p className="text-accent text-[0.56rem] font-bold tracking-[0.18em] uppercase">
            Galeria
          </p>
          <h2 className="font-display mt-1 text-[1.25rem] font-semibold text-[#4c3528]">
            Zdjęcia z partii
          </h2>

          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
            {play.photos.map((photo) => (
              <a
                key={photo.id}
                href={photo.url}
                target="_blank"
                rel="noreferrer noopener"
                className="paper-wash block overflow-hidden rounded-[1.05rem] p-1.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not a static asset */}
                <img
                  src={photo.url}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full rounded-[0.8rem] object-cover"
                />
              </a>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
