"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PATCH_NOTES } from "./patch-notes";

export function PatchNotesDialog() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-8 w-full items-center justify-between gap-2 pr-3 text-left text-sm font-bold text-[#4c3528] transition hover:text-[#9b5538]"
      >
        Patch notes
        <span aria-hidden="true" className="text-accent text-sm leading-none">
          ✦
        </span>
      </button>

      {isOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-100 flex items-end justify-center overflow-x-hidden bg-[#170b08]/78 p-2 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] backdrop-blur-sm sm:items-center sm:p-5"
              role="presentation"
              onClick={() => setIsOpen(false)}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="patch-notes-title"
                className="cork-board-bg premium-edge anim-rise-in-fast relative isolate flex max-h-[calc(100dvh-env(safe-area-inset-bottom)-6.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[1.6rem] p-2.5 shadow-[0_24px_52px_rgba(10,4,2,0.48)] sm:max-h-[min(48rem,calc(100dvh-2.5rem))] sm:p-3"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="parchment-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.25rem]">
                  <header className="flex items-start justify-between gap-3 border-b border-[#bd966f]/35 px-4 py-3.5 sm:px-5 sm:py-4">
                    <div>
                      <p className="text-accent text-[0.62rem] font-bold tracking-[0.18em] uppercase">
                        Co nowego?
                      </p>
                      <h2
                        id="patch-notes-title"
                        className="font-display mt-1 text-2xl font-semibold text-[#3f2a1a] sm:text-3xl"
                      >
                        Patch notes
                      </h2>
                      <p className="mt-1 text-sm text-[#705846]">
                        Ostatnie zmiany w Twoja Tura!
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      aria-label="Zamknij patch notes"
                      className="grid size-9 shrink-0 place-items-center rounded-full border border-[#a76b43] bg-[#6b3828] text-lg font-bold text-[#fff4df] shadow-[0_4px_10px_rgba(60,27,13,0.2)] transition hover:bg-[#81452f]"
                    >
                      ×
                    </button>
                  </header>

                  <div className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-3 py-3 pr-2 sm:space-y-4 sm:px-5 sm:py-4">
                    {PATCH_NOTES.map((release, releaseIndex) => (
                      <article
                        key={`${release.date}-${release.title}`}
                        className={`paper-wash rounded-[1rem] border border-[#c8a378]/35 px-3.5 py-3 shadow-[0_6px_16px_rgba(71,40,22,0.09)] sm:px-4 ${releaseIndex % 2 === 0 ? "rotate-[-0.1deg]" : "rotate-[0.1deg]"}`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <h3 className="font-display text-lg font-semibold text-[#4b3020]">
                            {release.title}
                          </h3>
                          <time className="text-[0.66rem] font-bold tracking-[0.08em] text-[#a25f39] uppercase">
                            {release.date}
                          </time>
                        </div>

                        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                          {release.categories.map((group) => (
                            <section key={group.category}>
                              <h4 className="text-[0.65rem] font-extrabold tracking-[0.13em] text-[#9b5538] uppercase">
                                {group.category}
                              </h4>
                              <ul className="mt-1.5 space-y-1.5">
                                {group.items.map((item) => (
                                  <li
                                    key={item}
                                    className="flex gap-2 text-xs leading-4.5 text-[#654b3a] sm:text-[0.8rem]"
                                  >
                                    <span
                                      aria-hidden="true"
                                      className="mt-[0.42rem] size-1 shrink-0 rounded-full bg-[#c47a3e]"
                                    />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </section>
                          ))}
                        </div>
                      </article>
                    ))}
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
