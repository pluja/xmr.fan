import { test } from "node:test";
import assert from "node:assert/strict";
import { critterFromAddress, GRID_H, GRID_W, RARITIES } from "./critter.ts";
import { SPECIES } from "./critter-parts.ts";
import { EXAMPLE_ADDRESS } from "./monero.ts";

test("the same address always hatches the same critter", () => {
  assert.deepEqual(critterFromAddress(EXAMPLE_ADDRESS), critterFromAddress(` ${EXAMPLE_ADDRESS}\n`));
});

test("species halves are 10 columns with one eye each", () => {
  for (const [name, rows] of Object.entries(SPECIES)) {
    for (const row of rows) assert.equal(row.length, 10, name);
    assert.equal(rows.join("").split("E").length - 1, 1, name);
  }
});

test("critters fill the grid and every one has eyes", () => {
  for (let i = 0; i < 400; i++) {
    const c = critterFromAddress(`4${i}`);
    assert.equal(c.pixels.length, GRID_H);
    for (const row of c.pixels) assert.equal(row.length, GRID_W);
    const flat = c.pixels.flat();
    assert.ok(flat.includes("e") || flat.includes("ik"), `${i} has no eyes`);
  }
});

test("one changed character gives a different critter", () => {
  const other = EXAMPLE_ADDRESS.slice(0, 40) + (EXAMPLE_ADDRESS[40] === "a" ? "b" : "a") + EXAMPLE_ADDRESS.slice(41);
  const a = critterFromAddress(EXAMPLE_ADDRESS), b = critterFromAddress(other);
  assert.notEqual(`${a.species}${a.hue}${a.item}${a.scene}${a.name}`, `${b.species}${b.hue}${b.item}${b.scene}${b.name}`);
});

test("all species, items and homes turn up, and rarities follow the odds", () => {
  const seen = { species: new Set(), item: new Set(), scene: new Set() };
  const counts = Object.fromEntries(RARITIES.map((r) => [r, 0]));
  for (let i = 0; i < 4000; i++) {
    const c = critterFromAddress(`8${i}`);
    seen.species.add(c.species); seen.item.add(c.item); seen.scene.add(c.scene);
    counts[c.rarity]++;
  }
  assert.equal(seen.species.size, 16);
  assert.equal(seen.item.size, 21);
  assert.equal(seen.scene.size, 8);
  assert.ok(counts.common > 2900 && counts.common < 3500);
  assert.ok(counts.legendary > 10 && counts.legendary < 90);
});
