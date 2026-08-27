"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui/action-button";
import { adminAdjustTukatsAction } from "./actions";
import type { AdminAccountRow } from "./types";
import type {
  AdminTukatAdjustmentRow,
  AdminTukatBalanceRow,
  AdminTukatOperation,
} from "./tukat-adjustments";
import {
  formatAdminTukatAdjustmentTitle,
  formatTukatDelta,
  formatTukats,
  TUKAT_ADJUSTMENT_REASON_MAX_LENGTH,
} from "./tukat-adjustments";

const fieldClassName =
  "paper-wash focus:border-gold focus:ring-gold/20 w-full rounded-xl border border-[#9a7657]/35 px-3 py-2.5 text-sm text-[#503828] transition outline-none focus:ring-4 disabled:opacity-60";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

/**
 * Korekty Tukatów — waluty Misji.
 *
 * ODDZIELNY panel od korekt Renomy i to jest celowe: Renoma jest prestiżem o
 * stałej taryfie (administrator wybiera akcję z cennika), Tukaty są walutą
 * (administrator podaje kwotę). Wspólny formularz musiałby udawać, że to jedna
 * operacja z dwoma trybami, i pierwsza pomyłka w wyborze trybu poszłaby do
 * niewłaściwego salda.
 *
 * Saldo pokazywane obok gracza pochodzi z widoku `tukat_balances`, czyli z sumy
 * append-only ledgera. Po udanej korekcie panel woła `router.refresh()` i czeka
 * na nowy render serwera — świadomie NIE dolicza delty lokalnie, bo wtedy
 * ekran mógłby pokazywać liczbę, której w bazie nie ma.
 */
export function AdminTukatAdjustmentsPanel({
  accounts,
  balances,
  initialAdjustments,
}: {
  accounts: AdminAccountRow[];
  balances: AdminTukatBalanceRow[];
  initialAdjustments: AdminTukatAdjustmentRow[];
}) {
  const router = useRouter();

  // Obserwator i konto nieaktywne nie gromadzą waluty (ta sama bramka co w
  // `private.is_gamification_eligible`), więc nie ma ich na liście odbiorców.
  const eligibleAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.isActive && account.role !== "observer",
      ),
    [accounts],
  );

  const balanceByUserId = useMemo(
    () => new Map(balances.map((row) => [row.userId, row.totalTukats])),
    [balances],
  );

  const [targetUserId, setTargetUserId] = useState(
    eligibleAccounts[0]?.userId ?? "",
  );
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentBalance = balanceByUserId.get(targetUserId) ?? 0;

  function submit(operation: AdminTukatOperation) {
    setError(null);
    setSuccess(null);

    // Nowy klucz na każde świadome kliknięcie. Retry tego samego żądania
    // trafia w idempotencję RPC; druga korekta ma własny klucz i wchodzi.
    const requestId = crypto.randomUUID();

    startTransition(async () => {
      const result = await adminAdjustTukatsAction({
        targetUserId,
        operation,
        amount,
        reason,
        requestId,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setAmount("");
      setReason("");
      setSuccess(
        `${formatTukatDelta(result.delta)}. Saldo po korekcie: ${formatTukats(
          result.balanceAfter,
        )}.`,
      );
      router.refresh();
    });
  }

  const canSubmit =
    !isPending && targetUserId.length > 0 && amount.trim().length > 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-[#4c3528]">
          Korekty Tukatów
        </h2>
        <p className="mt-1 text-sm text-[#6f5640]">
          Tukaty to waluta Misji — osobne saldo od Renomy, która pozostaje
          prestiżem. Każda korekta dopisuje nowy wpis do historii; nic nie jest
          kasowane, a saldo nie może zejść poniżej zera.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5 text-sm font-semibold text-[#503828]">
          <span>Gracz</span>
          <select
            className={fieldClassName}
            value={targetUserId}
            disabled={isPending}
            onChange={(event) => {
              setTargetUserId(event.target.value);
              setError(null);
              setSuccess(null);
            }}
          >
            {eligibleAccounts.map((account) => (
              <option key={account.userId} value={account.userId}>
                {account.displayName}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-1.5 text-sm font-semibold text-[#503828]">
          <span>Aktualne saldo</span>
          <p
            className="paper-wash rounded-xl border border-[#9a7657]/35 px-3 py-2.5 text-sm font-bold text-[#4c3528]"
            aria-live="polite"
          >
            {formatTukats(currentBalance)}
          </p>
        </div>

        <label className="space-y-1.5 text-sm font-semibold text-[#503828] md:col-span-2">
          <span>Liczba Tukatów</span>
          <input
            className={fieldClassName}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={amount}
            disabled={isPending}
            onChange={(event) => {
              setAmount(event.target.value);
              setError(null);
              setSuccess(null);
            }}
            placeholder="np. 20"
          />
        </label>

        <label className="space-y-1.5 text-sm font-semibold text-[#503828] md:col-span-2">
          <span>Powód (opcjonalnie, widoczny tylko dla administratorów)</span>
          <textarea
            className={fieldClassName}
            value={reason}
            disabled={isPending}
            maxLength={TUKAT_ADJUSTMENT_REASON_MAX_LENGTH}
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

      <div className="flex flex-wrap gap-2">
        <ActionButton
          type="button"
          action="shelf"
          size="compact"
          loading={isPending}
          disabled={!canSubmit}
          onClick={() => submit("grant")}
        >
          Nadaj
        </ActionButton>
        <ActionButton
          type="button"
          action="danger"
          size="compact"
          loading={isPending}
          disabled={!canSubmit}
          onClick={() => submit("revoke")}
        >
          Odbierz
        </ActionButton>
      </div>

      <div className="border-t border-[#9a7657]/25 pt-4">
        <h3 className="font-display text-lg font-semibold text-[#4c3528]">
          Ostatnie korekty Tukatów
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
                      {formatAdminTukatAdjustmentTitle(adjustment)}
                    </p>
                    <p className="text-xs text-[#6f5640]">
                      {adjustment.adminDisplayName} ·{" "}
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
                    {formatTukatDelta(adjustment.delta)}
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
