import { test } from "node:test";
import assert from "node:assert/strict";
import { diffPool, feeTier, noteFor } from "./live.ts";

test("pool changes between polls", () => {
  assert.deepEqual(diffPool(new Set(["a", "b"]), ["b", "c"]), { added: ["c"], removed: ["a"] });
  assert.deepEqual(diffPool(new Set(), ["a"]), { added: ["a"], removed: [] });
});

test("each transaction keeps its note, an octave higher per fee tier", () => {
  const h = "6215f25455b4688f12dcdd4940682f635c817fdc3298b09fffc1ea3697bbf008";
  assert.equal(noteFor(h), noteFor(h, 1));
  assert.equal(noteFor(h, 2) - noteFor(h, 0), 24);
  assert.ok(noteFor(h, 0) >= 48 && noteFor(h, 2) <= 82);
});

test("fee tiers follow the node's priority estimates", () => {
  const estimates = [20000, 80000, 320000, 4000000];
  assert.equal(feeTier(20000 * 2221, 2221, estimates), 0);
  assert.equal(feeTier(177680000, 2221, estimates), 1);
  assert.equal(feeTier(320000 * 1500, 1500, estimates), 2);
  assert.equal(feeTier(4000000 * 1500, 1500, estimates), 2);
});
