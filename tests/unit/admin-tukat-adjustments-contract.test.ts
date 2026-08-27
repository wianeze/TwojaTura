import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  formatAdminTukatAdjustmentTitle,
  formatTukatDelta,
  formatTukats,
  translateTukatAdjustmentError,
  TUKAT_ADJUSTMENT_MAX_AMOUNT,
  validateAdminTukatAdjustment,
} from "../../src/features/admin/tukat-adjustments.ts";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const TARGET_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

function adjustment(
  overrides: Partial<Parameters<typeof validateAdminTukatAdjustment>[0]> = {},
) {
  return validateAdminTukatAdjustment({
    targetUserId: TARGET_ID,
    operation: "grant",
    amount: "20",
    requestId: REQUEST_ID,
    ...overrides,
  });
}

test("kierunek korekty bierze się z operacji, nie ze znaku w polu", () => {
  const granted = adjustment({ operation: "grant", amount: "20" });
  assert.equal(granted.ok, true);
  if (granted.ok) assert.equal(granted.value.delta, 20);

  const revoked = adjustment({ operation: "revoke", amount: "5" });
  assert.equal(revoked.ok, true);
  if (revoked.ok) assert.equal(revoked.value.delta, -5);
});

test("korekta o zero jest odrzucana jako bezsensowna", () => {
  const result = adjustment({ amount: "0" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /nic nie zmienia/);
});

test("pole kwoty przyjmuje wyłącznie dodatnią liczbę całkowitą w rozsądnym zakresie", () => {
  assert.equal(adjustment({ amount: "" }).ok, false);
  assert.equal(adjustment({ amount: "  " }).ok, false);
  assert.equal(adjustment({ amount: "2.5" }).ok, false);
  assert.equal(adjustment({ amount: "dużo" }).ok, false);
  assert.equal(adjustment({ amount: "-5" }).ok, false);
  assert.equal(
    adjustment({ amount: String(TUKAT_ADJUSTMENT_MAX_AMOUNT + 1) }).ok,
    false,
  );
  assert.equal(
    adjustment({ amount: String(TUKAT_ADJUSTMENT_MAX_AMOUNT) }).ok,
    true,
  );
});

test("korekta wymaga gracza i własnego identyfikatora żądania", () => {
  assert.equal(adjustment({ targetUserId: "nie-uuid" }).ok, false);
  assert.equal(adjustment({ requestId: "stały-klucz" }).ok, false);
});

test("powód jest opcjonalny, przycinany i ograniczony długością", () => {
  const trimmed = adjustment({ reason: "  wyrównanie po awarii  " });
  assert.equal(trimmed.ok, true);
  if (trimmed.ok) assert.equal(trimmed.value.reason, "wyrównanie po awarii");

  const empty = adjustment({ reason: "   " });
  assert.equal(empty.ok, true);
  if (empty.ok) assert.equal(empty.value.reason, undefined);

  assert.equal(adjustment({ reason: "x".repeat(501) }).ok, false);
});

test("odmowa zejścia poniżej zera zamienia się w konkretne zdanie z liczbami", () => {
  const message = translateTukatAdjustmentError({
    code: "23514",
    message: "Tukat balance cannot fall below zero (balance 20, requested -30)",
  });

  assert.match(message, /30 Tukatów/);
  assert.match(message, /ma 20/);
  assert.match(message, /poniżej zera/);
});

test("pozostałe błędy RPC też docierają do panelu po polsku", () => {
  assert.match(
    translateTukatAdjustmentError({
      code: "42501",
      message: "Administrator access is required",
    }),
    /uprawnienia administratora/,
  );
  assert.match(
    translateTukatAdjustmentError({
      code: "42501",
      message: "Tukat recipient must be an active player",
    }),
    /aktywny gracz/,
  );
  assert.match(
    translateTukatAdjustmentError({
      code: "23505",
      message: "Request id has already been used for another correction",
    }),
    /już użyty/,
  );
  assert.equal(
    translateTukatAdjustmentError({ code: "XX000", message: "coś innego" }),
    "coś innego",
  );
});

test("Tukaty i Renoma mają osobne jednostki w interfejsie", () => {
  assert.equal(formatTukats(1200), "1200 Tukatów");
  assert.equal(formatTukatDelta(20), "+20 Tukatów");
  assert.equal(formatTukatDelta(-5), "−5 Tukatów");
  assert.equal(
    formatAdminTukatAdjustmentTitle({
      targetDisplayName: "Marta",
      operation: "grant",
    }),
    "Marta · Nadanie",
  );
  assert.equal(
    formatAdminTukatAdjustmentTitle({
      targetDisplayName: "Marta",
      operation: "revoke",
    }),
    "Marta · Odebranie",
  );
});

/**
 * Kontrakt na to, CZEGO w panelu nie ma. Doliczenie delty po stronie klienta
 * wyglądałoby poprawnie na ekranie i rozjechałoby się z bazą dopiero przy
 * następnym wejściu — czyli w momencie, w którym nikt już nie łączy tego z
 * korektą. Saldo ma pochodzić z `tukat_balances`, a odświeżenie z serwera.
 */
test("panel pokazuje saldo z bazy, bez lokalnego doliczania", () => {
  const panel = readFileSync(
    resolve(REPO_ROOT, "src/features/admin/admin-tukat-adjustments-panel.tsx"),
    "utf8",
  );

  assert.match(panel, /router\.refresh\(\)/);
  assert.match(panel, /crypto\.randomUUID\(\)/);
  assert.doesNotMatch(panel, /setBalance|currentBalance\s*\+|balance \+=/);
});

test("korekta Tukatów nie przechodzi przez RPC ani ścieżki Renomy", () => {
  const actions = readFileSync(
    resolve(REPO_ROOT, "src/features/admin/actions.ts"),
    "utf8",
  );
  const tukatAction = actions.slice(actions.indexOf("adminAdjustTukatsAction"));

  assert.match(tukatAction, /admin_adjust_tukats/);
  assert.doesNotMatch(tukatAction, /point_event|award_point|point_events/);
  // Saldo w komunikacie sukcesu pochodzi z wiersza zwróconego przez bazę.
  assert.match(tukatAction, /balanceAfter: row\.balance_after/);
});

/**
 * Nagrody Misji i cała mechanika Tukatów sprzed tej zmiany mają zostać
 * nietknięte — korekta administratora dopisuje własny wiersz ledgera i nie
 * dotyka `award_tukats_once`.
 */
test("migracja korekt nie modyfikuje mechaniki Misji", () => {
  const migration = readFileSync(
    resolve(
      REPO_ROOT,
      "supabase/migrations/20260826120000_admin_tukat_adjustments.sql",
    ),
    "utf8",
  );

  assert.doesNotMatch(migration, /alter table public\.tukat_events/i);
  assert.doesNotMatch(migration, /function private\.award_tukats_once/i);
  assert.doesNotMatch(migration, /user_missions/i);
  assert.doesNotMatch(migration, /delete from public\.tukat_events/i);
  assert.doesNotMatch(migration, /update public\.tukat_events/i);
  assert.match(migration, /private\.is_admin\(\)/);
});

/*
 * =============================================================================
 * REGRESJE: „Wybierz gracza." mimo wybranego gracza
 * =============================================================================
 *
 * Panel podawał prawidłowe `user_id` z selecta, ale walidacja wymagała UUID-a
 * z nibblami wersji i wariantu RFC 4122. Konta z seeda i fixture'ów QA mają
 * identyfikatory typu `10000000-0000-0000-0000-000000000002` — poprawne co do
 * kształtu, bez wersji — więc KAŻDY gracz był odrzucany, zanim żądanie doszło
 * do `admin_adjust_tukats`, i saldo się nie zmieniało.
 */
const SEEDED_PLAYER_ID = "10000000-0000-0000-0000-000000000002";
const AUTH_PLAYER_ID = "2002ce75-20b1-41d3-9672-7c4a7bfb48ee";

test("Nadaj przepuszcza wybranego gracza z identyfikatorem spoza RFC 4122", () => {
  const result = validateAdminTukatAdjustment({
    targetUserId: SEEDED_PLAYER_ID,
    operation: "grant",
    amount: "10",
    requestId: REQUEST_ID,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    // To jest wartość, którą akcja wstawia w p_target_user_id — bez podmiany,
    // bez wyszukiwania po display_name.
    assert.equal(result.value.targetUserId, SEEDED_PLAYER_ID);
    assert.equal(result.value.delta, 10);
  }
});

test("Odbierz działa dla tego samego wybranego gracza", () => {
  const result = validateAdminTukatAdjustment({
    targetUserId: SEEDED_PLAYER_ID,
    operation: "revoke",
    amount: "10",
    requestId: REQUEST_ID,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.targetUserId, SEEDED_PLAYER_ID);
    assert.equal(result.value.delta, -10);
  }
});

test("konta zaproszone przez Supabase Auth nadal przechodzą", () => {
  const result = validateAdminTukatAdjustment({
    targetUserId: AUTH_PLAYER_ID,
    operation: "grant",
    amount: "10",
    requestId: REQUEST_ID,
  });

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.targetUserId, AUTH_PLAYER_ID);
});

test("brak wyboru gracza nadal kończy się komunikatem „Wybierz gracza.”", () => {
  for (const targetUserId of ["", "   ", "nie-uuid", "10000000-0000-0000"]) {
    const result = validateAdminTukatAdjustment({
      targetUserId,
      operation: "grant",
      amount: "10",
      requestId: REQUEST_ID,
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.message, "Wybierz gracza.");
  }
});

test("klucz idempotencji nadal musi być pełnym UUID-em z crypto.randomUUID()", () => {
  // Rozluźnienie dotyczyło WYŁĄCZNIE identyfikatora gracza. Klucz generujemy
  // sami, więc słabszy kształt oznaczałby klucz wpisany ręcznie.
  const result = validateAdminTukatAdjustment({
    targetUserId: SEEDED_PLAYER_ID,
    operation: "grant",
    amount: "10",
    requestId: SEEDED_PLAYER_ID,
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /identyfikator żądania/);
});

test("akcja przekazuje wybrany user_id wprost do RPC", () => {
  const actions = readFileSync(
    resolve(REPO_ROOT, "src/features/admin/actions.ts"),
    "utf8",
  );
  const tukatAction = actions.slice(actions.indexOf("adminAdjustTukatsAction"));

  assert.match(tukatAction, /p_target_user_id: parsed\.value\.targetUserId/);
  // Żadnego obchodzenia problemu przez szukanie gracza po nazwie.
  assert.doesNotMatch(tukatAction, /display_?[Nn]ame/);
});

/**
 * Wybrany gracz jest jedynym stanem, którego sukces NIE czyści — inaczej po
 * udanej korekcie panel przeskakiwałby na pierwszego gracza z listy i pokazywał
 * JEGO saldo, co wygląda dokładnie jak korekta, która się nie zapisała.
 */
test("sukces zostawia wybranego gracza i pokazuje saldo z bazy", () => {
  const panel = readFileSync(
    resolve(REPO_ROOT, "src/features/admin/admin-tukat-adjustments-panel.tsx"),
    "utf8",
  );
  const submitBody = panel.slice(
    panel.indexOf("function submit("),
    panel.indexOf("const canSubmit"),
  );

  // Kliknięcie czyta targetUserId ze stanu i nigdzie go po drodze nie zeruje.
  assert.match(submitBody, /targetUserId,/);
  assert.doesNotMatch(submitBody, /setTargetUserId/);

  // Saldo w komunikacie pochodzi z wiersza zwróconego przez bazę, a pole
  // „Aktualne saldo" odświeża się nowym renderem serwera.
  assert.match(submitBody, /result\.balanceAfter/);
  assert.match(submitBody, /router\.refresh\(\)/);
});
