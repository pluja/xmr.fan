import { test } from "node:test";
import assert from "node:assert/strict";
import { diffPool, noteFor, shadeFor } from "./live.ts";

test("pool changes between polls", () => {
  assert.deepEqual(diffPool(new Set(["a", "b"]), ["b", "c"]), { added: ["c"], removed: ["a"] });
  assert.deepEqual(diffPool(new Set(), ["a"]), { added: ["a"], removed: [] });
});

test("each transaction keeps its note and color", () => {
  const h = "6215f25455b4688f12dcdd4940682f635c817fdc3298b09fffc1ea3697bbf008";
  assert.equal(noteFor(h), noteFor(h));
  assert.ok(noteFor(h) >= 60 && noteFor(h) <= 82);
  assert.ok(shadeFor(h) >= 0 && shadeFor(h) <= 255);
});
