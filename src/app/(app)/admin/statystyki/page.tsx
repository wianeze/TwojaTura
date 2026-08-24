import type { Metadata } from "next";
import { WarmLink } from "@/components/layout/warm-link";
import { AdminAnalyticsDashboard } from "@/features/admin/admin-analytics-dashboard";
import { AdminHistoricalAnalyticsDashboard } from "@/features/admin/admin-historical-analytics-dashboard";
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-[#e3ae67] uppercase">
            Dane aplikacji
          </p>
          <h1 className="font-display text-cream mt-1.5 text-4xl font-semibold tracking-tight sm:text-[2.8rem]">
            Statystyki
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#d8c3ad]">
            Bez trackerów reklamowych, nagrywania sesji i treści wpisywanych
            przez graczy.
          </p>
        </div>
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
      </header>
      <AdminAnalyticsDashboard data={data} />
      <AdminHistoricalAnalyticsDashboard data={historicalData} />
    </div>
  );
}
