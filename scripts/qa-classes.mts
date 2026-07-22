import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  assertQaEnvironment,
  qaClassEmail,
  QA_PASSWORD,
} from "./qa-classes-contract.mts";
import {
  syncQaAwardsWithPoints,
  resetQaPointEventsLocal,
  type QaAwardDefinition,
} from "./qa-fixture-awards.mts";

type LocalConfig = { url: string; anonKey: string; serviceRoleKey: string };
type QaClass = { key: string; name: string; iconPath: string | null };
type QaClassUser = QaClass & { email: string; id: string };

const qaReadyMarker = resolve("supabase/.temp/qa-classes-ready");
const qaEmailPrefix = "qa-class-";
const qaAllClassesEmail = "qa-class-all@twojatura.local";
const qaAllClassesName = "QA Wszystkie Klasy";

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

async function readQaClasses(service: SupabaseClient): Promise<QaClass[]> {
  const result = await service
    .from("class_definitions")
    .select("class_key, name, icon_path")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  assertOk(result.error, "Nie udało się pobrać definicji klas");
  const classes = (result.data ?? []).map((definition) => ({
    key: definition.class_key,
    name: definition.name,
    iconPath: definition.icon_path,
  }));
  if (classes.length !== 14) {
    throw new Error(
      `QA klas wymaga 14 aktywnych klas, znaleziono: ${classes.length}.`,
    );
  }
  return classes;
}

async function readRequirements(service: SupabaseClient) {
  const result = await service
    .from("class_requirements")
    .select("class_key, achievement_key");
  assertOk(result.error, "Nie udało się pobrać wymagań klas");
  const requirementsByClass = new Map<string, string[]>();
  for (const requirement of result.data ?? []) {
    const current = requirementsByClass.get(requirement.class_key) ?? [];
    current.push(requirement.achievement_key);
    requirementsByClass.set(requirement.class_key, current);
  }
  return requirementsByClass;
}

async function readAchievementDefinitions(service: SupabaseClient) {
  const result = await service
    .from("achievement_definitions")
    .select("achievement_key, name, points")
    .eq("is_active", true);
  assertOk(result.error, "Nie udało się pobrać definicji odznak QA klas");
  return new Map<string, QaAwardDefinition>(
    (result.data ?? []).map((definition) => [
      definition.achievement_key,
      {
        key: definition.achievement_key,
        name: definition.name,
        points: definition.points,
      },
    ]),
  );
}

async function ensureQaClassUsers(
  service: SupabaseClient,
  classes: QaClass[],
): Promise<QaClassUser[]> {
  const listed = await service.auth.admin.listUsers({ perPage: 1000 });
  assertOk(
    listed.error,
    "Nie udało się odczytać lokalnych użytkowników QA klas",
  );
  const byEmail = new Map(
    (listed.data.users ?? []).map((user) => [user.email, user]),
  );
  const users: QaClassUser[] = [];

  for (const characterClass of classes) {
    const email = qaClassEmail(characterClass.key);
    let user = byEmail.get(email);
    if (!user) {
      const created = await service.auth.admin.createUser({
        email,
        password: QA_PASSWORD,
        email_confirm: true,
        user_metadata: {
          twoja_tura_invite: "true",
          display_name: `QA ${characterClass.name}`,
        },
      });
      assertOk(created.error, `Nie udało się utworzyć ${email}`);
      user = created.data.user ?? undefined;
    }
    if (!user) throw new Error(`Brak użytkownika QA klas: ${email}`);

    assertOk(
      (
        await service.from("profiles").upsert({
          id: user.id,
          email,
          display_name: `QA ${characterClass.name}`,
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
    users.push({ ...characterClass, email, id: user.id });
  }
  return users;
}

async function ensureAllClassesUser(
  service: SupabaseClient,
  defaultClass: QaClass,
): Promise<QaClassUser> {
  const listed = await service.auth.admin.listUsers({ perPage: 1000 });
  assertOk(
    listed.error,
    "Nie udało się odczytać użytkownika QA wszystkich klas",
  );
  let user = (listed.data.users ?? []).find(
    (candidate) => candidate.email === qaAllClassesEmail,
  );
  if (!user) {
    const created = await service.auth.admin.createUser({
      email: qaAllClassesEmail,
      password: QA_PASSWORD,
      email_confirm: true,
      user_metadata: {
        twoja_tura_invite: "true",
        display_name: qaAllClassesName,
      },
    });
    assertOk(created.error, "Nie udało się utworzyć QA Wszystkie Klasy");
    user = created.data.user ?? undefined;
  }
  if (!user) throw new Error("Brak użytkownika QA Wszystkie Klasy");

  assertOk(
    (
      await service.from("profiles").upsert({
        id: user.id,
        email: qaAllClassesEmail,
        display_name: qaAllClassesName,
        active_class_key: defaultClass.key,
      })
    ).error,
    "Nie udało się przygotować profilu QA Wszystkie Klasy",
  );
  assertOk(
    (
      await service
        .from("app_members")
        .upsert({ user_id: user.id, role: "member", is_active: true })
    ).error,
    "Nie udało się aktywować QA Wszystkie Klasy",
  );
  return { ...defaultClass, email: qaAllClassesEmail, id: user.id };
}

async function prepareClassFixtures(
  service: SupabaseClient,
  users: QaClassUser[],
  requirementsByClass: Map<string, string[]>,
  definitionsByKey: Map<string, QaAwardDefinition>,
) {
  for (const user of users) {
    const requirementKeys = requirementsByClass.get(user.key) ?? [];
    if (requirementKeys.length === 0) {
      throw new Error(`Klasa ${user.name} nie ma wymaganych odznak.`);
    }

    const definitions = requirementKeys.map((achievementKey) => {
      const definition = definitionsByKey.get(achievementKey);
      if (!definition) {
        throw new Error(
          `Brak definicji odznaki ${achievementKey} dla ${user.name}`,
        );
      }
      return definition;
    });
    await syncQaAwardsWithPoints(
      service,
      user.id,
      definitions,
      "Lokalny fixture QA klasy — bez produkcyjnego flow",
    );
    assertOk(
      (
        await service
          .from("profiles")
          .update({ active_class_key: user.key })
          .eq("id", user.id)
      ).error,
      `Nie udało się ustawić aktywnej klasy ${user.name}`,
    );
  }
}

async function prepareAllClassesFixture(
  service: SupabaseClient,
  user: QaClassUser,
  requirementsByClass: Map<string, string[]>,
  definitionsByKey: Map<string, QaAwardDefinition>,
) {
  const requirementKeys = [
    ...new Set([...requirementsByClass.values()].flat()),
  ];
  const definitions = requirementKeys.map((achievementKey) => {
    const definition = definitionsByKey.get(achievementKey);
    if (!definition)
      throw new Error(`Brak definicji odznaki ${achievementKey}`);
    return definition;
  });
  await syncQaAwardsWithPoints(
    service,
    user.id,
    definitions,
    "Lokalny fixture QA wszystkich klas — bez produkcyjnego flow",
  );
}

async function resetQaClassFixtures(service: SupabaseClient) {
  const listed = await service.auth.admin.listUsers({ perPage: 1000 });
  assertOk(listed.error, "Nie udało się odczytać użytkowników QA klas");
  const users = (listed.data.users ?? []).filter((user) =>
    user.email?.startsWith(qaEmailPrefix),
  );
  const ids = users.map((user) => user.id);

  if (ids.length > 0) {
    assertOk(
      (await service.from("user_achievements").delete().in("user_id", ids))
        .error,
      "Nie udało się usunąć odznak użytkowników QA klas",
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
  console.log(`Usunięto ${ids.length} użytkowników QA klas i ich fixture’y.`);
}

type QaClassCheck = {
  check: string;
  expected: string;
  actual: string;
  passed: boolean;
};

async function checkQaClassFixtures(
  config: LocalConfig,
  service: SupabaseClient,
) {
  const classes = await readQaClasses(service);
  const requirementsByClass = await readRequirements(service);
  const listed = await service.auth.admin.listUsers({ perPage: 1000 });
  assertOk(listed.error, "Nie udało się odczytać użytkowników QA klas");
  const byEmail = new Map(
    (listed.data.users ?? []).map((user) => [user.email, user.id]),
  );
  const users = classes.map((characterClass) => ({
    ...characterClass,
    email: qaClassEmail(characterClass.key),
    id: byEmail.get(qaClassEmail(characterClass.key)) ?? null,
  }));
  const allClassesId = byEmail.get(qaAllClassesEmail) ?? null;
  const allClassesUser = classes.find(
    (characterClass) => characterClass.key === "bard_stolu",
  );
  if (!allClassesUser)
    throw new Error("Brak klasy bard_stolu w fixture’ach QA");
  const userIds = [
    ...users.flatMap((user) => (user.id ? [user.id] : [])),
    ...(allClassesId ? [allClassesId] : []),
  ];
  const [profiles, awards] = await Promise.all([
    service.from("profiles").select("id, active_class_key").in("id", userIds),
    service
      .from("user_achievements")
      .select("user_id, achievement_key")
      .in("user_id", userIds),
  ]);
  assertOk(profiles.error, "Nie udało się odczytać profili QA klas");
  assertOk(awards.error, "Nie udało się odczytać odznak QA klas");
  const activeClassByUser = new Map(
    (profiles.data ?? []).map((profile) => [
      profile.id,
      profile.active_class_key,
    ]),
  );
  const awardsByUser = new Map<string, Set<string>>();
  for (const award of awards.data ?? []) {
    const current = awardsByUser.get(award.user_id) ?? new Set<string>();
    current.add(award.achievement_key);
    awardsByUser.set(award.user_id, current);
  }

  const leaderboardClient = createClient(config.url, config.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const firstQaUser = users.find((user) => user.id);
  if (!firstQaUser) {
    throw new Error(
      "Fixture’y klas nieprzygotowane, uruchom `pnpm qa:classes`.",
    );
  }
  const signedIn = await leaderboardClient.auth.signInWithPassword({
    email: firstQaUser.email,
    password: QA_PASSWORD,
  });
  assertOk(signedIn.error, "Nie udało się zalogować użytkownika QA klas");
  const leaderboard = await leaderboardClient.rpc("get_leaderboard");
  assertOk(leaderboard.error, "Nie udało się odczytać leaderboardu QA klas");
  const leaderboardEntries = (leaderboard.data ?? []) as Array<{
    user_id: string;
  }>;
  const leaderboardIds = new Set(
    leaderboardEntries.map((entry) => entry.user_id),
  );

  const checks: QaClassCheck[] = [];
  const add = (
    check: string,
    expected: string,
    actual: string,
    passed: boolean,
  ) => checks.push({ check, expected, actual, passed });
  add(
    "Liczba użytkowników QA klas",
    "15",
    String(userIds.length),
    userIds.length === 15,
  );
  for (const user of users) {
    const requirementKeys = requirementsByClass.get(user.key) ?? [];
    const actualAwards = user.id
      ? (awardsByUser.get(user.id) ?? new Set())
      : new Set();
    const hasRequirements = requirementKeys.every((key) =>
      actualAwards.has(key),
    );
    add(
      `${user.name}: aktywna klasa`,
      user.key,
      user.id ? (activeClassByUser.get(user.id) ?? "brak") : "brak użytkownika",
      Boolean(user.id) && activeClassByUser.get(user.id) === user.key,
    );
    add(
      `${user.name}: wymagane odznaki`,
      `${requirementKeys.length}/${requirementKeys.length}`,
      `${requirementKeys.filter((key) => actualAwards.has(key)).length}/${requirementKeys.length}`,
      hasRequirements,
    );
    add(
      `${user.name}: emblemat klasy`,
      "icon_path",
      user.iconPath ?? "brak",
      Boolean(user.iconPath),
    );
    add(
      `${user.name}: leaderboard`,
      "widoczny",
      user.id !== null && leaderboardIds.has(user.id) ? "widoczny" : "brak",
      user.id !== null && leaderboardIds.has(user.id),
    );
  }
  const allRequirementKeys = [
    ...new Set([...requirementsByClass.values()].flat()),
  ];
  const allAwards = allClassesId
    ? (awardsByUser.get(allClassesId) ?? new Set<string>())
    : new Set<string>();
  add(
    "QA Wszystkie Klasy: użytkownik",
    "istnieje",
    allClassesId ? "istnieje" : "brak",
    Boolean(allClassesId),
  );
  add(
    "QA Wszystkie Klasy: wszystkie wymagane odznaki",
    `${allRequirementKeys.length}/${allRequirementKeys.length}`,
    `${allRequirementKeys.filter((key) => allAwards.has(key)).length}/${allRequirementKeys.length}`,
    allRequirementKeys.every((key) => allAwards.has(key)),
  );
  add(
    "QA Wszystkie Klasy: aktywna klasa",
    "bard_stolu",
    allClassesId ? (activeClassByUser.get(allClassesId) ?? "brak") : "brak",
    Boolean(allClassesId) &&
      activeClassByUser.get(allClassesId) === "bard_stolu",
  );
  add(
    "QA Wszystkie Klasy: leaderboard",
    "widoczny",
    allClassesId && leaderboardIds.has(allClassesId) ? "widoczny" : "brak",
    Boolean(allClassesId && leaderboardIds.has(allClassesId)),
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
      `QA klas: ${failed.length} sprawdzeń zakończyło się błędem.`,
    );
  }
  console.log(`QA klas: PASS (${checks.length}/${checks.length}).`);
}

async function main() {
  assertQaEnvironment(process.env);
  const isCheck = process.argv.includes("--check");
  if (isCheck && !existsSync(qaReadyMarker)) {
    throw new Error(
      "Fixture’y klas nieprzygotowane, uruchom `pnpm qa:classes`.",
    );
  }
  const config = readLocalConfig();
  const service = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (process.argv.includes("--reset")) {
    await resetQaClassFixtures(service);
    return;
  }
  if (isCheck) {
    await checkQaClassFixtures(config, service);
    return;
  }

  rmSync(qaReadyMarker, { force: true });
  const classes = await readQaClasses(service);
  const requirementsByClass = await readRequirements(service);
  const definitionsByKey = await readAchievementDefinitions(service);
  const users = await ensureQaClassUsers(service, classes);
  await prepareClassFixtures(
    service,
    users,
    requirementsByClass,
    definitionsByKey,
  );
  const defaultClass = classes.find(
    (characterClass) => characterClass.key === "bard_stolu",
  );
  if (!defaultClass) throw new Error("Nie znaleziono klasy bard_stolu.");
  const allClassesUser = await ensureAllClassesUser(service, defaultClass);
  await prepareAllClassesFixture(
    service,
    allClassesUser,
    requirementsByClass,
    definitionsByKey,
  );
  mkdirSync(dirname(qaReadyMarker), { recursive: true });
  writeFileSync(qaReadyMarker, "ready\n", "utf8");
  console.log(
    "Gotowe: przygotowano 14 użytkowników QA klas i QA Wszystkie Klasy.",
  );
  console.log(`Wspólne hasło: ${QA_PASSWORD}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
