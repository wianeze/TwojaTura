import assert from "node:assert/strict";
import test from "node:test";
import {
  getChronicleParticipantChips,
  formatPlayDateTime,
  formatPlayCompactDateTime,
  getPlayFormValues,
  getPlayPodium,
  getWinnerSummary,
  groupPlaysByMonth,
  sortPlaysByPlayedAtDesc,
} from "../../src/features/plays/formatting.ts";
import type {
  PlayFormMeetingOption,
  PlayListItem,
  PlayMember,
} from "../../src/features/plays/types.ts";
import {
  buildPlaySubmittedValues,
  validatePlayFormData,
} from "../../src/features/plays/validation.ts";
import { awardPlayPointsAfterSave } from "../../src/features/plays/play-points.ts";
import { awardPlayResultAchievementsAfterSave } from "../../src/features/plays/play-achievements.ts";
import { awardCampHostAfterPlaySave } from "../../src/features/plays/meeting-achievements.ts";

test("Chronicle create and result edit request natural_one evaluation", async () => {
  let requestCount = 0;
  const requestAward = async () => {
    requestCount += 1;
    return {
      data: [
        {
          awarded_count: 1,
          points_awarded: 5,
          awarded_user_ids: ["member-last"],
        },
      ],
      error: null,
    };
  };

  const [afterCreate, afterResultEdit] = await Promise.all([
    awardPlayResultAchievementsAfterSave(requestAward),
    awardPlayResultAchievementsAfterSave(requestAward),
  ]);

  assert.equal(requestCount, 2);
  assert.deepEqual(afterCreate, {
    ok: true,
    awardedCount: 1,
    pointsAwarded: 5,
    awardedUserIds: ["member-last"],
  });
  assert.deepEqual(afterResultEdit, afterCreate);
});

test("no new natural_one award remains a successful Chronicle post-save result", async () => {
  const result = await awardPlayResultAchievementsAfterSave(async () => ({
    data: [{ awarded_count: 0, points_awarded: 0, awarded_user_ids: [] }],
    error: null,
  }));

  assert.deepEqual(result, {
    ok: true,
    awardedCount: 0,
    pointsAwarded: 0,
    awardedUserIds: [],
  });
});

test("meeting-linked Chronicle save requests camp_host evaluation", async () => {
  let requestCount = 0;
  const result = await awardCampHostAfterPlaySave(true, async () => {
    requestCount += 1;
    return {
      data: [
        {
          awarded_count: 1,
          points_awarded: 10,
          awarded_keys: ["camp_host"],
        },
      ],
      error: null,
    };
  });

  assert.equal(requestCount, 1);
  assert.deepEqual(result, {
    ok: true,
    skipped: false,
    awardedCount: 1,
    pointsAwarded: 10,
    awardedKeys: ["camp_host"],
  });
});

test("Chronicle save without a meeting skips camp_host evaluation", async () => {
  let requestCount = 0;
  const result = await awardCampHostAfterPlaySave(false, async () => {
    requestCount += 1;
    return { data: null, error: null };
  });

  assert.equal(requestCount, 0);
  assert.deepEqual(result, {
    ok: true,
    skipped: true,
    awardedCount: 0,
    pointsAwarded: 0,
    awardedKeys: [],
  });
});

test("new Chronicle entry requests play_logged points", async () => {
  let requestCount = 0;
  const result = await awardPlayPointsAfterSave(true, async () => {
    requestCount += 1;
    return {
      data: [{ awarded: true, points: 40, point_event_id: "event-play" }],
      error: null,
    };
  });

  assert.equal(requestCount, 1);
  assert.deepEqual(result, {
    ok: true,
    skipped: false,
    awarded: true,
    points: 40,
    pointEventId: "event-play",
  });
});

test("editing a Chronicle entry skips play_logged award", async () => {
  let requestCount = 0;
  const result = await awardPlayPointsAfterSave(false, async () => {
    requestCount += 1;
    return { data: null, error: null };
  });

  assert.equal(requestCount, 0);
  assert.deepEqual(result, {
    ok: true,
    skipped: true,
    awarded: false,
    points: 0,
    pointEventId: null,
  });
});

test("idempotent play award no-op does not fail Chronicle create", async () => {
  const result = await awardPlayPointsAfterSave(true, async () => ({
    data: [{ awarded: false, points: 40, point_event_id: null }],
    error: null,
  }));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.awarded, false);
});

function buildParticipantsInput(
  participants?: Array<{
    userId: string;
    isWinner: boolean;
    placement?: string;
    score?: string;
  }>,
) {
  return JSON.stringify(
    participants ?? [
      {
        userId: "10000000-0000-0000-0000-000000000002",
        isWinner: true,
        placement: "1",
        score: "54",
      },
    ],
  );
}

function buildFormData(
  overrides?: Partial<{
    gameId: string;
    meetingId: string;
    playedOnDate: string;
    playedOnTime: string;
    durationMinutes: string;
    comment: string;
    status: string;
    stateNote: string;
    participants: string;
  }>,
) {
  const formData = new FormData();
  formData.set(
    "gameId",
    overrides?.gameId ?? "30000000-0000-0000-0000-000000000001",
  );
  formData.set("meetingId", overrides?.meetingId ?? "");
  formData.set("playedOnDate", overrides?.playedOnDate ?? "18/07/2026");
  formData.set("playedOnTime", overrides?.playedOnTime ?? "18:30");
  formData.set("durationMinutes", overrides?.durationMinutes ?? "95");
  formData.set("comment", overrides?.comment ?? "Świetna końcówka.");
  formData.set("status", overrides?.status ?? "completed");
  formData.set("stateNote", overrides?.stateNote ?? "");
  formData.set(
    "participants",
    overrides?.participants ?? buildParticipantsInput(),
  );
  return formData;
}

function createPlay(overrides?: Partial<PlayListItem>): PlayListItem {
  const member: PlayMember = {
    id: "10000000-0000-0000-0000-000000000002",
    displayName: "Marta",
    avatarUrl: null,
  };

  return {
    id: overrides?.id ?? "play-1",
    playedAt: overrides?.playedAt ?? "2026-07-18T16:30:00.000Z",
    durationMinutes: overrides?.durationMinutes ?? 95,
    comment: overrides?.comment ?? null,
    status: overrides?.status ?? "completed",
    stateNote: overrides?.stateNote ?? null,
    createdAt: overrides?.createdAt ?? "2026-07-18T18:10:00.000Z",
    updatedAt: overrides?.updatedAt ?? "2026-07-18T18:10:00.000Z",
    game: overrides?.game ?? {
      id: "game-1",
      title: "Frostpunk",
      coverUrl: "/games/frostpunk.webp",
    },
    meeting: overrides?.meeting ?? null,
    createdBy: overrides?.createdBy ?? member,
    participants: overrides?.participants ?? [
      {
        member,
        placement: 1,
        score: 54,
        isWinner: true,
      },
    ],
    winners: overrides?.winners ?? [member],
    playersCount: overrides?.playersCount ?? 1,
    canEdit: overrides?.canEdit ?? true,
  };
}

const ACTIVE_MEMBER_IDS = [
  "10000000-0000-0000-0000-000000000001",
  "10000000-0000-0000-0000-000000000002",
  "10000000-0000-0000-0000-000000000003",
];

test("play validation rejects missing game", () => {
  const validation = validatePlayFormData(
    buildFormData({ gameId: "" }),
    ACTIVE_MEMBER_IDS,
  );

  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.equal(validation.fieldErrors.gameId, "Wybierz grę z listy.");
});

test("play validation rejects zero participants", () => {
  const validation = validatePlayFormData(
    buildFormData({ participants: "[]" }),
    ACTIVE_MEMBER_IDS,
  );

  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.equal(
    validation.fieldErrors.participants,
    "Dodaj przynajmniej jednego gracza do tej partii.",
  );
});

test("play validation rejects zero winners", () => {
  const validation = validatePlayFormData(
    buildFormData({
      participants: buildParticipantsInput([
        {
          userId: "10000000-0000-0000-0000-000000000002",
          isWinner: false,
          placement: "1",
        },
      ]),
    }),
    ACTIVE_MEMBER_IDS,
  );

  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.equal(
    validation.fieldErrors.participants,
    "Zaznacz przynajmniej jednego zwycięzcę.",
  );
});

test("play validation allows in_progress without a winner", () => {
  const validation = validatePlayFormData(
    buildFormData({
      status: "in_progress",
      stateNote: "Runda 3 z 5, wracamy jutro",
      participants: buildParticipantsInput([
        {
          userId: "10000000-0000-0000-0000-000000000002",
          isWinner: false,
          placement: "",
        },
      ]),
    }),
    ACTIVE_MEMBER_IDS,
  );

  assert.equal(validation.ok, true);
  if (!validation.ok) return;
  assert.equal(validation.data.status, "in_progress");
  assert.equal(validation.data.stateNote, "Runda 3 z 5, wracamy jutro");
});

test("play validation still requires at least one participant when in_progress", () => {
  const validation = validatePlayFormData(
    buildFormData({
      status: "in_progress",
      stateNote: "Runda 3 z 5",
      participants: "[]",
    }),
    ACTIVE_MEMBER_IDS,
  );

  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.equal(
    validation.fieldErrors.participants,
    "Dodaj przynajmniej jednego gracza do tej partii.",
  );
});

test("play validation requires a state note when in_progress", () => {
  const validation = validatePlayFormData(
    buildFormData({ status: "in_progress", stateNote: "" }),
    ACTIVE_MEMBER_IDS,
  );

  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.equal(
    validation.fieldErrors.stateNote,
    "Opisz stan gry w toku (np. do którego miejsca dotarliście).",
  );
});

test("play validation allows multiple winners", () => {
  const validation = validatePlayFormData(
    buildFormData({
      participants: buildParticipantsInput([
        {
          userId: "10000000-0000-0000-0000-000000000002",
          isWinner: true,
          placement: "1",
        },
        {
          userId: "10000000-0000-0000-0000-000000000003",
          isWinner: true,
          placement: "1",
        },
      ]),
    }),
    ACTIVE_MEMBER_IDS,
  );

  assert.equal(validation.ok, true);
  if (!validation.ok) return;
  assert.equal(
    validation.data.participants.filter((player) => player.isWinner).length,
    2,
  );
});

test("play validation rejects duplicate participant", () => {
  const validation = validatePlayFormData(
    buildFormData({
      participants: buildParticipantsInput([
        {
          userId: "10000000-0000-0000-0000-000000000002",
          isWinner: true,
        },
        {
          userId: "10000000-0000-0000-0000-000000000002",
          isWinner: false,
        },
      ]),
    }),
    ACTIVE_MEMBER_IDS,
  );

  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.equal(
    validation.fieldErrors.participants,
    "Ten sam gracz nie może zostać dodany dwa razy do jednej partii.",
  );
});

test("play validation rejects placement lower than one", () => {
  const validation = validatePlayFormData(
    buildFormData({
      participants: buildParticipantsInput([
        {
          userId: "10000000-0000-0000-0000-000000000002",
          isWinner: true,
          placement: "0",
        },
      ]),
    }),
    ACTIVE_MEMBER_IDS,
  );

  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.equal(
    validation.participantFieldErrors["10000000-0000-0000-0000-000000000002"]
      ?.placement,
    "Miejsce musi być dodatnią liczbą całkowitą.",
  );
});

test("play validation rejects non-positive duration", () => {
  const validation = validatePlayFormData(
    buildFormData({ durationMinutes: "0" }),
    ACTIVE_MEMBER_IDS,
  );

  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.equal(
    validation.fieldErrors.durationMinutes,
    "Czas gry musi być dodatnią liczbą całkowitą.",
  );
});

test("play validation keeps score nullable", () => {
  const validation = validatePlayFormData(
    buildFormData({
      participants: buildParticipantsInput([
        {
          userId: "10000000-0000-0000-0000-000000000002",
          isWinner: true,
          placement: "1",
          score: "",
        },
      ]),
    }),
    ACTIVE_MEMBER_IDS,
  );

  assert.equal(validation.ok, true);
  if (!validation.ok) return;
  assert.equal(validation.data.participants[0]?.score, null);
});

test("play validation preserves submitted values after validation error", () => {
  const formData = buildFormData({
    durationMinutes: "0",
    comment: "Zostaw ten komentarz",
  });
  const validation = validatePlayFormData(formData, ACTIVE_MEMBER_IDS);

  assert.equal(validation.ok, false);
  if (validation.ok) return;
  assert.deepEqual(
    validation.submittedValues,
    buildPlaySubmittedValues(formData),
  );
});

test("play list sorting uses played_at descending", () => {
  const sorted = sortPlaysByPlayedAtDesc([
    createPlay({ id: "play-older", playedAt: "2026-07-10T10:00:00.000Z" }),
    createPlay({ id: "play-newer", playedAt: "2026-07-18T10:00:00.000Z" }),
    createPlay({ id: "play-middle", playedAt: "2026-07-15T10:00:00.000Z" }),
  ]);

  assert.deepEqual(
    sorted.map((play) => play.id),
    ["play-newer", "play-middle", "play-older"],
  );
});

test("chronicle groups plays by month and year", () => {
  const groups = groupPlaysByMonth([
    createPlay({ id: "play-july", playedAt: "2026-07-18T10:00:00.000Z" }),
    createPlay({ id: "play-june", playedAt: "2026-06-10T10:00:00.000Z" }),
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.items[0]?.id, "play-july");
  assert.match(groups[0]?.label ?? "", /Lipiec 2026/);
});

test("chronicle month grouping uses Europe/Warsaw instead of UTC", () => {
  const groups = groupPlaysByMonth([
    createPlay({
      id: "play-warsaw-july",
      playedAt: "2026-06-30T22:30:00.000Z",
    }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.key, "2026-07");
  assert.match(groups[0]?.label ?? "", /Lipiec 2026/);
});

test("winner summary returns single winner label", () => {
  assert.equal(
    getWinnerSummary([{ id: "user-1", displayName: "Marta", avatarUrl: null }]),
    "Marta",
  );
});

test("winner summary returns multiple winners label", () => {
  assert.equal(
    getWinnerSummary([
      { id: "user-1", displayName: "Marta", avatarUrl: null },
      { id: "user-2", displayName: "Ania", avatarUrl: null },
    ]),
    "Marta, Ania",
  );
});

test("chronicle podium extracts placements 1-3 including ties", () => {
  const podium = getPlayPodium([
    {
      member: { id: "user-1", displayName: "Marta", avatarUrl: null },
      placement: 1,
      score: 80,
      isWinner: true,
    },
    {
      member: { id: "user-2", displayName: "Ania", avatarUrl: null },
      placement: 1,
      score: 80,
      isWinner: true,
    },
    {
      member: { id: "user-3", displayName: "Kuba", avatarUrl: null },
      placement: 3,
      score: 60,
      isWinner: false,
    },
    {
      member: { id: "user-4", displayName: "Michał", avatarUrl: null },
      placement: null,
      score: null,
      isWinner: false,
    },
  ]);

  assert.deepEqual(podium, [
    {
      rank: 1,
      members: [
        { id: "user-1", displayName: "Marta", avatarUrl: null },
        { id: "user-2", displayName: "Ania", avatarUrl: null },
      ],
    },
    {
      rank: 3,
      members: [{ id: "user-3", displayName: "Kuba", avatarUrl: null }],
    },
  ]);
});

test("chronicle participant chips keep podium first and remaining players after", () => {
  const chips = getChronicleParticipantChips([
    {
      member: { id: "user-1", displayName: "Marta", avatarUrl: null },
      placement: 1,
      score: 80,
      isWinner: true,
    },
    {
      member: { id: "user-2", displayName: "Kuba", avatarUrl: null },
      placement: 2,
      score: 70,
      isWinner: false,
    },
    {
      member: { id: "user-3", displayName: "Ania", avatarUrl: null },
      placement: null,
      score: null,
      isWinner: false,
    },
  ]);

  assert.deepEqual(chips, [
    {
      participant: {
        member: { id: "user-1", displayName: "Marta", avatarUrl: null },
        placement: 1,
        score: 80,
        isWinner: true,
      },
      medalRank: 1,
    },
    {
      participant: {
        member: { id: "user-2", displayName: "Kuba", avatarUrl: null },
        placement: 2,
        score: 70,
        isWinner: false,
      },
      medalRank: 2,
    },
    {
      participant: {
        member: { id: "user-3", displayName: "Ania", avatarUrl: null },
        placement: null,
        score: null,
        isWinner: false,
      },
      medalRank: null,
    },
  ]);
});

test("chronicle participant chips fall back to winner flag when placements are missing", () => {
  const chips = getChronicleParticipantChips([
    {
      member: { id: "user-1", displayName: "Ania", avatarUrl: null },
      placement: null,
      score: null,
      isWinner: true,
    },
    {
      member: { id: "user-2", displayName: "Przemek", avatarUrl: null },
      placement: null,
      score: null,
      isWinner: false,
    },
  ]);

  assert.deepEqual(chips, [
    {
      participant: {
        member: { id: "user-1", displayName: "Ania", avatarUrl: null },
        placement: null,
        score: null,
        isWinner: true,
      },
      medalRank: 1,
    },
    {
      participant: {
        member: { id: "user-2", displayName: "Przemek", avatarUrl: null },
        placement: null,
        score: null,
        isWinner: false,
      },
      medalRank: null,
    },
  ]);
});

test("meeting prefill contract maps starts_at into play form values", () => {
  const meeting: PlayFormMeetingOption = {
    id: "meeting-1",
    title: "Sobota u Marty",
    startsAt: "2026-07-18T16:30:00.000Z",
    endsAt: "2026-07-18T20:00:00.000Z",
    location: "U Marty",
  };

  assert.deepEqual(getPlayFormValues(undefined, meeting), {
    gameId: "",
    meetingId: "meeting-1",
    playedOnDate: "18/07/2026",
    playedOnTime: "18:30",
    durationMinutes: "",
    comment: "",
    status: "completed",
    stateNote: "",
    participants: [],
  });
});

test("play date formatting stays in Warsaw timezone", () => {
  assert.match(
    formatPlayDateTime("2026-07-18T16:30:00.000Z"),
    /18 lipca 2026.*18:30/i,
  );
});

test("compact chronicle date formatting uses dd/MM/yyyy HH:mm", () => {
  assert.equal(
    formatPlayCompactDateTime("2026-07-18T16:30:00.000Z"),
    "18/07/2026 18:30",
  );
});
