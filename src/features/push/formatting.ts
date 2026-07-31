import type { AdminPushCampaignRow, PushPermissionState } from "./types";

const dateTimeFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
});

const meetingDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
});

export function formatPushDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return dateTimeFormatter.format(date);
}

export function formatPushMeetingOption(
  title: string,
  startsAt: string,
): string {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return title;

  return `${title} — ${meetingDateFormatter.format(date)}`;
}

export const PUSH_CAMPAIGN_KIND_LABELS: Record<
  AdminPushCampaignRow["kind"],
  string
> = {
  meeting_created: "Nowe spotkanie",
  admin_manual: "Ręczna",
};

export const PUSH_PERMISSION_STATE_LABELS: Record<PushPermissionState, string> =
  {
    unsupported: "Przeglądarka nieobsługiwana",
    "ios-needs-install": "Wymaga dodania do ekranu głównego",
    denied: "Zgoda odrzucona",
    enabled: "Powiadomienia włączone",
    disabled: "Powiadomienia wyłączone",
  };

/**
 * Zdanie w potwierdzeniu przed wysłaniem. Liczba użytkowników i liczba
 * urządzeń są raportowane osobno, bo jedna osoba może mieć kilka urządzeń.
 */
export function formatPushAudienceSentence(
  userCount: number,
  subscriptionCount: number,
): string {
  return `Wyślesz powiadomienie do ${userCount} ${pluralizeUsers(userCount)} na ${subscriptionCount} ${pluralizeDevices(subscriptionCount)}.`;
}

function pluralizeUsers(count: number): string {
  if (count === 1) return "użytkownika";
  return "użytkowników";
}

function pluralizeDevices(count: number): string {
  if (count === 1) return "urządzeniu";
  return "urządzeniach";
}
