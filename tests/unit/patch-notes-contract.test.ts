import assert from "node:assert/strict";
import test from "node:test";
import { PATCH_NOTES } from "../../src/features/patch-notes/patch-notes.ts";

test("Economy V2 patch notes describe prestige, not shop currency", () => {
  const economyRelease = PATCH_NOTES.find(
    (release) => release.title === "Renoma, Zlecenia i Legendarium",
  );
  const copy = economyRelease?.categories
    .flatMap((category) => category.items)
    .join(" ");

  // Najnowsze wydanie stoi na czele listy — aktualizowane z każdym wpisem.
  assert.equal(PATCH_NOTES[0]?.title, "Wielki buff oprawy Stołu");
  assert.ok(economyRelease);
  assert.match(copy ?? "", /trwałym prestiżem gracza/);
  assert.match(copy ?? "", /nie wydajesz jej w Sklepie/);
  assert.match(copy ?? "", /Zlecenia/);
  assert.doesNotMatch(copy ?? "", /Kup za|RSVP \+10|Głos \+10/);
});
