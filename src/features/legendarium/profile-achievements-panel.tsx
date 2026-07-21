import Image from "next/image";
import { Panel } from "@/components/ui/panel";
import type {
  AchievementView,
  CharacterClassView,
} from "./achievement-view-model";

export function ProfileAchievementsPanel({
  achievements,
  classes,
}: {
  achievements: AchievementView[];
  classes: CharacterClassView[];
}) {
  const acquired = achievements.filter(
    (achievement) => achievement.state === "acquired",
  );
  const recent = [...acquired]
    .sort((a, b) => (b.awardedAt ?? "").localeCompare(a.awardedAt ?? ""))
    .slice(0, 3);
  const closestClasses = [...classes]
    .sort(
      (a, b) =>
        Number(b.unlocked) - Number(a.unlocked) ||
        b.acquiredRequirements - a.acquiredRequirements ||
        a.sortOrder - b.sortOrder,
    )
    .slice(0, 4);

  return (
    <Panel className="paper-wash p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-accent text-[0.62rem] font-bold tracking-[0.17em] uppercase">
            Trofea bohatera
          </p>
          <h2 className="font-display mt-1 text-2xl font-semibold">
            Odznaki i klasy
          </h2>
        </div>
        <span className="rounded-full bg-[#ead9bc] px-3 py-1.5 text-xs font-bold text-[#765537]">
          {acquired.length} zdobytych
        </span>
      </div>

      {recent.length > 0 ? (
        <div className="mt-3">
          <p className="text-[0.62rem] font-bold tracking-[0.14em] text-[#87644a] uppercase">
            Ostatnio zdobyte
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {recent.map((achievement) => (
              <article
                key={achievement.key}
                className="rounded-xl border border-[#d4b88f]/55 bg-[#fff8e9]/75 p-2 text-center"
              >
                <div className="relative mx-auto -my-1 size-16">
                  {achievement.iconPath ? (
                    <Image
                      src={achievement.iconPath}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-contain"
                    />
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-[0.68rem] leading-4 font-bold">
                  {achievement.name}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-[#d4b88f]/55 bg-[#fff8e9]/75 px-3 py-3 text-sm leading-5 text-[#705b49]">
          Jeszcze nie zdobyto odznak. Wykonuj questy, zapisuj partie i
          rozbudowuj Półkę.
        </p>
      )}

      {acquired.length > 3 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {acquired.map((achievement) => (
            <span
              key={achievement.key}
              className="rounded-full bg-[#e8d8bd] px-2 py-1 text-[0.62rem] font-semibold text-[#70543c]"
            >
              {achievement.name}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 border-t border-[#caa97c]/45 pt-3">
        <p className="text-[0.62rem] font-bold tracking-[0.14em] text-[#87644a] uppercase">
          Progres klas
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {closestClasses.map((characterClass) => (
            <article
              key={characterClass.key}
              className="flex items-center gap-2 rounded-xl bg-[#6d402d]/92 px-2.5 py-2 text-[#fff0d8]"
            >
              <div className="relative -my-1.5 size-[3.7rem] shrink-0">
                {characterClass.iconPath ? (
                  <Image
                    src={characterClass.iconPath}
                    alt=""
                    fill
                    sizes="59px"
                    className={`object-contain ${characterClass.unlocked ? "" : "grayscale-[0.65]"}`}
                  />
                ) : null}
              </div>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">
                  {characterClass.name}
                </span>
                <span className="block text-[0.62rem] text-[#dac5af]">
                  {characterClass.unlocked ? "Odblokowana" : "W drodze"}
                </span>
              </span>
              <span className="rounded-full bg-black/22 px-2 py-1 text-xs font-bold">
                {characterClass.acquiredRequirements}/
                {characterClass.totalRequirements}
              </span>
            </article>
          ))}
        </div>
      </div>
    </Panel>
  );
}
