import assert from "node:assert/strict";
import test from "node:test";
import {
  formatAuthErrorMessage,
  getAuthHashSessionKind,
  getAuthHashTokens,
  getSafeAuthErrorInfo,
  getUrlHostname,
  parseAuthHashParams,
} from "../../src/features/auth/recovery-session.ts";

test("parseAuthHashParams strips a leading #", () => {
  const params = parseAuthHashParams("#access_token=abc&type=recovery");
  assert.equal(params.get("access_token"), "abc");
  assert.equal(params.get("type"), "recovery");
});

test("parseAuthHashParams handles a hash with no leading #", () => {
  const params = parseAuthHashParams("type=invite");
  assert.equal(params.get("type"), "invite");
});

test("parseAuthHashParams handles an empty hash", () => {
  const params = parseAuthHashParams("");
  assert.equal(params.get("type"), null);
});

test("getAuthHashSessionKind recognizes a recovery session", () => {
  const params = parseAuthHashParams(
    "#access_token=abc&refresh_token=def&type=recovery",
  );
  assert.deepEqual(getAuthHashSessionKind(params), { kind: "recovery" });
});

test("getAuthHashSessionKind recognizes an invite session", () => {
  const params = parseAuthHashParams(
    "#access_token=abc&refresh_token=def&type=invite",
  );
  assert.deepEqual(getAuthHashSessionKind(params), { kind: "invite" });
});

test("getAuthHashSessionKind reports an expired/invalid link via error", () => {
  const params = parseAuthHashParams(
    "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
  );
  const result = getAuthHashSessionKind(params);
  assert.equal(result.kind, "error");
  assert.equal(result.errorDescription, "Email link is invalid or has expired");
});

test("getAuthHashSessionKind treats error_code alone as an error", () => {
  const params = parseAuthHashParams("#error_code=otp_expired");
  assert.equal(getAuthHashSessionKind(params).kind, "error");
});

test("getAuthHashSessionKind prioritizes error over a type param", () => {
  const params = parseAuthHashParams("#error=access_denied&type=recovery");
  assert.equal(getAuthHashSessionKind(params).kind, "error");
});

test("getAuthHashSessionKind returns null for an unrelated or empty hash", () => {
  assert.equal(getAuthHashSessionKind(parseAuthHashParams("")).kind, null);
  assert.equal(
    getAuthHashSessionKind(parseAuthHashParams("#type=magiclink")).kind,
    null,
  );
});

test("getAuthHashTokens extracts both tokens from a recovery hash", () => {
  const params = parseAuthHashParams(
    "#access_token=abc123&refresh_token=def456&type=recovery",
  );
  assert.deepEqual(getAuthHashTokens(params), {
    accessToken: "abc123",
    refreshToken: "def456",
  });
});

test("getAuthHashTokens extracts both tokens from an invite hash", () => {
  const params = parseAuthHashParams(
    "#access_token=abc123&refresh_token=def456&type=invite",
  );
  assert.deepEqual(getAuthHashTokens(params), {
    accessToken: "abc123",
    refreshToken: "def456",
  });
});

test("getAuthHashTokens reports a missing refresh_token as null", () => {
  const params = parseAuthHashParams("#access_token=abc123&type=recovery");
  assert.deepEqual(getAuthHashTokens(params), {
    accessToken: "abc123",
    refreshToken: null,
  });
});

test("getAuthHashTokens reports a missing access_token as null", () => {
  const params = parseAuthHashParams("#refresh_token=def456&type=recovery");
  assert.deepEqual(getAuthHashTokens(params), {
    accessToken: null,
    refreshToken: "def456",
  });
});

test("getAuthHashTokens finds no tokens in an expired-link error hash", () => {
  const params = parseAuthHashParams(
    "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
  );
  assert.deepEqual(getAuthHashTokens(params), {
    accessToken: null,
    refreshToken: null,
  });
});

test("getAuthHashTokens finds no tokens in an empty hash (would time out, not hang forever)", () => {
  assert.deepEqual(getAuthHashTokens(parseAuthHashParams("")), {
    accessToken: null,
    refreshToken: null,
  });
});

test("getSafeAuthErrorInfo extracts only the four whitelisted fields", () => {
  const info = getSafeAuthErrorInfo({
    name: "AuthApiError",
    code: "refresh_token_not_found",
    status: 400,
    message: "Invalid Refresh Token: Refresh Token Not Found",
    // Anything else on the error object must never survive extraction.
    access_token: "should-never-appear",
    session: { user: { email: "should-never-appear@example.com" } },
  });
  assert.deepEqual(info, {
    name: "AuthApiError",
    code: "refresh_token_not_found",
    status: 400,
    message: "Invalid Refresh Token: Refresh Token Not Found",
  });
  assert.equal("access_token" in info, false);
  assert.equal("session" in info, false);
});

test("getSafeAuthErrorInfo tolerates a partial error (missing code)", () => {
  assert.deepEqual(getSafeAuthErrorInfo({ name: "AuthError", status: 500 }), {
    name: "AuthError",
    code: null,
    status: 500,
    message: null,
  });
});

test("getSafeAuthErrorInfo tolerates null/non-object input", () => {
  const empty = { name: null, code: null, status: null, message: null };
  assert.deepEqual(getSafeAuthErrorInfo(null), empty);
  assert.deepEqual(getSafeAuthErrorInfo(undefined), empty);
  assert.deepEqual(getSafeAuthErrorInfo("not an error object"), empty);
});

test("formatAuthErrorMessage renders status and code", () => {
  assert.equal(
    formatAuthErrorMessage({
      name: "AuthApiError",
      code: "refresh_token_not_found",
      status: 400,
      message: "Invalid Refresh Token: Refresh Token Not Found",
    }),
    "Nie udało się potwierdzić linku (Auth 400: refresh_token_not_found).",
  );
});

test("formatAuthErrorMessage falls back to name when code is missing", () => {
  assert.equal(
    formatAuthErrorMessage({
      name: "AuthUnknownError",
      code: null,
      status: 500,
      message: null,
    }),
    "Nie udało się potwierdzić linku (Auth 500: AuthUnknownError).",
  );
});

test("formatAuthErrorMessage stays readable with nothing but the four fields empty", () => {
  assert.equal(
    formatAuthErrorMessage({
      name: null,
      code: null,
      status: null,
      message: null,
    }),
    "Nie udało się potwierdzić linku (Auth ?: unknown_error).",
  );
});

test("getUrlHostname extracts the expected production Supabase host", () => {
  assert.equal(
    getUrlHostname("https://brahsmioddvhkozoilgs.supabase.co"),
    "brahsmioddvhkozoilgs.supabase.co",
  );
});

test("getUrlHostname extracts a local Supabase host", () => {
  assert.equal(getUrlHostname("http://127.0.0.1:54321"), "127.0.0.1");
});

test("getUrlHostname returns null for a malformed URL instead of throwing", () => {
  assert.equal(getUrlHostname("not-a-url"), null);
});
