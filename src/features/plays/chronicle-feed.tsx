import Link from "next/link";
import { GameCover } from "@/components/ui/game-cover";
import { Panel } from "@/components/ui/panel";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import {
  formatChronicleChipScore,
  formatPlayDuration,
  getChronicleParticipantChips,
  getPlayDateBadgeParts,
  groupPlaysByMonth,
  sortPlayParticipants,
} from "./formatting";
import type { PlayListItem, PlayParticipantResult } from "./types";

const medalConfig = {
  1: {
    src: "/brand/Gamewin1.png",
    alt: "1 miejsce",
    sizeClass: "size-10 sm:size-11",
    chipClass: "bg-[#f5ead7]/95 text-[#5a3d27]",
    labelClass: "text-[0.74rem] font-bold",
  },
  2: {
    src: "/brand/Gamewin2.png",
    alt: "2 miejsce",
    sizeClass: "size-8 sm:size-9",
    chipClass: "bg-[#f1e4d1]/95 text-[#6a4d36]",
    labelClass: "text-[0.71rem] font-semibold",
  },
  3: {
    src: "/brand/Gamewin3.png",
    alt: "3 miejsce",
    sizeClass: "size-8 sm:size-9",
    chipClass: "bg-[#eee0cd]/95 text-[#6a4d36]",
    labelClass: "text-[0.71rem] font-semibold",
  },
} as const;

function DateTile({
  playedAt,
  durationMinutes,
  meetingTitle,
}: {
  playedAt: string;
  durationMinutes: number | null;
  meetingTitle: string | null;
}) {
  const date = getPlayDateBadgeParts(playedAt);

  return (
    <div className="premium-edge flex w-[6.75rem] shrink-0 flex-col items-center rounded-[1.2rem] bg-[linear-gradient(180deg,rgba(255,251,244,0.96),rgba(241,229,208,0.92))] px-2.5 py-2.5 text-center shadow-[0_10px_22px_rgba(74,49,30,0.12)] sm:w-[7rem]">
      <p className="text-[1.22rem] leading-none font-bold tracking-[0.03em] text-[#4d3528]">
        {date.day}/{date.month}
      </p>
      <p className="mt-1 text-[0.62rem] leading-none font-semibold tracking-[0.16em] text-[#9b7249] uppercase">
        {date.year}
      </p>
      <p className="mt-3 text-[0.82rem] leading-none font-semibold text-[#6b5242]">
        {date.time}
      </p>

      {durationMinutes ? (
        <span className="mt-2 inline-flex max-w-full items-center justify-center rounded-full bg-[#ead7b6] px-2 py-0.75 text-center text-[0.64rem] leading-4 font-semibold break-words text-[#705338]">
          {formatPlayDuration(durationMinutes)}
        </span>
      ) : null}

      {meetingTitle ? (
        <span className="mt-2 line-clamp-2 max-w-full text-center text-[0.65rem] leading-4 font-semibold text-[#705338]">
          {meetingTitle}
        </span>
      ) : null}
    </div>
  );
}

function ParticipantChip({
  participant,
  medalRank,
}: {
  participant: PlayParticipantResult;
  medalRank: 1 | 2 | 3 | null;
}) {
  const scoreLabel = formatChronicleChipScore(participant.score);

  if (medalRank) {
    const config = medalConfig[medalRank];

    return (
      <span
        className={`inline-flex max-w-full items-center gap-1.5 rounded-2xl pr-2.5 pl-1.5 ${config.chipClass}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local decorative asset from public/brand */}
        <img
          src={config.src}
          alt={config.alt}
          className={`${config.sizeClass} shrink-0 object-contain`}
        />
        <span className="min-w-0 py-1">
          <span
            className={`inline min-w-0 leading-4 break-words ${config.labelClass}`}
          >
            {participant.member.displayName}
          </span>
          {scoreLabel ? (
            <span className="ml-1.5 inline-flex rounded-full bg-white/45 px-1.5 py-0.5 text-[0.62rem] leading-4 font-semibold text-[#7a5a3b]">
              {scoreLabel}
            </span>
          ) : null}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-2xl bg-white/76 px-2.5 py-1 text-[0.68rem] leading-4 text-[#5f4738]">
      <span className="bg-brand text-cream grid size-5 shrink-0 place-items-center rounded-full text-[0.58rem] font-bold">
        {participant.member.displayName
          .trim()
          .charAt(0)
          .toLocaleUpperCase("pl-PL")}
      </span>
      <span className="min-w-0 py-0.5">
        <span className="inline min-w-0 font-semibold break-words">
          {participant.member.displayName}
        </span>
        {scoreLabel ? (
          <span className="ml-1.5 inline-flex rounded-full bg-[#ead7b6] px-1.5 py-0.5 text-[0.62rem] leading-4 font-medium text-[#8a6a53]">
            {scoreLabel}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function ParticipantsRow({ item }: { item: PlayListItem }) {
  const chips = getChronicleParticipantChips(item.participants);

  return (
    <div className="space-y-1.5">
      <p className="text-[0.58rem] font-bold tracking-[0.16em] text-[#a56c42] uppercase">
        Gracze
      </p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <ParticipantChip
            key={`${chip.participant.member.id}-${chip.medalRank ?? "plain"}`}
            participant={chip.participant}
            medalRank={chip.medalRank}
          />
        ))}
      </div>
    </div>
  );
}

function MobileParticipantsList({ item }: { item: PlayListItem }) {
  const participants = sortPlayParticipants(item.participants);

  return (
    <div className="space-y-1">
      {participants.map((participant, index) => {
        const placement =
          participant.placement ?? (participant.isWinner ? 1 : index + 1);
        const scoreLabel = formatChronicleChipScore(participant.score);
        const medalRank =
          placement === 1 || placement === 2 || placement === 3
            ? placement
            : null;
        const medal = medalRank ? medalConfig[medalRank] : null;

        return (
          <div
            key={participant.member.id}
            className={`flex items-center gap-1.5 rounded-2xl px-2 py-1.5 text-[0.68rem] leading-4 ${
              medal ? medal.chipClass : "bg-white/78 text-[#5f4738]"
            }`}
          >
            {medal ? (
              // eslint-disable-next-line @next/next/no-img-element -- local decorative asset from public/brand
              <img
                src={medal.src}
                alt={medal.alt}
                className="size-7 shrink-0 object-contain"
              />
            ) : (
              <span className="bg-brand text-cream grid size-5 shrink-0 place-items-center rounded-full text-[0.58rem] font-bold">
                {placement}
              </span>
            )}

            <span className="min-w-0 flex-1 truncate font-semibold text-[#4d3528]">
              {participant.member.displayName}
            </span>
            {scoreLabel ? (
              <span className="shrink-0 rounded-full bg-white/45 px-1.5 py-0.5 text-[0.6rem] font-semibold text-[#7a5a3b]">
                {scoreLabel}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function ChronicleFeed({ items }: { items: PlayListItem[] }) {
  if (items.length === 0) {
    return (
      <Panel className="anim-rise-in-fast paper-wash p-4 sm:p-5">
        <p className="text-sm text-[#5f4738]">
          Kronika jest jeszcze pusta. Zapisz pierwszą partię i zacznij budować
          historię stołu.
        </p>
      </Panel>
    );
  }

  const groups = groupPlaysByMonth(items);
  const groupsWithOffsets = groups.reduce<
    Array<{ group: (typeof groups)[number]; startIndex: number }>
  >((acc, group) => {
    const previous = acc.at(-1);
    const startIndex = previous
      ? previous.startIndex + previous.group.items.length
      : 0;
    return [...acc, { group, startIndex }];
  }, []);

  return (
    <div className="space-y-4">
      {groupsWithOffsets.map(({ group, startIndex }) => (
        <section key={group.key} className="space-y-2.5">
          <div className="flex items-center gap-3">
            <p className="text-accent text-[0.62rem] font-bold tracking-[0.18em] uppercase">
              {group.label}
            </p>
            <span className="h-px flex-1 bg-white/25" />
          </div>

          <div className="space-y-2.5">
            {group.items.map((item, index) => (
              <Link
                key={item.id}
                href={`/kronika/${item.id}`}
                className="anim-rise-in block"
                style={{
                  animationDelay: `${getEntranceStaggerDelayMs(startIndex + index)}ms`,
                }}
              >
                <Panel className="paper-wash p-3 transition hover:bg-white/82 sm:p-3.5">
                  <article className="grid grid-cols-[7.25rem_minmax(0,1fr)_6.75rem] gap-x-3 gap-y-2.5 sm:grid-cols-[7.25rem_minmax(0,1fr)] sm:gap-3.5 md:grid-cols-[8rem_minmax(0,1fr)_7rem] md:items-start lg:grid-cols-[8.5rem_minmax(0,1fr)_7.2rem]">
                    <div className="flex w-[7.25rem] min-w-0 flex-col items-center justify-start space-y-2 text-center sm:w-[7.25rem] md:w-[8rem] lg:w-[8.5rem]">
                      <p className="line-clamp-2 w-full text-center text-[0.95rem] leading-5 font-semibold text-[#4d3528]">
                        {item.game.title}
                      </p>
                      <div className="flex w-full justify-center">
                        <GameCover
                          title={item.game.title}
                          coverUrl={item.game.coverUrl}
                          size="mini"
                          fitParent
                          className="w-[7.25rem] sm:w-[6.2rem] md:w-[6.5rem] lg:w-[6.75rem]"
                        />
                      </div>
                    </div>

                    <div className="min-w-0 space-y-2 overflow-hidden sm:space-y-2.5">
                      <div className="sm:hidden">
                        <MobileParticipantsList item={item} />
                      </div>

                      <div className="hidden sm:block">
                        <ParticipantsRow item={item} />
                      </div>

                      {item.comment ? (
                        <p className="line-clamp-2 text-[0.68rem] leading-4 text-[#7a604d]">
                          {item.comment}
                        </p>
                      ) : null}
                    </div>

                    <aside className="min-w-0 self-start sm:col-span-2 md:col-span-1">
                      <div className="flex justify-end md:justify-end">
                        <DateTile
                          playedAt={item.playedAt}
                          durationMinutes={item.durationMinutes}
                          meetingTitle={item.meeting?.title ?? null}
                        />
                      </div>
                    </aside>
                  </article>
                </Panel>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
