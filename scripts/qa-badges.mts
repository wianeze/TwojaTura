import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  assertQaEnvironment,
  qaBadgeEmail,
  QA_PASSWORD,
} from "./qa-badges-contract.mts";
import {
  resetQaPointEventsLocal,
  syncQaAwardsWithPoints,
} from "./qa-fixture-awards.mts";

type LocalConfig = { url: string; anonKey: string; serviceRoleKey: string };
type BadgeDefinition = {
  key: string;
  name: string;
  rarity: string;
  points: number;
  isSecret: boolean;
  isManual: boolean;
  iconPath: string | null;
};
type QaBadgeUser = { kind: string; name: string; email: string; id: string };

const qaReadyMarker = resolve("supabase/.temp/qa-badges-ready");
const qaEmailPrefix = "qa-badge-";
const qaBadgeUsers = [
  ["common", "QA Badge Common"],
  ["rare", "QA Badge Rare"],
  ["epic", "QA Badge Epic"],
  ["legendary", "QA Badge Legendary"],
  ["secret-locked", "QA Badge Secret Locked"],
  ["secret-unlocked", "QA Badge Secret Unlocked"],
  ["mixed", "QA Badge Mixed"],
] as const;
type QaBadgeKind = (typeof qaBadgeUsers)[number][0];

function commandName() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function runPnpm(args: string[]) {
  if (process.platform === "win32") {
    return execFileSync(
      "cmd.exe",
      ["/d", "/s", "/c", `${commandName()} ${args.join(" ")}`],
      { encoding: "utf8" },
    );
  }

  return execFileSync(commandName(), args, { encoding: "utf8" });
}

function readLocalConfig(): LocalConfig {
  const output = runPnpm(["dlx", "supabase@2.109.0", "status", "-o", "env"]);
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

function selectBadgeSet(
  definitions: BadgeDefinition[],
  predicate: (definition: BadgeDefinition) => boolean,
  label: string,
  count: number,
) {
  const selected = definitions.filter(predicate).slice(0, count);
  if (selected.length < count) {
    throw new Error(
      `QA badge wymaga ${count} aktywnych definicji dla: ${label}; znaleziono ${selected.length}.`,
    );
  }
  return selected;
}

async function readDefinitions(service: SupabaseClient) {
  const result = await service
    .from("achievement_definitions")
    .select(
      "achievement_key, name, rarity, points, is_secret, is_manual, icon_path",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  assertOk(result.error, "Nie udało się pobrać definicji odznak");
  const definitions: BadgeDefinition[] = (result.data ?? []).map(
    (definition) => ({
      key: definition.achievement_key,
      name: definition.name,
      rarity: definition.rarity,
      points: definition.points,
      isSecret: definition.is_secret,
      isManual: definition.is_manual,
      iconPath: definition.icon_path,
    }),
  );

  const common = selectBadgeSet(
    definitions,
    (definition) =>
      definition.rarity === "common" &&
      !definition.isSecret &&
      definition.points > 0,
    "common",
    2,
  );
  const rare = selectBadgeSet(
    definitions,
    (definition) =>
      definition.rarity === "rare" &&
      !definition.isSecret &&
      definition.points > 0,
    "rare",
    2,
  );
  const epic = selectBadgeSet(
    definitions,
    (definition) =>
      definition.rarity === "epic" &&
      !definition.isSecret &&
      definition.points > 0,
    "epic",
    2,
  );
  const legendary = selectBadgeSet(
    definitions,
    (definition) =>
      definition.rarity === "legendary" &&
      !definition.isSecret &&
      definition.points > 0,
    "legendary",
    3,
  );
  const secret = selectBadgeSet(
    definitions,
    (definition) =>
      (definition.isSecret || definition.rarity === "secret") &&
      definition.points > 0,
    "secret",
    3,
  );

  return { definitions, common, rare, epic, legendary, secret };
}

async function ensureUsers(service: SupabaseClient): Promise<QaBadgeUser[]> {
  const listed = await service.auth.admin.listUsers({ perPage: 1000 });
  assertOk(listed.error, "Nie udało się odczytać użytkowników QA badge’y");
  const byEmail = new Map(
    (listed.data.users ?? []).map((user) => [user.email, user]),
  );
  const users: QaBadgeUser[] = [];

  for (const [kind, name] of qaBadgeUsers) {
    const email = qaBadgeEmail(kind);
    let user = byEmail.get(email);
    if (!user) {
      const created = await service.auth.admin.createUser({
        email,
        password: QA_PASSWORD,
        email_confirm: true,
        user_metadata: { twoja_tura_invite: "true", display_name: name },
      });
      assertOk(created.error, `Nie udało się utworzyć ${email}`);
      user = created.data.user ?? undefined;
    }
    if (!user) throw new Error(`Brak użytkownika QA badge’y: ${email}`);

    assertOk(
      (
        await service.from("profiles").upsert({
          id: user.id,
          email,
          display_name: name,
          active_class_key: null,
        })
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
    users.push({ kind, name, email, id: user.id });
  }
  return users;
}

async function replaceAwards(
  service: SupabaseClient,
  user: QaBadgeUser,
  definitions: BadgeDefinition[],
) {
  await syncQaAwardsWithPoints(
    service,
    user.id,
    definitions,
    "Lokalny fixture QA badge’y — bez produkcyjnego flow",
  );
}

async function prepareFixtures(service: SupabaseClient) {
  const selected = await readDefinitions(service);
  const users = await ensureUsers(service);
  const byKind = new Map(users.map((user) => [user.kind, user]));
  const targets: Record<QaBadgeKind, BadgeDefinition[]> = {
    common: selected.common,
    rare: selected.rare,
    epic: selected.epic,
    legendary: selected.legendary,
    "secret-locked": [],
    "secret-unlocked": selected.secret,
    mixed: [
      ...selected.common,
      ...selected.rare,
      ...selected.epic,
      ...selected.legendary,
      ...selected.secret,
    ],
  };

  for (const kind of Object.keys(targets) as QaBadgeKind[]) {
    const awards = targets[kind];
    const user = byKind.get(kind);
    if (!user) throw new Error(`Brak konfiguracji QA badge dla: ${kind}`);
    await replaceAwards(service, user, awards);
  }
}

async function resetFixtures(service: SupabaseClient) {
  const listed = await service.auth.admin.listUsers({ perPage: 1000 });
  assertOk(listed.error, "Nie udało się odczytać użytkowników QA badge’y");
  const users = (listed.data.users ?? []).filter((user) =>
    user.email?.startsWith(qaEmailPrefix),
  );
  const ids = users.map((user) => user.id);

  if (ids.length > 0) {
    assertOk(
      (await service.from("user_achievements").delete().in("user_id", ids))
        .error,
      "Nie udało się usunąć odznak użytkowników QA badge’y",
    );
    resetQaPointEventsLocal(ids);
    for (const user of users) {
      assertOk(
        (await service.auth.admin.deleteUser(user.id)).error,
        `Nie udało się usunąć ${user.email}`,
      );
    }
  }
  rmSync(qaReadyMarker, { force: true });
  console.log(
    `Usunięto ${ids.length} użytkowników QA badge’y i ich fixture’y.`,
  );
}

type QaCheck = {
  check: string;
  expected: string;
  actual: string;
  passed: boolean;
};

async function checkFixtures(config: LocalConfig, service: SupabaseClient) {
  const selected = await readDefinitions(service);
  const listed = await service.auth.admin.listUsers({ perPage: 1000 });
  assertOk(listed.error, "Nie udało się odczytać użytkowników QA badge’y");
  const byEmail = new Map(
    (listed.data.users ?? []).map((user) => [user.email, user.id]),
  );
  const users = qaBadgeUsers.map(([kind, name]) => ({
    kind,
    name,
    id: byEmail.get(qaBadgeEmail(kind)) ?? null,
  }));
  const userIds = users.flatMap((user) => (user.id ? [user.id] : []));
  const [awards, pointEvents] = await Promise.all([
    service
      .from("user_achievements")
      .select("user_id, achievement_key")
      .in("user_id", userIds),
    service
      .from("point_events")
      .select("user_id, points")
      .in("user_id", userIds),
  ]);
  assertOk(awards.error, "Nie udało się odczytać odznak QA badge’y");
  assertOk(pointEvents.error, "Nie udało się odczytać punktów QA badge’y");
  const awardsByUser = new Map<string, Set<string>>();
  for (const award of awards.data ?? []) {
    const current = awardsByUser.get(award.user_id) ?? new Set<string>();
    current.add(award.achievement_key);
    awardsByUser.set(award.user_id, current);
  }
  const pointsByUser = new Map<string, number>();
  for (const event of pointEvents.data ?? []) {
    pointsByUser.set(
      event.user_id,
      (pointsByUser.get(event.user_id) ?? 0) + event.points,
    );
  }

  const leaderboardClient = createClient(config.url, config.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await leaderboardClient.auth.signInWithPassword({
    email: qaBadgeEmail("legendary"),
    password: QA_PASSWORD,
  });
  assertOk(signedIn.error, "Nie udało się zalogować użytkownika QA badge’y");
  const leaderboard = await leaderboardClient.rpc("get_leaderboard");
  assertOk(leaderboard.error, "Nie udało się odczytać leaderboardu QA badge’y");
  const leaderboardIds = new Set(
    ((leaderboard.data ?? []) as Array<{ user_id: string }>).map(
      (entry) => entry.user_id,
    ),
  );

  const checks: QaCheck[] = [];
  const add = (
    check: string,
    expected: string,
    actual: string,
    passed: boolean,
  ) => checks.push({ check, expected, actual, passed });
  add(
    "Liczba użytkowników QA badge’y",
    "7",
    String(userIds.length),
    userIds.length === 7,
  );

  const userByKind = new Map(users.map((user) => [user.kind, user]));
  const hasAll = (kind: QaBadgeKind, expected: BadgeDefinition[]) => {
    const user = userByKind.get(kind);
    const actual = user?.id
      ? (awardsByUser.get(user.id) ?? new Set<string>())
      : new Set<string>();
    return expected.every((definition) => actual.has(definition.key));
  };
  add(
    "Legendary: odznaka legendarna",
    "zdobyta",
    hasAll("legendary", selected.legendary) ? "zdobyta" : "brak",
    hasAll("legendary", selected.legendary),
  );
  for (const kind of [
    "common",
    "rare",
    "epic",
    "legendary",
    "secret-unlocked",
    "mixed",
  ] as QaBadgeKind[]) {
    const user = userByKind.get(kind);
    const awardCount = user?.id ? (awardsByUser.get(user.id)?.size ?? 0) : 0;
    const points = user?.id ? (pointsByUser.get(user.id) ?? 0) : 0;
    add(
      `${user?.name ?? kind}: odznaki`,
      ">0",
      String(awardCount),
      awardCount > 0,
    );
    add(`${user?.name ?? kind}: punkty`, ">0", String(points), points > 0);
  }
  const lockedUser = userByKind.get("secret-locked");
  const lockedAwards = lockedUser?.id
    ? (awardsByUser.get(lockedUser.id) ?? new Set<string>())
    : new Set<string>();
  const secretKeys = new Set(
    selected.secret.map((definition) => definition.key),
  );
  add(
    "Secret locked: brak zdobytych sekretów",
    "0",
    String([...lockedAwards].filter((key) => secretKeys.has(key)).length),
    ![...lockedAwards].some((key) => secretKeys.has(key)),
  );
  add(
    "Secret unlocked: sekretna odznaka",
    "zdobyta",
    hasAll("secret-unlocked", selected.secret) ? "zdobyta" : "brak",
    hasAll("secret-unlocked", selected.secret),
  );
  const mixedExpected = [
    ...selected.common,
    ...selected.rare,
    ...selected.epic,
    ...selected.legendary,
    ...selected.secret,
  ];
  add(
    "Mixed: wszystkie warianty rarity",
    "common, rare, epic, legendary, secret",
    hasAll("mixed", mixedExpected) ? "komplet" : "brak",
    hasAll("mixed", mixedExpected),
  );
  const legendaryUser = userByKind.get("legendary");
  const mixedUser = userByKind.get("mixed");
  add(
    "Legendary: widoczny w leaderboardzie",
    "widoczny",
    legendaryUser?.id && leaderboardIds.has(legendaryUser.id)
      ? "widoczny"
      : "brak",
    legendaryUser?.id !== null &&
      legendaryUser?.id !== undefined &&
      leaderboardIds.has(legendaryUser.id),
  );
  add(
    "Mixed: widoczny w leaderboardzie",
    "widoczny",
    mixedUser?.id && leaderboardIds.has(mixedUser.id) ? "widoczny" : "brak",
    Boolean(mixedUser?.id && leaderboardIds.has(mixedUser.id)),
  );
  add(
    "Wybrane odznaki mają grafiki",
    "icon_path",
    mixedExpected.every((definition) => Boolean(definition.iconPath))
      ? "komplet"
      : "brak",
    mixedExpected.every((definition) => Boolean(definition.iconPath)),
  );

  console.table(
    checks.map((row) => ({
      Status: row.passed ? "PASS" : "FAIL",
      Sprawdzenie: row.check,
      Oczekiwano: row.expected,
      Otrzymano: row.actual,
    })),
  );
  const failed = checks.filter((check) => !check.passed);
  if (failed.length > 0) {
    throw new Error(
      `QA badge’y: ${failed.length} sprawdzeń zakończyło się błędem.`,
    );
  }
  console.log(`QA badge’y: PASS (${checks.length}/${checks.length}).`);
}

async function main() {
  assertQaEnvironment(process.env);
  const isCheck = process.argv.includes("--check");
  if (isCheck && !existsSync(qaReadyMarker)) {
    throw new Error(
      "Fixture’y badge’y nieprzygotowane, uruchom `pnpm qa:badges`.",
    );
  }
  const config = readLocalConfig();
  const service = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (process.argv.includes("--reset")) {
    await resetFixtures(service);
    return;
  }
  if (isCheck) {
    await checkFixtures(config, service);
    return;
  }

  rmSync(qaReadyMarker, { force: true });
  await prepareFixtures(service);
  mkdirSync(dirname(qaReadyMarker), { recursive: true });
  writeFileSync(qaReadyMarker, "ready\n", "utf8");
  console.log("Gotowe: przygotowano 7 użytkowników QA badge’y.");
  console.log(`Wspólne hasło: ${QA_PASSWORD}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
