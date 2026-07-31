import type { Metadata } from "next";
import { ActionLink } from "@/components/ui/action-button";
import { Panel } from "@/components/ui/panel";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { AdminPushForm } from "@/features/push/admin-push-form";
import { AdminPushHistory } from "@/features/push/admin-push-history";
import {
  listAdminPushAudience,
  listAdminPushCampaigns,
  listUpcomingMeetingsForPush,
} from "@/features/push/queries";

export const metadata: Metadata = { title: "Powiadomienia" };

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
      <header
        style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
        className="anim-rise-in-fast"
      >
        <p className="text-xs font-bold tracking-[0.2em] text-[#e3ae67] uppercase">
          Zarządzanie grupą
        </p>
        <h1 className="font-display text-cream mt-1.5 text-4xl font-semibold tracking-tight drop-shadow-[0_2px_12px_rgba(20,10,7,0.32)] sm:text-[2.8rem]">
          Powiadomienia
        </h1>
        <p className="text-cream/80 mt-2 max-w-2xl text-sm">
          Ręczna wysyłka powiadomień push. Powiadomienie o nowym spotkaniu
          wychodzi automatycznie — tutaj wysyłasz wszystko pozostałe.
        </p>
        <ActionLink
          action="neutral"
          size="compact"
          emphasis="secondary"
          href="/admin"
          className="mt-3"
        >
          Wróć do panelu Admin
        </ActionLink>
      </header>

      <Panel
        style={{ animationDelay: `${getEntranceStaggerDelayMs(1)}ms` }}
        className="anim-rise-in-fast paper-wash p-5 sm:p-6"
      >
        <h2 className="font-display mb-4 text-xl font-semibold text-[#4c3528]">
          Nowe powiadomienie
        </h2>
        <AdminPushForm audience={audience} meetings={meetings} />
      </Panel>

      <Panel
        style={{ animationDelay: `${getEntranceStaggerDelayMs(2)}ms` }}
        className="anim-rise-in-fast paper-wash p-5 sm:p-6"
      >
        <AdminPushHistory campaigns={campaigns} />
      </Panel>
    </div>
  );
}
