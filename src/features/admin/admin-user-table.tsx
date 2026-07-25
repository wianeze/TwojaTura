import { formatAdminDate, ROLE_LABELS } from "./formatting";
import type { AdminAccountRow } from "./types";

export function AdminUserTable({
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
    <div className="hidden overflow-x-auto rounded-2xl border border-[#9a7657]/25 md:block">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#9a7657]/25 bg-black/5 text-left text-xs font-bold tracking-wide text-[#6f5640] uppercase">
            <th className="px-4 py-3">Konto</th>
            <th className="px-4 py-3">Rola</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Dołączył(a)</th>
            <th className="px-4 py-3">Ostatnie logowanie</th>
            <th className="px-4 py-3 text-right">Akcje</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => {
            const isSelf = account.userId === currentUserId;
            const isLastActiveAdmin =
              account.role === "admin" &&
              account.isActive &&
              activeAdminCount <= 1;
            const deactivateDisabled =
              isSelf || isLastActiveAdmin || !account.isActive;

            return (
              <tr
                key={account.userId}
                className="border-b border-[#9a7657]/15 last:border-b-0"
              >
                <td className="px-4 py-3">
                  <span className="block font-semibold text-[#4c3528]">
                    {account.displayName}
                    {isSelf ? (
                      <span className="ml-1.5 text-xs font-normal text-[#6f5640]">
                        (Ty)
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-xs text-[#6f5640]">
                    {account.email}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-semibold text-[#4c3528]">
                    {ROLE_LABELS[account.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {account.isActive ? (
                    <span className="text-xs font-semibold text-[#3f6b3f]">
                      Aktywne
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-[#7d2f3d]">
                      Usunięte
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[#6f5640]">
                  {formatAdminDate(account.createdAt)}
                </td>
                <td className="px-4 py-3 text-xs text-[#6f5640]">
                  {formatAdminDate(account.lastSignInAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onRoleChange(account)}
                      disabled={!account.isActive}
                      className="rounded-full border border-[#9a7657]/35 px-3 py-1.5 text-xs font-bold text-[#4c3528] transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="rounded-full border border-[#7d2f3d]/35 px-3 py-1.5 text-xs font-bold text-[#7d2f3d] transition-colors hover:bg-[#7d2f3d]/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Usuń
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
