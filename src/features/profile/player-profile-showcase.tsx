import Link from "next/link";
import type { ReactNode } from "react";
import { GameCover } from "@/components/ui/game-cover";
import { Panel } from "@/components/ui/panel";
import { PlayerPortraitFrame } from "@/components/ui/player-portrait-frame";
import type { CurrentMember } from "@/features/auth/types";
import { ActiveClassEmblem } from "@/features/legendarium/active-class-emblem";
import type {
  AchievementRarity,
  AchievementView,
  ActiveClassView,
  CharacterClassView,
} from "@/features/legendarium/achievement-view-model";
import { MiniAchievementBadge } from "@/features/legendarium/mini-achievement-badge";
import {
  getActiveClassBackdropGradient,
  getActiveClassTexture,
} from "@/features/legendarium/leaderboard-presentation";
import { formatPlayShortDate } from "@/features/plays/formatting";
import type { PlayerProfileData } from "./queries";
import {
  formatProfileDuration,
  selectTopProfileClasses,
  type ProfileGameHighlight,
  type ProfileRecord,
} from "./profile-statistics";
import { ProfileClassSelector } from "./profile-class-selector";
import { PortraitFrameStore } from "./portrait-frame-store";
import type { PortraitFrameStoreData } from "./portrait-frames";

const rarityLabels: Record<AchievementRarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  secret: "Secret",
};

const rarityClasses: Record<AchievementRarity, string> = {
  common: "bg-white/70 text-[#66584d]",
  rare: "bg-[#dcebdc] text-[#376344]",
  epic: "bg-[#eadcf0] text-[#704981]",
  legendary: "bg-[#f4dfad] text-[#8a561a]",
  secret: "bg-[#382a3d] text-[#eadcf2]",
};

const trophyDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Warsaw",
});

function getClassProgress(characterClass: CharacterClassView | null) {
  if (!characterClass || characterClass.totalRequirements === 0) return 0;
  return Math.round(
    (characterClass.acquiredRequirements / characterClass.totalRequirements) *
      100,
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#edc980]/20 bg-black/18 px-3 py-2">
      <p className="text-[0.58rem] font-bold tracking-[0.13em] text-[#d9b77c] uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold text-[#fff0dc] sm:text-base">
        {value}
      </p>
    </div>
  );
}

function HeroClassEmblem({
  activeClass,
}: {
  activeClass: ActiveClassView | null;
}) {
  const gradient = getActiveClassBackdropGradient(activeClass?.key ?? null);

  return (
    <span
      className="relative grid size-[3.75rem] shrink-0 place-items-center overflow-hidden rounded-[1.15rem] border border-[#f0ca83]/25 bg-black/15"
      style={{ backgroundImage: gradient }}
    >
      <ActiveClassEmblem
        activeClass={activeClass}
        sizeClass="relative z-10 size-12"
        imageSizes="48px"
        showAura={false}
      />
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="text-accent text-[0.58rem] font-bold tracking-[0.17em] uppercase">
          {eyebrow}
        </p>
        <h2 className="font-display mt-1 text-xl font-semibold text-[#4c3528] sm:text-2xl">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function formatHighlightValue(highlight: ProfileGameHighlight) {
  if (highlight.kind === "most-played") {
    return `${highlight.value} ${highlight.value === 1 ? "partia" : "partii"}`;
  }
  if (highlight.kind === "highest-rated") return `★ ${highlight.value}/10`;
  return formatProfileDuration(highlight.value) ?? "—";
}

function highlightTitle(kind: ProfileGameHighlight["kind"]) {
  if (kind === "most-played") return "Najczęściej grana";
  if (kind === "highest-rated") return "Najwyżej oceniana";
  return "Najwięcej czasu";
}

function recordContent(record: ProfileRecord) {
  if (record.kind === "longest-play") {
    return {
      title: "Najdłuższa partia",
      value: `${record.game?.title ?? "Gra"} · ${formatProfileDuration(record.value)}`,
    };
  }
  if (record.kind === "most-played") {
    return {
      title: "Najczęściej grana gra",
      value: `${record.game?.title ?? "Gra"} · ${record.value} partii`,
    };
  }
  if (record.kind === "win-streak") {
    return {
      title: "Najdłuższa seria zwycięstw",
      value: String(record.value),
    };
  }
  return {
    title: "Najwięcej grania w miesiącu",
    value: `${record.label ?? "Miesiąc"} · ${formatProfileDuration(record.value)}`,
  };
}

export function PlayerProfileShowcase({
  member,
  profile,
  achievements,
  classes,
  activeClass,
  portraitFrameData,
}: {
  member: CurrentMember;
  profile: PlayerProfileData;
  achievements: AchievementView[];
  classes: CharacterClassView[];
  activeClass: ActiveClassView | null;
  portraitFrameData: PortraitFrameStoreData;
}) {
  const topClasses = selectTopProfileClasses(classes);
  const heroClass =
    (activeClass
      ? (classes.find((item) => item.key === activeClass.key) ?? null)
      : null) ??
    topClasses[0] ??
    null;
  const heroActiveClass = activeClass ?? heroClass;
  const heroClassTexture = heroClass?.unlocked
    ? getActiveClassTexture(heroActiveClass?.key ?? null)
    : null;
  const classProgress = getClassProgress(heroClass);
  const recentAchievements = achievements
    .filter((achievement) => achievement.state === "acquired")
    .sort((left, right) =>
      (right.awardedAt ?? "").localeCompare(left.awardedAt ?? ""),
    )
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <Panel
        className="wood-grain anim-rise-in-fast relative isolate overflow-hidden border-[#d3a45c]/60 p-4 text-[#fff0dc] sm:p-5 lg:p-6"
        style={{
          backgroundColor: "#26150f",
          ...(heroClassTexture ? { backgroundImage: "none" } : {}),
        }}
      >
        {heroClassTexture ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-50"
            style={{ backgroundImage: `url(\"${heroClassTexture}\")` }}
          />
        ) : null}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(23,11,7,0.34),rgba(23,11,7,0.18)_55%,rgba(23,11,7,0.4))]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_85%_10%,rgba(236,169,69,0.2),transparent_38%)]"
        />
        <div className="grid grid-cols-[35%_minmax(0,1fr)] gap-3 sm:gap-5 lg:grid-cols-[minmax(13.75rem,17.5rem)_minmax(0,1fr)] lg:items-stretch">
          <div className="flex justify-center lg:justify-start">
            <PlayerPortraitFrame
              avatarUrl={member.avatarUrl}
              name={member.displayName}
              frameType={portraitFrameData.activeFrameKey}
              size="large"
              className="w-full max-w-[9rem] sm:max-w-[11rem] lg:w-[clamp(13.75rem,16vw,16.5rem)] lg:max-w-[16.5rem]"
            />
          </div>

          <div className="flex min-w-0 flex-col justify-center gap-3 sm:gap-4 lg:py-2">
            <div>
              <p className="text-[0.62rem] font-bold tracking-[0.2em] text-[#e5ba70] uppercase">
                Karta Gracza
              </p>
              <h1 className="font-display mt-1 truncate text-3xl font-semibold sm:text-4xl">
                {member.displayName}
              </h1>
              {heroClass ? (
                <div className="mt-2 flex min-w-0 items-center gap-2">
                  <HeroClassEmblem activeClass={heroActiveClass} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#f0ca83]">
                      {heroClass.name}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/35">
                        <span
                          className="block h-full rounded-full bg-[linear-gradient(90deg,#c77732,#f0c36f)]"
                          style={{ width: `${classProgress}%` }}
                        />
                      </span>
                      <span className="text-[0.68rem] font-bold text-[#e8c58b]">
                        {classProgress}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-[#d8c3aa]">
                  Pierwsza klasa bohatera dopiero czeka na odblokowanie.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <HeroStat label="Renoma" value={`${profile.totalPoints} pkt`} />
              <HeroStat label="Partie" value={String(profile.playsCount)} />
              <HeroStat label="Zwycięstwa" value={String(profile.wins)} />
              <HeroStat
                label="Przy stole"
                value={formatProfileDuration(profile.totalMinutes) ?? "—"}
              />
            </div>
          </div>
        </div>
      </Panel>

      <PortraitFrameStore
        data={portraitFrameData}
        avatarUrl={member.avatarUrl}
        displayName={member.displayName}
      />

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <Panel className="paper-wash anim-rise-in-fast p-4 sm:p-5 xl:col-span-6">
          <SectionHeading
            eyebrow="Historia bohatera"
            title="Statystyki gracza"
          />
          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2 xl:gap-1.5">
            {[
              ["Partie", String(profile.playsCount)],
              ["Wygrane", String(profile.wins)],
              ["Porażki", String(profile.losses)],
              [
                "Łączny czas",
                formatProfileDuration(profile.totalMinutes) ?? "—",
              ],
              [
                "Średnia partia",
                formatProfileDuration(profile.averageMinutes) ?? "—",
              ],
              [
                "Średnia Twoich ocen",
                profile.averageRating === null
                  ? "—"
                  : `★ ${profile.averageRating.toFixed(1)}`,
              ],
              ["Różne gry", String(profile.uniqueGames)],
              ["Współgracze", String(profile.uniqueCoPlayers)],
              ["Skuteczność", `${profile.winRate ?? 0}%`],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex min-h-[3.8rem] flex-col justify-center rounded-xl bg-white/62 px-2 py-1.5 sm:min-h-[4.4rem] sm:px-3 sm:py-2 xl:min-h-[3.25rem] xl:py-1"
              >
                <p className="text-[0.5rem] leading-3 font-bold tracking-[0.08em] text-[#9a6846] uppercase sm:text-[0.6rem] sm:leading-normal sm:tracking-[0.12em]">
                  {label}
                </p>
                <p className="mt-0.5 text-xs font-bold text-[#4e372a] sm:text-base">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="paper-wash anim-rise-in-fast p-4 sm:p-5 xl:col-span-6">
          <SectionHeading
            eyebrow="Ścieżki bohatera"
            title="Wybierz aktywną klasę"
            action={
              <Link
                href="/legendarium"
                className="text-accent text-xs font-bold underline underline-offset-4"
              >
                Legendarium
              </Link>
            }
          />
          <ProfileClassSelector classes={classes} />
        </Panel>

        <Panel className="paper-wash anim-rise-in-fast p-4 sm:p-5 xl:col-span-5">
          <SectionHeading
            eyebrow="Łupy i legendy"
            title="Ostatnie trofea"
            action={
              <Link
                href="/legendarium"
                className="text-accent text-xs font-bold underline underline-offset-4"
              >
                Zobacz Legendarium
              </Link>
            }
          />
          {recentAchievements.length === 0 ? (
            <p className="mt-3 rounded-xl bg-white/55 px-3 py-3 text-sm text-[#705b49]">
              Pierwsze trofeum wciąż czeka na zdobycie.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-2 items-start gap-1.5 sm:gap-2">
              {recentAchievements.map((achievement) => (
                <article
                  key={achievement.key}
                  className="flex min-w-0 items-center gap-1.5 rounded-xl border border-[#d6ba91]/45 bg-white/55 px-2 py-1.5 sm:gap-2 sm:px-2.5 sm:py-2"
                >
                  <MiniAchievementBadge
                    iconPath={achievement.iconPath}
                    name={achievement.name}
                    rarity={achievement.rarity}
                    sizeClass="size-9 shrink-0 sm:size-10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs leading-4 font-bold text-[#4e372a] sm:text-sm">
                      {achievement.name}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[0.54rem] sm:text-[0.62rem]">
                      <span
                        className={`rounded-full px-2 py-0.5 font-bold ${rarityClasses[achievement.rarity]}`}
                      >
                        {rarityLabels[achievement.rarity]}
                      </span>
                      {achievement.awardedAt ? (
                        <span className="text-[#806b58]">
                          {trophyDateFormatter.format(
                            new Date(achievement.awardedAt),
                          )}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="paper-wash anim-rise-in-fast p-4 sm:p-5 xl:col-span-7">
          <SectionHeading
            eyebrow="Półka bohatera"
            title="Moje gry przy stole"
          />
          {profile.gameHighlights.length === 0 ? (
            <p className="mt-3 rounded-xl bg-white/55 px-3 py-3 text-sm text-[#705b49]">
              Zapisz pierwszą partię, aby odkryć swoje planszówkowe
              specjalizacje.
            </p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {profile.gameHighlights.map((highlight) => (
                <Link
                  key={highlight.kind}
                  href={`/gry/${highlight.game.id}`}
                  className="flex min-w-0 items-center gap-2 rounded-xl border border-[#d6ba91]/45 bg-white/58 p-2 transition hover:bg-white/78"
                >
                  <GameCover
                    title={highlight.game.title}
                    coverUrl={highlight.game.coverUrl}
                    size="micro"
                  />
                  <span className="min-w-0">
                    <span className="block text-[0.56rem] font-bold tracking-[0.09em] text-[#9a6846] uppercase">
                      {highlightTitle(highlight.kind)}
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-bold text-[#4e372a]">
                      {highlight.game.title}
                    </span>
                    <span className="block text-xs text-[#80624a]">
                      {formatHighlightValue(highlight)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="paper-wash anim-rise-in-fast p-4 sm:p-5 xl:col-span-8">
          <SectionHeading
            eyebrow="Kronika"
            title="Ostatnio przy stole"
            action={
              <Link
                href="/kronika"
                className="text-accent text-xs font-bold underline underline-offset-4"
              >
                Pełna Kronika
              </Link>
            }
          />
          {profile.recentPlays.length === 0 ? (
            <p className="mt-3 rounded-xl bg-white/55 px-3 py-3 text-sm text-[#705b49]">
              Nie masz jeszcze zapisanych partii w Kronice.
            </p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {profile.recentPlays.map((play) => (
                <Link
                  key={play.id}
                  href={`/kronika/${play.id}`}
                  className="flex min-w-0 items-center gap-2 rounded-xl border border-[#d6ba91]/45 bg-white/58 p-2 transition hover:bg-white/78"
                >
                  <GameCover
                    title={play.game.title}
                    coverUrl={play.game.coverUrl}
                    size="micro"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[#4e372a]">
                      {play.game.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#80624a]">
                      {formatPlayShortDate(play.playedAt)}
                      {play.durationMinutes
                        ? ` · ${formatProfileDuration(play.durationMinutes)}`
                        : ""}
                    </span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-[0.62rem] font-black ${
                      play.result === "win"
                        ? "bg-[#dbe8d7] text-[#35603b]"
                        : play.result === "loss"
                          ? "bg-[#ecd7d2] text-[#8a3e35]"
                          : "bg-[#e7dcc9] text-[#6d5846]"
                    }`}
                  >
                    {play.result === "win"
                      ? "WIN"
                      : play.result === "loss"
                        ? "LOST"
                        : "UDZIAŁ"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="paper-wash anim-rise-in-fast p-4 sm:p-5 xl:col-span-4">
          <SectionHeading eyebrow="Najlepsze historie" title="Rekordy" />
          {profile.records.length === 0 ? (
            <p className="mt-3 rounded-xl bg-white/55 px-3 py-3 text-sm text-[#705b49]">
              Rekordy pojawią się wraz z kolejnymi wpisami w Kronice.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {profile.records.map((record) => {
                const content = recordContent(record);
                return (
                  <div
                    key={record.kind}
                    className="rounded-xl border border-[#d6ba91]/45 bg-white/58 px-3 py-2"
                  >
                    <p className="text-[0.58rem] font-bold tracking-[0.1em] text-[#9a6846] uppercase">
                      {content.title}
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-[#4e372a]">
                      {content.value}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
