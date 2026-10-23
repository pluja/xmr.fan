import { test } from "node:test";
import assert from "node:assert/strict";
import { critterFromAddress, RARITIES, SIZE } from "./critter.ts";
import { EXAMPLE_ADDRESS } from "./monero.ts";

test("the same address always hatches the same critter", () => {
  assert.deepEqual(critterFromAddress(EXAMPLE_ADDRESS), critterFromAddress(` ${EXAMPLE_ADDRESS}\n`));
});

test("critters fill a square grid", () => {
  const { rows } = critterFromAddress(EXAMPLE_ADDRESS);
  assert.equal(rows.length, SIZE);
  for (const row of rows) assert.equal(row.length, SIZE);
});

test("one changed character gives a different critter", () => {
  const other = EXAMPLE_ADDRESS.slice(0, 40) + (EXAMPLE_ADDRESS[40] === "a" ? "b" : "a") + EXAMPLE_ADDRESS.slice(41);
  const a = critterFromAddress(EXAMPLE_ADDRESS), b = critterFromAddress(other);
  assert.notEqual(a.rows.join() + a.name, b.rows.join() + b.name);
});

test("every critter has a body and a face", () => {
  for (let i = 0; i < 300; i++) {
    const c = critterFromAddress(`4${i}`).rows.join("");
    assert.ok(c.includes("b") || c.includes("d"));
    assert.ok(c.includes("e"));
  }
});

test("rarities follow the odds roughly", () => {
  const counts = Object.fromEntries(RARITIES.map((r) => [r, 0]));
  for (let i = 0; i < 4000; i++) counts[critterFromAddress(`8${i}`).rarity]++;
  assert.ok(counts.common > 2900 && counts.common < 3500);
  assert.ok(counts.legendary > 10 && counts.legendary < 90);
});
