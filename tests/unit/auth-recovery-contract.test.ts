import assert from "node:assert/strict";
import test from "node:test";
import {
  getAuthHashSessionKind,
  getAuthHashTokens,
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
