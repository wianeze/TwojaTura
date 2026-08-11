"use client";

import Image from "next/image";
import { useState } from "react";
import {
  formatPointAction,
  formatPointEventDate,
  formatPoints,
} from "./formatting";
import type { LegendariumPointEvent } from "./queries";

const collapsedEventCount = 5;

const eventIconAssets: Record<string, string> = {
  shelf_first_game: "/brand/Exclamation-common.png",
  shelf_5_games: "/brand/Exclamation-common.png",
  shelf_10_games: "/brand/Exclamation-common.png",
  shelf_15_games: "/brand/Exclamation-common.png",
  meeting_hosted: "/brand/Exclamation-legendary.png",
  meeting_rsvp: "/brand/Exclamation-legendary.png",
  meeting_vote: "/brand/Exclamation-magic.png",
  rating_created: "/brand/Exclamation-uncommon.png",
  play_participated: "/brand/Exclamation-epic.png",
  admin_adjustment: "/brand/Exclamation-magic.png",
  // Typy sprzed Economy V2 — nie powstają już nowe zdarzenia, ale historyczne
  // pozycje w Kronice Renomy nadal potrzebują ikony.
  meeting_created: "/brand/Exclamation-legendary.png",
  play_logged: "/brand/Exclamation-epic.png",
};

export function RecentLootList({
  events,
}: {
  events: LegendariumPointEvent[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMoreEvents = events.length > collapsedEventCount;
  const visibleEvents = isExpanded
    ? events
    : events.slice(0, collapsedEventCount);

  return (
    <div className="mt-3 flex min-w-0 flex-1 flex-col">
      <div id="recent-loot-list" className="space-y-2">
        {visibleEvents.map((event) => (
          <LootEvent key={event.id} event={event} />
        ))}
      </div>

      {hasMoreEvents ? (
        <button
          type="button"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          aria-expanded={isExpanded}
          aria-controls="recent-loot-list"
          className="mt-3 min-h-10 self-center rounded-full border border-[#efcf9f]/65 bg-[#351b12]/78 px-4 py-2 text-sm font-bold text-[#ffe6b9] shadow-[0_5px_12px_rgba(12,5,2,0.28)] transition-colors hover:bg-[#573023] focus-visible:ring-2 focus-visible:ring-[#efbd68] focus-visible:outline-none xl:mt-auto"
        >
          {isExpanded ? "Zwiń" : "Rozwiń"}
        </button>
      ) : null}
    </div>
  );
}

function LootEvent({ event }: { event: LegendariumPointEvent }) {
  return (
    <article className="relative flex min-h-16 items-center gap-3 rounded-xl bg-black/18 px-3 py-2.5 shadow-inner">
      <Image
        src={
          eventIconAssets[event.actionType] ?? "/brand/Exclamation-magic.png"
        }
        alt=""
        width={42}
        height={58}
        className="h-11 w-auto shrink-0 object-contain drop-shadow-[0_5px_8px_rgba(10,4,2,0.5)]"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">
          {formatPointAction(event.actionType)}
        </span>
        <span className="block truncate text-[0.68rem] text-[#c9b8a5]">
          {event.description
            ? `${event.description} · ${formatPointEventDate(event.createdAt)}`
            : formatPointEventDate(event.createdAt)}
        </span>
      </span>
      <span className="shrink-0 text-sm font-bold text-[#efbd68]">
        {formatPoints(event.points)}
      </span>
    </article>
  );
}
