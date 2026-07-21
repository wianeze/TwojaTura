"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type {
  AchievementRarity,
  AchievementState,
  AchievementView,
} from "./achievement-view-model";

const rarityFilters: Array<{
  value: "all" | AchievementRarity;
  label: string;
}> = [
  { value: "all", label: "Wszystkie" },
  { value: "common", label: "Common" },
  { value: "rare", label: "Rare" },
  { value: "epic", label: "Epic" },
  { value: "legendary", label: "Legendary" },
  { value: "secret", label: "Secret" },
];

const stateFilters: Array<{
  value: "all" | AchievementState;
  label: string;
}> = [
  { value: "all", label: "Wszystkie stany" },
  { value: "acquired", label: "Zdobyte" },
  { value: "locked", label: "Niezdobyte" },
  { value: "secret", label: "Sekretne" },
];

const rarityStyles: Record<AchievementRarity, string> = {
  common: "border-[#d8c8af] bg-[#efe7da] text-[#705b49]",
  rare: "border-[#75a2b4] bg-[#dbeaf0] text-[#315d70]",
  epic: "border-[#9a78b3] bg-[#eadff1] text-[#65467d]",
  legendary: "border-[#d99b48] bg-[#f3dfbc] text-[#8a541f]",
  secret: "border-[#766275] bg-[#d9cfdc] text-[#493a4d]",
};

export function AchievementCatalog({
  achievements,
}: {
  achievements: AchievementView[];
}) {
  const [rarity, setRarity] = useState<"all" | AchievementRarity>("all");
  const [state, setState] = useState<"all" | AchievementState>("all");
  const acquiredCount = achievements.filter(
    (achievement) => achievement.state === "acquired",
  ).length;
  const visible = useMemo(
    () =>
      achievements.filter(
        (achievement) =>
          (rarity === "all" || achievement.rarity === rarity) &&
          (state === "all" || achievement.state === state),
      ),
    [achievements, rarity, state],
  );

  return (
    <section className="parchment-card premium-edge mt-4 rounded-[1.55rem] p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-accent text-[0.62rem] font-bold tracking-[0.18em] uppercase">
            Kolekcja trofeów
          </p>
          <h2 className="font-display mt-1 text-2xl font-semibold">Odznaki</h2>
        </div>
        <span className="rounded-full bg-[#ead9bc] px-3 py-1.5 text-xs font-bold text-[#785536]">
          {acquiredCount}/{achievements.length} zdobytych
        </span>
      </div>

      {acquiredCount === 0 ? (
        <p className="mt-3 rounded-xl border border-[#d6b98e]/55 bg-[#fff8e9]/72 px-3 py-2 text-sm text-[#705b49]">
          Jeszcze nie zdobyto odznak. Wykonuj questy, zapisuj partie i
          rozbudowuj Półkę.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {rarityFilters.map((filter) => (
          <FilterButton
            key={filter.value}
            active={rarity === filter.value}
            onClick={() => setRarity(filter.value)}
          >
            {filter.label}
          </FilterButton>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {stateFilters.map((filter) => (
          <FilterButton
            key={filter.value}
            active={state === filter.value}
            onClick={() => setState(filter.value)}
          >
            {filter.label}
          </FilterButton>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {visible.map((achievement) => (
          <AchievementCard key={achievement.key} achievement={achievement} />
        ))}
      </div>
    </section>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[0.68rem] font-bold transition-colors ${
        active
          ? "border-[#8f5138] bg-[#6f382a] text-[#fff2dc]"
          : "border-[#cfb591] bg-[#fff9ec]/75 text-[#765b45] hover:bg-[#f4e5ca]"
      }`}
    >
      {children}
    </button>
  );
}

function AchievementCard({ achievement }: { achievement: AchievementView }) {
  const acquired = achievement.state === "acquired";
  const secret = achievement.state === "secret";

  return (
    <article
      className={`relative min-h-44 rounded-[1.15rem] border p-3 pb-7 transition-[filter,opacity,transform] ${
        rarityStyles[achievement.rarity]
      } ${acquired ? "shadow-[0_10px_22px_rgba(73,42,22,0.18)]" : "opacity-72 grayscale-[0.35]"}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="relative grid size-[4.65rem] shrink-0 place-items-center rounded-full bg-black/8">
          {achievement.iconPath && !secret ? (
            <Image
              src={achievement.iconPath}
              alt=""
              fill
              sizes="75px"
              className="object-contain p-0.5"
            />
          ) : (
            <span className="font-display text-2xl font-bold">?</span>
          )}
        </div>
        <div className="min-w-0">
          <span className="block text-[0.65rem] font-bold tracking-[0.13em] uppercase">
            {achievement.rarity}
          </span>
          <h3 className="font-display mt-0.5 text-base leading-5 font-semibold">
            {achievement.name}
          </h3>
          {!secret ? (
            <span className="mt-1 block text-[0.8rem] font-bold">
              {achievement.points} pkt prestiżu
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-[0.76rem] leading-[1.15rem]">
        {achievement.description}
      </p>
      <p className="mt-1.5 border-t border-current/15 pt-1.5 text-[0.7rem] leading-[1.05rem] opacity-85">
        {achievement.conditionText}
      </p>
      <span className="absolute right-3 bottom-2 text-right text-[0.68rem] font-bold uppercase">
        {acquired
          ? `Zdobyta ${formatAwardDate(achievement.awardedAt)}`
          : secret
            ? "Sekretna"
            : "Niezdobyta"}
      </span>
    </article>
  );
}

function formatAwardDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
