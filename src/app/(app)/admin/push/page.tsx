import type { Metadata } from "next";
import { Panel } from "@/components/ui/panel";
import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { AdminPushForm } from "@/features/push/admin-push-form";
import { AdminPushHistory } from "@/features/push/admin-push-history";
import {
  listAdminPushAudience,
  listAdminPushCampaigns,
  listUpcomingMeetingsForPush,
} from "@/features/push/queries";

export const metadata: Metadata = { title: "Push — Admin" };

/**
 * Dostęp pilnuje `(app)/admin/layout.tsx` (rola admina, inaczej redirect),
 * a niezależnie od niego każde RPC sprawdza `private.is_admin()` po stronie
 * bazy. Ukrycie linku w nawigacji nie jest tu żadną z tych warstw.
 */
export default async function AdminPushPage() {
  const [audience, campaigns, meetings] = await Promise.all([
    listAdminPushAudience(),
    listAdminPushCampaigns(20),
    listUpcomingMeetingsForPush(),
  ]);

  return (
    <div className="space-y-7">
      <AdminPageHeader
        title="Powiadomienia push"
        description="Ręczna wysyłka powiadomień push. Powiadomienie o nowym spotkaniu wychodzi automatycznie — tutaj wysyłasz wszystko pozostałe."
      />

      <Panel className="paper-wash p-5 sm:p-6">
        <h2 className="font-display mb-4 text-xl font-semibold text-[#4c3528]">
          Nowe powiadomienie
        </h2>
        <AdminPushForm audience={audience} meetings={meetings} />
      </Panel>

      <Panel className="paper-wash p-5 sm:p-6">
        <AdminPushHistory campaigns={campaigns} />
      </Panel>
    </div>
  );
}
