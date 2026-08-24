import { KpiCard, Section } from "./admin-analytics-dashboard";
import {
  HISTORICAL_BUSINESS_DESCRIPTION,
  HISTORICAL_BUSINESS_TITLE,
  HISTORICAL_RESPONSES_NOTE,
  type HistoricalBusinessSnapshot,
  type HistoricalWeeklyActivity,
} from "./historical-analytics";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function formatDuration(value: number | null) {
  if (value === null) return "—";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

function formatRating(value: number | null) {
  return value === null
    ? "—"
    : value.toLocaleString("pl-PL", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
}

function formatRenownAction(value: string) {
  if (value.startsWith("achievement_unlocked:")) {
    return `Osiągnięcie · ${value.slice("achievement_unlocked:".length).replaceAll("_", " ")}`;
  }
  if (value.startsWith("admin_award:"))
    return "Korekta administratora · dodanie";
  if (value.startsWith("admin_reversal:"))
    return "Korekta administratora · cofnięcie";
  if (value.startsWith("reversal:")) {
    return `Cofnięcie · ${value.slice("reversal:".length).replaceAll("_", " ")}`;
  }

  const labels: Record<string, string> = {
    meeting_rsvp: "RSVP",
    meeting_vote: "Głos na grę",
    rating_created: "Ocena gry",
    meeting_hosted: "Ukończone spotkanie",
    play_participated: "Udział w partii",
    play_logged: "Historyczny wpis Kroniki",
    shelf_first_game: "Pierwsza gra na Półce",
    shelf_5_games: "5 gier na Półce",
    shelf_10_games: "10 gier na Półce",
    shelf_15_games: "15 gier na Półce",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function formatRenownSource(value: string) {
  const labels: Record<string, string> = {
    reward: "Nagroda",
    achievement: "Osiągnięcie",
    admin_correction: "Korekta",
    business_reversal: "Cofnięcie",
  };
  return labels[value] ?? value;
}

function WeeklyBusinessActivityChart({
  points,
}: {
  points: HistoricalWeeklyActivity[];
}) {
  const max = Math.max(1, ...points.map((point) => point.recordsCount));

  if (points.length === 0) {
    return (
      <p className="text-sm text-[#806452]">
        Brak historycznych rekordów biznesowych.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {points.map((point) => (
        <div
          key={point.weekStart}
          className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-sm"
        >
          <span className="text-xs font-semibold text-[#74513d]">
            {formatDate(point.weekStart)}
          </span>
          <span className="h-3 overflow-hidden rounded-full bg-[#6e4a35]/12">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-[#9c4c29] via-[#cf7938] to-[#e4ad58]"
              style={{
                width: `${Math.max(3, (point.recordsCount / max) * 100)}%`,
              }}
            />
          </span>
          <span className="min-w-14 text-right font-bold text-[#67422f]">
            {point.recordsCount}
            <span className="ml-1 block text-[0.62rem] font-medium text-[#8b6d59] sm:inline">
              · {point.activeUsers} os.
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyTableRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-5 text-center text-[#806452]">
        Brak danych do pokazania.
      </td>
    </tr>
  );
}

export function AdminHistoricalAnalyticsDashboard({
  data,
}: {
  data: HistoricalBusinessSnapshot;
}) {
  return (
    <section
      aria-labelledby="historical-business-title"
      className="mt-10 space-y-6 rounded-[2rem] border-2 border-[#d19552]/45 bg-[#26160f]/28 p-3 shadow-[0_22px_55px_rgba(32,15,8,0.2)] sm:p-5"
    >
      <header className="rounded-[1.5rem] border border-[#e1b66f]/30 bg-gradient-to-br from-[#4c2b1d]/95 to-[#281710]/95 px-5 py-5 text-[#f7e7cd] sm:px-6">
        <span className="inline-flex rounded-full border border-[#edbd6d]/45 bg-[#d58435]/15 px-3 py-1 text-[0.65rem] font-bold tracking-[0.16em] text-[#efbd73] uppercase">
          Dane pochodne · nie telemetria
        </span>
        <h2
          id="historical-business-title"
          className="font-display mt-3 text-3xl font-semibold"
        >
          {HISTORICAL_BUSINESS_TITLE}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#dfc8af]">
          {HISTORICAL_BUSINESS_DESCRIPTION}
        </p>
        <p className="mt-2 text-xs text-[#bca58f]">
          Zakres od {formatDate(data.dataSince)} · grupowanie tygodni według
          strefy {data.timezone}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
        <KpiCard label="Spotkania" value={data.kpis.meetings} />
        <KpiCard label="Wpisy Kroniki" value={data.kpis.plays} />
        <KpiCard label="Oceny" value={data.kpis.ratings} />
        <KpiCard label="Gry" value={data.kpis.games} />
        <KpiCard label="Renoma netto" value={data.kpis.renownNet} />
        <KpiCard label="Osiągnięcia" value={data.kpis.achievements} />
        <KpiCard label="Wypożyczenia" value={data.kpis.loans} />
        <KpiCard label="Zgłoszenia" value={data.kpis.feedback} />
      </div>

      <Section title="Aktywność w danych aplikacji">
        <WeeklyBusinessActivityChart points={data.weeklyActivity} />
        <p className="mt-4 text-xs leading-relaxed text-[#806452]">
          To liczba zapisanych rekordów biznesowych i osób powiązanych z nimi,
          nie liczba wizyt ani sesji w aplikacji. Wpisy Renomy wskazują
          beneficjenta nagrody, nie zawsze autora pierwotnej czynności.
        </p>
      </Section>

      <Section title="Aktywność graczy">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[76rem] text-left text-sm">
            <thead className="text-xs tracking-wide text-[#936344] uppercase">
              <tr>
                <th className="pb-3">Gracz</th>
                <th>Spotkania</th>
                <th>Propozycje</th>
                <th>Odpowiedzi</th>
                <th>Partie</th>
                <th>Wygrane</th>
                <th>Oceny</th>
                <th>Gry</th>
                <th>Renoma</th>
                <th>Osiągnięcia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#8d664d]/15">
              {data.playerActivity.length === 0 ? (
                <EmptyTableRow colSpan={10} />
              ) : null}
              {data.playerActivity.map((row) => (
                <tr key={row.userId}>
                  <td className="py-3 pr-5 font-semibold whitespace-nowrap">
                    {row.displayName}
                  </td>
                  <td>{row.meetingsCreated}</td>
                  <td>{row.proposals}</td>
                  <td>{row.responses}</td>
                  <td>{row.playParticipations}</td>
                  <td>{row.wins}</td>
                  <td>{row.ratings}</td>
                  <td>{row.gamesAdded}</td>
                  <td>{row.renownNet}</td>
                  <td>{row.achievements}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[#806452]">
          „Gry” wynikają z obecnego właściciela egzemplarza, który mógł zostać
          zmieniony administracyjnie.
        </p>
      </Section>

      <Section title="Najczęściej grane gry">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="text-xs tracking-wide text-[#936344] uppercase">
              <tr>
                <th className="pb-3">Gra</th>
                <th>Partie</th>
                <th>Gracze</th>
                <th>Średni czas</th>
                <th>Oceny</th>
                <th>Średnia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#8d664d]/15">
              {data.topGames.length === 0 ? (
                <EmptyTableRow colSpan={6} />
              ) : null}
              {data.topGames.map((row) => (
                <tr key={row.gameId}>
                  <td className="py-3 pr-5 font-semibold">{row.title}</td>
                  <td>{row.playsCount}</td>
                  <td>{row.uniquePlayers}</td>
                  <td>{formatDuration(row.averageDurationMinutes)}</td>
                  <td>{row.ratingsCount}</td>
                  <td>{formatRating(row.averageRating)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Historia Renomy">
          <div className="max-h-[28rem] overflow-auto pr-1">
            <table className="w-full text-left text-sm">
              <thead className="text-xs tracking-wide text-[#936344] uppercase">
                <tr>
                  <th className="pb-3">Źródło</th>
                  <th>Typ</th>
                  <th>Wpisy</th>
                  <th className="text-right">Renoma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#8d664d]/15">
                {data.renownBreakdown.length === 0 ? (
                  <EmptyTableRow colSpan={4} />
                ) : null}
                {data.renownBreakdown.map((row) => (
                  <tr key={row.actionType}>
                    <td className="py-2.5 pr-3 font-semibold capitalize">
                      {formatRenownAction(row.actionType)}
                    </td>
                    <td className="text-xs text-[#806452]">
                      {formatRenownSource(row.sourceType)}
                    </td>
                    <td>{row.eventsCount}</td>
                    <td className="text-right font-bold">
                      {row.pointsTotal > 0 ? "+" : ""}
                      {row.pointsTotal}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-[#74513d]">
            <div className="rounded-xl bg-[#6e4a35]/8 p-3">
              <dt>Korekty administratora</dt>
              <dd className="mt-1 font-bold">
                {data.renownAdjustments.adminCorrectionPoints}
              </dd>
            </div>
            <div className="rounded-xl bg-[#6e4a35]/8 p-3">
              <dt>Cofnięcia operacyjne</dt>
              <dd className="mt-1 font-bold">
                {data.renownAdjustments.businessReversalPoints}
              </dd>
            </div>
            <div className="col-span-2 rounded-xl bg-[#6e4a35]/8 p-3">
              <dt>Reconciliation / rebase</dt>
              <dd className="mt-1 font-bold">
                {data.renownAdjustments.rebaseRuns} uruchomień · zmiana
                raportowa {data.renownAdjustments.rebasePointsDelta} · wpisów{" "}
                {data.renownAdjustments.rebaseEventsWritten}
              </dd>
            </div>
          </dl>
        </Section>

        <Section title="Najczęściej zdobywane osiągnięcia">
          <div className="space-y-2">
            {data.topAchievements.length === 0 ? (
              <p className="text-sm text-[#806452]">
                Brak zdobytych osiągnięć.
              </p>
            ) : null}
            {data.topAchievements.map((row) => (
              <div
                key={row.achievementKey}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#8f6345]/16 bg-white/45 px-3 py-2.5"
              >
                <span>
                  <strong className="block text-sm text-[#57382a]">
                    {row.name}
                  </strong>
                  <span className="text-[0.68rem] tracking-wide text-[#956444] uppercase">
                    {row.rarity}
                  </span>
                </span>
                <span className="font-display text-xl font-bold text-[#6b432e]">
                  {row.awardedCount}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-[#806452]">
            Data przyznania osiągnięcia może być datą historycznego backfillu, a
            nie dniem faktycznego spełnienia warunku.
          </p>
        </Section>
      </div>

      <Section title="Zapisany stan RSVP i głosów">
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard
            label="RSVP · zapisane"
            value={data.responseState.rsvpTotal}
          />
          <KpiCard
            label="Gry · zapisane"
            value={data.responseState.gameResponsesTotal}
          />
          <KpiCard
            label="Kontynuacje · zapisane"
            value={data.responseState.continuationResponsesTotal}
          />
        </div>
        <div className="mt-3 grid gap-2 text-xs font-semibold text-[#74513d] sm:grid-cols-3">
          <p>{data.responseState.rsvpYes} odpowiedzi TAK</p>
          <p>{data.responseState.gameResponsesYes} odpowiedzi TAK</p>
          <p>{data.responseState.continuationResponsesYes} odpowiedzi TAK</p>
        </div>
        <p className="mt-4 rounded-xl border border-[#b67843]/20 bg-[#f3ddbe]/45 px-3 py-2 text-xs leading-relaxed text-[#74513d]">
          {HISTORICAL_RESPONSES_NOTE}
        </p>
      </Section>

      <footer className="rounded-2xl border border-[#d19b58]/20 bg-black/15 px-4 py-3 text-xs leading-relaxed text-[#d8c3ad]">
        Spotkania usunięte miękko są wyłączone z aktywnych agregatów
        spotkaniowych ({data.quality.excludedSoftDeletedMeetings} pominiętych).
        Daty Renomy mogą obejmować reconciliation, a daty osiągnięć — backfill.
        Ta sekcja świadomie nie odtwarza tras, kliknięć, Zleceń, logowań ani
        urządzeń.
      </footer>
    </section>
  );
}
