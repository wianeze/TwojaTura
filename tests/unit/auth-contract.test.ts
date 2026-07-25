import assert from "node:assert/strict";
import test from "node:test";
import {
  formatInviteError,
  formatInviteOutcome,
  getInviteAdminConfig,
  getProvisioningState,
  parseRole,
} from "../../scripts/invite-user-lib.mjs";
import { mapCurrentMember } from "../../src/features/auth/current-member.ts";
import { getSafeInternalPath } from "../../src/features/auth/safe-redirect.ts";
import {
  buildAppUrl,
  buildAuthCallbackUrl,
  getAppOrigin,
} from "../../src/lib/app-url.ts";
import {
  validatePasswordChange,
  validateProfileInput,
} from "../../src/features/auth/validation.ts";

const profile = {
  id: "user-1",
  display_name: "Marta",
  email: "marta@example.com",
  avatar_url: null,
};

function restoreSiteUrl(value: string | undefined) {
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    return;
  }

  process.env.NEXT_PUBLIC_SITE_URL = value;
}

function inviteEnv(values: Record<string, string>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

test("safe redirect accepts /", () => {
  assert.equal(getSafeInternalPath("/"), "/");
});

test("safe redirect accepts /profil", () => {
  assert.equal(getSafeInternalPath("/profil"), "/profil");
});

test("safe redirect rejects protocol-relative destinations", () => {
  assert.equal(getSafeInternalPath("//evil.example"), "/");
});

test("safe redirect rejects full external URLs", () => {
  assert.equal(getSafeInternalPath("https://evil.example"), "/");
});

test("safe redirect rejects executable destinations", () => {
  assert.equal(getSafeInternalPath("javascript:alert(1)"), "/");
});

test("app origin defaults to localhost:3000", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;

  assert.equal(getAppOrigin(), "http://localhost:3000");

  restoreSiteUrl(previous);
});

test("invite callback URL still targets /ustaw-haslo (unchanged, token_hash flow)", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

  assert.equal(
    buildAuthCallbackUrl("/ustaw-haslo"),
    "http://localhost:3000/auth/callback?next=%2Fustaw-haslo",
  );

  restoreSiteUrl(previous);
});

test("password recovery redirect points at /logowanie (hash flow)", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

  assert.equal(
    buildAppUrl("/logowanie").toString(),
    "http://localhost:3000/logowanie",
  );

  restoreSiteUrl(previous);
});

test("invite admin config requires SUPABASE_SERVICE_ROLE_KEY", () => {
  assert.throws(
    () =>
      getInviteAdminConfig(
        inviteEnv({
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        }),
      ),
    /SUPABASE_SERVICE_ROLE_KEY/,
  );
});

test("invite admin config rejects sb_secret keys", () => {
  assert.throws(
    () =>
      getInviteAdminConfig(
        inviteEnv({
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
          SUPABASE_SERVICE_ROLE_KEY: "sb_secret_example",
        }),
      ),
    /legacy JWT service_role, nie sb_secret_/,
  );
});

test("invite admin config returns JWT service role and callback URL", () => {
  const config = getInviteAdminConfig(
    inviteEnv({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      SUPABASE_SERVICE_ROLE_KEY: "header.payload.signature",
    }),
  );

  assert.equal(config.url, "http://127.0.0.1:54321");
  assert.equal(config.serviceRoleKey, "header.payload.signature");
  assert.equal(
    config.redirectTo,
    "http://localhost:3000/auth/callback?next=%2Fustaw-haslo",
  );
});

test("invite error formatting is operator-friendly", () => {
  assert.equal(
    formatInviteError({
      status: 403,
      code: "bad_jwt",
      message: "invalid JWT",
    }),
    [
      "Nie udalo sie wyslac zaproszenia.",
      "Status: 403",
      "Kod: bad_jwt",
      "Powod: invalid JWT",
    ].join("\n"),
  );
});

test("invite provisioning state is true only for active member profile", () => {
  assert.equal(
    getProvisioningState(
      { id: "user-1" },
      { user_id: "user-1", role: "member", is_active: true },
    ),
    true,
  );
  assert.equal(
    getProvisioningState(
      { id: "user-1" },
      { user_id: "user-1", role: "admin", is_active: true },
    ),
    false,
  );
});

test("invite provisioning state accepts an expected non-default role", () => {
  assert.equal(
    getProvisioningState(
      { id: "user-1" },
      { user_id: "user-1", role: "observer", is_active: true },
      "observer",
    ),
    true,
  );
  assert.equal(
    getProvisioningState(
      { id: "user-1" },
      { user_id: "user-1", role: "member", is_active: true },
      "observer",
    ),
    false,
  );
});

test("invite outcome reports verified success", () => {
  assert.equal(
    formatInviteOutcome({
      email: "zaproszony2@twojatura.local",
      inviteSucceeded: true,
      provisioningReady: true,
    }),
    [
      "Zaproszenie wyslane.",
      "Uzytkownik: zaproszony2@twojatura.local",
      "Rola: member.",
      "Profil i czlonkostwo: gotowe.",
    ].join("\n"),
  );
});

test("invite outcome reports warning when provisioning is not confirmed", () => {
  assert.equal(
    formatInviteOutcome({
      email: "zaproszony2@twojatura.local",
      inviteSucceeded: true,
      provisioningReady: false,
    }),
    [
      "Zaproszenie wyslane.",
      "Uzytkownik: zaproszony2@twojatura.local",
      "Rola: member.",
      "Nie udalo sie potwierdzic provisioningu czlonkostwa. Sprawdz profiles i app_members.",
    ].join("\n"),
  );
});

test("invite outcome includes a non-default requested role", () => {
  assert.equal(
    formatInviteOutcome({
      email: "zaproszony2@twojatura.local",
      inviteSucceeded: true,
      provisioningReady: true,
      role: "observer",
    }),
    [
      "Zaproszenie wyslane.",
      "Uzytkownik: zaproszony2@twojatura.local",
      "Rola: observer.",
      "Profil i czlonkostwo: gotowe.",
    ].join("\n"),
  );
});

test("invite outcome keeps real invite failure as failure", () => {
  assert.equal(
    formatInviteOutcome({
      email: "zaproszony2@twojatura.local",
      inviteSucceeded: false,
      provisioningReady: false,
    }),
    "Nie udalo sie wyslac zaproszenia.",
  );
});

test("parseRole defaults to member", () => {
  assert.equal(parseRole(undefined), "member");
  assert.equal(parseRole(""), "member");
});

test("parseRole accepts admin and observer", () => {
  assert.equal(parseRole("admin"), "admin");
  assert.equal(parseRole("observer"), "observer");
});

test("parseRole rejects unknown values", () => {
  assert.throws(() => parseRole("superadmin"), /Nieprawidlowa rola/);
});

test("maps an active member", () => {
  const state = mapCurrentMember(
    "user-1",
    { role: "member", is_active: true },
    profile,
  );
  assert.equal(state.status, "active-member");
  if (state.status === "active-member")
    assert.equal(state.member.role, "member");
});

test("maps an active admin", () => {
  const state = mapCurrentMember(
    "user-1",
    { role: "admin", is_active: true },
    profile,
  );
  assert.equal(state.status, "active-member");
  if (state.status === "active-member")
    assert.equal(state.member.role, "admin");
});

test("maps an active observer", () => {
  const state = mapCurrentMember(
    "user-1",
    { role: "observer", is_active: true },
    profile,
  );
  assert.equal(state.status, "active-member");
  if (state.status === "active-member")
    assert.equal(state.member.role, "observer");
});

test("missing membership denies access", () => {
  assert.equal(
    mapCurrentMember("user-1", null, profile).status,
    "authenticated-but-not-member",
  );
});

test("inactive membership denies access", () => {
  assert.equal(
    mapCurrentMember("user-1", { role: "member", is_active: false }, null)
      .status,
    "inactive-member",
  );
});

test("profile validation rejects an empty name", () => {
  assert.equal(validateProfileInput("   ", "").ok, false);
});

test("profile validation rejects an invalid avatar URL", () => {
  assert.equal(validateProfileInput("Marta", "not-a-url").ok, false);
});

test("password validation detects different passwords", () => {
  assert.equal(validatePasswordChange("TwojaTura123!", "inne-haslo").ok, false);
});

test("password validation rejects empty fields", () => {
  assert.equal(validatePasswordChange("", "").ok, false);
  assert.equal(validatePasswordChange("TwojaTura123!", "").ok, false);
});

test("password validation rejects a too-short password", () => {
  assert.equal(validatePasswordChange("krotkie", "krotkie").ok, false);
});

test("password validation accepts a matching, long-enough password", () => {
  const result = validatePasswordChange("TwojaTura123!", "TwojaTura123!");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.password, "TwojaTura123!");
});
