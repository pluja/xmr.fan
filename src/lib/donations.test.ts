import { test } from "node:test";
import assert from "node:assert/strict";
import data from "../data/donations.json" with { type: "json" };
import { DONATION_CATEGORIES, listed, spin } from "./donations.ts";
import { LOCALES } from "../i18n/ui.ts";
import { parseAddress } from "./monero.ts";

test("every donation entry is a valid mainnet address with an https source", () => {
  const ids = new Set<string>();
  for (const d of data) {
    const parsed = parseAddress(d.address);
    assert.ok(parsed.ok && parsed.network === "mainnet", `${d.id}: invalid address`);
    assert.ok(d.source.startsWith("https://"), `${d.id}: source must be https`);
    assert.ok((DONATION_CATEGORIES as readonly string[]).includes(d.category), `${d.id}: unknown category`);
    assert.match(d.checked, /^\d{4}-\d{2}-\d{2}$/);
    for (const lang of LOCALES) assert.ok((d.description as Record<string, string>)[lang]?.trim(), `${d.id}: missing ${lang} description`);
    assert.ok(!ids.has(d.id), `${d.id}: duplicate id`);
    ids.add(d.id);
  }
});

test("spin never repeats the current project when it can avoid it", () => {
  const list = [{ id: "a" }, { id: "b" }];
  for (const r of [0, 0.5, 0.99]) assert.equal(spin(list, "a", () => r)?.id, "b");
  assert.equal(spin([{ id: "a" }], "a")?.id, "a");
  assert.equal(spin([], "a"), undefined);
});

test("projects drop out when their address goes missing or isn't confirmed for months", () => {
  const today = new Date("2026-10-23T12:00:00Z");
  assert.equal(listed({ checked: "2026-10-20" }, today), true);
  assert.equal(listed({ checked: "2026-10-20", missing: true }, today), false);
  assert.equal(listed({ checked: "2026-07-26" }, today), true);
  assert.equal(listed({ checked: "2026-07-20" }, today), false);
});
