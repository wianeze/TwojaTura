import type { Metadata } from "next";
import { Panel } from "@/components/ui/panel";
import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { FeedbackReviewPanel } from "@/features/admin/feedback-review-panel";
import { listAdminFeedbackSubmissions } from "@/features/admin/queries";

export const metadata: Metadata = { title: "Zgłoszenia — Admin" };

export default async function AdminFeedbackPage() {
  const submissions = await listAdminFeedbackSubmissions();

  return (
    <div className="space-y-7">
      <AdminPageHeader
        title="Zgłoszenia użytkowników"
        description="Pomysły, błędy i sugestie przesłane przez drużynę."
      />
      <Panel className="paper-wash p-5 sm:p-6">
        <FeedbackReviewPanel initialSubmissions={submissions} />
      </Panel>
    </div>
  );
}
