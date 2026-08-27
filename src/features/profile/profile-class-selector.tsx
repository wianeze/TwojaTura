"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { ActiveClassEmblem } from "@/features/legendarium/active-class-emblem";
import { setActiveClassAction } from "@/features/legendarium/active-class-actions";
import type { CharacterClassView } from "@/features/legendarium/achievement-view-model";

export function ProfileClassSelector({
  classes,
}: {
  classes: CharacterClassView[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const unlockedClasses = classes.filter(
    (characterClass) => characterClass.unlocked,
  );
  const hasActiveClass = unlockedClasses.some(
    (characterClass) => characterClass.isActive,
  );

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const triggerElement = triggerRef.current;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>("[data-class-autofocus]")
        ?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      triggerElement?.focus();
    };
  }, [isOpen]);

  async function selectClass(formData: FormData) {
    await setActiveClassAction(formData);
    setIsOpen(false);
    router.refresh();
  }

  const hasUnlockedClasses = unlockedClasses.length > 0;

  return (
    <>
      <div className="flex justify-end">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(true)}
          disabled={!hasUnlockedClasses}
          aria-haspopup="dialog"
          title={
            hasUnlockedClasses
              ? undefined
              : "Nie zdobyłeś jeszcze żadnej klasy."
          }
          className="min-h-9 rounded-xl border border-[#d8aa63]/55 bg-[#4f2b20]/72 px-3 py-2 text-xs font-bold text-[#f5d797] shadow-[0_5px_14px_rgba(19,8,4,0.2)] transition hover:border-[#efc477]/85 hover:bg-[#633725] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0c36f] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {hasActiveClass ? "Zmień aktywną klasę" : "Wybierz aktywną klasę"}
        </button>
      </div>

      {isOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-100 flex items-end justify-center overflow-x-hidden bg-[#170b08]/80 p-2 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] backdrop-blur-sm sm:items-center sm:p-5"
              role="presentation"
              onClick={() => setIsOpen(false)}
            >
              <section
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="profile-class-dialog-title"
                aria-describedby="profile-class-dialog-description"
                className="cork-board-bg premium-edge anim-rise-in-fast relative isolate flex max-h-[calc(100dvh-env(safe-area-inset-bottom)-6.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[1.6rem] p-2.5 shadow-[0_24px_52px_rgba(10,4,2,0.52)] sm:max-h-[min(46rem,calc(100dvh-2.5rem))] sm:p-3"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="parchment-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.25rem]">
                  <header className="flex items-start justify-between gap-3 border-b border-[#bd966f]/35 px-4 py-3.5 sm:px-5 sm:py-4">
                    <div className="min-w-0">
                      <p className="text-accent text-[0.62rem] font-bold tracking-[0.18em] uppercase">
                        Ścieżki bohatera
                      </p>
                      <h2
                        id="profile-class-dialog-title"
                        className="font-display mt-1 text-2xl font-semibold text-[#3f2a1a] sm:text-3xl"
                      >
                        Wybierz aktywną klasę
                      </h2>
                      <p
                        id="profile-class-dialog-description"
                        className="mt-1 text-sm text-[#705846]"
                      >
                        Wybierz klasę, która będzie reprezentować Cię przy
                        Stole.
                      </p>
                    </div>

                    <button
                      type="button"
                      data-class-autofocus
                      onClick={() => setIsOpen(false)}
                      aria-label="Zamknij wybór aktywnej klasy"
                      className="grid size-9 shrink-0 place-items-center rounded-full border border-[#a76b43] bg-[#6b3828] text-lg font-bold text-[#fff4df] shadow-[0_4px_10px_rgba(60,27,13,0.2)] transition hover:bg-[#81452f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b5538]"
                    >
                      ×
                    </button>
                  </header>

                  <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
                    <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2 lg:grid-cols-3">
                      {unlockedClasses.map((characterClass) => (
                        <ClassChoice
                          key={characterClass.key}
                          characterClass={characterClass}
                          action={selectClass}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function ClassChoice({
  characterClass,
  action,
}: {
  characterClass: CharacterClassView;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action}>
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
  const progressLabel = `${characterClass.acquiredRequirements}/${characterClass.totalRequirements} odznak`;

  return (
    <button
      type="submit"
      disabled={pending || characterClass.isActive}
      aria-pressed={characterClass.isActive}
      className={`relative flex min-h-20 w-full items-center gap-2 overflow-hidden rounded-xl border px-2.5 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b5538] disabled:cursor-default ${
        characterClass.isActive
          ? "border-[#b87531]/85 bg-[#70442d] shadow-[0_0_0_1px_rgba(190,126,55,0.3),0_8px_18px_rgba(64,26,12,0.2)]"
          : "border-[#c99e64]/55 bg-[#fff8e8]/70 hover:border-[#b87531]/85 hover:bg-[#fffaf0]"
      }`}
    >
      <ActiveClassEmblem
        activeClass={characterClass}
        sizeClass="size-12 shrink-0"
        imageSizes="48px"
      />
      <span className="relative z-10 min-w-0 flex-1">
        <span
          className={`block line-clamp-2 text-sm leading-4 font-bold ${
            characterClass.isActive ? "text-[#fff0dc]" : "text-[#4e372a]"
          }`}
        >
          {characterClass.name}
        </span>
        <span
          className={`mt-1 block text-[0.6rem] leading-3 font-bold tracking-[0.06em] uppercase ${
            characterClass.isActive ? "text-[#f0ca83]" : "text-[#8b684e]"
          }`}
        >
          {pending ? "Ustawianie…" : progressLabel}
        </span>
        {characterClass.isActive ? (
          <span className="mt-1 inline-flex rounded-full bg-[#f0c36f] px-2 py-0.5 text-[0.55rem] font-black tracking-[0.08em] text-[#50301f] uppercase">
            Aktywna
          </span>
        ) : null}
      </span>
    </button>
  );
}
