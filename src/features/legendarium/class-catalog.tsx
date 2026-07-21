import Image from "next/image";
import type { CharacterClassView } from "./achievement-view-model";

export function ClassCatalog({ classes }: { classes: CharacterClassView[] }) {
  return (
    <section className="wood-grain premium-edge text-cream mt-4 rounded-[1.55rem] p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[0.62rem] font-bold tracking-[0.18em] text-[#e8bd79] uppercase">
            Ścieżki bohaterów
          </p>
          <h2 className="font-display mt-1 text-2xl font-semibold">
            Klasy postaci
          </h2>
        </div>
        <p className="max-w-md text-xs leading-5 text-[#d2c0aa]">
          Klasy odblokowują się automatycznie po zdobyciu kompletu wymaganych
          odznak.
        </p>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {classes.map((characterClass) => (
          <article
            key={characterClass.key}
            className={`relative overflow-hidden rounded-[1.15rem] border p-3 ${
              characterClass.unlocked
                ? "border-[#e2b361] bg-[#6f3f28]/88 shadow-[0_10px_24px_rgba(12,5,2,0.3)]"
                : "border-white/16 bg-black/20 opacity-78"
            }`}
          >
            <div className="flex gap-3">
              <div className="relative size-17 shrink-0">
                {characterClass.iconPath ? (
                  <Image
                    src={characterClass.iconPath}
                    alt=""
                    fill
                    sizes="68px"
                    className={`object-contain ${characterClass.unlocked ? "" : "grayscale-[0.65]"}`}
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base leading-5 font-semibold">
                    {characterClass.name}
                  </h3>
                  <span className="shrink-0 rounded-full bg-black/24 px-2 py-1 text-[0.62rem] font-bold text-[#ffe2ad]">
                    {characterClass.acquiredRequirements}/
                    {characterClass.totalRequirements}
                  </span>
                </div>
                <p className="mt-1 text-[0.68rem] leading-4 text-[#d6c2aa]">
                  {characterClass.playstyle}
                </p>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              {characterClass.requirements.map((requirement) => (
                <span
                  key={requirement.key}
                  className={`rounded-full px-2 py-1 text-[0.58rem] font-semibold ${
                    requirement.state === "acquired"
                      ? "bg-[#51714a] text-[#f0f4d9]"
                      : requirement.state === "hidden"
                        ? "bg-[#584958] text-[#e5d9e8]"
                        : "bg-white/10 text-[#cdbda9]"
                  }`}
                >
                  {requirement.name}
                </span>
              ))}
            </div>
            <span className="mt-2 block text-[0.6rem] font-bold tracking-[0.12em] text-[#e8bd79] uppercase">
              {characterClass.unlocked ? "Odblokowana" : "Zablokowana"}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
