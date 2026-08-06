import assert from "node:assert/strict";
import test from "node:test";
import {
  clearInvitedIds,
  filterInvitableMembers,
  selectAllInvitableIds,
  toggleInvitedUserId,
} from "../../src/features/meetings/invited-selection.ts";

const MEMBERS = [
  { id: "m1", displayName: "Marta" },
  { id: "m2", displayName: "Michał" },
  { id: "m3", displayName: "Ania" },
];

test("toggling an unselected user adds them", () => {
  assert.deepEqual(toggleInvitedUserId([], "m1"), ["m1"]);
});

test("toggling an already-selected user removes them", () => {
  assert.deepEqual(toggleInvitedUserId(["m1", "m2"], "m1"), ["m2"]);
});

test("toggling preserves the order of untouched entries", () => {
  assert.deepEqual(toggleInvitedUserId(["m1", "m2"], "m3"), ["m1", "m2", "m3"]);
});

test("selecting all returns every invitable member id, in list order", () => {
  assert.deepEqual(selectAllInvitableIds(MEMBERS), ["m1", "m2", "m3"]);
});

test("selecting all on an empty roster returns an empty selection", () => {
  assert.deepEqual(selectAllInvitableIds([]), []);
});

test("clearing always returns an empty selection", () => {
  assert.deepEqual(clearInvitedIds(), []);
});

test("filtering with an empty query returns every member unchanged", () => {
  assert.deepEqual(filterInvitableMembers(MEMBERS, ""), MEMBERS);
});

test("filtering matches case- and diacritic-insensitively", () => {
  assert.deepEqual(filterInvitableMembers(MEMBERS, "michał"), [MEMBERS[1]]);
  assert.deepEqual(filterInvitableMembers(MEMBERS, "MICH"), [MEMBERS[1]]);
});

test("filtering trims surrounding whitespace before matching", () => {
  assert.deepEqual(filterInvitableMembers(MEMBERS, "  ania  "), [MEMBERS[2]]);
});

test("filtering with no match returns an empty list, not the full roster", () => {
  assert.deepEqual(filterInvitableMembers(MEMBERS, "nikt-taki"), []);
});
