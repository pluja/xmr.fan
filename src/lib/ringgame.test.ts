import { test } from "node:test";
import assert from "node:assert/strict";
import { luck, makeRound, spendAge } from "./ringgame.ts";

/** Seeded random numbers, so the statistics below don't flake. */
function seeded(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

test("rings list coins oldest first and hide the real one among them", () => {
  const r = makeRound("today", seeded(1));
  assert.equal(r.ages.length, 16);
  assert.deepEqual([...r.ages].sort((a, b) => b - a), r.ages);
  assert.ok(r.real >= 0 && r.real < 16);
});

test("in 2015 the newest coin was usually the real one", () => {
  const random = seeded(2);
  let newest = 0;
  for (let i = 0; i < 2000; i++) if (makeRound("2015", random).real === 2) newest++;
  assert.ok(newest / 2000 > 0.8);
});

test("today the newest coin is real no more often than chance", () => {
  const random = seeded(3);
  let newest = 0;
  for (let i = 0; i < 4000; i++) if (makeRound("today", random).real === 15) newest++;
  assert.ok(Math.abs(newest / 4000 - 1 / 16) < 0.02);
});

test("decoy ages center on a day or two and respect the spend lock", () => {
  const random = seeded(4);
  const ages = Array.from({ length: 4000 }, () => spendAge(random)).sort((a, b) => a - b);
  assert.ok(ages[0] >= 1200);
  const median = ages[2000] / 86_400;
  assert.ok(median > 0.5 && median < 5, `median ${median} days`);
});

test("luck is one in the ring size per round", () => {
  assert.equal(luck("today", 16), 1);
  assert.equal(luck("2015", 3), 1);
});
