"use client";

import { useState } from "react";
import type { LegendariumReward } from "./legendarium-showcase";

export function MobileRewardsSheet({
  rewards,
  futureRewards,
}: {
  rewards: readonly LegendariumReward[];
  futureRewards: readonly LegendariumReward[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full border border-[#efcf9f]/65 bg-[#351b12]/78 px-3 py-2 text-xs font-bold text-[#ffe6b9] shadow-[0_5px_12px_rgba(12,5,2,0.28)]"
      >
        Jak zdobywać łupy
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-100 bg-[#170b08]/88 p-3 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-rewards-title"
        >
          <section className="cork-board-bg premium-edge relative isolate flex h-full flex-col overflow-hidden rounded-[1.65rem] p-3">
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
                Każda nagroda jest naliczana raz dla danego zdarzenia lub progu.
              </p>

              <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                <p className="text-accent text-[0.65rem] font-bold tracking-[0.16em] uppercase">
                  {"Dzia\u0142a teraz"}
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
                    {"Po spotkaniu \u2014 wkr\u00f3tce"}
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
                          {"Planowany bonus \u00b7 wkr\u00f3tce"}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
