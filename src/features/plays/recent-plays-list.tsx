import Link from "next/link";
import { GameCover } from "@/components/ui/game-cover";
import { Panel } from "@/components/ui/panel";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import {
  formatPlayScore,
  formatPlayShortDate,
  getWinnerSummary,
} from "./formatting";
import type { PlayListItem, RecentPlaySummary } from "./types";

export function GameRecentPlaysList({ items }: { items: PlayListItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-muted text-sm leading-5.5">
        Ta gra nie ma jeszcze zapisanej historii partii.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <Link
          key={item.id}
          href={`/kronika/${item.id}`}
          style={{ animationDelay: `${getEntranceStaggerDelayMs(index)}ms` }}
          className="anim-rise-in-fast block"
        >
          <div className="rounded-[1.1rem] bg-white/70 px-3 py-2 transition hover:bg-white/85">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#4d3528]">
                {formatPlayShortDate(item.playedAt)}
              </span>
              <span className="text-[#6a4d36]">
                {getWinnerSummary(item.winners)}
              </span>
            </div>
            <p className="text-muted mt-1 text-xs">
              {item.participants
                .map((participant) => participant.member.displayName)
                .join(", ")}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function RecentMemberPlaysPanel({
  title,
  items,
  emptyMessage,
  entranceIndex = 0,
}: {
  title: string;
  items: RecentPlaySummary[];
  emptyMessage: string;
  entranceIndex?: number;
}) {
  return (
    <Panel
      style={{ animationDelay: `${getEntranceStaggerDelayMs(entranceIndex)}ms` }}
      className="anim-rise-in-fast paper-wash p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-accent text-[0.56rem] font-bold tracking-[0.18em] uppercase">
            Kronika
          </p>
          <h2 className="font-display mt-1 text-[1.35rem] font-semibold text-[#4c3528]">
            {title}
          </h2>
        </div>
        <Link
          href="/kronika"
          className="text-accent text-xs font-bold underline decoration-[#b37a46]/40 underline-offset-4"
        >
          Pełna Kronika
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-muted mt-3 text-sm leading-5.5">{emptyMessage}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item, index) => (
            <Link
              key={item.id}
              href={`/kronika/${item.id}`}
              style={{
                animationDelay: `${getEntranceStaggerDelayMs(index)}ms`,
              }}
              className="anim-rise-in-fast block"
            >
              <div className="rounded-[1.1rem] bg-white/70 px-3 py-2 transition hover:bg-white/85">
                <div className="grid gap-2 sm:grid-cols-[3.6rem_minmax(0,1fr)] sm:items-center">
                  <GameCover
                    title={item.game.title}
                    coverUrl={item.game.coverUrl}
                    size="mini"
                    className="w-14"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <p className="font-semibold text-[#4d3528]">
                        {item.game.title}
                      </p>
                      <span className="text-[#6a4d36]">
                        {formatPlayShortDate(item.playedAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#5f4738]">
                      {item.isWinner ? "Zwycięstwo" : "Udział"} ·{" "}
                      {item.placement
                        ? `${item.placement}. miejsce`
                        : "bez miejsca"}
                      {item.score !== null
                        ? ` · ${formatPlayScore(item.score)}`
                        : ""}
                    </p>
                    <p className="text-muted mt-1 text-xs">
                      Zwycięzca: {getWinnerSummary(item.winners)}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}
