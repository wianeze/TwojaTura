"use client";

import { useState, useTransition } from "react";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { useCanWrite } from "@/features/auth/member-role-context";
import { cleanBggExpansionName } from "./bgg";
import type { GameExpansion, ToggleGameExpansionState } from "./types";

type GameExpansionsChecklistProps = {
  expansions: GameExpansion[];
  gameTitle: string;
  canManage: boolean;
  onToggle: (
    expansionId: string,
    isOwned: boolean,
  ) => Promise<ToggleGameExpansionState>;
};

function ExpansionRow({
  expansion,
  gameTitle,
  canManage,
  onToggle,
  index,
}: {
  expansion: GameExpansion;
  gameTitle: string;
  canManage: boolean;
  onToggle: (
    expansionId: string,
    isOwned: boolean,
  ) => Promise<ToggleGameExpansionState>;
  index: number;
}) {
  const [optimisticOwned, setOptimisticOwned] = useState(expansion.isOwned);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div
      style={{ animationDelay: `${getEntranceStaggerDelayMs(index)}ms` }}
      className="anim-rise-in-fast"
    >
      <label
        className={`paper-wash flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-sm ${
          canManage ? "cursor-pointer" : "cursor-default opacity-90"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <input
            type="checkbox"
            checked={optimisticOwned}
            disabled={!canManage || isPending}
            onChange={(event) => {
              const nextOwned = event.target.checked;
              setOptimisticOwned(nextOwned);
              setFeedback(null);

              startTransition(async () => {
                const result = await onToggle(expansion.id, nextOwned);
                if (result.status === "error") {
                  setOptimisticOwned(expansion.isOwned);
                  setFeedback(
                    result.message ?? "Nie udało się zmienić stanu dodatku.",
                  );
                }
              });
            }}
            className="accent-[#b86c39]"
          />
          <span className="min-w-0">
            <span className="block text-[0.82rem] leading-4.5 font-semibold text-[#4f382a]">
              {cleanBggExpansionName(expansion.name, gameTitle)}
            </span>
            <span className="text-muted block text-[0.62rem]">
              {optimisticOwned ? "Posiadany" : "Nieposiadany"}
            </span>
          </span>
        </span>

        <span className="text-muted shrink-0 text-[0.68rem]">
          {isPending ? "Zapisywanie…" : ""}
        </span>
      </label>

      {feedback ? (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-[#8f3528]">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

export function GameExpansionsChecklist({
  expansions,
  gameTitle,
  canManage,
  onToggle,
}: GameExpansionsChecklistProps) {
  const [showAll, setShowAll] = useState(false);
  const canWrite = useCanWrite();
  const effectiveCanManage = canManage && canWrite;

  if (expansions.length === 0) {
    return (
      <div className="paper-wash rounded-xl px-4 py-3 text-sm text-[#6f5640]">
        Nie dodano jeszcze dodatków do tego egzemplarza.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-1">
      {expansions.slice(0, showAll ? undefined : 6).map((expansion, index) => (
        <ExpansionRow
          key={`${expansion.id}:${expansion.isOwned ? "owned" : "missing"}`}
          expansion={expansion}
          gameTitle={gameTitle}
          canManage={effectiveCanManage}
          onToggle={onToggle}
          index={index}
        />
      ))}
      {expansions.length > 6 ? (
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          className="text-accent col-span-3 mt-1 text-xs font-bold underline decoration-[#b37a46]/40 underline-offset-4 lg:col-span-1"
        >
          {showAll ? "Ukryj dodatki" : "Pokaż wszystkie dodatki"}
        </button>
      ) : null}
    </div>
  );
}
