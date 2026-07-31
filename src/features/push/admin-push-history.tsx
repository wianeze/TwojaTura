"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminRunPushQueueAction } from "./admin-actions";
import { formatPushDate, PUSH_CAMPAIGN_KIND_LABELS } from "./formatting";
import type { AdminPushCampaignRow } from "./types";

export function AdminPushHistory({
  campaigns,
}: {
  campaigns: AdminPushCampaignRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleRunQueue() {
    setIsRunning(true);
    setMessage(null);
    setIsError(false);

    const outcome = await adminRunPushQueueAction();

    setIsRunning(false);

    if (!outcome.ok) {
      setMessage(outcome.message);
      setIsError(true);
      return;
    }

    const { rescheduled, claimed, sent, retrying, failed } = outcome.result;

    setMessage(
      `Przesunięto ${rescheduled}, przetworzono ${claimed}: wysłano ${sent}, do ponowienia ${retrying}, nieudanych ${failed}.`,
    );

    startTransition(() => router.refresh());
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-[#4c3528]">
            Historia wysyłek
          </h2>
          <p className="mt-1 text-xs text-[#6f5640]">
            Zapis techniczny do diagnostyki i ponawiania — nie jest to lista
            powiadomień dla użytkowników.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => startTransition(() => router.refresh())}
            disabled={isPending || isRunning}
            className="rounded-full border border-[#9a7657]/35 px-4 py-2 text-xs font-bold text-[#6f5640] disabled:opacity-60"
          >
            {isPending ? "Odświeżamy…" : "Odśwież"}
          </button>
          <button
            type="button"
            onClick={handleRunQueue}
            disabled={isRunning || isPending}
            className="cta-glow bg-brand rounded-full px-4 py-2 text-xs font-bold text-[#fff3ec] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRunning ? "Ponawiamy…" : "Ponów oczekujące teraz"}
          </button>
        </div>
      </div>

      <p className="mt-2 text-[0.7rem] text-[#6f5640]">
        Ponawiane są wyłącznie dostawy czekające w kolejce. Status „nieudane”
        jest końcowy: oznacza wygasłą subskrypcję, błąd trwały albo wyczerpany
        limit prób.
      </p>

      {message ? (
        <p
          role={isError ? "alert" : "status"}
          className={`mt-3 rounded-xl px-4 py-3 text-sm ${
            isError ? "bg-[#8f3528]/10 text-[#8f3528]" : "bg-moss/12 text-moss"
          }`}
        >
          {message}
        </p>
      ) : null}

      {campaigns.length === 0 ? (
        <p className="mt-4 text-sm text-[#6f5640]">
          Nie wysłano jeszcze żadnego powiadomienia.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="rounded-2xl border border-[#9a7657]/25 bg-white/60 p-3"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-[0.7rem] font-bold text-[#4c3528]">
                  {PUSH_CAMPAIGN_KIND_LABELS[campaign.kind]}
                </span>
                <span className="font-semibold text-[#4c3528]">
                  {campaign.title}
                </span>
                <span className="ml-auto text-xs text-[#6f5640]">
                  {formatPushDate(campaign.createdAt)}
                  {campaign.createdByName ? ` · ${campaign.createdByName}` : ""}
                </span>
              </div>

              <p className="mt-1 text-sm whitespace-pre-line text-[#6f5640]">
                {campaign.body}
              </p>

              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-[#6f5640]">
                <Metric
                  label="Użytkownicy"
                  value={campaign.recipientUserCount}
                />
                <Metric label="Urządzenia" value={campaign.deviceCount} />
                <Metric label="Wysłane" value={campaign.sentCount} />
                <Metric label="W kolejce" value={campaign.queuedCount} />
                <Metric label="Nieudane" value={campaign.failedCount} />
                <Metric label="Pominięte" value={campaign.skippedCount} />
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex gap-1">
      <dt>{label}:</dt>
      <dd className="font-bold text-[#4c3528]">{value}</dd>
    </div>
  );
}
