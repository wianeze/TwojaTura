import { getWinnerSummary } from "../plays/formatting.ts";
import type { PlayMember } from "../plays/types";
import type {
  DashboardHeroSummary,
  DashboardLeaderboardEntry,
  DashboardLeaderboardPreview,
  DashboardPointsSummary,
  DashboardQuest,
  DashboardRecentPlayPreview,
  DashboardUpcomingMeeting,
} from "./types";

const compactDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Warsaw",
});

const compactTimeFormatter = new Intl.DateTimeFormat("pl-PL", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Warsaw",
});

function pluralizeQuests(count: number) {
  if (count === 1) return "zlecenie czeka";
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return "zlecenia czekają";
  }

  return "zleceń czeka";
}

export function formatDashboardDate(iso: string) {
  return compactDateFormatter.format(new Date(iso));
}

export function formatDashboardTime(iso: string) {
  return compactTimeFormatter.format(new Date(iso));
}

export function formatDashboardDateTime(iso: string) {
  return `${formatDashboardDate(iso)} • ${formatDashboardTime(iso)}`;
}

export function getConfirmedMeetingAlert(
  meeting: Pick<
    DashboardUpcomingMeeting,
    "status" | "startsAt" | "leadingGame"
  >,
) {
  if (meeting.status !== "confirmed") return null;

  const leadingGame = meeting.leadingGame
    ? ` · prowadzi ${meeting.leadingGame.title}`
    : "";

  return `Spotkanie potwierdzone · ${formatDashboardDateTime(meeting.startsAt)}${leadingGame}`;
}

export function formatDashboardQuestDateTime(iso: string) {
  return `${formatDashboardDate(iso)} · ${formatDashboardTime(iso)}`;
}

/**
 * Podgląd nagrody na karcie Zlecenia. `null` dla czynności, które nie dają
 * Renomy — wtedy karta nie pokazuje nagrody w ogóle.
 */
export function formatQuestRenownPreview(
  quest: Pick<DashboardQuest, "renownPoints">,
) {
  if (!quest.renownPoints) return null;

  return `+${quest.renownPoints} Renomy`;
}

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

export function isDashboardQuestActive(
  quest: Pick<DashboardQuest, "expiresAt">,
  now = new Date(),
) {
  return !quest.expiresAt || new Date(quest.expiresAt).getTime() > now.getTime();
}

/**
 * Spokojny, minutowy opis terminu Zlecenia. Nie jest countdownem i nie
 * pokazuje sekund; po terminie zwraca null, bo taka karta nie powinna już
 * trafić do renderu.
 */
export function formatQuestExpiryLabel(
  expiresAt: string | undefined,
  now = new Date(),
) {
  if (!expiresAt) return null;

  const remainingMs = new Date(expiresAt).getTime() - now.getTime();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null;

  if (remainingMs > 48 * HOUR_MS) {
    return `Przepada za ${Math.ceil(remainingMs / (24 * HOUR_MS))} dni`;
  }

  if (remainingMs >= 24 * HOUR_MS) return "Przepada jutro";

  if (remainingMs >= 3 * HOUR_MS) {
    return `Przepada za ${Math.ceil(remainingMs / HOUR_MS)}h`;
  }

  const totalMinutes = Math.ceil(remainingMs / MINUTE_MS);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [hours > 0 ? `${hours}h` : null, minutes > 0 ? `${minutes}m` : null]
    .filter(Boolean)
    .join(" ");

  return `Ostatnie ${parts}`;
}

export function isQuestExpiryUrgent(
  expiresAt: string | undefined,
  now = new Date(),
) {
  if (!expiresAt) return false;
  const remainingMs = new Date(expiresAt).getTime() - now.getTime();
  return remainingMs > 0 && remainingMs < 3 * HOUR_MS;
}

/**
 * Kolejność sekcji „Zlecenia”:
 *   P1 blokujące — najstarsze pierwsze, bo najdłużej blokują historię grupy,
 *   P2 z deadline'em — najbliższy termin na górze,
 *   P3 housekeeping — najświeższe pierwsze.
 */
export function sortDashboardQuests(quests: DashboardQuest[]) {
  return [...quests].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;

    if (left.priority <= 2) {
      const leftDeadline = left.deadlineAt
        ? new Date(left.deadlineAt).getTime()
        : leftTime;
      const rightDeadline = right.deadlineAt
        ? new Date(right.deadlineAt).getTime()
        : rightTime;

      if (leftDeadline !== rightDeadline) {
        return leftDeadline - rightDeadline;
      }

      return left.id.localeCompare(right.id);
    }

    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return left.id.localeCompare(right.id);
  });
}

export function sumQuestRenownPoints(quests: DashboardQuest[]) {
  return quests.reduce((sum, quest) => sum + (quest.renownPoints ?? 0), 0);
}

export function buildDashboardPointsSummary(
  currentPoints: number,
  quests: DashboardQuest[],
): DashboardPointsSummary {
  return {
    currentPoints,
    availablePoints: sumQuestRenownPoints(quests),
  };
}

export function buildDashboardHeroSummary(input: {
  memberName: string;
  quests: DashboardQuest[];
  hasFutureMeeting: boolean;
}): DashboardHeroSummary {
  const questCount = input.quests.length;
  const availablePoints = sumQuestRenownPoints(input.quests);

  if (questCount === 0) {
    return {
      title: "Stół czysty",
      subtitle: "Nie masz teraz żadnych zleceń.",
      emptyCtaHref: input.hasFutureMeeting ? "/gry/nowa" : "/kalendarium/nowe",
      emptyCtaLabel: input.hasFutureMeeting
        ? "Dodaj grę do Półki"
        : "Zorganizuj spotkanie",
      questCount,
      availablePoints,
    };
  }

  const renownLabel =
    availablePoints > 0 ? ` · ${availablePoints} Renomy do wzięcia` : "";

  return {
    title: `Witaj przy stole, ${input.memberName}`,
    subtitle: `${questCount} ${pluralizeQuests(questCount)}${renownLabel}`,
    emptyCtaHref: "/kalendarium/nowe",
    emptyCtaLabel: "Zorganizuj spotkanie",
    questCount,
    availablePoints,
  };
}

/**
 * „Następne spotkanie” w dotychczasowym rozumieniu: takie, które jeszcze się
 * nie zaczęło.
 *
 * `excludeMeetingId` wyłącza z tej listy wieczór, który właśnie zajmuje sekcję
 * Stołu (patrz pickTableSession). Bez tego to samo spotkanie mogłoby pojawić
 * się na Stole dwa razy — raz jako trwająca sesja, raz jako „najbliższe”.
 */
export function pickUpcomingMeeting(
  meetings: DashboardUpcomingMeeting[],
  now = new Date(),
  options: { excludeMeetingId?: string | null } = {},
) {
  const futureMeetings = meetings.filter(
    (meeting) =>
      meeting.id !== options.excludeMeetingId &&
      new Date(meeting.startsAt).getTime() > now.getTime(),
  );

  const nearestConfirmed = futureMeetings
    .filter((meeting) => meeting.status === "confirmed")
    .sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    )[0];

  if (nearestConfirmed) return nearestConfirmed;

  return (
    futureMeetings.sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    )[0] ?? null
  );
}

/**
 * Czy „teraz” mieści się w zaplanowanym oknie spotkania.
 *
 * Zastąpiło dawne pickActiveMeeting: wybór wieczoru zajmującego sekcję Stołu
 * robi dziś pickTableSession (features/meetings/live-play.ts), bo musi brać pod
 * uwagę także biegnącą partię i okno tolerancji po zaplanowanym końcu. Tutaj
 * został sam predykat czasowy — używany do rozróżnienia „TRWA TERAZ” od
 * „gramy po godzinach”.
 */
export function isWithinMeetingWindow(
  meeting: Pick<DashboardUpcomingMeeting, "startsAt" | "endsAt">,
  now = new Date(),
) {
  const nowTime = now.getTime();
  const startsAt = new Date(meeting.startsAt).getTime();
  const endsAt = new Date(meeting.endsAt).getTime();

  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) return false;

  return startsAt <= nowTime && nowTime < endsAt;
}

export function buildLeaderboardPreview(input: {
  currentPoints: number;
  entries: DashboardLeaderboardEntry[];
  currentUserId: string;
}): DashboardLeaderboardPreview {
  const sorted = [...input.entries].sort(
    (left, right) => left.rank - right.rank,
  );
  const viewer =
    sorted.find((entry) => entry.userId === input.currentUserId) ?? null;

  return {
    currentPoints: input.currentPoints,
    entries: sorted.slice(0, 5),
    viewerRank: viewer?.rank ?? null,
  };
}

export function buildRecentPlayPreviews(
  items: DashboardRecentPlayPreview[],
  limit = 5,
) {
  return [...items]
    .sort(
      (left, right) =>
        new Date(right.playedAt).getTime() - new Date(left.playedAt).getTime(),
    )
    .slice(0, limit);
}

export function formatDashboardWinnerSummary(winners: PlayMember[]) {
  return getWinnerSummary(winners);
}
