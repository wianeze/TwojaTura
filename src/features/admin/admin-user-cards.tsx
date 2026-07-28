import { formatAdminDate, ROLE_LABELS } from "./formatting";
import type { AdminAccountRow } from "./types";

export function AdminUserCards({
  accounts,
  currentUserId,
  activeAdminCount,
  onRoleChange,
  onDeactivate,
}: {
  accounts: AdminAccountRow[];
  currentUserId: string;
  activeAdminCount: number;
  onRoleChange: (account: AdminAccountRow) => void;
  onDeactivate: (account: AdminAccountRow) => void;
}) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {accounts.map((account) => {
        const isSelf = account.userId === currentUserId;
        const isLastActiveAdmin =
          account.role === "admin" && account.isActive && activeAdminCount <= 1;
        const deactivateDisabled =
          isSelf || isLastActiveAdmin || !account.isActive;

        return (
          <article
            key={account.userId}
            className="paper-wash rounded-2xl border border-[#9a7657]/25 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#4c3528]">
                  {account.displayName}
                  {isSelf ? (
                    <span className="ml-1.5 text-xs font-normal text-[#6f5640]">
                      (Ty)
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-[#6f5640]">
                  {account.email}
                </p>
              </div>
              {account.isActive ? (
                <span className="shrink-0 text-xs font-semibold text-[#3f6b3f]">
                  Aktywne
                </span>
              ) : (
                <span className="shrink-0 text-xs font-semibold text-[#7d2f3d]">
                  Usunięte
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6f5640]">
              <span className="rounded-full bg-black/5 px-2.5 py-1 font-semibold text-[#4c3528]">
                {ROLE_LABELS[account.role]}
              </span>
              <span>Dołączył(a): {formatAdminDate(account.createdAt)}</span>
              <span>Logowanie: {formatAdminDate(account.lastSignInAt)}</span>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onRoleChange(account)}
                disabled={!account.isActive}
                className="min-h-10 flex-1 rounded-full border border-[#9a7657]/35 px-3 text-xs font-bold text-[#4c3528] transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Zmień rolę
              </button>
              <button
                type="button"
                onClick={() => onDeactivate(account)}
                disabled={deactivateDisabled}
                title={
                  isSelf
                    ? "Nie możesz usunąć własnego konta."
                    : isLastActiveAdmin
                      ? "To ostatnie aktywne konto administratora."
                      : undefined
                }
                className="min-h-10 flex-1 rounded-full border border-[#7d2f3d]/35 px-3 text-xs font-bold text-[#7d2f3d] transition-colors hover:bg-[#7d2f3d]/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Usuń
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
