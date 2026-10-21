import { test } from "node:test";
import assert from "node:assert/strict";
import { fanCard, normalizeName, RARITIES } from "./fancard.ts";

test("the same name always gets the same card, whatever the case or spacing", () => {
  const { name: _a, ...upper } = fanCard("Satoshi");
  const { name: _b, ...spaced } = fanCard("  satoshi ");
  assert.deepEqual(upper, spaced);
  assert.notDeepEqual(fanCard("alice").avatar, fanCard("bob").avatar);
  assert.equal(fanCard("").name, "anon");
  assert.equal(normalizeName("  a   b  "), "a b");
});

test("cards are well-formed", () => {
  for (let i = 0; i < 200; i++) {
    const c = fanCard(`fan${i}`);
    assert.equal(c.avatar.length, 16);
    assert.ok(c.avatar.every((r) => r.length === 16 && r.every((p) => p >= 0 && p < c.palette.length)));
    assert.match(c.number, /^#\d{4}$/);
    assert.ok(Object.values(c.stats).every((s) => s >= 15 && s <= 99));
  }
});

test("rarer cards are rarer", () => {
  const counts = Object.fromEntries(RARITIES.map((r) => [r, 0]));
  for (let i = 0; i < 5000; i++) counts[fanCard(`name-${i}`).rarity]++;
  assert.ok(counts.common > counts.uncommon && counts.uncommon > counts.rare && counts.rare > counts.legendary && counts.legendary > counts.mythic);
  assert.ok(counts.mythic > 0);
});
