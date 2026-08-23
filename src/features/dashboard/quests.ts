import {
  formatDashboardDateTime,
  isDashboardQuestActive,
  sortDashboardQuests,
} from "./formatting.ts";
import type { DashboardQuest, DashboardQuestSource } from "./types";

/**
 * Konfiguracja sekcji „Zlecenia”.
 *
 * Zlecenia to przypomnienia operacyjne, które trzymają dane grupy w porządku.
 * To NIE są Misje — faktyczne wyzwania gameplayowe będą osobną warstwą z
 * własnymi nagrodami i na razie ich nie ma.
 *
 * Grupa gra około raz w miesiącu, więc lista musi znosić długie przerwy:
 * krótka, uporządkowana priorytetami i wygasająca sama z siebie.
 */
export const OPERATIONAL_TASK_POLICY = {
  /** Ile pozycji pokazujemy na Stole. Reszta czeka na swoją kolej. */
  maxVisibleTasks: 3,
  /** Brakujący wpis Kroniki przepada 72 godziny po spotkaniu. */
  chronicleEntryHours: 72,
  /** Ocena i rozliczenie partii pozostają Zleceniem przez 7 dni. */
  postPlayDays: 7,
} as const;

/**
 * P1 — blokuje dane grupy: bez tego historia wieczoru nie powstanie.
 * P2 — ma realny deadline: im bliżej spotkania, tym wyżej.
 * P3 — housekeeping: warto, ale nic nie blokuje.
 */
export const TASK_PRIORITY = {
  blocking: 1,
  deadline: 2,
  housekeeping: 3,
} as const;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

function addMilliseconds(iso: string, milliseconds: number) {
  return new Date(new Date(iso).getTime() + milliseconds).toISOString();
}

/**
 * Kalendarz pozostaje widoczny dla grupy, ale Zlecenia konkretnego spotkania
 * dostaje tylko jego organizator i osoby zaproszone.
 */
export function filterDashboardQuestSourceForMeetingEligibility(
  source: DashboardQuestSource,
  eligibleMeetingIds: ReadonlySet<string>,
): DashboardQuestSource {
  return {
    ...source,
    futureMeetings: source.futureMeetings.filter((meeting) =>
      eligibleMeetingIds.has(meeting.id),
    ),
    unratedGames: source.unratedGames.filter(
      (play) => !play.meetingId || eligibleMeetingIds.has(play.meetingId),
    ),
    finishedMeetingsWithoutPlay: source.finishedMeetingsWithoutPlay.filter(
      (meeting) => eligibleMeetingIds.has(meeting.id),
    ),
  };
}

/**
 * Buduje pełną listę aktualnych Zleceń.
 *
 * Nagrody podane w `renownPoints` to DOKŁADNIE tyle Renomy, ile naliczy baza
 * po wykonaniu czynności (`private.point_reward_for`). Zlecenia, które same z
 * siebie nie dają Renomy, nie mają tego pola — karta nie pokazuje wtedy żadnej
 * nagrody, zamiast obiecywać punkty „potem”.
 */
export function buildDashboardQuests(source: DashboardQuestSource) {
  const quests: DashboardQuest[] = [];
  const futureMeetings = source.futureMeetings
    .filter(
      (meeting) => new Date(meeting.startsAt).getTime() > source.now.getTime(),
    )
    .sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    );

  // --- P1: wynik spotkania, którego nikt nie zapisał ------------------------
  // Bez wpisu w Kronice wieczór nie istnieje: nie ma partii, nie ma Renomy za
  // udział dla nikogo przy stole i nie przeliczą się odznaki.
  for (const meeting of source.finishedMeetingsWithoutPlay) {
    const meetingEnd = meeting.endsAt ?? meeting.startsAt;
    const expiresAt = addMilliseconds(
      meetingEnd,
      OPERATIONAL_TASK_POLICY.chronicleEntryHours * HOUR_MS,
    );

    if (new Date(meetingEnd).getTime() > source.now.getTime()) continue;

    quests.push({
      id: `missing-play:${meeting.id}`,
      type: "action",
      tone: "action",
      title: "Uzupełnij wynik spotkania",
      description: meeting.title,
      href: `/kronika/nowa?meeting=${meeting.id}`,
      ctaLabel: "Zapisz wynik gry",
      // Renomę za partię dostaje każdy jej uczestnik, więc autor wpisu też —
      // ale jako gracz, nie za samą operację w UI.
      renownPoints: 5,
      priority: TASK_PRIORITY.blocking,
      deadlineAt: expiresAt,
      expiresAt,
      createdAt: meetingEnd,
    });
  }

  // --- P2: odpowiedź na spotkanie ------------------------------------------
  // Znika sama, gdy spotkanie się zacznie: futureMeetings trzyma wyłącznie
  // spotkania jeszcze nierozpoczęte.
  for (const meeting of futureMeetings.filter(
    (item) => item.ownResponse === null,
  )) {
    quests.push({
      id: `missing-rsvp:${meeting.id}`,
      type: "question",
      tone: "decision",
      title: "Będziesz na spotkaniu?",
      description: `${meeting.title} · ${formatDashboardDateTime(meeting.startsAt)}`,
      href: `/kalendarium/${meeting.id}`,
      ctaLabel: "Odpowiedz",
      // Także odpowiedź odmowna: „nie będę” jest organizacyjnie tak samo
      // przydatne jak „będę”.
      renownPoints: 2,
      priority: TASK_PRIORITY.deadline,
      deadlineAt: meeting.startsAt,
      expiresAt: meeting.startsAt,
      createdAt: meeting.startsAt,
    });
  }

  // --- P2: głos na grę -----------------------------------------------------
  for (const meeting of futureMeetings.filter(
    (item) => item.ownResponse === true && !item.hasOwnVote,
  )) {
    quests.push({
      id: `missing-vote:${meeting.id}`,
      type: "question",
      tone: "action",
      title: "W co chcesz zagrać?",
      description: `${meeting.title} · ${formatDashboardDateTime(meeting.startsAt)}`,
      href: `/kalendarium/${meeting.id}`,
      ctaLabel: "Odpowiedz",
      renownPoints: 1,
      priority: TASK_PRIORITY.deadline,
      deadlineAt: meeting.startsAt,
      expiresAt: meeting.startsAt,
      createdAt: meeting.startsAt,
    });
  }

  // --- P3: ocena rozegranej gry --------------------------------------------
  // Przypomnienie wygasa po 7 dniach od partii. Ocenić grę można nadal —
  // w Półce, kiedy tylko przyjdzie ochota.
  for (const play of source.unratedGames) {
    if (new Date(play.playedAt).getTime() > source.now.getTime()) continue;
    const expiresAt = addMilliseconds(
      play.playedAt,
      OPERATIONAL_TASK_POLICY.postPlayDays * DAY_MS,
    );

    quests.push({
      id: `rate-game:${play.playId}:${play.gameId}`,
      type: "question",
      tone: "action",
      title: "Oceń ostatnio rozegraną grę",
      description: play.gameTitle,
      href: `/gry/${play.gameId}`,
      ctaLabel: "Dodaj opinię",
      renownPoints: 3,
      priority: TASK_PRIORITY.housekeeping,
      expiresAt,
      createdAt: play.playedAt,
    });
  }

  // --- P3: zwołanie ekipy --------------------------------------------------
  // Pokazujemy WYŁĄCZNIE wtedy, gdy w kalendarzu nie ma żadnego przyszłego
  // spotkania. Poprzedni próg „dalej niż 21 dni” tworzył kartę mimo
  // zaplanowanego wieczoru, co przy rytmie jednego spotkania na miesiąc było
  // po prostu nieprawdą.
  //
  // Bez `renownPoints`: samo utworzenie spotkania nie daje już Renomy —
  // organizator dostaje 5 dopiero za spotkanie, które faktycznie się odbyło.
  if (futureMeetings.length === 0) {
    quests.push({
      id: "schedule-meeting",
      type: "action",
      tone: "success",
      title: "Zaproponuj spotkanie",
      description: "Zwołaj ekipę na kolejny wieczór.",
      href: "/kalendarium/nowe",
      ctaLabel: "Zorganizuj spotkanie",
      priority: TASK_PRIORITY.housekeeping,
    });
  }

  return sortDashboardQuests(
    quests.filter((quest) => isDashboardQuestActive(quest, source.now)),
  );
}

/**
 * Lista pokazywana na Stole. Pełny wynik `buildDashboardQuests` bywa dłuższy
 * (trzy spotkania i cztery nieocenione gry to już siedem kart) — Stół ma być
 * podpowiedzią, nie skrzynką odbiorczą.
 */
export function pickVisibleDashboardQuests(
  quests: DashboardQuest[],
  now = new Date(),
) {
  return quests
    .filter((quest) => isDashboardQuestActive(quest, now))
    .slice(0, OPERATIONAL_TASK_POLICY.maxVisibleTasks);
}
