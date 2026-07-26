import assert from "node:assert/strict";
import test from "node:test";
import {
  isSamePasswordError,
  resolvePasswordUpdateRedirectTarget,
} from "../../src/features/auth/password-update-flow.ts";

test("isSamePasswordError recognizes Supabase's same_password code", () => {
  assert.equal(
    isSamePasswordError({
      name: "AuthApiError",
      code: "same_password",
      status: 422,
      message: "New password should be different from the old password.",
    }),
    true,
  );
});

test("isSamePasswordError is false for an unrelated updateUser error", () => {
  assert.equal(
    isSamePasswordError({
      name: "AuthApiError",
      code: "weak_password",
      status: 422,
      message: "Password is too weak.",
    }),
    false,
  );
});

test("isSamePasswordError is false when there is no code at all", () => {
  assert.equal(
    isSamePasswordError({
      name: null,
      code: null,
      status: null,
      message: null,
    }),
    false,
  );
});

test("resolvePasswordUpdateRedirectTarget sends a successful recovery back to /logowanie", () => {
  assert.equal(
    resolvePasswordUpdateRedirectTarget("recovery", false),
    "/logowanie?passwordUpdated=1",
  );
  // Even for an account that happens to already be an active member —
  // recovery always goes back to the login screen, membership is irrelevant.
  assert.equal(
    resolvePasswordUpdateRedirectTarget("recovery", true),
    "/logowanie?passwordUpdated=1",
  );
});

test("resolvePasswordUpdateRedirectTarget sends invite (no flow marker) into the app when active", () => {
  assert.equal(resolvePasswordUpdateRedirectTarget("", true), "/");
});

test("resolvePasswordUpdateRedirectTarget sends invite (no flow marker) to brak-dostepu when not an active member", () => {
  assert.equal(resolvePasswordUpdateRedirectTarget("", false), "/brak-dostepu");
});
