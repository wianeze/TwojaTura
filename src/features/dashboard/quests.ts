import { formatDashboardDateTime, sortDashboardQuests } from "./formatting.ts";
import type { DashboardQuest, DashboardQuestSource } from "./types";

const QUEST_PRIORITY = {
  missingPlay: 120,
  missingRsvp: 110,
  missingVote: 100,
  scheduleMeeting: 90,
  missingRating: 80,
  addGame: 70,
} as const;

const DAY_MS = 86_400_000;

export function buildDashboardQuests(source: DashboardQuestSource) {
  const quests: DashboardQuest[] = [];
  const futureMeetings = [...source.futureMeetings].sort(
    (left, right) =>
      new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );

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
      optionalPoints: 10,
      reward: {
        immediatePoints: 10,
        immediateLabel: "teraz",
        followUpPoints: 30,
        followUpLabel: "po udziale",
        totalPreviewPoints: 40,
        rewardTone: "split",
      },
      priority: QUEST_PRIORITY.missingRsvp,
      createdAt: meeting.startsAt,
    });
  }

  for (const meeting of futureMeetings.filter((item) => !item.hasOwnVote)) {
    quests.push({
      id: `missing-vote:${meeting.id}`,
      type: "question",
      tone: "action",
      title: "W co chcesz zagrać?",
      description: `${meeting.title} · ${formatDashboardDateTime(meeting.startsAt)}`,
      href: `/kalendarium/${meeting.id}`,
      ctaLabel: "Zagłosuj",
      optionalPoints: 10,
      reward: {
        immediatePoints: 10,
        immediateLabel: "teraz",
        followUpPoints: 10,
        followUpLabel: "jeśli trafi na stół",
        totalPreviewPoints: 20,
        rewardTone: "split",
      },
      priority: QUEST_PRIORITY.missingVote,
      createdAt: meeting.startsAt,
    });
  }

  for (const play of source.unratedGames) {
    quests.push({
      id: `rate-game:${play.playId}:${play.gameId}`,
      type: "question",
      tone: "action",
      title: "Oceń ostatnio rozegraną grę",
      description: play.gameTitle,
      href: `/gry/${play.gameId}`,
      ctaLabel: "Dodaj opinię",
      optionalPoints: 30,
      reward: {
        immediatePoints: 30,
        immediateLabel: "za opinię",
        totalPreviewPoints: 30,
        rewardTone: "immediate",
      },
      priority: QUEST_PRIORITY.missingRating,
      createdAt: play.playedAt,
    });
  }

  for (const meeting of source.finishedMeetingsWithoutPlay) {
    quests.push({
      id: `missing-play:${meeting.id}`,
      type: "action",
      tone: "action",
      title: "Uzupełnij wynik spotkania",
      description: meeting.title,
      href: `/kronika/nowa?meeting=${meeting.id}`,
      ctaLabel: "Zapisz wynik gry",
      optionalPoints: 40,
      reward: {
        immediatePoints: 40,
        immediateLabel: "za Kronikę",
        totalPreviewPoints: 40,
        rewardTone: "immediate",
      },
      priority: QUEST_PRIORITY.missingPlay,
      createdAt: meeting.endsAt,
    });
  }

  if (source.ownGamesCount === 0) {
    quests.push({
      id: "add-game",
      type: "action",
      tone: "success",
      title: "Dodaj grę do Półki",
      description: "Niech grupa wie, co możesz przynieść na stół.",
      href: "/gry/nowa",
      ctaLabel: "Dodaj grę do Półki",
      optionalPoints: 40,
      reward: {
        immediatePoints: 40,
        immediateLabel: "pierwsza gra",
        totalPreviewPoints: 40,
        rewardTone: "immediate",
      },
      priority: QUEST_PRIORITY.addGame,
    });
  }

  const nearestMeeting = futureMeetings[0] ?? null;
  const hasFarAwayMeeting =
    nearestMeeting &&
    new Date(nearestMeeting.startsAt).getTime() - source.now.getTime() >
      21 * DAY_MS;

  if (!nearestMeeting || hasFarAwayMeeting) {
    quests.push({
      id: "schedule-meeting",
      type: "action",
      tone: "success",
      title: "Zaproponuj spotkanie",
      description: "Zwołaj ekipę na kolejny wieczór.",
      href: "/kalendarium/nowe",
      ctaLabel: "Zorganizuj spotkanie",
      optionalPoints: 25,
      reward: {
        immediatePoints: 25,
        immediateLabel: "teraz",
        followUpPoints: 25,
        followUpLabel: "po spotkaniu",
        totalPreviewPoints: 50,
        rewardTone: "split",
      },
      priority: QUEST_PRIORITY.scheduleMeeting,
    });
  }

  return sortDashboardQuests(quests);
}
