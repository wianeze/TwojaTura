import assert from "node:assert/strict";
import test from "node:test";
import { PATCH_NOTES } from "../../src/features/patch-notes/patch-notes.ts";

test("latest patch notes describe Economy V2 as prestige, not shop currency", () => {
  const latestRelease = PATCH_NOTES[0];
  const copy = latestRelease?.categories
    .flatMap((category) => category.items)
    .join(" ");

  assert.equal(latestRelease?.title, "Renoma, Zlecenia i Legendarium");
  assert.match(copy ?? "", /trwałym prestiżem gracza/);
  assert.match(copy ?? "", /nie wydajesz jej w Sklepie/);
  assert.match(copy ?? "", /Zlecenia/);
  assert.doesNotMatch(copy ?? "", /Kup za|RSVP \+10|Głos \+10/);
});
