"use client";

import { useFormStatus } from "react-dom";
import { ActiveClassEmblem } from "@/features/legendarium/active-class-emblem";
import { setActiveClassAction } from "@/features/legendarium/active-class-actions";
import type { CharacterClassView } from "@/features/legendarium/achievement-view-model";

export function ProfileClassSelector({
  classes,
}: {
  classes: CharacterClassView[];
}) {
  const unlockedClasses = classes.filter((characterClass) => characterClass.unlocked);

  if (unlockedClasses.length === 0) {
    return (
      <p className="mt-3 rounded-xl bg-white/55 px-3 py-3 text-sm text-[#705b49]">
        Odblokuj komplet odznak, aby wybrać pierwszą klasę bohatera.
      </p>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-4 xl:gap-2">
      {unlockedClasses.map((characterClass) => (
        <ClassChoice key={characterClass.key} characterClass={characterClass} />
      ))}
    </div>
  );
}

function ClassChoice({
  characterClass,
}: {
  characterClass: CharacterClassView;
}) {
  return (
    <form action={setActiveClassAction}>
      <input type="hidden" name="classKey" value={characterClass.key} />
      <ClassChoiceButton characterClass={characterClass} />
    </form>
  );
}

function ClassChoiceButton({
  characterClass,
}: {
  characterClass: CharacterClassView;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={characterClass.isActive}
      className={`relative flex min-h-15 w-full items-center gap-2 overflow-hidden rounded-xl border px-2 py-1.5 text-left transition disabled:cursor-wait disabled:opacity-65 ${
        characterClass.isActive
          ? "border-[#f0c36f]/85 bg-[#74442d] shadow-[0_0_0_1px_rgba(240,195,111,0.35),0_8px_18px_rgba(64,26,12,0.28)]"
          : "border-[#c99e64]/42 bg-black/18 hover:border-[#e3bc76]/75 hover:bg-black/28"
      }`}
    >
      <ActiveClassEmblem
        activeClass={characterClass}
        sizeClass="size-9 shrink-0 sm:size-10"
        imageSizes="40px"
      />
      <span className="relative z-10 min-w-0">
        <span className="block truncate text-xs font-bold text-[#fff0dc] sm:text-sm">
          {characterClass.name}
        </span>
        <span className="mt-0.5 block text-[0.55rem] leading-3 font-bold tracking-[0.07em] text-[#edc77f] uppercase sm:text-[0.6rem]">
          {pending
            ? "Ustawianie…"
            : characterClass.isActive
              ? "Aktywna klasa"
              : "Ustaw jako aktywną"}
        </span>
      </span>
    </button>
  );
}
