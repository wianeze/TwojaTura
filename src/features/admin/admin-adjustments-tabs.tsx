"use client";

import { useState } from "react";
import { AdminPointAdjustmentsPanel } from "./admin-point-adjustments-panel";
import { AdminTukatAdjustmentsPanel } from "./admin-tukat-adjustments-panel";
import type {
  AdminPointAdjustmentRow,
  AdminReversiblePointEventRow,
} from "./point-adjustments";
import type { AdminAccountRow } from "./types";
import type {
  AdminTukatAdjustmentRow,
  AdminTukatBalanceRow,
} from "./tukat-adjustments";

type AdjustmentTab = "renown" | "tukats";

export function AdminAdjustmentsTabs({
  accounts,
  pointAdjustments,
  reversiblePointEvents,
  tukatAdjustments,
  tukatBalances,
}: {
  accounts: AdminAccountRow[];
  pointAdjustments: AdminPointAdjustmentRow[];
  reversiblePointEvents: AdminReversiblePointEventRow[];
  tukatAdjustments: AdminTukatAdjustmentRow[];
  tukatBalances: AdminTukatBalanceRow[];
}) {
  const [activeTab, setActiveTab] = useState<AdjustmentTab>("renown");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Rodzaj korekt"
        className="mb-5 inline-flex rounded-2xl border border-[#8b5d3d]/30 bg-[#6a422d]/12 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "renown"}
          onClick={() => setActiveTab("renown")}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "renown"
              ? "bg-[#5b3627] text-[#ffe5b7] shadow-[0_4px_10px_rgba(54,28,18,0.26)]"
              : "text-[#694630] hover:bg-white/45"
          }`}
        >
          Renoma
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "tukats"}
          onClick={() => setActiveTab("tukats")}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "tukats"
              ? "bg-[#5b3627] text-[#ffe5b7] shadow-[0_4px_10px_rgba(54,28,18,0.26)]"
              : "text-[#694630] hover:bg-white/45"
          }`}
        >
          Tukaty
        </button>
      </div>

      {activeTab === "renown" ? (
        <AdminPointAdjustmentsPanel
          accounts={accounts}
          initialAdjustments={pointAdjustments}
          initialReversibleEvents={reversiblePointEvents}
        />
      ) : (
        <AdminTukatAdjustmentsPanel
          accounts={accounts}
          balances={tukatBalances}
          initialAdjustments={tukatAdjustments}
        />
      )}
    </div>
  );
}
