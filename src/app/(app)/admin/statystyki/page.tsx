import type { Metadata } from "next";
import { WarmLink } from "@/components/layout/warm-link";
import { AdminAnalyticsDashboard } from "@/features/admin/admin-analytics-dashboard";
import { AdminHistoricalAnalyticsDashboard } from "@/features/admin/admin-historical-analytics-dashboard";
import { AdminPageHeader } from "@/features/admin/admin-page-header";
import {
  getAdminAnalyticsSnapshot,
  getAdminHistoricalBusinessSnapshot,
} from "@/features/admin/queries";

export const metadata: Metadata = { title: "Statystyki — Admin" };

export default async function AdminStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ dni?: string }>;
}) {
  const params = await searchParams;
  const requestedDays = Number(params.dni ?? 30);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const [data, historicalData] = await Promise.all([
    getAdminAnalyticsSnapshot(days),
    getAdminHistoricalBusinessSnapshot(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <AdminPageHeader
          eyebrow="Dane aplikacji"
          title="Statystyki"
          description="Bez trackerów reklamowych, nagrywania sesji i treści wpisywanych przez graczy."
        />
        <nav className="flex gap-2" aria-label="Zakres statystyk">
          {[7, 30, 90].map((value) => (
            <WarmLink
              key={value}
              href={`/admin/statystyki?dni=${value}`}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${days === value ? "border-[#e3ae67] bg-[#e3ae67] text-[#3c241b]" : "border-white/18 bg-black/18 text-[#ead8c4]"}`}
            >
              {value} dni
            </WarmLink>
          ))}
        </nav>
      </div>
      <AdminAnalyticsDashboard data={data} />
      <AdminHistoricalAnalyticsDashboard data={historicalData} />
    </div>
  );
}
