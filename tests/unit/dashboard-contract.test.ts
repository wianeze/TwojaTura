import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDashboardHeroSummary,
  buildDashboardPointsSummary,
  buildRecentPlayPreviews,
  formatQuestRenownPreview,
  formatDashboardWinnerSummary,
  getConfirmedMeetingAlert,
  isWithinMeetingWindow,
  pickUpcomingMeeting,
  sortDashboardQuests,
  sumQuestRenownPoints,
} from "../../src/features/dashboard/formatting.ts";
import {
  buildDashboardQuests,
  filterDashboardQuestSourceForMeetingEligibility,
  pickVisibleDashboardQuests,
  OPERATIONAL_TASK_POLICY,
  TASK_PRIORITY,
} from "../../src/features/dashboard/quests.ts";
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
    id: "task-1",
    type: "action",
    title: "Zadanie",
    href: "/",
    ctaLabel: "Idź",
    priority: TASK_PRIORITY.blocking,
    renownPoints: 2,
    ...overrides,
  };
}

function buildFutureMeeting(
  overrides: Partial<DashboardQuestSource["futureMeetings"][number]> = {},
): DashboardQuestSource["futureMeetings"][number] {
  return {
    id: "meeting-1",
    title: "Strategiczna sobota",
    startsAt: "2026-07-20T16:00:00.000Z",
    endsAt: "2026-07-20T20:00:00.000Z",
    status: "planned",
    ownResponse: null,
    hasOwnVote: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Economy V2 — nagrody pokazywane na kartach
// ---------------------------------------------------------------------------

test("RSVP task shows exactly the +2 Renoma the ledger will award", () => {
  const quests = buildDashboardQuests(
    buildSource({ futureMeetings: [buildFutureMeeting()] }),
  );

  const quest = quests.find((item) => item.id === "missing-rsvp:meeting-1");
  assert.ok(quest);
  assert.equal(quest.renownPoints, 2);
  assert.equal(quest.priority, TASK_PRIORITY.deadline);
});

test("RSVP task carries no fictional follow-up reward", () => {
  const quests = buildDashboardQuests(
    buildSource({ futureMeetings: [buildFutureMeeting()] }),
  );

  const quest = quests.find((item) => item.id === "missing-rsvp:meeting-1");
  assert.ok(quest);
  assert.equal("reward" in quest, false);
  assert.equal("followUpPoints" in quest, false);
  assert.equal("totalPreviewPoints" in quest, false);
});

test("vote task shows exactly +1 Renoma", () => {
  const quests = buildDashboardQuests(
    buildSource({
      futureMeetings: [
        buildFutureMeeting({ ownResponse: true, hasOwnVote: false }),
      ],
    }),
  );

  const quest = quests.find((item) => item.id === "missing-vote:meeting-1");
  assert.ok(quest);
  assert.equal(quest.renownPoints, 1);
  assert.equal(quest.priority, TASK_PRIORITY.deadline);
});

test("rating task shows exactly +3 Renoma", () => {
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
  assert.equal(quest.renownPoints, 3);
  assert.equal(quest.priority, TASK_PRIORITY.housekeeping);
});

test("chronicle task shows the +5 participation reward and blocks first", () => {
  const quests = buildDashboardQuests(
    buildSource({
      finishedMeetingsWithoutPlay: [
        {
          id: "meeting-1",
          title: "Wieczór bez wpisu",
          startsAt: "2026-07-12T18:00:00.000Z",
          endsAt: "2026-07-12T21:00:00.000Z",
          status: "confirmed",
        },
      ],
    }),
  );

  const quest = quests.find((item) => item.id === "missing-play:meeting-1");
  assert.ok(quest);
  assert.equal(quest.renownPoints, 5);
  assert.equal(quest.priority, TASK_PRIORITY.blocking);
});

test("meeting proposal task promises no Renoma for creating a meeting", () => {
  const quests = buildDashboardQuests(buildSource());
  const quest = quests.find((item) => item.id === "schedule-meeting");

  assert.ok(quest);
  // Organizator dostaje 5 Renomy dopiero za spotkanie, które się odbyło —
  // karta nie może obiecywać nagrody za samo wypełnienie formularza.
  assert.equal(quest.renownPoints, undefined);
  assert.equal(formatQuestRenownPreview(quest), null);
});

test("renown preview renders the real reward or nothing at all", () => {
  assert.equal(formatQuestRenownPreview({ renownPoints: 2 }), "+2 Renomy");
  assert.equal(formatQuestRenownPreview({ renownPoints: undefined }), null);
  assert.equal(formatQuestRenownPreview({ renownPoints: 0 }), null);
});

// ---------------------------------------------------------------------------
// Pruning: wygasanie, brak Półki, zwołanie ekipy
// ---------------------------------------------------------------------------

test("rating reminder disappears 30 days after the play", () => {
  const fresh = buildDashboardQuests(
    buildSource({
      now: new Date("2026-08-08T10:00:00.000Z"),
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
  const stale = buildDashboardQuests(
    buildSource({
      now: new Date("2026-08-12T10:00:00.000Z"),
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

  assert.ok(fresh.some((quest) => quest.id === "rate-game:play-1:game-1"));
  assert.equal(
    stale.some((quest) => quest.id === "rate-game:play-1:game-1"),
    false,
  );
  assert.equal(OPERATIONAL_TASK_POLICY.reminderMaxAgeDays, 30);
});

test("chronicle reminder also expires after the configured window", () => {
  const stale = buildDashboardQuests(
    buildSource({
      now: new Date("2026-08-20T10:00:00.000Z"),
      finishedMeetingsWithoutPlay: [
        {
          id: "meeting-old",
          title: "Dawno temu",
          startsAt: "2026-07-12T18:00:00.000Z",
          endsAt: "2026-07-12T21:00:00.000Z",
          status: "confirmed",
        },
      ],
    }),
  );

  assert.equal(
    stale.some((quest) => quest.id === "missing-play:meeting-old"),
    false,
  );
});

test("rating task does not appear for a future play", () => {
  const quests = buildDashboardQuests(
    buildSource({
      unratedGames: [
        {
          playId: "play-future",
          gameId: "game-future",
          gameTitle: "Jeszcze nie rozegrana",
          playedAt: "2026-07-13T12:00:00.000Z",
        },
      ],
    }),
  );

  assert.equal(
    quests.some((quest) => quest.id === "rate-game:play-future:game-future"),
    false,
  );
});

test("chronicle task appears only after the meeting end", () => {
  const beforeMeeting = buildDashboardQuests(
    buildSource({
      finishedMeetingsWithoutPlay: [
        {
          id: "meeting-later",
          title: "Jeszcze trwa",
          startsAt: "2026-07-13T12:00:00.000Z",
          endsAt: "2026-07-13T12:30:00.000Z",
          status: "confirmed",
        },
      ],
    }),
  );
  const afterMeeting = buildDashboardQuests(
    buildSource({
      finishedMeetingsWithoutPlay: [
        {
          id: "meeting-finished",
          title: "Już po spotkaniu",
          startsAt: "2026-07-13T08:00:00.000Z",
          endsAt: "2026-07-13T09:00:00.000Z",
          status: "confirmed",
        },
      ],
    }),
  );

  assert.equal(
    beforeMeeting.some((quest) => quest.id === "missing-play:meeting-later"),
    false,
  );
  assert.ok(
    afterMeeting.some((quest) => quest.id === "missing-play:meeting-finished"),
  );
});

test("shelf onboarding no longer produces dashboard tasks", () => {
  const shelfTaskIds = new Set([
    "add-first-game",
    "add-five-games",
    "add-ten-games",
    "add-fifteen-games",
  ]);

  for (const ownGamesCount of [0, 1, 5, 10, 15, 40]) {
    const quests = buildDashboardQuests(buildSource({ ownGamesCount }));

    assert.equal(
      quests.some((quest) => shelfTaskIds.has(quest.id)),
      false,
    );
  }
});

test("meeting proposal task hides whenever any future meeting exists", () => {
  const withMeeting = buildDashboardQuests(
    buildSource({
      futureMeetings: [
        buildFutureMeeting({
          // Ponad 21 dni w przód — stary próg pokazałby tu kartę mimo
          // zaplanowanego spotkania.
          startsAt: "2026-09-20T16:00:00.000Z",
          endsAt: "2026-09-20T20:00:00.000Z",
          ownResponse: true,
          hasOwnVote: true,
        }),
      ],
    }),
  );
  const withoutMeeting = buildDashboardQuests(buildSource());

  assert.equal(
    withMeeting.some((quest) => quest.id === "schedule-meeting"),
    false,
  );
  assert.ok(withoutMeeting.some((quest) => quest.id === "schedule-meeting"));
});

// ---------------------------------------------------------------------------
// Priorytety i przycinanie listy
// ---------------------------------------------------------------------------

test("member with RSVP NO does not receive the game-vote task", () => {
  const quests = buildDashboardQuests(
    buildSource({
      futureMeetings: [
        buildFutureMeeting({
          id: "meeting-declined",
          ownResponse: false,
          hasOwnVote: false,
        }),
      ],
    }),
  );

  assert.equal(
    quests.some((quest) => quest.id === "missing-vote:meeting-declined"),
    false,
  );
});

test("RSVP YES receives the game-vote task before the meeting", () => {
  const quests = buildDashboardQuests(
    buildSource({
      futureMeetings: [
        buildFutureMeeting({
          id: "meeting-available",
          status: "confirmed",
          ownResponse: true,
          hasOwnVote: false,
        }),
      ],
    }),
  );

  assert.ok(
    quests.some((quest) => quest.id === "missing-vote:meeting-available"),
  );
});

test("task order follows P1 blocking, P2 deadline, P3 housekeeping", () => {
  const quests = buildDashboardQuests(
    buildSource({
      futureMeetings: [
        buildFutureMeeting({
          id: "meeting-vote",
          startsAt: "2026-07-21T16:00:00.000Z",
          endsAt: "2026-07-21T20:00:00.000Z",
          ownResponse: true,
          hasOwnVote: false,
        }),
        buildFutureMeeting({
          id: "meeting-rsvp",
          startsAt: "2026-07-20T16:00:00.000Z",
          endsAt: "2026-07-20T20:00:00.000Z",
        }),
      ],
      finishedMeetingsWithoutPlay: [
        {
          id: "meeting-play",
          title: "Brak wpisu",
          startsAt: "2026-07-12T18:00:00.000Z",
          endsAt: "2026-07-12T21:00:00.000Z",
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
    }),
  );

  assert.deepEqual(
    quests.map((quest) => quest.id),
    [
      "missing-play:meeting-play",
      "missing-rsvp:meeting-rsvp",
      "missing-vote:meeting-vote",
      "rate-game:play-1:game-1",
    ],
  );
});

test("P2 tasks sort by the closest deadline first, regardless of kind", () => {
  const quests = buildDashboardQuests(
    buildSource({
      futureMeetings: [
        buildFutureMeeting({
          id: "late-rsvp",
          startsAt: "2026-08-20T16:00:00.000Z",
          endsAt: "2026-08-20T20:00:00.000Z",
        }),
        buildFutureMeeting({
          id: "soon-vote",
          startsAt: "2026-07-15T16:00:00.000Z",
          endsAt: "2026-07-15T20:00:00.000Z",
          ownResponse: true,
          hasOwnVote: false,
        }),
      ],
    }),
  );

  assert.deepEqual(
    quests.map((quest) => quest.id),
    ["missing-vote:soon-vote", "missing-rsvp:late-rsvp"],
  );
});

test("the table shows at most three operational tasks", () => {
  const quests = buildDashboardQuests(
    buildSource({
      futureMeetings: [
        buildFutureMeeting({
          id: "m1",
          startsAt: "2026-07-14T16:00:00.000Z",
          endsAt: "2026-07-14T20:00:00.000Z",
        }),
        buildFutureMeeting({
          id: "m2",
          startsAt: "2026-07-15T16:00:00.000Z",
          endsAt: "2026-07-15T20:00:00.000Z",
        }),
        buildFutureMeeting({
          id: "m3",
          startsAt: "2026-07-16T16:00:00.000Z",
          endsAt: "2026-07-16T20:00:00.000Z",
          ownResponse: true,
          hasOwnVote: false,
        }),
      ],
      finishedMeetingsWithoutPlay: [
        {
          id: "f1",
          title: "Brak wpisu",
          startsAt: "2026-07-12T18:00:00.000Z",
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
    }),
  );
  const visible = pickVisibleDashboardQuests(quests);

  assert.equal(quests.length, 6);
  assert.equal(visible.length, OPERATIONAL_TASK_POLICY.maxVisibleTasks);
  // Przycięcie nie może wypchnąć zadania blokującego dane grupy.
  assert.deepEqual(
    visible.map((quest) => quest.id),
    ["missing-play:f1", "missing-rsvp:m1", "missing-rsvp:m2"],
  );
});

test("completed tasks disappear from the list", () => {
  const pending = buildDashboardQuests(
    buildSource({ futureMeetings: [buildFutureMeeting()] }),
  );
  const answered = buildDashboardQuests(
    buildSource({
      futureMeetings: [
        buildFutureMeeting({ ownResponse: true, hasOwnVote: true }),
      ],
    }),
  );

  assert.ok(pending.some((quest) => quest.id === "missing-rsvp:meeting-1"));
  assert.equal(answered.length, 0);
});

test("tasks tied to a past meeting stop being offered", () => {
  const quests = buildDashboardQuests(
    buildSource({
      now: new Date("2026-07-25T10:00:00.000Z"),
      futureMeetings: [buildFutureMeeting()],
    }),
  );

  assert.equal(
    quests.some((quest) => quest.id === "missing-rsvp:meeting-1"),
    false,
  );
});

test("meeting tasks keep unique ids per meeting", () => {
  const quests = buildDashboardQuests(
    buildSource({
      futureMeetings: [
        buildFutureMeeting({ id: "meeting-a" }),
        buildFutureMeeting({
          id: "meeting-b",
          startsAt: "2026-07-21T16:00:00.000Z",
          endsAt: "2026-07-21T20:00:00.000Z",
          ownResponse: true,
          hasOwnVote: false,
        }),
      ],
    }),
  );

  assert.ok(quests.some((quest) => quest.id === "missing-rsvp:meeting-a"));
  assert.ok(quests.some((quest) => quest.id === "missing-vote:meeting-b"));
});

test("RSVP tasks cover future meetings in July, August and September", () => {
  const quests = buildDashboardQuests(
    buildSource({
      futureMeetings: [
        buildFutureMeeting({ id: "july-meeting" }),
        buildFutureMeeting({
          id: "august-meeting",
          status: "confirmed",
          startsAt: "2026-08-20T16:00:00.000Z",
          endsAt: "2026-08-20T20:00:00.000Z",
        }),
        buildFutureMeeting({
          id: "september-meeting",
          startsAt: "2026-09-20T16:00:00.000Z",
          endsAt: "2026-09-20T20:00:00.000Z",
        }),
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

test("sortDashboardQuests keeps blocking tasks above deadline tasks", () => {
  const quests: DashboardQuest[] = [
    buildQuest({
      id: "missing-vote:meeting-late",
      priority: TASK_PRIORITY.deadline,
      deadlineAt: "2026-07-22T10:00:00.000Z",
    }),
    buildQuest({
      id: "missing-rsvp:meeting-rsvp-early",
      priority: TASK_PRIORITY.deadline,
      deadlineAt: "2026-07-19T10:00:00.000Z",
    }),
    buildQuest({
      id: "rate-game:p1:g1",
      priority: TASK_PRIORITY.housekeeping,
      createdAt: "2026-07-23T10:00:00.000Z",
    }),
    buildQuest({
      id: "missing-play:meeting-play",
      priority: TASK_PRIORITY.blocking,
      createdAt: "2026-07-18T10:00:00.000Z",
      deadlineAt: "2026-07-18T10:00:00.000Z",
    }),
  ];

  assert.deepEqual(
    sortDashboardQuests(quests).map((quest) => quest.id),
    [
      "missing-play:meeting-play",
      "missing-rsvp:meeting-rsvp-early",
      "missing-vote:meeting-late",
      "rate-game:p1:g1",
    ],
  );
});

// ---------------------------------------------------------------------------
// Podsumowania
// ---------------------------------------------------------------------------

test("hero summary sums only real Renoma from visible tasks", () => {
  const summary = buildDashboardHeroSummary({
    memberName: "Marta",
    quests: [
      buildQuest({ id: "t1", renownPoints: 2 }),
      buildQuest({ id: "t2", renownPoints: 1 }),
      buildQuest({ id: "t3", renownPoints: undefined }),
    ],
    hasFutureMeeting: true,
  });

  assert.equal(summary.questCount, 3);
  assert.equal(summary.availablePoints, 3);
  assert.match(summary.subtitle, /3 Renomy do wzięcia/);
  assert.equal("followUpPoints" in summary, false);
});

test("task preview never changes the real balance", () => {
  const points = buildDashboardPointsSummary(120, [
    buildQuest({ renownPoints: 2 }),
  ]);

  assert.deepEqual(points, {
    currentPoints: 120,
    availablePoints: 2,
  });
});

test("sumQuestRenownPoints ignores tasks without a reward", () => {
  assert.equal(
    sumQuestRenownPoints([
      buildQuest({ id: "t1", renownPoints: 5 }),
      buildQuest({ id: "t2", renownPoints: undefined }),
      buildQuest({ id: "t3", renownPoints: 3 }),
    ]),
    8,
  );
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

test("a meeting already under way is not offered as the next one", () => {
  const now = new Date("2026-07-18T18:00:00.000Z");

  assert.equal(
    pickUpcomingMeeting(
      [
        buildUpcomingMeeting({
          id: "active",
          startsAt: "2026-07-18T17:00:00.000Z",
          endsAt: "2026-07-18T21:00:00.000Z",
        }),
        buildUpcomingMeeting({
          id: "upcoming",
          startsAt: "2026-07-20T16:00:00.000Z",
        }),
      ],
      now,
    )?.id,
    "upcoming",
  );
});

test("the meeting holding the table is excluded from the next-meeting slot", () => {
  const now = new Date("2026-07-18T12:00:00.000Z");
  const meetings = [
    buildUpcomingMeeting({
      id: "tonight",
      startsAt: "2026-07-18T16:00:00.000Z",
      endsAt: "2026-07-18T21:00:00.000Z",
    }),
    buildUpcomingMeeting({
      id: "next-week",
      startsAt: "2026-07-25T16:00:00.000Z",
      endsAt: "2026-07-25T21:00:00.000Z",
    }),
  ];

  assert.equal(pickUpcomingMeeting(meetings, now)?.id, "tonight");
  assert.equal(
    pickUpcomingMeeting(meetings, now, { excludeMeetingId: "tonight" })?.id,
    "next-week",
  );
});

test("meeting window covers its start and excludes its scheduled end", () => {
  const meeting = buildUpcomingMeeting({
    startsAt: "2026-07-18T17:00:00.000Z",
    endsAt: "2026-07-18T21:00:00.000Z",
  });

  assert.equal(
    isWithinMeetingWindow(meeting, new Date("2026-07-18T16:59:59.000Z")),
    false,
  );
  assert.equal(
    isWithinMeetingWindow(meeting, new Date("2026-07-18T17:00:00.000Z")),
    true,
  );
  assert.equal(
    isWithinMeetingWindow(meeting, new Date("2026-07-18T21:00:00.000Z")),
    false,
  );
});

test("confirmed meeting exposes a readable organizer confirmation status", () => {
  const alert = getConfirmedMeetingAlert(
    buildUpcomingMeeting({
      status: "confirmed",
      startsAt: "2026-07-20T16:00:00.000Z",
      leadingGame: {
        gameId: "game-1",
        title: "Nemesis",
        coverUrl: null,
        yesCount: 3,
      },
    }),
  );

  assert.match(alert ?? "", /Spotkanie potwierdzone/);
  assert.match(alert ?? "", /Nemesis/);
  assert.equal(
    getConfirmedMeetingAlert(buildUpcomingMeeting({ status: "planned" })),
    null,
  );
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

test("uninvited member receives no quests tied to that meeting", () => {
  const eligibleSource = filterDashboardQuestSourceForMeetingEligibility(
    buildSource({
      futureMeetings: [
        {
          id: "invited-meeting",
          title: "Wieczór drużyny",
          startsAt: "2026-07-20T16:00:00.000Z",
          endsAt: "2026-07-20T20:00:00.000Z",
          status: "planned",
          ownResponse: null,
          hasOwnVote: false,
        },
        {
          id: "uninvited-meeting",
          title: "Obcy wieczór",
          startsAt: "2026-07-21T16:00:00.000Z",
          endsAt: "2026-07-21T20:00:00.000Z",
          status: "planned",
          ownResponse: null,
          hasOwnVote: false,
        },
      ],
      finishedMeetingsWithoutPlay: [
        {
          id: "uninvited-finished-meeting",
          title: "Obcy zakończony wieczór",
          startsAt: "2026-07-10T16:00:00.000Z",
          endsAt: "2026-07-10T20:00:00.000Z",
          status: "completed",
        },
      ],
      unratedGames: [
        {
          playId: "standalone-play",
          gameId: "standalone-game",
          gameTitle: "Własna partia",
          playedAt: "2026-07-12T10:00:00.000Z",
        },
        {
          playId: "uninvited-play",
          gameId: "uninvited-game",
          gameTitle: "Gra z obcego spotkania",
          playedAt: "2026-07-12T10:00:00.000Z",
          meetingId: "uninvited-finished-meeting",
        },
      ],
    }),
    new Set(["invited-meeting"]),
  );

  const quests = buildDashboardQuests(eligibleSource);

  assert.ok(
    quests.some((quest) => quest.id === "missing-rsvp:invited-meeting"),
  );
  assert.ok(!quests.some((quest) => quest.id.includes("uninvited-meeting")));
  assert.ok(
    !quests.some(
      (quest) => quest.id === "missing-play:uninvited-finished-meeting",
    ),
  );
  assert.ok(
    !quests.some(
      (quest) => quest.id === "rate-game:uninvited-play:uninvited-game",
    ),
  );
  assert.ok(
    quests.some(
      (quest) => quest.id === "rate-game:standalone-play:standalone-game",
    ),
  );
});
