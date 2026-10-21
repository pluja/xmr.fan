import { test } from "node:test";
import assert from "node:assert/strict";
import { heightAt, restoreHeight, timeAt, type Sample } from "./heights.ts";
import samples from "../data/heights.json" with { type: "json" };

const table: Sample[] = samples;
const at = (iso: string) => Date.parse(iso) / 1000;

test("known blocks land within a day, even where block time changed (v2 went from 1 to 2 minutes)", () => {
  // Timestamps of blocks 1009827 (v2 fork) and 2688888 (v15 fork).
  assert.ok(Math.abs(heightAt(at("2016-03-23T15:57:38Z"), table) - 1009827) < 720);
  assert.ok(Math.abs(heightAt(at("2022-08-13T18:47:38Z"), table) - 2688888) < 720);
});

test("date and height round-trip", () => {
  for (const h of [5000, 1_234_567, 3_000_000]) assert.ok(Math.abs(heightAt(timeAt(h, table), table) - h) <= 1);
});

test("future dates extrapolate at two minutes per block", () => {
  const [lastHeight, lastTime] = table[table.length - 1];
  assert.equal(heightAt(lastTime + 7200, table), lastHeight + 60);
  assert.equal(timeAt(lastHeight + 30, table), lastTime + 3600);
});

test("before launch is block 1; restore height goes a week back", () => {
  assert.equal(heightAt(0, table), 1);
  assert.equal(restoreHeight(10_000), 10_000 - 5040);
  assert.equal(restoreHeight(100), 0);
});
