import assert from "node:assert/strict";
import test from "node:test";
import {
  getAuthHashSessionKind,
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
