export function formatAnalyticsDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDaysSince(
  value: string | null,
  now = new Date(),
) {
  if (!value) return "Brak aktywności";
  const days = Math.max(
    0,
    Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000),
  );
  return days === 0 ? "Dzisiaj" : `${days} dni`;
}

export function calculateCompletionRate(completed: number, presented: number) {
  if (presented <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((completed / presented) * 100)));
}
