"use client";

import { useMemo, useState, useTransition } from "react";
import type { MemberRole } from "@/features/auth/types";
import { adminChangeRoleAction, adminDeactivateAccountAction } from "./actions";
import { AdminUserCards } from "./admin-user-cards";
import { AdminUserTable } from "./admin-user-table";
import { DeactivateAccountModal } from "./deactivate-account-modal";
import { ROLE_LABELS } from "./formatting";
import { RoleChangeModal } from "./role-change-modal";
import type { AdminAccountRow } from "./types";

const ROLE_FILTER_OPTIONS: Array<{ value: MemberRole | "all"; label: string }> =
  [
    { value: "all", label: "Wszystkie role" },
    { value: "member", label: ROLE_LABELS.member },
    { value: "admin", label: ROLE_LABELS.admin },
    { value: "observer", label: ROLE_LABELS.observer },
  ];

export function AdminAccountsPanel({
  initialAccounts,
  currentUserId,
}: {
  initialAccounts: AdminAccountRow[];
  currentUserId: string;
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<MemberRole | "all">("all");
  const [roleChangeTarget, setRoleChangeTarget] =
    useState<AdminAccountRow | null>(null);
  const [deactivateTarget, setDeactivateTarget] =
    useState<AdminAccountRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeAdminCount = useMemo(
    () =>
      accounts.filter((account) => account.role === "admin" && account.isActive)
        .length,
    [accounts],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesRole = roleFilter === "all" || account.role === roleFilter;
      const matchesQuery =
        query.length === 0 ||
        account.displayName.toLowerCase().includes(query) ||
        account.email.toLowerCase().includes(query);
      return matchesRole && matchesQuery;
    });
  }, [accounts, roleFilter, search]);

  function handleConfirmRoleChange(newRole: MemberRole, reason: string) {
    if (!roleChangeTarget) return;
    const target = roleChangeTarget;
    setError(null);
    startTransition(async () => {
      const result = await adminChangeRoleAction(
        target.userId,
        newRole,
        reason.trim() || undefined,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setAccounts((current) =>
        current.map((account) =>
          account.userId === target.userId
            ? { ...account, role: newRole }
            : account,
        ),
      );
      setRoleChangeTarget(null);
    });
  }

  function handleConfirmDeactivate(reason: string) {
    if (!deactivateTarget) return;
    const target = deactivateTarget;
    setError(null);
    startTransition(async () => {
      const result = await adminDeactivateAccountAction(
        target.userId,
        reason.trim() || undefined,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setAccounts((current) =>
        current.map((account) =>
          account.userId === target.userId
            ? {
                ...account,
                isActive: false,
                displayName: "Usunięty użytkownik",
                email: "—",
              }
            : account,
        ),
      );
      setDeactivateTarget(null);
    });
  }

  const deactivateBlockReason = deactivateTarget
    ? deactivateTarget.userId === currentUserId
      ? "Nie możesz usunąć własnego konta."
      : deactivateTarget.role === "admin" &&
          deactivateTarget.isActive &&
          activeAdminCount <= 1
        ? "To ostatnie aktywne konto administratora — nie można go usunąć."
        : null
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Szukaj po imieniu lub e-mailu…"
          className="paper-wash focus:border-gold focus:ring-gold/20 w-full rounded-full border border-[#9a7657]/35 px-4 py-2 text-sm text-[#503828] transition outline-none focus:ring-4 sm:max-w-xs"
        />
        <select
          value={roleFilter}
          onChange={(event) =>
            setRoleFilter(event.target.value as MemberRole | "all")
          }
          className="paper-wash focus:border-gold focus:ring-gold/20 w-full rounded-full border border-[#9a7657]/35 px-4 py-2 text-sm text-[#503828] transition outline-none focus:ring-4 sm:w-auto"
        >
          {ROLE_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-[#6f5640] sm:ml-auto">
          {filtered.length} / {accounts.length} kont
        </span>
      </div>

      {error ? (
        <p className="rounded-xl bg-[#7d2f3d]/10 px-3 py-2 text-sm font-semibold text-[#7d2f3d]">
          {error}
        </p>
      ) : null}

      <AdminUserTable
        accounts={filtered}
        currentUserId={currentUserId}
        activeAdminCount={activeAdminCount}
        onRoleChange={setRoleChangeTarget}
        onDeactivate={setDeactivateTarget}
      />
      <AdminUserCards
        accounts={filtered}
        currentUserId={currentUserId}
        activeAdminCount={activeAdminCount}
        onRoleChange={setRoleChangeTarget}
        onDeactivate={setDeactivateTarget}
      />

      {roleChangeTarget ? (
        <RoleChangeModal
          account={roleChangeTarget}
          isPending={isPending}
          isSelf={roleChangeTarget.userId === currentUserId}
          onConfirm={handleConfirmRoleChange}
          onClose={() => setRoleChangeTarget(null)}
        />
      ) : null}

      {deactivateTarget ? (
        <DeactivateAccountModal
          account={deactivateTarget}
          isPending={isPending}
          blockReason={deactivateBlockReason}
          onConfirm={handleConfirmDeactivate}
          onClose={() => setDeactivateTarget(null)}
        />
      ) : null}
    </div>
  );
}
