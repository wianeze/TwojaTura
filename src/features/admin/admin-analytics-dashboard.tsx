import type {
  AnalyticsCountRow,
  AnalyticsDailyPoint,
  AnalyticsSnapshot,
} from "./analytics-types";
import {
  calculateCompletionRate,
  formatAnalyticsDateTime,
  formatDaysSince,
} from "./analytics-formatting";

const ROUTE_LABELS: Record<string, string> = {
  table: "Stół",
  shelf: "Półka",
  legendarium: "Legendarium",
  calendar: "Kalendarium",
  chronicle: "Kronika",
  profile: "Profil",
  admin: "Admin",
  "admin.statistics": "Statystyki",
};

export function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#9a6b43]/25 bg-white/58 px-4 py-4 shadow-[0_8px_22px_rgba(82,49,31,0.08)]">
      <p className="text-[0.68rem] font-bold tracking-[0.14em] text-[#956444] uppercase">
        {label}
      </p>
      <p className="font-display mt-1 text-3xl font-bold text-[#4b2f23]">
        {value.toLocaleString("pl-PL")}
      </p>
    </div>
  );
}

function ActivityLine({ points }: { points: AnalyticsDailyPoint[] }) {
  const width = 720;
  const height = 190;
  const maxValue = Math.max(1, ...points.map((point) => point.activeUsers));
  const coordinates = points.map((point, index) => {
    const x =
      points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - 18 - (point.activeUsers / maxValue) * (height - 38);
    return `${x},${y}`;
  });

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Aktywni użytkownicy dzień po dniu"
        className="h-48 w-full overflow-visible"
      >
        <defs>
          <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d4863d" stopOpacity="0.4" />
            <stop offset="1" stopColor="#d4863d" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`M 0 ${height - 18} L ${coordinates.join(" L ")} L ${width} ${height - 18} Z`}
          fill="url(#activity-fill)"
        />
        <polyline
          points={coordinates.join(" ")}
          fill="none"
          stroke="#bd6c2f"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-between text-xs text-[#806452]">
        <span>{points[0]?.date ?? "—"}</span>
        <span>{points.at(-1)?.date ?? "—"}</span>
      </div>
    </div>
  );
}

function BarChart({ rows }: { rows: AnalyticsCountRow[] }) {
  const max = Math.max(1, ...rows.map((row) => row.eventsCount));
  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-sm text-[#806452]">
          Dane pojawią się po pierwszych wejściach.
        </p>
      ) : null}
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm"
        >
          <span className="truncate font-semibold text-[#57382a]">
            {ROUTE_LABELS[row.label] ?? row.label}
          </span>
          <span className="h-3 overflow-hidden rounded-full bg-[#6e4a35]/12">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-[#a94f27] to-[#e2a24d]"
              style={{
                width: `${Math.max(4, (row.eventsCount / max) * 100)}%`,
              }}
            />
          </span>
          <span className="font-bold text-[#6b432e]">{row.eventsCount}</span>
        </div>
      ))}
    </div>
  );
}

function StepChart({ rows }: { rows: AnalyticsCountRow[] }) {
  const max = Math.max(1, ...rows.map((row) => row.eventsCount));
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <div
          key={row.label}
          className="rounded-xl border border-[#9b6a42]/25 bg-gradient-to-r from-[#5b3124] to-[#8c512f] px-3 py-2 text-[#fff0d9]"
          style={{
            width: `${Math.max(55, 100 - index * (45 / Math.max(1, rows.length - 1)))}%`,
          }}
        >
          <span className="flex items-center justify-between gap-3 text-sm font-semibold">
            <span>{row.label}</span>
            <span>{row.eventsCount}</span>
          </span>
          <span className="mt-1 block h-1 rounded-full bg-white/12">
            <span
              className="block h-full rounded-full bg-[#efb45e]"
              style={{ width: `${(row.eventsCount / max) * 100}%` }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="paper-wash rounded-[1.75rem] border border-[#8a5c3d]/24 p-5 shadow-[0_16px_38px_rgba(45,23,14,0.14)] sm:p-6">
      <h2 className="font-display mb-4 text-2xl font-semibold text-[#4b2f23]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function AdminAnalyticsDashboard({ data }: { data: AnalyticsSnapshot }) {
  const completionRate = calculateCompletionRate(
    data.questUsage.completed,
    data.questUsage.presented,
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Aktywni dzisiaj" value={data.kpis.activeToday} />
        <KpiCard label="Aktywni 7 dni" value={data.kpis.active7Days} />
        <KpiCard label="Aktywni 30 dni" value={data.kpis.active30Days} />
        <KpiCard label="Udane logowania" value={data.kpis.loginSuccess} />
        <KpiCard label="Nieudane logowania" value={data.kpis.loginFailure} />
        <KpiCard label="Błędy akcji" value={data.kpis.actionErrors} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Aktywność użytkowników">
          <ActivityLine points={data.dailyActivity} />
        </Section>
        <Section title="Najczęściej odwiedzane sekcje">
          <BarChart rows={data.routes} />
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.7fr_1fr_1fr]">
        <Section title="Zlecenia">
          <div className="flex items-center gap-5">
            <div
              className="grid size-28 shrink-0 place-items-center rounded-full"
              style={{
                background: `conic-gradient(#c67232 ${completionRate}%, rgba(105,70,48,.14) 0)`,
              }}
            >
              <span className="grid size-20 place-items-center rounded-full bg-[#f4ead8] font-bold text-[#57382a]">
                {completionRate}%
              </span>
            </div>
            <dl className="space-y-1 text-sm text-[#654838]">
              <div>
                <dt className="inline">Wyświetlono: </dt>
                <dd className="inline font-bold">
                  {data.questUsage.presented}
                </dd>
              </div>
              <div>
                <dt className="inline">Kliknięto: </dt>
                <dd className="inline font-bold">{data.questUsage.clicked}</dd>
              </div>
              <div>
                <dt className="inline">Wykonano: </dt>
                <dd className="inline font-bold">
                  {data.questUsage.completed}
                </dd>
              </div>
              <div>
                <dt className="inline">Po terminie: </dt>
                <dd className="inline font-bold">{data.questUsage.expired}</dd>
              </div>
            </dl>
          </div>
        </Section>
        <Section title="Lejek spotkania">
          <StepChart rows={data.funnel} />
        </Section>
        <Section title="Kontynuacje partii">
          <StepChart rows={data.continuations} />
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Aktywność graczy">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="text-xs tracking-wide text-[#936344] uppercase">
                <tr>
                  <th className="pb-3">Gracz</th>
                  <th>Logowania</th>
                  <th>Ostatnie logowanie</th>
                  <th>Ostatnia aktywność</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#8d664d]/15">
                {data.userActivity.map((row) => (
                  <tr key={row.userId}>
                    <td className="py-3 font-semibold">{row.displayName}</td>
                    <td>{row.loginCount}</td>
                    <td>{formatAnalyticsDateTime(row.lastLoginAt)}</td>
                    <td>{formatDaysSince(row.lastActivityAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
        <Section title="Ostatnie logowania">
          <div className="space-y-2">
            {data.recentLogins.length === 0 ? (
              <p className="text-sm text-[#806452]">
                Brak zarejestrowanych logowań.
              </p>
            ) : null}
            {data.recentLogins.map((row, index) => (
              <div
                key={`${row.createdAt}-${index}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#8f6345]/16 bg-white/45 px-3 py-2 text-sm"
              >
                <span>
                  <strong>{row.displayName}</strong>
                  <span className="ml-2 text-[#806452]">
                    {row.deviceClass} · {row.browserFamily}
                  </span>
                </span>
                <span className="text-[#806452]">
                  {formatAnalyticsDateTime(row.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Top komponenty i CTA">
          <BarChart
            rows={data.topComponents.map((row) => ({
              ...row,
              label: `${row.label} · ${row.action}`,
            }))}
          />
        </Section>
        <Section title="Najczęściej kontynuowane gry">
          <BarChart rows={data.continuedGames} />
        </Section>
      </div>

      {data.errors.length > 0 ? (
        <Section title="Ostatnie błędy akcji">
          <div className="space-y-2">
            {data.errors.map((row, index) => (
              <div
                key={`${row.createdAt}-${index}`}
                className="grid gap-1 rounded-xl border border-[#a84935]/20 bg-[#fff4ec]/65 px-3 py-2 text-sm sm:grid-cols-[1fr_1fr_auto]"
              >
                <strong>{row.errorAction || "Akcja serwerowa"}</strong>
                <span>{row.displayName}</span>
                <span className="text-[#806452]">
                  {formatAnalyticsDateTime(row.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
