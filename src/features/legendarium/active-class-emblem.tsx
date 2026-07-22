import Image from "next/image";
import type { ActiveClassView } from "./achievement-view-model";
import { getActiveClassBackdropGradient } from "./leaderboard-presentation";

export function ActiveClassEmblem({
  activeClass,
  sizeClass = "size-9",
  className = "",
  showAura = true,
  imageSizes = "72px",
}: {
  activeClass: ActiveClassView | null;
  sizeClass?: string;
  className?: string;
  showAura?: boolean;
  imageSizes?: string;
}) {
  if (!activeClass) return null;

  return (
    <span
      className={`relative isolate grid place-items-center ${sizeClass} ${className}`}
      title={activeClass.name}
    >
      {showAura ? (
        <span
          aria-hidden="true"
          className="absolute -inset-[14%] -z-10 rounded-full bg-[radial-gradient(circle,rgba(255,226,145,0.7)_0%,rgba(168,93,46,0.34)_52%,transparent_74%)]"
          style={{
            backgroundImage: getActiveClassBackdropGradient(activeClass.key),
          }}
        />
      ) : null}
      {activeClass.iconPath ? (
        <Image
          src={activeClass.iconPath}
          alt={`Emblemat klasy ${activeClass.name}`}
          fill
          sizes={imageSizes}
          className="object-contain drop-shadow-[0_4px_7px_rgba(25,11,5,0.5)]"
        />
      ) : (
        <span className="font-display text-sm font-bold text-[#f1c877]">✦</span>
      )}
    </span>
  );
}

export function ActiveClassProfileCard({
  activeClass,
}: {
  activeClass: ActiveClassView | null;
}) {
  if (!activeClass) {
    return (
      <div className="mt-3 rounded-xl border border-[#d4b88f]/55 bg-[#fff8e9]/72 px-3 py-3 text-sm text-[#705b49]">
        Nie wybrano aktywnej klasy. Odblokuj klasę w Legendarium i ustaw ją jako
        swoją.
      </div>
    );
  }

  return (
    <article className="wood-grain text-cream mt-3 flex items-center gap-3 rounded-[1.15rem] border border-[#d6a65b]/55 px-3 py-2.5 shadow-[0_9px_20px_rgba(56,29,14,0.2)]">
      <ActiveClassEmblem
        activeClass={activeClass}
        sizeClass="size-[5.25rem]"
        className="-my-2 shrink-0"
      />
      <div className="min-w-0">
        <span className="text-[0.62rem] font-bold tracking-[0.15em] text-[#edc27d] uppercase">
          Aktywna klasa
        </span>
        <h3 className="font-display mt-0.5 text-xl font-semibold">
          {activeClass.name}
        </h3>
        <p className="mt-0.5 text-xs leading-5 text-[#d7c4ae]">
          {activeClass.description}
        </p>
        <p className="mt-1 text-[0.68rem] leading-4 font-semibold text-[#efc77f]">
          {activeClass.playstyle}
        </p>
      </div>
    </article>
  );
}
