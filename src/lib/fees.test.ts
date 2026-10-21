import { test } from "node:test";
import assert from "node:assert/strict";
import { blocksToClear, estimateTxSize, estimateTxWeight, feeFor } from "./fees.ts";

test("weights match real transactions within a few bytes", () => {
  // Mempool minimum and median on mainnet: 1-in/2-out is 1530 bytes, 2-in/2-out 2216.
  assert.ok(Math.abs(estimateTxSize(1, 2) - 1530) <= 8);
  assert.ok(Math.abs(estimateTxSize(2, 2) - 2216) <= 8);
  assert.equal(estimateTxWeight(1, 2), estimateTxSize(1, 2));
});

test("more outputs add the Bulletproofs clawback", () => {
  assert.ok(estimateTxWeight(1, 3) > estimateTxSize(1, 3));
  assert.ok(estimateTxWeight(1, 16) > estimateTxWeight(1, 8));
});

test("fees round up to the quantization mask", () => {
  assert.equal(feeFor(1536, 20000, 10000), 30720000);
  assert.equal(feeFor(1530, 20000, 10000), 30600000);
  assert.equal(feeFor(1, 25000, 10000), 30000);
});

test("queue length in blocks", () => {
  assert.equal(blocksToClear(0, 300000), 1);
  assert.equal(blocksToClear(450000, 300000), 2);
});
