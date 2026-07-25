import type { Metadata } from "next";
import { Panel } from "@/components/ui/panel";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { AdminAccountsPanel } from "@/features/admin/admin-accounts-panel";
import { listAdminAccounts } from "@/features/admin/queries";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const [memberState, accounts] = await Promise.all([
    getCurrentMember(),
    listAdminAccounts(),
  ]);

  const currentUserId =
    memberState.status === "active-member" ? memberState.member.id : "";

  return (
    <div className="space-y-7">
      <header
        style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
        className="anim-rise-in-fast"
      >
        <p className="text-xs font-bold tracking-[0.2em] text-[#e3ae67] uppercase">
          Zarządzanie grupą
        </p>
        <h1 className="font-display text-cream mt-1.5 text-4xl font-semibold tracking-tight drop-shadow-[0_2px_12px_rgba(20,10,7,0.32)] sm:text-[2.8rem]">
          Admin
        </h1>
      </header>

      <Panel
        style={{ animationDelay: `${getEntranceStaggerDelayMs(1)}ms` }}
        className="anim-rise-in-fast paper-wash p-5 sm:p-6"
      >
        <AdminAccountsPanel
          initialAccounts={accounts}
          currentUserId={currentUserId}
        />
      </Panel>
    </div>
  );
}
