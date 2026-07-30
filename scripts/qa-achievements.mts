import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isRealLastPlace } from "../src/features/legendarium/achievement-progress.ts";
import {
  assertQaEnvironment,
  QA_PASSWORD,
  QA_SCENARIOS,
} from "./qa-achievements-contract.mts";
import { resetQaPointEventsLocal } from "./qa-fixture-awards.mts";

type LocalConfig = { url: string; anonKey: string; serviceRoleKey: string };
type QaUser = { index: number; email: string; name: string; id: string };

const qaReadyMarker = resolve("supabase/.temp/qa-achievements-ready");

const qaUsers = [
  [1, "qa-achievements-near@twojatura.local", "QA Progi"],
  [2, "qa-achievements-ready@twojatura.local", "QA Gotowy"],
  [3, "qa-achievements-last-one@twojatura.local", "QA Ostatni 1"],
  [4, "qa-achievements-last-two@twojatura.local", "QA Ostatni 2"],
  [5, "qa-achievements-streak-broken@twojatura.local", "QA Seria Przerwana"],
  [6, "qa-achievements-class-locked@twojatura.local", "QA Klasa 4/5"],
  [7, "qa-achievements-class-ready@twojatura.local", "QA Klasa 5/5"],
  [8, "qa-achievements-coop@twojatura.local", "QA Kooperacja"],
  [9, "qa-achievements-loot-near@twojatura.local", "QA Półka 24/25"],
] as const;

function localFixtureId(kind: number, userIndex: number, index: number) {
  return `90000000-0000-4000-8${kind.toString(16).padStart(3, "0")}-${userIndex
    .toString(16)
    .padStart(3, "0")}${index.toString(16).padStart(9, "0")}`;
}

function commandName() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function runPnpm(args: string[], stdio: "pipe" | "inherit" = "pipe") {
  if (process.platform === "win32") {
    return execFileSync(
      "cmd.exe",
      ["/d", "/s", "/c", `${commandName()} ${args.join(" ")}`],
      {
        encoding: stdio === "pipe" ? "utf8" : undefined,
        stdio,
      },
    );
  }

  return execFileSync(commandName(), args, {
    encoding: stdio === "pipe" ? "utf8" : undefined,
    stdio,
  });
}

function readLocalConfig(): LocalConfig {
  const output = runPnpm(["dlx", "supabase@2.109.0", "status", "-o", "env"]);
  if (typeof output !== "string") {
    throw new Error("Nie udało się odczytać konfiguracji lokalnego Supabase.");
  }
  const values = Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1], match[2].replace(/^"|"$/g, "")]),
  );
  const url = values.API_URL ?? values.SUPABASE_URL;
  const anonKey = values.ANON_KEY ?? values.PUBLISHABLE_KEY;
  const serviceRoleKey = values.SERVICE_ROLE_KEY ?? values.SERVICE_ROLE_JWT;

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Nie udało się odczytać lokalnych kluczy Supabase. Uruchom najpierw `pnpm supabase:start`.",
    );
  }
  assertQaEnvironment(process.env, url);
  return { url, anonKey, serviceRoleKey };
}

function assertOk(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

async function ensureQaUsers(service: SupabaseClient): Promise<QaUser[]> {
  const existing = await service.auth.admin.listUsers({ perPage: 1000 });
  assertOk(existing.error, "Nie udało się odczytać lokalnych użytkowników QA");
  const byEmail = new Map(
    (existing.data.users ?? []).map((user) => [user.email, user]),
  );
  const users: QaUser[] = [];

  for (const [index, email, name] of qaUsers) {
    let user = byEmail.get(email);
    if (!user) {
      const created = await service.auth.admin.createUser({
        email,
        password: QA_PASSWORD,
        email_confirm: true,
        user_metadata: { twoja_tura_invite: "true", display_name: name },
      });
      assertOk(created.error, `Nie udało się utworzyć ${email}`);
      if (created.data.user) {
        user = created.data.user;
      }
    }
    if (!user) throw new Error(`Brak użytkownika QA: ${email}`);

    assertOk(
      (
        await service
          .from("profiles")
          .upsert({ id: user.id, email, display_name: name })
      ).error,
      `Nie udało się przygotować profilu ${email}`,
    );
    assertOk(
      (
        await service
          .from("app_members")
          .upsert({ user_id: user.id, role: "member", is_active: true })
      ).error,
      `Nie udało się aktywować ${email}`,
    );
    users.push({ index, email, name, id: user.id });
  }
  return users;
}

async function upsertGames(
  service: SupabaseClient,
  user: QaUser,
  count: number,
) {
  const games = Array.from({ length: count }, (_, offset) => ({
    id: localFixtureId(1, user.index, offset + 1),
    title: `QA Odznaki ${user.name} — gra ${offset + 1}`,
    owner_id: user.id,
    current_holder_id: user.id,
    status: "available",
    min_players: 1,
    max_players: 5,
  }));
  assertOk(
    (await service.from("games").upsert(games)).error,
    `Nie udało się przygotować gier dla ${user.name}`,
  );
  return games;
}

async function upsertMeetings(
  service: SupabaseClient,
  user: QaUser,
  count: number,
) {
  const meetings = Array.from({ length: count }, (_, offset) => ({
    id: localFixtureId(2, user.index, offset + 1),
    created_by: user.id,
    title: `QA Odznaki ${user.name} — spotkanie ${offset + 1}`,
    status: "confirmed",
    starts_at: `2025-01-${String((offset % 25) + 1).padStart(2, "0")}T18:00:00.000Z`,
    ends_at: `2025-01-${String((offset % 25) + 1).padStart(2, "0")}T21:00:00.000Z`,
  }));
  assertOk(
    (await service.from("meetings").upsert(meetings)).error,
    `Nie udało się przygotować spotkań dla ${user.name}`,
  );
  return meetings;
}

async function upsertRatings(
  service: SupabaseClient,
  user: QaUser,
  games: { id: string }[],
  count: number,
  perfectCount: number,
  replayCount: number,
) {
  const ratings = Array.from({ length: count }, (_, offset) => ({
    id: localFixtureId(3, user.index, offset + 1),
    game_id: games[offset].id,
    user_id: user.id,
    overall: offset < perfectCount ? 10 : 8,
    replayability: 8,
    theme: 8,
    wants_to_play_again: offset < replayCount,
    comment: `QA komentarz odznaki ${offset + 1}`,
  }));
  assertOk(
    (await service.from("ratings").upsert(ratings)).error,
    `Nie udało się przygotować ocen dla ${user.name}`,
  );
}

async function upsertAvailability(
  service: SupabaseClient,
  user: QaUser,
  meetings: { id: string }[],
) {
  assertOk(
    (
      await service.from("meeting_availability").upsert(
        meetings.map((meeting) => ({
          meeting_id: meeting.id,
          user_id: user.id,
          is_available: true,
        })),
      )
    ).error,
    `Nie udało się przygotować odpowiedzi spotkań dla ${user.name}`,
  );
}

async function upsertPlay(
  service: SupabaseClient,
  options: {
    id: string;
    owner: QaUser;
    gameId: string;
    playedAt: string;
    meetingId?: string | null;
    mode?: "competitive" | "cooperative";
    teamResult?: "win" | "loss" | null;
    participants: Array<{
      user: QaUser;
      placement: number | null;
      winner?: boolean;
    }>;
  },
) {
  assertOk(
    (
      await service.from("plays").upsert({
        id: options.id,
        game_id: options.gameId,
        meeting_id: options.meetingId ?? null,
        created_by: options.owner.id,
        played_at: options.playedAt,
        duration_minutes: 90,
        comment: "QA fixture osiągnięć",
        mode: options.mode ?? "competitive",
        team_result: options.teamResult ?? null,
      })
    ).error,
    `Nie udało się przygotować partii ${options.id}`,
  );
  if (options.participants.length > 0) {
    assertOk(
      (
        await service.from("play_participants").upsert(
          options.participants.map((participant) => ({
            play_id: options.id,
            user_id: participant.user.id,
            placement: participant.placement,
            is_winner: participant.winner ?? participant.placement === 1,
          })),
        )
      ).error,
      `Nie udało się przygotować uczestników partii ${options.id}`,
    );
  }
}

async function prepareProgressFixtures(
  service: SupabaseClient,
  users: QaUser[],
) {
  const byIndex = new Map(users.map((user) => [user.index, user]));
  const near = byIndex.get(1)!;
  const ready = byIndex.get(2)!;
  const lastOne = byIndex.get(3)!;
  const lastTwo = byIndex.get(4)!;
  const broken = byIndex.get(5)!;
  const coop = byIndex.get(8)!;
  const lootNear = byIndex.get(9)!;

  const nearGames = await upsertGames(service, near, 49);
  const readyGames = await upsertGames(service, ready, 50);
  const oneGames = await upsertGames(service, lastOne, 3);
  const twoGames = await upsertGames(service, lastTwo, 3);
  const brokenGames = await upsertGames(service, broken, 4);
  const coopGames = await upsertGames(service, coop, 3);
  await upsertGames(service, lootNear, 24);
  await upsertRatings(service, near, nearGames, 9, 4, 19);
  await upsertRatings(service, ready, readyGames, 10, 5, 20);

  const nearMeetings = await upsertMeetings(service, near, 9);
  const readyMeetings = await upsertMeetings(service, ready, 10);
  await upsertAvailability(service, near, nearMeetings);
  await upsertAvailability(service, ready, readyMeetings);

  // Created plays drive the 24/25 and 25/25 Chronicle progress. They stay
  // before the scripted result fixtures so the streak scenarios remain clear.
  for (let index = 1; index <= 24; index += 1) {
    await upsertPlay(service, {
      id: localFixtureId(4, near.index, index),
      owner: near,
      gameId: nearGames[(index - 1) % nearGames.length].id,
      playedAt: `2024-01-${String((index % 25) + 1).padStart(2, "0")}T12:00:00.000Z`,
      meetingId: index <= 4 ? nearMeetings[index - 1].id : null,
      participants: [],
    });
  }
  for (let index = 1; index <= 25; index += 1) {
    await upsertPlay(service, {
      id: localFixtureId(4, ready.index, index),
      owner: ready,
      gameId: readyGames[(index - 1) % readyGames.length].id,
      playedAt: `2024-02-${String((index % 25) + 1).padStart(2, "0")}T12:00:00.000Z`,
      meetingId: index <= 5 ? readyMeetings[index - 1].id : null,
      participants: [],
    });
  }

  // Natural One: 1/3, 2/3 and 3/3. The ready user's three losses occur
  // before their wins, so Dark Urge can still end with a clean win streak.
  for (const [owner, games, resultCount] of [
    [lastOne, oneGames, 1],
    [lastTwo, twoGames, 2],
  ] as Array<[QaUser, { id: string }[], number]>) {
    for (let index = 1; index <= resultCount; index += 1) {
      await upsertPlay(service, {
        id: localFixtureId(5, owner.index, index),
        owner,
        gameId: games[index - 1].id,
        playedAt: `2025-03-0${index}T12:00:00.000Z`,
        participants: [
          { user: near, placement: 1, winner: true },
          { user: owner, placement: 2 },
        ],
      });
    }
  }
  for (let index = 1; index <= 3; index += 1) {
    await upsertPlay(service, {
      id: localFixtureId(5, ready.index, index),
      owner: ready,
      gameId: readyGames[index].id,
      playedAt: `2025-04-0${index}T12:00:00.000Z`,
      participants: [
        { user: near, placement: 1, winner: true },
        { user: ready, placement: 2 },
      ],
    });
  }
  for (let index = 1; index <= 3; index += 1) {
    await upsertPlay(service, {
      id: localFixtureId(6, ready.index, index),
      owner: ready,
      gameId: readyGames[index + 5].id,
      playedAt: `2025-05-0${index}T12:00:00.000Z`,
      participants: [
        { user: ready, placement: 1, winner: true },
        { user: near, placement: 2 },
      ],
    });
  }
  for (let index = 1; index <= 2; index += 1) {
    await upsertPlay(service, {
      id: localFixtureId(6, near.index, index),
      owner: near,
      gameId: nearGames[index].id,
      playedAt: `2025-06-0${index}T12:00:00.000Z`,
      participants: [
        { user: near, placement: 1, winner: true },
        { user: ready, placement: 2 },
      ],
    });
  }
  for (let index = 1; index <= 4; index += 1) {
    await upsertPlay(service, {
      id: localFixtureId(6, broken.index, index),
      owner: broken,
      gameId: brokenGames[index - 1].id,
      playedAt: `2025-07-0${index}T12:00:00.000Z`,
      participants: [
        { user: broken, placement: index === 2 ? 2 : 1, winner: index !== 2 },
        { user: near, placement: index === 2 ? 1 : 2, winner: index === 2 },
      ],
    });
  }

  for (let index = 1; index <= 3; index += 1) {
    await upsertPlay(service, {
      id: localFixtureId(8, coop.index, index),
      owner: coop,
      gameId: coopGames[index - 1].id,
      playedAt: `2025-09-0${index}T12:00:00.000Z`,
      // Prawdziwy tryb kooperacyjny: wynik należy do drużyny, miejsc nie ma
      // wcale. Wcześniej ten fixture udawał kooperację zapisem 1/1/1, który w
      // nowym modelu jest po prostu remisem w partii rywalizacyjnej.
      mode: "cooperative",
      teamResult: "win",
      participants: [
        { user: coop, placement: null, winner: true },
        { user: lastOne, placement: null, winner: true },
        { user: lastTwo, placement: null, winner: true },
      ],
    });
  }

  await upsertPlay(service, {
    id: localFixtureId(7, ready.index, 1),
    owner: ready,
    gameId: readyGames[12].id,
    playedAt: "2025-08-01T12:00:00.000Z",
    participants: [
      { user: ready, placement: 1, winner: true },
      { user: near, placement: 2 },
      { user: lastOne, placement: 3 },
      { user: lastTwo, placement: 4 },
      { user: broken, placement: 5 },
    ],
  });
  await upsertPlay(service, {
    id: localFixtureId(7, ready.index, 2),
    owner: ready,
    gameId: readyGames[13].id,
    playedAt: "2025-08-02T12:00:00.000Z",
    participants: [{ user: ready, placement: 1, winner: true }],
  });
}

async function asUser(config: LocalConfig, user: QaUser) {
  const client = createClient(config.url, config.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await client.auth.signInWithPassword({
    email: user.email,
    password: QA_PASSWORD,
  });
  assertOk(signIn.error, `Nie udało się zalogować ${user.email}`);
  return client;
}

async function assertResultFixtureReady(
  service: SupabaseClient,
  playId: string,
  expectedOwnerId: string,
) {
  const play = await service
    .from("plays")
    .select("id, created_by")
    .eq("id", playId)
    .maybeSingle();
  assertOk(play.error, `Nie udało się sprawdzić partii QA ${playId}`);
  if (!play.data) {
    throw new Error(
      `Fixture’y nieprzygotowane: brak partii ${playId}. Uruchom ponownie \`pnpm qa:achievements\`.`,
    );
  }
  if (play.data.created_by !== expectedOwnerId) {
    throw new Error(
      `Fixture’y nieprzygotowane: partia ${playId} ma niewłaściwego autora. Uruchom ponownie \`pnpm qa:achievements\`.`,
    );
  }

  const participants = await service
    .from("play_participants")
    .select("user_id")
    .eq("play_id", playId);
  assertOk(
    participants.error,
    `Nie udało się sprawdzić uczestników partii QA ${playId}`,
  );
  if ((participants.data?.length ?? 0) < 2) {
    throw new Error(
      `Fixture’y nieprzygotowane: partia ${playId} nie ma kompletnego zestawu uczestników. Uruchom ponownie \`pnpm qa:achievements\`.`,
    );
  }
}

async function runAutomations(
  config: LocalConfig,
  users: QaUser[],
  service: SupabaseClient,
) {
  const byIndex = new Map(users.map((user) => [user.index, user]));
  const near = byIndex.get(1)!;
  const ready = byIndex.get(2)!;
  const one = byIndex.get(3)!;
  const two = byIndex.get(4)!;
  const broken = byIndex.get(5)!;
  const coop = byIndex.get(8)!;

  for (const user of [near, ready]) {
    const client = await asUser(config, user);
    assertOk(
      (await client.rpc("award_current_user_simple_achievements")).error,
      `Nie udało się uruchomić prostych automatyzacji dla ${user.name}`,
    );
  }

  for (const [user, playIds] of [
    [one, [localFixtureId(5, one.index, 1)]],
    [two, [localFixtureId(5, two.index, 1), localFixtureId(5, two.index, 2)]],
    [
      ready,
      [localFixtureId(5, ready.index, 3), localFixtureId(6, ready.index, 3)],
    ],
    [near, [localFixtureId(6, near.index, 2)]],
    [broken, [localFixtureId(6, broken.index, 4)]],
    [coop, [localFixtureId(8, coop.index, 3)]],
  ] as Array<[QaUser, string[]]>) {
    const client = await asUser(config, user);
    for (const playId of playIds) {
      await assertResultFixtureReady(service, playId, user.id);
      assertOk(
        (
          await client.rpc("award_play_result_achievements", {
            p_play_id: playId,
          })
        ).error,
        `Nie udało się uruchomić odznak wynikowych dla ${user.name}`,
      );
    }
  }
  const readyClient = await asUser(config, ready);
  assertOk(
    (
      await readyClient.rpc("award_meeting_achievements", {
        p_play_id: localFixtureId(4, ready.index, 5),
      })
    ).error,
    "Nie udało się uruchomić odznaki Gospodarz Obozu",
  );

  const classLocked = byIndex.get(6)!;
  const classReady = byIndex.get(7)!;
  const requirements = await service
    .from("class_requirements")
    .select("achievement_key")
    .eq("class_key", "bard_stolu")
    .order("achievement_key");
  assertOk(requirements.error, "Nie udało się pobrać wymagań klasy Bard Stołu");
  const keys = (requirements.data ?? []).map((row) => row.achievement_key);
  if (keys.length !== 5)
    throw new Error("Bard Stołu powinien mieć pięć wymagań.");
  for (const [user, count] of [
    [classLocked, 4],
    [classReady, 5],
  ] as Array<[QaUser, number]>) {
    assertOk(
      (
        await service.from("user_achievements").upsert(
          keys.slice(0, count).map((achievement_key) => ({
            user_id: user.id,
            achievement_key,
            awarded_by: user.id,
            note: "QA fixture klasy — bez wpływu na produkcyjny flow",
          })),
        )
      ).error,
      `Nie udało się przygotować klasy dla ${user.name}`,
    );
  }
  const classClient = await asUser(config, classReady);
  assertOk(
    (await classClient.rpc("set_active_class", { p_class_key: "bard_stolu" }))
      .error,
    "Nie udało się ustawić aktywnej klasy QA",
  );
}

type QaCheck = {
  check: string;
  expected: string;
  actual: string;
  passed: boolean;
};

function currentWinStreak(
  results: Array<{
    placement: number | null;
    is_winner: boolean;
    played_at: string;
    created_at: string;
    play_id: string;
    mode?: "competitive" | "cooperative";
    team_result?: "win" | "loss" | null;
  }>,
) {
  const ordered = [...results].sort(
    (left, right) =>
      left.played_at.localeCompare(right.played_at) ||
      left.created_at.localeCompare(right.created_at) ||
      left.play_id.localeCompare(right.play_id),
  );
  let streak = 0;
  for (const result of ordered) {
    // Ta sama reguła co private.qualifies_for_achievement dla dark_urge:
    // zwycięstwo to wyłącznie is_winner, a partia bez rozstrzygnięcia
    // (kooperacja bez wyniku drużyny) nie jest w ogóle liczona.
    const hasResult =
      (result.mode ?? "competitive") === "competitive" ||
      (result.team_result ?? null) !== null;
    if (!hasResult) continue;

    streak = result.is_winner ? streak + 1 : 0;
  }
  return streak;
}

async function readExistingQaUsers(service: SupabaseClient) {
  const listed = await service.auth.admin.listUsers({ perPage: 1000 });
  assertOk(listed.error, "Nie udało się odczytać kont QA");
  const byEmail = new Map(
    (listed.data.users ?? []).map((user) => [user.email, user.id]),
  );
  return qaUsers.map(([index, email, name]) => {
    const id = byEmail.get(email);
    if (!id) {
      throw new Error(
        `Brakuje fixture'u ${email}. Uruchom najpierw \`pnpm qa:achievements\`.`,
      );
    }
    return { index, email, name, id } satisfies QaUser;
  });
}

async function assertQaFixturesPrepared(
  service: SupabaseClient,
  users: QaUser[],
) {
  const byIndex = new Map(users.map((user) => [user.index, user]));
  const userIds = users.map((user) => user.id);
  const profiles = await service
    .from("profiles")
    .select("id")
    .in("id", userIds);
  assertOk(profiles.error, "Nie udało się sprawdzić profili QA");
  if ((profiles.data?.length ?? 0) !== userIds.length) {
    throw new Error(
      "Fixture’y nieprzygotowane: brakuje wymaganych profili. Uruchom `pnpm qa:achievements`.",
    );
  }

  const requiredResultPlayIds = [
    localFixtureId(5, byIndex.get(3)!.index, 1),
    localFixtureId(5, byIndex.get(4)!.index, 1),
    localFixtureId(5, byIndex.get(4)!.index, 2),
    ...[1, 2, 3].map((index) =>
      localFixtureId(5, byIndex.get(2)!.index, index),
    ),
    ...[1, 2, 3].map((index) =>
      localFixtureId(8, byIndex.get(8)!.index, index),
    ),
  ];
  const [plays, participants] = await Promise.all([
    service.from("plays").select("id").in("id", requiredResultPlayIds),
    service
      .from("play_participants")
      .select("play_id")
      .in("play_id", requiredResultPlayIds),
  ]);
  assertOk(plays.error, "Nie udało się sprawdzić wymaganych partii QA");
  assertOk(
    participants.error,
    "Nie udało się sprawdzić wymaganych uczestników QA",
  );
  const existingPlayIds = new Set((plays.data ?? []).map((play) => play.id));
  const participantCounts = new Map<string, number>();
  for (const participant of participants.data ?? []) {
    participantCounts.set(
      participant.play_id,
      (participantCounts.get(participant.play_id) ?? 0) + 1,
    );
  }
  const missing = requiredResultPlayIds.filter(
    (playId) =>
      !existingPlayIds.has(playId) || (participantCounts.get(playId) ?? 0) < 2,
  );
  if (missing.length > 0) {
    throw new Error(
      `Fixture’y nieprzygotowane: brakuje kompletnych partii ${missing.join(", ")}. Uruchom \`pnpm qa:achievements\`.`,
    );
  }
}

async function checkQaFixtures(config: LocalConfig, service: SupabaseClient) {
  const users = await readExistingQaUsers(service);
  await assertQaFixturesPrepared(service, users);
  const byIndex = new Map(users.map((user) => [user.index, user]));
  const checkedUsers = [
    byIndex.get(1)!,
    byIndex.get(2)!,
    byIndex.get(3)!,
    byIndex.get(4)!,
    byIndex.get(5)!,
    byIndex.get(8)!,
  ];
  const ownParticipantsResult = await service
    .from("play_participants")
    .select("play_id, user_id, placement, is_winner")
    .in(
      "user_id",
      checkedUsers.map((user) => user.id),
    );
  assertOk(ownParticipantsResult.error, "Nie udało się sprawdzić wyników QA");
  const playIds = [
    ...new Set((ownParticipantsResult.data ?? []).map((row) => row.play_id)),
  ];
  const [participantsResult, playsResult, awardsResult, meetingsResult] =
    await Promise.all([
      service
        .from("play_participants")
        .select("play_id, user_id, placement, is_winner")
        .in("play_id", playIds),
      service
        .from("plays")
        .select(
          "id, meeting_id, created_by, played_at, created_at, mode, team_result",
        )
        .in("id", playIds),
      service
        .from("user_achievements")
        .select("user_id, achievement_key")
        .in(
          "user_id",
          users.map((user) => user.id),
        ),
      service
        .from("meetings")
        .select("id, created_by")
        .in("created_by", [byIndex.get(1)!.id, byIndex.get(2)!.id]),
    ]);
  assertOk(
    participantsResult.error,
    "Nie udało się sprawdzić składów partii QA",
  );
  assertOk(playsResult.error, "Nie udało się sprawdzić partii QA");
  assertOk(awardsResult.error, "Nie udało się sprawdzić odznak QA");
  assertOk(meetingsResult.error, "Nie udało się sprawdzić spotkań QA");

  const hostedMeetingIds = (meetingsResult.data ?? []).map(
    (meeting) => meeting.id,
  );
  const hostedPlaysResult = await service
    .from("plays")
    .select("meeting_id")
    .in("meeting_id", hostedMeetingIds);
  assertOk(
    hostedPlaysResult.error,
    "Nie udało się sprawdzić zakończonych spotkań QA",
  );

  const placementsByPlay = new Map<string, Array<number | null>>();
  for (const participant of participantsResult.data ?? []) {
    const placements = placementsByPlay.get(participant.play_id) ?? [];
    placements.push(participant.placement);
    placementsByPlay.set(participant.play_id, placements);
  }
  const playsById = new Map(
    (playsResult.data ?? []).map((play) => [play.id, play]),
  );
  const resultsByUser = new Map<
    string,
    Array<{
      placement: number | null;
      is_winner: boolean;
      played_at: string;
      created_at: string;
      play_id: string;
      mode: "competitive" | "cooperative";
      team_result: "win" | "loss" | null;
    }>
  >();
  for (const participant of ownParticipantsResult.data ?? []) {
    const play = playsById.get(participant.play_id);
    if (!play) continue;
    const rows = resultsByUser.get(participant.user_id) ?? [];
    rows.push({
      placement: participant.placement,
      is_winner: participant.is_winner,
      played_at: play.played_at,
      created_at: play.created_at,
      play_id: participant.play_id,
      mode: play.mode,
      team_result: play.team_result,
    });
    resultsByUser.set(participant.user_id, rows);
  }
  const realLastPlaces = (user: QaUser) =>
    (resultsByUser.get(user.id) ?? []).filter((result) =>
      isRealLastPlace(
        placementsByPlay.get(result.play_id) ?? [],
        result.placement,
      ),
    ).length;
  const naturalOneProgress = (user: QaUser) =>
    Math.min(realLastPlaces(user), 3);
  const hasAward = (user: QaUser, key: string) =>
    (awardsResult.data ?? []).some(
      (award) => award.user_id === user.id && award.achievement_key === key,
    );

  const completedMeetingIds = new Set(
    (hostedPlaysResult.data ?? [])
      .map((play) => play.meeting_id)
      .filter((meetingId): meetingId is string => Boolean(meetingId)),
  );
  const completedHosted = (user: QaUser) =>
    (meetingsResult.data ?? []).filter(
      (meeting) =>
        meeting.created_by === user.id && completedMeetingIds.has(meeting.id),
    ).length;

  const classRequirements = await service
    .from("class_requirements")
    .select("achievement_key")
    .eq("class_key", "bard_stolu");
  assertOk(classRequirements.error, "Nie udało się sprawdzić wymagań klasy QA");
  const requirementKeys = new Set(
    (classRequirements.data ?? []).map((row) => row.achievement_key),
  );
  const classProgress = (user: QaUser) =>
    (awardsResult.data ?? []).filter(
      (award) =>
        award.user_id === user.id && requirementKeys.has(award.achievement_key),
    ).length;
  const activeProfile = await service
    .from("profiles")
    .select("active_class_key")
    .eq("id", byIndex.get(7)!.id)
    .single();
  assertOk(activeProfile.error, "Nie udało się sprawdzić aktywnej klasy QA");
  const activeClassKey = activeProfile.data?.active_class_key ?? null;

  const lockedClient = await asUser(config, byIndex.get(6)!);
  const hiddenSecrets = await lockedClient
    .from("achievement_definitions")
    .select("achievement_key")
    .eq("is_secret", true);
  assertOk(hiddenSecrets.error, "Nie udało się sprawdzić RLS sekretów QA");
  const manualDefinitions = await service
    .from("achievement_definitions")
    .select("achievement_key")
    .eq("is_manual", true);
  assertOk(
    manualDefinitions.error,
    "Nie udało się sprawdzić ręcznych odznak QA",
  );

  const one = byIndex.get(3)!;
  const two = byIndex.get(4)!;
  const ready = byIndex.get(2)!;
  const near = byIndex.get(1)!;
  const coop = byIndex.get(8)!;
  const classLocked = byIndex.get(6)!;
  const classReady = byIndex.get(7)!;
  const checks: QaCheck[] = [];
  const add = (
    check: string,
    expected: string,
    actual: string,
    passed: boolean,
  ) => checks.push({ check, expected, actual, passed });

  add(
    "natural_one 1/3",
    "1",
    String(naturalOneProgress(one)),
    naturalOneProgress(one) === 1,
  );
  add(
    "natural_one 2/3",
    "2",
    String(naturalOneProgress(two)),
    naturalOneProgress(two) === 2,
  );
  add(
    "natural_one 3/3",
    "3 + zdobyta",
    `${naturalOneProgress(ready)} + ${hasAward(ready, "natural_one") ? "zdobyta" : "brak"}`,
    naturalOneProgress(ready) === 3 && hasAward(ready, "natural_one"),
  );
  add(
    "Kooperacja 1/1/1 nie liczy natural_one",
    "0",
    String(realLastPlaces(coop)),
    realLastPlaces(coop) === 0 && !hasAward(coop, "natural_one"),
  );
  const coopStreak = currentWinStreak(resultsByUser.get(coop.id) ?? []);
  add(
    "dark_urge z 3 kooperacyjnych wygranych",
    "3 + zdobyta",
    `${coopStreak} + ${hasAward(coop, "dark_urge") ? "zdobyta" : "brak"}`,
    coopStreak >= 3 && hasAward(coop, "dark_urge"),
  );
  add(
    "camp_host 4/5",
    "4",
    String(completedHosted(near)),
    completedHosted(near) === 4,
  );
  add(
    "camp_host 5/5",
    "5",
    String(completedHosted(ready)),
    completedHosted(ready) === 5,
  );
  add(
    "Klasa 4/5",
    "4",
    String(classProgress(classLocked)),
    classProgress(classLocked) === 4,
  );
  add(
    "Klasa 5/5",
    "5",
    String(classProgress(classReady)),
    classProgress(classReady) === 5,
  );
  add(
    "Aktywna klasa",
    "bard_stolu",
    activeClassKey ?? "brak",
    activeClassKey === "bard_stolu",
  );
  add(
    "Sekretne definicje są ukryte",
    "0 widocznych",
    `${hiddenSecrets.data?.length ?? 0} widocznych`,
    (hiddenSecrets.data?.length ?? 0) === 0,
  );
  add(
    "Ręczne odznaki pozostają oznaczone jako ręczne",
    "> 0 definicji",
    `${manualDefinitions.data?.length ?? 0} definicji`,
    (manualDefinitions.data?.length ?? 0) > 0,
  );

  console.table(
    checks.map((row) => ({
      Status: row.passed ? "PASS" : "FAIL",
      Sprawdzenie: row.check,
      Oczekiwano: row.expected,
      Otrzymano: row.actual,
    })),
  );
  const failed = checks.filter((row) => !row.passed);
  if (failed.length > 0) {
    throw new Error(
      `QA odznak: ${failed.length} sprawdzeń zakończyło się błędem.`,
    );
  }
  console.log(`QA odznak: PASS (${checks.length}/${checks.length}).`);
}

async function resetQaFixtures(service: SupabaseClient) {
  const listed = await service.auth.admin.listUsers({ perPage: 1000 });
  assertOk(listed.error, "Nie udało się odczytać lokalnych użytkowników QA");
  const users = (listed.data.users ?? []).filter((user) =>
    user.email?.startsWith("qa-achievements-"),
  );
  const ids = users.map((user) => user.id);

  if (ids.length > 0) {
    for (const [table, column] of [
      ["user_achievements", "user_id"],
      ["play_participants", "user_id"],
      ["ratings", "user_id"],
      ["meeting_availability", "user_id"],
      ["meeting_game_responses", "user_id"],
      ["plays", "created_by"],
      ["meetings", "created_by"],
      ["games", "owner_id"],
    ] as const) {
      assertOk(
        (await service.from(table).delete().in(column, ids)).error,
        `Nie udało się usunąć fixture'ów QA z ${table}`,
      );
    }
    resetQaPointEventsLocal(ids);
    for (const user of users) {
      assertOk(
        (await service.auth.admin.deleteUser(user.id)).error,
        `Nie udało się usunąć ${user.email}`,
      );
    }
  }
  rmSync(qaReadyMarker, { force: true });
  console.log(`Usunięto ${ids.length} użytkowników QA odznak i ich fixture'y.`);
}

async function main() {
  assertQaEnvironment(process.env);
  const config = readLocalConfig();
  const service = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (process.argv.includes("--reset")) {
    await resetQaFixtures(service);
    console.log(
      "Lokalna baza została zresetowana. Uruchom teraz `pnpm qa:achievements`.",
    );
    return;
  }
  if (process.argv.includes("--check") && !existsSync(qaReadyMarker)) {
    throw new Error(
      "Fixture’y nieprzygotowane, uruchom `pnpm qa:achievements`.",
    );
  }
  if (process.argv.includes("--check")) {
    await checkQaFixtures(config, service);
    return;
  }
  rmSync(qaReadyMarker, { force: true });
  const users = await ensureQaUsers(service);
  await prepareProgressFixtures(service, users);
  await runAutomations(config, users, service);
  mkdirSync(dirname(qaReadyMarker), { recursive: true });
  writeFileSync(qaReadyMarker, "ready\n", "utf8");
  console.log("Gotowe: lokalne fixture'y QA odznak zostały przygotowane.");
  console.log("Konta testowe:");
  for (const scenario of QA_SCENARIOS) {
    console.log(
      `- ${scenario.email}: ${scenario.label} (${scenario.expected.join(", ")})`,
    );
  }
  console.log(`Wspólne hasło: ${QA_PASSWORD}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
