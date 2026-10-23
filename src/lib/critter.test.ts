import { test } from "node:test";
import assert from "node:assert/strict";
import { critterFromAddress, SIZE } from "./critter.ts";
import { EXAMPLE_ADDRESS } from "./monero.ts";

test("the same address always hatches the same critter", () => {
  assert.deepEqual(critterFromAddress(EXAMPLE_ADDRESS), critterFromAddress(` ${EXAMPLE_ADDRESS}\n`));
});

test("critters are 16x16 and mirror left to right", () => {
  const { rows } = critterFromAddress(EXAMPLE_ADDRESS);
  assert.equal(rows.length, SIZE);
  for (const row of rows) {
    assert.equal(row.length, SIZE);
    assert.equal(row, [...row].reverse().join(""));
  }
});

test("one changed character gives a different critter", () => {
  const other = EXAMPLE_ADDRESS.slice(0, 40) + (EXAMPLE_ADDRESS[40] === "a" ? "b" : "a") + EXAMPLE_ADDRESS.slice(41);
  const a = critterFromAddress(EXAMPLE_ADDRESS), b = critterFromAddress(other);
  assert.ok(a.rows.join() !== b.rows.join() || a.colors.b !== b.colors.b || a.name !== b.name);
});

test("every critter has a body and a face", () => {
  for (let i = 0; i < 200; i++) {
    const c = critterFromAddress(`4${i}`).rows.join("");
    assert.ok(c.includes("b") || c.includes("d"));
    assert.ok(c.includes("k"));
  }
});
