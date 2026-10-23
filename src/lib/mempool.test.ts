import { test } from "node:test";
import assert from "node:assert/strict";
import { assessPool, recentFullness } from "./mempool.ts";

const FEES = [20000, 80000, 320000, 4000000];
const MEDIAN = 300_000;

test("a small pool is calm and fits in one block", () => {
  const a = assessPool({ bytes_total: 60_000, fee_total: 60_000 * 20000, txs_total: 23, oldest: 0 }, MEDIAN, FEES);
  assert.equal(a.state, "calm");
  assert.equal(a.fill, 0.2);
  assert.equal(a.feeMultiple, 1);
  assert.equal(a.priority, 0);
});

test("pool size picks busy, congested and flooded", () => {
  const at = (bytes: number) => assessPool({ bytes_total: bytes, fee_total: 0, txs_total: 1, oldest: 0 }, MEDIAN, FEES).state;
  assert.equal(at(200_000), "busy");
  assert.equal(at(450_000), "jam");
  assert.equal(at(900_000), "flood");
});

test("full recent blocks count as busy even with an empty pool", () => {
  assert.equal(assessPool({ bytes_total: 0, fee_total: 0, txs_total: 0, oldest: 0 }, MEDIAN, FEES, 0.95).state, "busy");
});

test("the average fee maps to a priority on a log scale", () => {
  const a = assessPool({ bytes_total: 1000, fee_total: 1000 * 320000, txs_total: 1, oldest: 0 }, MEDIAN, FEES);
  assert.equal(a.feeMultiple, 16);
  assert.equal(a.priority, 2);
  assert.ok(Math.abs(a.feeLevel - Math.log(16) / Math.log(200)) < 1e-9);
});

test("recent fullness averages block weights", () => {
  assert.equal(recentFullness([{ block_weight: 150_000 }, { block_weight: 300_000 }], MEDIAN), 0.75);
  assert.equal(recentFullness([], MEDIAN), 0);
});
