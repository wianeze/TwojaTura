import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { ChronicleEntryCard } from "./chronicle-entry-card";
import { groupPlaysByMonth } from "./formatting";
import type { PlayListItem } from "./types";

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
    <div className="chronicle-feed space-y-4">
      {groupsWithOffsets.map(({ group, startIndex }) => (
        /* chronicle-column: ta sama szerokość co karty, więc nagłówek miesiąca
           trzyma się kolumny wpisów zamiast rozciągać się na całą stronę. */
        <section key={group.key} className="chronicle-column space-y-2.5">
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
                className="chronicle-page-shell anim-rise-in block rounded-[1.75rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e3ae67]"
                style={{
                  animationDelay: `${getEntranceStaggerDelayMs(startIndex + index)}ms`,
                }}
              >
                <ChronicleEntryCard item={item} />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
