"use client";

import { useState, useTransition } from "react";
import type { GameExpansion, ToggleGameExpansionState } from "./types";

type GameExpansionsChecklistProps = {
  expansions: GameExpansion[];
  canManage: boolean;
  onToggle: (
    expansionId: string,
    isOwned: boolean,
  ) => Promise<ToggleGameExpansionState>;
};

function ExpansionRow({
  expansion,
  canManage,
  onToggle,
}: {
  expansion: GameExpansion;
  canManage: boolean;
  onToggle: (
    expansionId: string,
    isOwned: boolean,
  ) => Promise<ToggleGameExpansionState>;
}) {
  const [optimisticOwned, setOptimisticOwned] = useState(expansion.isOwned);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <label
        className={`paper-wash flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm ${
          canManage ? "cursor-pointer" : "cursor-default opacity-90"
        }`}
      >
        <span className="flex min-w-0 items-center gap-3">
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
            <span className="block truncate font-semibold text-[#4f382a]">
              {expansion.name}
            </span>
            <span className="text-muted mt-0.5 block text-xs">
              {optimisticOwned ? "Posiadany" : "Nieposiadany"}
            </span>
          </span>
        </span>

        <span className="text-muted shrink-0 text-xs">
          {isPending ? "Zapisywanie…" : ""}
        </span>
      </label>

      {feedback ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-[#8f3528]">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}

export function GameExpansionsChecklist({
  expansions,
  canManage,
  onToggle,
}: GameExpansionsChecklistProps) {
  if (expansions.length === 0) {
    return (
      <div className="paper-wash rounded-xl px-4 py-4 text-sm text-[#6f5640]">
        Ten egzemplarz nie ma jeszcze zapisanych dodatków.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {expansions.map((expansion) => (
        <ExpansionRow
          key={`${expansion.id}:${expansion.isOwned ? "owned" : "missing"}`}
          expansion={expansion}
          canManage={canManage}
          onToggle={onToggle}
        />
      ))}
      <p className="text-muted text-xs leading-5">
        {canManage
          ? "Możesz od razu zaznaczyć, które dodatki są fizycznie na półce tej gry."
          : "Tylko właściciel egzemplarza albo administrator może zmienić stan posiadania dodatków."}
      </p>
    </div>
  );
}
