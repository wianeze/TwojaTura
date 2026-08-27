import type { Metadata } from "next";
import { Panel } from "@/components/ui/panel";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { AdminAccountsPanel } from "@/features/admin/admin-accounts-panel";
import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { listAdminAccounts } from "@/features/admin/queries";

export const metadata: Metadata = { title: "Konta — Admin" };

export default async function AdminAccountsPage() {
  const [memberState, accounts] = await Promise.all([
    getCurrentMember(),
    listAdminAccounts(),
  ]);
  const currentUserId =
    memberState.status === "active-member" ? memberState.member.id : "";

  return (
    <div className="space-y-7">
      <AdminPageHeader
        title="Zarządzanie kontami"
        description="Role, statusy i dostęp członków Twojej grupy."
      />
      <Panel className="paper-wash p-5 sm:p-6">
        <AdminAccountsPanel
          initialAccounts={accounts}
          currentUserId={currentUserId}
        />
      </Panel>
    </div>
  );
}
