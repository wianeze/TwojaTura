import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDashboardHeroSummary,
  buildDashboardPointsSummary,
  buildRecentPlayPreviews,
  formatQuestRewardPreview,
  formatDashboardWinnerSummary,
  pickUpcomingMeeting,
  sortDashboardQuests,
  sumQuestFollowUpPoints,
  sumQuestImmediatePoints,
  sumQuestOptionalPoints,
} from "../../src/features/dashboard/formatting.ts";
import { buildDashboardQuests } from "../../src/features/dashboard/quests.ts";
import type {
  DashboardQuest,
  DashboardQuestSource,
  DashboardUpcomingMeeting,
} from "../../src/features/dashboard/types.ts";

function buildSource(
  overrides: Partial<DashboardQuestSource> = {},
): DashboardQuestSource {
  return {
    futureMeetings: [],
    unratedGames: [],
    finishedMeetingsWithoutPlay: [],
    ownGamesCount: 2,
    totalActiveGames: 8,
    now: new Date("2026-07-13T10:00:00.000Z"),
    ...overrides,
  };
}

function buildUpcomingMeeting(
  overrides: Partial<DashboardUpcomingMeeting> = {},
): DashboardUpcomingMeeting {
  return {
    id: "meeting-1",
    title: "Strategiczna sobota",
    location: "Chata",
    startsAt: "2026-07-20T16:00:00.000Z",
    endsAt: "2026-07-20T21:00:00.000Z",
    status: "planned",
    ownResponse: null,
    confirmedAttendeesCount: 3,
    visualLabel: "Do decyzji",
    visualState: "decision-required",
    needsAction: true,
    href: "/kalendarium/meeting-1",
    leadingGame: null,
    ...overrides,
  };
}

function buildQuest(overrides: Partial<DashboardQuest> = {}): DashboardQuest {
  return {
    id: "quest-1",
    type: "action",
    title: "Quest",
    href: "/",
    ctaLabel: "Idź",
    priority: 1,
    optionalPoints: 10,
    reward: {
      immediatePoints: 10,
      immediateLabel: "teraz",
      totalPreviewPoints: 10,
    },
    ...overrides,
  };
}

test("RSVP quest gets +10 now and +30 after attendance", () => {
  const quests = buildDashboardQuests(
    buildSource({
      futureMeetings: [
        {
          id: "meeting-1",
          title: "Strategiczna sobota",
          startsAt: "2026-07-20T16:00:00.000Z",
          endsAt: "2026-07-20T20:00:00.000Z",
          status: "planned",
          ownResponse: null,
          hasOwnVote: true,
        },
      ],
    }),
  );

  const quest = quests.find((item) => item.id === "missing-rsvp:meeting-1");
  assert.ok(quest);
  assert.equal(quest.reward.immediatePoints, 10);
  assert.equal(quest.reward.immediateLabel, "teraz");
  assert.equal(quest.reward.followUpPoints, 30);
  assert.equal(quest.reward.followUpLabel, "po udziale");
  assert.equal(quest.optionalPoints, 10);
});

test("vote quest gets +10 now and +10 if the voted game reaches the table", () => {
  const quests = buildDashboardQuests(
    buildSource({
      futureMeetings: [
        {
          id: "meeting-1",
          title: "Strategiczna sobota",
          startsAt: "2026-07-20T16:00:00.000Z",
          endsAt: "2026-07-20T20:00:00.000Z",
          status: "planned",
          ownResponse: true,
          hasOwnVote: false,
        },
      ],
    }),
  );

  const quest = quests.find((item) => item.id === "missing-vote:meeting-1");
  assert.ok(quest);
  assert.equal(quest.reward.immediatePoints, 10);
  assert.equal(quest.reward.followUpPoints, 10);
  assert.equal(quest.reward.followUpLabel, "jeśli trafi na stół");
  assert.equal(quest.optionalPoints, 10);
});

test("meeting proposal quest gets +25 now and +25 after the meeting happens", () => {
  const quests = buildDashboardQuests(buildSource());
  const quest = quests.find((item) => item.id === "schedule-meeting");

  assert.ok(quest);
  assert.equal(quest.reward.immediatePoints, 25);
  assert.equal(quest.reward.followUpPoints, 25);
  assert.equal(quest.reward.followUpLabel, "po spotkaniu");
});

test("chronicle quest gets +40 and the highest priority", () => {
  const quests = buildDashboardQuests(
    buildSource({
      finishedMeetingsWithoutPlay: [
        {
          id: "meeting-1",
          title: "Wieczór bez wpisu",
          endsAt: "2026-07-12T21:00:00.000Z",
          status: "confirmed",
        },
      ],
    }),
  );

  const quest = quests.find((item) => item.id === "missing-play:meeting-1");
  assert.ok(quest);
  assert.equal(quest.reward.immediatePoints, 40);
  assert.equal(quest.reward.immediateLabel, "za Kronikę");
  assert.equal(quest.priority, 120);
});

test("rating quest gets +30 for the opinion", () => {
  const quests = buildDashboardQuests(
    buildSource({
      unratedGames: [
        {
          playId: "play-1",
          gameId: "game-1",
          gameTitle: "Nemesis",
          playedAt: "2026-07-10T18:00:00.000Z",
        },
      ],
    }),
  );

  const quest = quests.find((item) => item.id === "rate-game:play-1:game-1");
  assert.ok(quest);
  assert.equal(quest.reward.immediatePoints, 30);
  assert.equal(quest.reward.immediateLabel, "za opinię");
});

test("add game quest is onboarding-only and appears only for the first owned game", () => {
  const firstGameQuests = buildDashboardQuests(
    buildSource({
      ownGamesCount: 0,
    }),
  );
  const laterQuests = buildDashboardQuests(
    buildSource({
      ownGamesCount: 1,
    }),
  );

  const firstGameQuest = firstGameQuests.find((item) => item.id === "add-game");
  assert.ok(firstGameQuest);
  assert.equal(firstGameQuest.reward.immediatePoints, 40);
  assert.equal(firstGameQuest.reward.immediateLabel, "pierwsza gra");
  assert.equal(
    laterQuests.some((item) => item.id === "add-game"),
    false,
  );
});

test("quest priorities follow the new Stage 7 order", () => {
  const quests = buildDashboardQuests(
    buildSource({
      futureMeetings: [
        {
          id: "meeting-rsvp",
          title: "RSVP",
          startsAt: "2026-08-20T16:00:00.000Z",
          endsAt: "2026-08-20T20:00:00.000Z",
          status: "planned",
          ownResponse: null,
          hasOwnVote: true,
        },
        {
          id: "meeting-vote",
          title: "Vote",
          startsAt: "2026-08-21T16:00:00.000Z",
          endsAt: "2026-08-21T20:00:00.000Z",
          status: "planned",
          ownResponse: true,
          hasOwnVote: false,
        },
      ],
      finishedMeetingsWithoutPlay: [
        {
          id: "meeting-play",
          title: "Brak wpisu",
          endsAt: "2026-07-19T21:00:00.000Z",
          status: "confirmed",
        },
      ],
      unratedGames: [
        {
          playId: "play-1",
          gameId: "game-1",
          gameTitle: "Nemesis",
          playedAt: "2026-07-10T18:00:00.000Z",
        },
      ],
      ownGamesCount: 0,
    }),
  );

  assert.deepEqual(
    quests.map((quest) => quest.id),
    [
      "missing-play:meeting-play",
      "missing-rsvp:meeting-rsvp",
      "missing-vote:meeting-vote",
      "schedule-meeting",
      "rate-game:play-1:game-1",
      "add-game",
    ],
  );
});

test("meeting quests keep unique ids per meeting", () => {
  const quests = buildDashboardQuests(
    buildSource({
      futureMeetings: [
        {
          id: "meeting-a",
          title: "A",
          startsAt: "2026-07-20T16:00:00.000Z",
          endsAt: "2026-07-20T20:00:00.000Z",
          status: "planned",
          ownResponse: null,
          hasOwnVote: true,
        },
        {
          id: "meeting-b",
          title: "B",
          startsAt: "2026-07-21T16:00:00.000Z",
          endsAt: "2026-07-21T20:00:00.000Z",
          status: "planned",
          ownResponse: true,
          hasOwnVote: false,
        },
      ],
    }),
  );

  assert.ok(quests.some((quest) => quest.id === "missing-rsvp:meeting-a"));
  assert.ok(quests.some((quest) => quest.id === "missing-vote:meeting-b"));
});

test("RSVP quests cover future meetings in July, August and September", () => {
  const quests = buildDashboardQuests(
    buildSource({
      futureMeetings: [
        {
          id: "july-meeting",
          title: "Lipiec",
          startsAt: "2026-07-20T16:00:00.000Z",
          endsAt: "2026-07-20T20:00:00.000Z",
          status: "planned",
          ownResponse: null,
          hasOwnVote: true,
        },
        {
          id: "august-meeting",
          title: "Sierpień",
          startsAt: "2026-08-20T16:00:00.000Z",
          endsAt: "2026-08-20T20:00:00.000Z",
          status: "confirmed",
          ownResponse: null,
          hasOwnVote: true,
        },
        {
          id: "september-meeting",
          title: "Wrzesień",
          startsAt: "2026-09-20T16:00:00.000Z",
          endsAt: "2026-09-20T20:00:00.000Z",
          status: "planned",
          ownResponse: null,
          hasOwnVote: true,
        },
      ],
    }),
  );

  assert.deepEqual(
    quests
      .filter((quest) => quest.id.startsWith("missing-rsvp:"))
      .map((quest) => quest.id),
    [
      "missing-rsvp:july-meeting",
      "missing-rsvp:august-meeting",
      "missing-rsvp:september-meeting",
    ],
  );
});

test("missing vote is created for a future meeting outside the current month", () => {
  const quests = buildDashboardQuests(
    buildSource({
      futureMeetings: [
        {
          id: "august-vote",
          title: "Sierpniowe granie",
          startsAt: "2026-08-28T16:00:00.000Z",
          endsAt: "2026-08-28T20:00:00.000Z",
          status: "confirmed",
          ownResponse: null,
          hasOwnVote: false,
        },
      ],
    }),
  );

  assert.ok(quests.some((quest) => quest.id === "missing-vote:august-vote"));
  assert.ok(quests.some((quest) => quest.id === "missing-rsvp:august-vote"));
});

test("dashboard totals include every visible future meeting quest", () => {
  const quests = buildDashboardQuests(
    buildSource({
      futureMeetings: [
        {
          id: "july-rsvp",
          title: "Lipiec",
          startsAt: "2026-07-20T16:00:00.000Z",
          endsAt: "2026-07-20T20:00:00.000Z",
          status: "planned",
          ownResponse: null,
          hasOwnVote: true,
        },
        {
          id: "august-rsvp",
          title: "Sierpień",
          startsAt: "2026-08-20T16:00:00.000Z",
          endsAt: "2026-08-20T20:00:00.000Z",
          status: "confirmed",
          ownResponse: null,
          hasOwnVote: true,
        },
        {
          id: "september-rsvp",
          title: "Wrzesień",
          startsAt: "2026-09-20T16:00:00.000Z",
          endsAt: "2026-09-20T20:00:00.000Z",
          status: "planned",
          ownResponse: null,
          hasOwnVote: true,
        },
      ],
    }),
  );

  const summary = buildDashboardHeroSummary({
    memberName: "Marta",
    quests,
    hasFutureMeeting: true,
  });

  assert.equal(summary.questCount, 3);
  assert.equal(summary.availablePoints, 30);
  assert.equal(summary.followUpPoints, 90);
});

test("chronicle and meeting quests stay visible without slicing low-priority items over them", () => {
  const quests = buildDashboardQuests(
    buildSource({
      futureMeetings: [
        {
          id: "m1",
          title: "A",
          startsAt: "2026-07-14T16:00:00.000Z",
          endsAt: "2026-07-14T20:00:00.000Z",
          status: "planned",
          ownResponse: null,
          hasOwnVote: true,
        },
        {
          id: "m2",
          title: "B",
          startsAt: "2026-07-15T16:00:00.000Z",
          endsAt: "2026-07-15T20:00:00.000Z",
          status: "planned",
          ownResponse: null,
          hasOwnVote: true,
        },
        {
          id: "m3",
          title: "C",
          startsAt: "2026-07-16T16:00:00.000Z",
          endsAt: "2026-07-16T20:00:00.000Z",
          status: "planned",
          ownResponse: true,
          hasOwnVote: false,
        },
      ],
      finishedMeetingsWithoutPlay: [
        {
          id: "f1",
          title: "Brak wpisu",
          endsAt: "2026-07-12T21:00:00.000Z",
          status: "confirmed",
        },
      ],
      unratedGames: [
        {
          playId: "p1",
          gameId: "g1",
          gameTitle: "Nemesis",
          playedAt: "2026-07-12T10:00:00.000Z",
        },
        {
          playId: "p2",
          gameId: "g2",
          gameTitle: "Frostpunk",
          playedAt: "2026-07-11T10:00:00.000Z",
        },
      ],
      ownGamesCount: 0,
    }),
  );

  assert.ok(quests.some((quest) => quest.id === "missing-play:f1"));
  assert.ok(quests.some((quest) => quest.id === "missing-rsvp:m1"));
  assert.ok(quests.some((quest) => quest.id === "missing-rsvp:m2"));
  assert.ok(quests.some((quest) => quest.id === "missing-vote:m3"));
  assert.equal(quests.length, 7);
});

test("sortDashboardQuests sorts meeting quests by starts_at ascending", () => {
  const quests: DashboardQuest[] = [
    buildQuest({
      id: "missing-vote:meeting-late",
      priority: 100,
      createdAt: "2026-07-22T10:00:00.000Z",
    }),
    buildQuest({
      id: "missing-vote:meeting-early",
      priority: 100,
      createdAt: "2026-07-20T10:00:00.000Z",
    }),
    buildQuest({
      id: "missing-rsvp:meeting-rsvp-late",
      priority: 110,
      createdAt: "2026-07-21T10:00:00.000Z",
    }),
    buildQuest({
      id: "missing-rsvp:meeting-rsvp-early",
      priority: 110,
      createdAt: "2026-07-19T10:00:00.000Z",
    }),
    buildQuest({
      id: "missing-play:meeting-play",
      priority: 120,
      createdAt: "2026-07-18T10:00:00.000Z",
    }),
  ];

  assert.deepEqual(
    sortDashboardQuests(quests).map((quest) => quest.id),
    [
      "missing-play:meeting-play",
      "missing-rsvp:meeting-rsvp-early",
      "missing-rsvp:meeting-rsvp-late",
      "missing-vote:meeting-early",
      "missing-vote:meeting-late",
    ],
  );
});

test("hero summary distinguishes immediate and follow-up quest points", () => {
  const summary = buildDashboardHeroSummary({
    memberName: "Marta",
    quests: [
      buildQuest({
        reward: {
          immediatePoints: 10,
          immediateLabel: "teraz",
          followUpPoints: 30,
          followUpLabel: "po udziale",
        },
        optionalPoints: 10,
      }),
      buildQuest({
        id: "q2",
        reward: {
          immediatePoints: 45,
          immediateLabel: "teraz",
          followUpPoints: 25,
          followUpLabel: "po spotkaniu",
        },
        optionalPoints: 45,
      }),
    ],
    hasFutureMeeting: true,
  });

  assert.equal(summary.availablePoints, 55);
  assert.equal(summary.followUpPoints, 55);
  assert.match(summary.subtitle, /55 pkt teraz/);
  assert.match(summary.subtitle, /55 pkt później/);
});

test("quest preview points never change the real balance", () => {
  const points = buildDashboardPointsSummary(120, [
    buildQuest({
      reward: {
        immediatePoints: 10,
        immediateLabel: "teraz",
        followUpPoints: 30,
        followUpLabel: "po udziale",
      },
      optionalPoints: 10,
    }),
  ]);

  assert.deepEqual(points, {
    currentPoints: 120,
    availablePoints: 10,
    followUpPoints: 30,
  });
});

test("sum helpers keep optionalPoints compatible with immediate points", () => {
  const quests = [
    buildQuest({
      reward: { immediatePoints: 20, immediateLabel: "teraz" },
      optionalPoints: 20,
    }),
    buildQuest({
      id: "q2",
      reward: {
        immediatePoints: 25,
        immediateLabel: "teraz",
        followUpPoints: 15,
        followUpLabel: "później",
      },
      optionalPoints: 25,
    }),
  ];

  assert.equal(sumQuestOptionalPoints(quests), 45);
  assert.equal(sumQuestImmediatePoints(quests), 45);
  assert.equal(sumQuestFollowUpPoints(quests), 15);
});

test("reward view model returns compact preview text", () => {
  const quest = buildQuest({
    reward: {
      immediatePoints: 10,
      immediateLabel: "teraz",
      followUpPoints: 30,
      followUpLabel: "po udziale",
    },
  });

  assert.equal(formatQuestRewardPreview(quest), "+10 teraz · +30 po udziale");
});

test("no quests gives empty state summary", () => {
  const summary = buildDashboardHeroSummary({
    memberName: "Marta",
    quests: [],
    hasFutureMeeting: false,
  });

  assert.equal(summary.title, "Stół czysty");
  assert.equal(summary.emptyCtaLabel, "Zorganizuj spotkanie");
});

test("nearest meeting prefers confirmed over earlier planned", () => {
  const meeting = pickUpcomingMeeting(
    [
      buildUpcomingMeeting({
        id: "planned",
        status: "planned",
        startsAt: "2026-07-15T16:00:00.000Z",
      }),
      buildUpcomingMeeting({
        id: "confirmed",
        status: "confirmed",
        startsAt: "2026-07-19T16:00:00.000Z",
      }),
    ],
    new Date("2026-07-18T10:00:00.000Z"),
  );

  assert.equal(meeting?.id, "confirmed");
});

test("recent plays sort by played_at descending", () => {
  const previews = buildRecentPlayPreviews([
    {
      id: "play-1",
      gameId: "game-1",
      gameTitle: "Nemesis",
      playedAt: "2026-07-10T18:00:00.000Z",
      playersCount: 4,
      winnerLabel: "Marta",
      href: "/kronika/play-1",
    },
    {
      id: "play-2",
      gameId: "game-2",
      gameTitle: "Frostpunk",
      playedAt: "2026-07-11T18:00:00.000Z",
      playersCount: 4,
      winnerLabel: "Ania",
      href: "/kronika/play-2",
    },
  ]);

  assert.deepEqual(
    previews.map((play) => play.id),
    ["play-2", "play-1"],
  );
});

test("winner summary returns single winner", () => {
  assert.equal(
    formatDashboardWinnerSummary([
      { id: "1", displayName: "Marta", avatarUrl: null },
    ]),
    "Marta",
  );
});

test("winner summary returns many winners", () => {
  assert.equal(
    formatDashboardWinnerSummary([
      { id: "1", displayName: "Marta", avatarUrl: null },
      { id: "2", displayName: "Ania", avatarUrl: null },
    ]),
    "Marta, Ania",
  );
});
