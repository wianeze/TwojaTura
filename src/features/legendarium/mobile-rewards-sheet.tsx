"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { LegendariumReward } from "./legendarium-showcase";

export function MobileRewardsSheet({
  rewards,
  futureRewards,
}: {
  rewards: readonly LegendariumReward[];
  futureRewards: readonly LegendariumReward[];
}) {
  // No SSR-mount guard needed: isOpen only ever flips to true from the
  // button's onClick, which can't fire during server rendering or before
  // hydration — by the time createPortal(..., document.body) below
  // actually runs, document is guaranteed to exist.
  const [isOpen, setIsOpen] = useState(false);

  // Body scroll lock + Escape-to-close, active only while the popup is open.
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full border border-[#efcf9f]/65 bg-[#351b12]/78 px-3 py-2 text-xs font-bold text-[#ffe6b9] shadow-[0_5px_12px_rgba(12,5,2,0.28)]"
      >
        Jak zdobywać łupy
      </button>

      {isOpen
        ? createPortal(
            // Portaled straight to <body>: legendarium-showcase.tsx and
            // app-shell.tsx's <main> both establish their own stacking
            // context (position:relative + z-index), which caps whatever
            // z-index this popup uses to *within* that context — no value
            // here could ever paint above a true sibling context (like the
            // fixed bottom nav) without escaping that nesting entirely.
            <div
              className="anim-rise-in-fast fixed inset-0 z-100 flex items-center justify-center bg-[#170b08]/88 backdrop-blur-sm"
              role="presentation"
              onClick={() => setIsOpen(false)}
            >
              <div
                className="flex max-h-full w-full max-w-md flex-col p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
                onClick={(event) => event.stopPropagation()}
              >
                {/*
                  Same anim-rise-in-fast primitive used across the rest of
                  the app (Kalendarium/Półka cards, achievement/class
                  catalogs) — fade + subtle rise, respects
                  prefers-reduced-motion already. Reused here instead of a
                  bespoke modal transition so the popup's entrance matches
                  everything else's motion language.
                */}
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="mobile-rewards-title"
                  className="anim-rise-in-fast cork-board-bg premium-edge relative isolate flex max-h-full flex-col overflow-hidden rounded-[1.65rem] p-3"
                >
                  <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(32,16,9,0.1),rgba(22,10,7,0.42))]" />
                  <div className="parchment-card relative flex min-h-0 flex-1 flex-col rounded-[1.25rem] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-accent text-[0.65rem] font-bold tracking-[0.18em] uppercase">
                          Legendarium
                        </p>
                        <h2
                          id="mobile-rewards-title"
                          className="font-display mt-1 text-3xl font-semibold"
                        >
                          Jak zdobywać łupy
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="grid size-10 shrink-0 place-items-center rounded-full border border-[#a76b43] bg-[#6b3828] text-xl font-bold text-[#fff4df]"
                        aria-label="Zamknij"
                      >
                        ×
                      </button>
                    </div>

                    <p className="text-muted mt-2 text-sm leading-5">
                      Każda nagroda jest naliczana raz dla danego zdarzenia
                      lub progu.
                    </p>

                    <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                      <p className="text-accent text-[0.65rem] font-bold tracking-[0.16em] uppercase">
                        {"Działa teraz"}
                      </p>
                      <div className="mt-2 grid grid-cols-1 content-start gap-2">
                        {rewards.map((reward, index) => (
                          <article
                            key={reward.title}
                            className={`paper-wash relative min-h-28 rounded-xl px-3 py-2.5 shadow-[0_7px_14px_rgba(70,40,22,0.12)] ${
                              index % 3 === 1
                                ? "rotate-[0.35deg]"
                                : "-rotate-[0.25deg]"
                            }`}
                          >
                            <span className="text-accent text-base font-bold">
                              {reward.points} pkt
                            </span>
                            <p className="mt-1 text-sm leading-4 font-bold text-[#70533d]">
                              {reward.title}
                            </p>
                            <p className="mt-1 text-xs leading-4 text-[#70533d]">
                              {reward.condition}
                            </p>
                            <p className="mt-1 text-[0.68rem] leading-4 font-bold text-[#a76538]">
                              {reward.limit}
                            </p>
                          </article>
                        ))}
                      </div>

                      <div className="mt-4 border-t border-[#c89d73]/45 pt-3">
                        <p className="text-[0.65rem] font-bold tracking-[0.16em] text-[#83614a] uppercase">
                          {"Po spotkaniu — wkrótce"}
                        </p>
                        <div className="mt-2 grid grid-cols-1 content-start gap-2">
                          {futureRewards.map((reward, index) => (
                            <article
                              key={reward.title}
                              className={`paper-wash relative min-h-28 rounded-xl px-3 py-2.5 opacity-75 shadow-[0_7px_14px_rgba(70,40,22,0.12)] ${
                                index % 3 === 1
                                  ? "rotate-[0.35deg]"
                                  : "-rotate-[0.25deg]"
                              }`}
                            >
                              <span className="text-accent text-base font-bold">
                                {reward.points} pkt
                              </span>
                              <p className="mt-1 text-sm leading-4 font-bold text-[#70533d]">
                                {reward.title}
                              </p>
                              <p className="mt-1 text-xs leading-4 text-[#70533d]">
                                {reward.condition}
                              </p>
                              <p className="mt-1 text-[0.68rem] leading-4 font-bold text-[#a76538]">
                                {"Planowany bonus · wkrótce"}
                              </p>
                            </article>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
