import type { Metadata } from "next";
import { Panel } from "@/components/ui/panel";
import { AdminAdjustmentsTabs } from "@/features/admin/admin-adjustments-tabs";
import { AdminPageHeader } from "@/features/admin/admin-page-header";
import {
  listAdminAccounts,
  listAdminPointAdjustments,
  listAdminReversiblePointEvents,
  listAdminTukatAdjustments,
  listAdminTukatBalances,
} from "@/features/admin/queries";

export const metadata: Metadata = { title: "Korekty — Admin" };

export default async function AdminAdjustmentsPage() {
  const [
    accounts,
    pointAdjustments,
    reversiblePointEvents,
    tukatAdjustments,
    tukatBalances,
  ] = await Promise.all([
    listAdminAccounts(),
    listAdminPointAdjustments(),
    listAdminReversiblePointEvents(),
    listAdminTukatAdjustments(),
    listAdminTukatBalances(),
  ]);

  return (
    <div className="space-y-7">
      <AdminPageHeader
        title="Korekty punktów"
        description="Zarządzaj Renomą i Tukatami bez mieszania dwóch ekonomii."
      />
      <Panel className="paper-wash p-5 sm:p-6">
        <AdminAdjustmentsTabs
          accounts={accounts}
          pointAdjustments={pointAdjustments}
          reversiblePointEvents={reversiblePointEvents}
          tukatAdjustments={tukatAdjustments}
          tukatBalances={tukatBalances}
        />
      </Panel>
    </div>
  );
}
