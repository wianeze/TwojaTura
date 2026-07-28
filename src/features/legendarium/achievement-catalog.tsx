"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
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

/**
 * Background for ACQUIRED cards only — locked/secret cards keep the flat
 * rarityStyles above untouched. Gradient direction and stops per rarity
 * come from the approved Legendarium badge-background proposal.
 */
const acquiredRarityStyles: Record<AchievementRarity, string> = {
  common:
    "border-[#c9b48c] bg-[linear-gradient(140deg,#f0e8d8_0%,#d9c6a0_100%)] text-[#5f4a34]",
  rare: "border-[#5f93a8] bg-[linear-gradient(140deg,#eaf4f8_0%,#a9cddd_100%)] text-[#24495a]",
  epic: "border-[#7d4f9b] bg-[linear-gradient(140deg,#f2e6f7_0%,#b98ed6_100%)] text-[#4a2c62]",
  legendary:
    "border-[#ffdf8c] bg-[linear-gradient(140deg,#8a4a1a_0%,#f0b64a_55%,#ffe9ad_100%)] text-[#3d2409]",
  secret: rarityStyles.secret,
};

/** Glow behind the icon for acquired rare/epic/legendary — common keeps the plain backdrop. */
const acquiredIconGlow: Partial<Record<AchievementRarity, string>> = {
  rare: "bg-[radial-gradient(circle,rgba(173,224,255,0.85)_0%,rgba(95,147,168,0.35)_65%,transparent_78%)]",
  epic: "bg-[radial-gradient(circle,rgba(224,182,255,0.9)_0%,rgba(125,79,155,0.4)_65%,transparent_78%)]",
  legendary:
    "bg-[radial-gradient(circle,rgba(255,244,210,0.95)_0%,rgba(235,160,50,0.5)_60%,transparent_78%)] shadow-[0_0_22px_rgba(255,210,120,0.55)]",
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
        {visible.map((achievement, index) => (
          <AchievementCard
            key={achievement.key}
            achievement={achievement}
            index={index}
          />
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

function AchievementCard({
  achievement,
  index,
}: {
  achievement: AchievementView;
  index: number;
}) {
  const acquired = achievement.state === "acquired";
  const secret = achievement.state === "secret";
  const progress = achievement.progress;
  // Every acquired badge gets the one-time hover/focus sheen (previously
  // epic/legendary only) — locked/secret cards never show it.
  const showSheen = acquired;
  const isLegendaryAcquired = acquired && achievement.rarity === "legendary";
  const iconGlowClass = acquired
    ? (acquiredIconGlow[achievement.rarity] ?? "bg-black/8")
    : "bg-black/8";

  return (
    <article
      tabIndex={showSheen ? 0 : undefined}
      style={{ animationDelay: `${getEntranceStaggerDelayMs(index)}ms` }}
      className={`anim-rise-in-fast relative min-h-44 rounded-[1.15rem] border p-3 pb-10 transition-[filter,opacity,transform] ${
        acquired ? "overflow-hidden" : ""
      } ${
        acquired
          ? acquiredRarityStyles[achievement.rarity]
          : rarityStyles[achievement.rarity]
      } ${acquired ? "shadow-[0_10px_22px_rgba(73,42,22,0.18)]" : "opacity-55 grayscale-[0.75]"} ${
        showSheen ? "rarity-sheen" : ""
      }`}
    >
      {isLegendaryAcquired ? (
        <span
          aria-hidden="true"
          // Origin sits exactly behind the icon (card padding + half the
          // icon's own size), radius sized to comfortably clear the
          // farthest card corner so the rays reach every edge.
          className="pointer-events-none absolute top-[3.075rem] left-[3.075rem] -z-10 size-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[repeating-conic-gradient(from_0deg,rgba(255,235,180,0.32)_0deg_6deg,transparent_6deg_20deg)] opacity-70"
        />
      ) : null}
      {/* Desktop/tablet (sm:+) — pristine header row, unchanged from before. */}
      <div className="hidden items-start gap-2.5 sm:flex">
        <div
          className={`relative grid size-[4.65rem] shrink-0 place-items-center rounded-full ${iconGlowClass}`}
        >
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
        <div className="min-w-0 pr-10">
          <span className="block text-[0.65rem] font-bold tracking-[0.13em] uppercase">
            {achievement.rarity}
          </span>
          <h3 className="font-display mt-0.5 text-base leading-5 font-semibold">
            {achievement.name}
          </h3>
          {!secret ? (
            <span className="mt-1 block text-[0.8rem] font-bold">
              {achievement.points} pkt
            </span>
          ) : null}
        </div>
      </div>
      {/*
       * Mobile-only (<sm) — top row is icon-only (left) + the fixed
       * rarity/progress/points column (right, shrink-0), pushed to
       * opposite ends with justify-between. The name used to live under
       * the icon in a ~51px-wide column, which forced it down to 11px
       * and still broke long words mid-syllable ("Zwołanie" split as
       * "Zwoła"/"nie"); it's moved below instead, as its own line right
       * above the (already full-card-width) description, where it gets
       * the whole card's content width instead of sharing a column with
       * the icon. size-[3.25rem] on the icon (vs the sm:+ block's
       * size-[4.65rem]) is unchanged from before — kept only because a
       * 128px 2-col mobile card has ~104px of content width and the
       * rarity/progress/points column still needs its own ~48px of
       * that regardless of where the name lives now.
       */}
      <div className="flex items-start justify-between gap-2 sm:hidden">
        <div
          className={`relative grid size-[3.25rem] shrink-0 place-items-center rounded-full ${iconGlowClass}`}
        >
          {achievement.iconPath && !secret ? (
            <Image
              src={achievement.iconPath}
              alt=""
              fill
              sizes="52px"
              className="object-contain p-0.5"
            />
          ) : (
            <span className="font-display text-2xl font-bold">?</span>
          )}
        </div>
        <div className="flex w-12 shrink-0 flex-col items-center gap-0.5 text-center">
          <span className="w-full truncate text-[8px] font-bold tracking-normal uppercase">
            {achievement.rarity}
          </span>
          {progress && !secret && !achievement.isManual ? (
            <span className="rounded-full border border-current/20 bg-white/35 px-1 py-0.5 text-[9px] font-bold tabular-nums">
              {progress.current}/{progress.target}
            </span>
          ) : null}
          {!secret ? (
            <span className="text-[10px] font-bold">
              {achievement.points} pkt
            </span>
          ) : null}
        </div>
      </div>
      {/* Mobile-only name, full card width — see comment above. */}
      <h3 className="font-display mt-2 line-clamp-2 text-[13px] leading-[1.2] font-semibold break-words sm:hidden">
        {achievement.name}
      </h3>
      <p className="mt-1 text-[0.76rem] leading-[1.15rem] sm:mt-2">
        {achievement.description}
      </p>
      {!secret ? (
        <>
          <p className="mt-1.5 border-t border-current/15 pt-1.5 text-[0.7rem] leading-[1.05rem] opacity-85">
            {achievement.conditionText}
          </p>
        </>
      ) : null}
      {progress && !secret && !achievement.isManual ? (
        <span className="absolute top-3 right-3 hidden rounded-full border border-current/20 bg-white/35 px-1.5 py-0.5 text-[0.68rem] font-bold tabular-nums sm:block">
          {progress.current}/{progress.target}
        </span>
      ) : null}
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
