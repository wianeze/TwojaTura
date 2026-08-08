"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui/action-button";
import {
  getPointAction,
  pointActionCatalog,
  pointActionLabels,
  type PointActionType,
} from "@/features/points/action-catalog";
import { formatPoints } from "@/features/legendarium/formatting";
import { adminAwardPointAction, adminReversePointEventAction } from "./actions";
import type { AdminAccountRow } from "./types";
import type {
  AdminPointAdjustmentRow,
  AdminPointOperation,
  AdminReversiblePointEventRow,
} from "./point-adjustments";
import { formatAdminPointAdjustmentTitle } from "./point-adjustments";

const fieldClassName =
  "paper-wash focus:border-gold focus:ring-gold/20 w-full rounded-xl border border-[#9a7657]/35 px-3 py-2.5 text-sm text-[#503828] transition outline-none focus:ring-4 disabled:opacity-60";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminPointAdjustmentsPanel({
  accounts,
  initialAdjustments,
  initialReversibleEvents,
}: {
  accounts: AdminAccountRow[];
  initialAdjustments: AdminPointAdjustmentRow[];
  initialReversibleEvents: AdminReversiblePointEventRow[];
}) {
  const router = useRouter();
  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.isActive),
    [accounts],
  );
  const [operation, setOperation] = useState<AdminPointOperation>("award");
  const [targetUserId, setTargetUserId] = useState(
    activeAccounts[0]?.userId ?? "",
  );
  const [actionType, setActionType] = useState<PointActionType>(
    pointActionCatalog[0].value,
  );
  const [pointEventId, setPointEventId] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reversibleForTarget = useMemo(
    () =>
      initialReversibleEvents.filter(
        (event) => event.targetUserId === targetUserId,
      ),
    [initialReversibleEvents, targetUserId],
  );

  function changeTarget(nextTarget: string) {
    setTargetUserId(nextTarget);
    setPointEventId("");
    setError(null);
    setSuccess(null);
  }

  function submit() {
    setError(null);
    setSuccess(null);
    const requestId = crypto.randomUUID();

    startTransition(async () => {
      const result =
        operation === "award"
          ? await adminAwardPointAction({
              targetUserId,
              actionType,
              reason,
              requestId,
            })
          : await adminReversePointEventAction({
              pointEventId,
              reason,
              requestId,
            });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setReason("");
      setPointEventId("");
      setSuccess(
        operation === "award"
          ? `Przyznano ${formatPoints(result.delta)}.`
          : `Zapisano wycofanie ${formatPoints(result.delta)}.`,
      );
      router.refresh();
    });
  }

  const canSubmit =
    !isPending &&
    targetUserId.length > 0 &&
    (operation === "award" || pointEventId.length > 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-[#4c3528]">
          Korekty questów / punktów
        </h2>
        <p className="mt-1 text-sm text-[#6f5640]">
          Kontrolowana korekta zapisuje nowy wpis w historii. Nie zmienia
          danych, z których powstają questy na Stole.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5 text-sm font-semibold text-[#503828]">
          <span>Operacja</span>
          <select
            className={fieldClassName}
            value={operation}
            disabled={isPending}
            onChange={(event) => {
              setOperation(event.target.value as AdminPointOperation);
              setError(null);
              setSuccess(null);
            }}
          >
            <option value="award">Przyznaj</option>
            <option value="reversal">Wycofaj wcześniejszy wpis</option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm font-semibold text-[#503828]">
          <span>Użytkownik</span>
          <select
            className={fieldClassName}
            value={targetUserId}
            disabled={isPending}
            onChange={(event) => changeTarget(event.target.value)}
          >
            {activeAccounts.map((account) => (
              <option key={account.userId} value={account.userId}>
                {account.displayName}
              </option>
            ))}
          </select>
        </label>

        {operation === "award" ? (
          <label className="space-y-1.5 text-sm font-semibold text-[#503828] md:col-span-2">
            <span>Quest / akcja punktowa</span>
            <select
              className={fieldClassName}
              value={actionType}
              disabled={isPending}
              onChange={(event) =>
                setActionType(event.target.value as PointActionType)
              }
            >
              {pointActionCatalog.map((action) => (
                <option key={action.value} value={action.value}>
                  {action.label} (+{action.points} pkt)
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="space-y-1.5 text-sm font-semibold text-[#503828] md:col-span-2">
            <span>Konkretny wpis do cofnięcia</span>
            <select
              className={fieldClassName}
              value={pointEventId}
              disabled={isPending || reversibleForTarget.length === 0}
              onChange={(event) => setPointEventId(event.target.value)}
            >
              <option value="">
                {reversibleForTarget.length === 0
                  ? "Brak wpisów możliwych do cofnięcia"
                  : "Wybierz wpis"}
              </option>
              {reversibleForTarget.map((event) => (
                <option key={event.pointEventId} value={event.pointEventId}>
                  {pointActionLabels[event.actionType]} · +{event.points} pkt ·{" "}
                  {formatDateTime(event.createdAt)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="space-y-1.5 text-sm font-semibold text-[#503828] md:col-span-2">
          <span>Powód (opcjonalnie, widoczny tylko dla administratorów)</span>
          <textarea
            className={fieldClassName}
            value={reason}
            disabled={isPending}
            maxLength={500}
            rows={2}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Krótka notatka do audytu"
          />
        </label>
      </div>

      {error ? (
        <p className="rounded-xl bg-[#7d2f3d]/10 px-3 py-2 text-sm font-semibold text-[#7d2f3d]">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl bg-[#43633f]/10 px-3 py-2 text-sm font-semibold text-[#43633f]">
          {success}
        </p>
      ) : null}

      <ActionButton
        type="button"
        action={operation === "award" ? "meeting" : "danger"}
        size="compact"
        loading={isPending}
        disabled={!canSubmit}
        onClick={submit}
      >
        {operation === "award"
          ? `Przyznaj +${getPointAction(actionType).points} pkt`
          : "Wycofaj wpis"}
      </ActionButton>

      <div className="border-t border-[#9a7657]/25 pt-4">
        <h3 className="font-display text-lg font-semibold text-[#4c3528]">
          Ostatnie korekty
        </h3>
        {initialAdjustments.length === 0 ? (
          <p className="mt-2 text-sm text-[#6f5640]">Brak korekt.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {initialAdjustments.map((adjustment) => (
              <li
                key={adjustment.adjustmentId}
                className="paper-wash rounded-xl border border-[#9a7657]/25 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#4c3528]">
                      {formatAdminPointAdjustmentTitle(adjustment)}
                    </p>
                    <p className="text-xs text-[#6f5640]">
                      {adjustment.operation === "award"
                        ? "Przyznano"
                        : "Cofnięto"}{" "}
                      przez {adjustment.adminDisplayName} ·{" "}
                      {formatDateTime(adjustment.createdAt)}
                    </p>
                    {adjustment.reason ? (
                      <p className="mt-1 text-xs text-[#6f5640]">
                        Powód: {adjustment.reason}
                      </p>
                    ) : null}
                  </div>
                  <strong
                    className={
                      adjustment.delta > 0
                        ? "text-sm text-[#43633f]"
                        : "text-sm text-[#8b3d35]"
                    }
                  >
                    {formatPoints(adjustment.delta)}
                  </strong>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
