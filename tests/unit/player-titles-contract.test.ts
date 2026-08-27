import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const componentPath = new URL(
  "../../src/components/ui/player-display-name.tsx",
  import.meta.url,
);
const migrationPath = new URL(
  "../../supabase/migrations/20260826130000_player_titles_store.sql",
  import.meta.url,
);
const customizationPath = new URL(
  "../../src/features/profile/player-customization-store.tsx",
  import.meta.url,
);

test("PlayerDisplayName obsługuje compact, standard i hero", async () => {
  const source = await readFile(componentPath, "utf8");
  assert.match(source, /variant = "standard"/);
  assert.match(source, /variant === "compact"/);
  assert.match(source, /✦ \{title\.name\} ✦/);
  assert.doesNotMatch(source, /nickname/i);
  assert.match(source, /\{displayName\}/);
  assert.doesNotMatch(source, / · \{title\.name\}/);
  assert.match(source, /line-clamp-2/);
  assert.match(source, /truncate/);
});

test("Tytuły mają bezpieczny append-only zakup bez osobnego nickname", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.doesNotMatch(sql, /nickname/i);
  assert.match(sql, /add column equipped_title_id uuid/i);
  assert.match(sql, /create or replace function public\.purchase_title/i);
  assert.match(sql, /v_balance < v_title\.price_tukats/i);
  assert.match(sql, /insert into public\.tukat_events/i);
  assert.match(sql, /amount, source_type, source_id, reason, idempotency_key/i);
  assert.match(sql, /create or replace function public\.set_equipped_title/i);
});

test("Zakup i equip nie zależą od formatu legacy display_name", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /create or replace function public\.purchase_title/i);
  assert.match(sql, /create or replace function public\.set_equipped_title/i);
  assert.doesNotMatch(sql, /display_name.*[~!]/i);
});

test("Profil ma jeden moduł Personalizacja z Tytułami i Ramkami", async () => {
  const source = await readFile(customizationPath, "utf8");
  assert.match(source, />\s*Personalizacja\s*</);
  assert.match(source, /title="Ekwipunek"/);
  assert.match(source, /title="Sklep"/);
  assert.match(source, /inventoryTab/);
  assert.match(source, /shopTab/);
  assert.match(source, /lg:grid-cols-2/);
  assert.match(source, /Aktualnie wyposażony/);
});
