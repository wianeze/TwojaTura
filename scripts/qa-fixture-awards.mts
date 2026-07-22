import { execFileSync } from "node:child_process";
import type { SupabaseClient } from "@supabase/supabase-js";

export type QaAwardDefinition = {
  key: string;
  name: string;
  points: number;
};

function assertOk(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

/** Local QA equivalent of awarding an achievement and its ledger event. */
export async function syncQaAwardsWithPoints(
  service: SupabaseClient,
  userId: string,
  definitions: QaAwardDefinition[],
  note: string,
) {
  assertOk(
    (await service.from("user_achievements").delete().eq("user_id", userId))
      .error,
    "Nie udało się wyczyścić odznak fixture’u QA",
  );

  if (definitions.length === 0) return;

  assertOk(
    (
      await service.from("user_achievements").upsert(
        definitions.map((definition) => ({
          user_id: userId,
          achievement_key: definition.key,
          awarded_by: userId,
          note,
        })),
      )
    ).error,
    "Nie udało się zapisać odznak fixture’u QA",
  );

  const existing = await service
    .from("point_events")
    .select("action_type")
    .eq("user_id", userId);
  assertOk(existing.error, "Nie udało się odczytać punktów fixture’u QA");
  const actionTypes = new Set(
    (existing.data ?? []).map((event) => event.action_type),
  );
  const events = definitions
    .filter((definition) => definition.points > 0)
    .filter(
      (definition) =>
        !actionTypes.has(`achievement_unlocked:${definition.key}`),
    )
    .map((definition) => ({
      user_id: userId,
      points: definition.points,
      action_type: `achievement_unlocked:${definition.key}`,
      description: `Odznaka: ${definition.name}`,
      related_entity_type: "profile",
      related_entity_id: userId,
      created_by: userId,
    }));
  if (events.length === 0) return;

  assertOk(
    (await service.from("point_events").insert(events)).error,
    "Nie udało się przyznać punktów fixture’u QA",
  );
}

/** Local-only cleanup for already verified QA profile ids. */
export function resetQaPointEventsLocal(userIds: string[]) {
  if (userIds.length === 0) return;
  const container = execFileSync(
    "docker",
    ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
    { encoding: "utf8" },
  )
    .split(/\r?\n/)
    .map((name) => name.trim())
    .find(Boolean);
  if (!container) {
    throw new Error("Nie znaleziono lokalnego kontenera Supabase Postgres.");
  }
  const ids = userIds.map((id) => `'${id}'`).join(", ");
  const sql = `begin;
    alter table public.point_events disable trigger point_events_append_only;
    delete from public.point_events where user_id in (${ids});
    alter table public.point_events enable trigger point_events_append_only;
    commit;`;
  execFileSync(
    "docker",
    [
      "exec",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  );
}
