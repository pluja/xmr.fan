import { test } from "node:test";
import assert from "node:assert/strict";
import { bestSidechain, networkHashrate, powerCostPerDay, timeToFind, xmrPerDay } from "./mining.ts";

const DIFFICULTY = 770_678_958_874; // about 6.4 GH/s
const REWARD = 610_000_000_000;

test("income is proportional to your share of the network", () => {
  const network = networkHashrate(DIFFICULTY);
  assert.ok(Math.abs(network - 6.42e9) < 1e7);
  // The whole network mines 720 blocks a day.
  assert.ok(Math.abs(xmrPerDay(network, DIFFICULTY, REWARD) - 720 * 0.61) < 1e-6);
  assert.ok(Math.abs(xmrPerDay(10_000, DIFFICULTY, REWARD) - 0.000684) < 0.000001);
});

test("time to find and power cost", () => {
  assert.equal(timeToFind(100, 1000), 10);
  assert.equal(timeToFind(0, 1000), Infinity);
  assert.equal(powerCostPerDay(100, 0.25), 0.6);
});

test("sidechain choice follows hashrate", () => {
  const chains = [
    { name: "main" as const, difficulty: 4.9e9, blockTime: 10, windowSize: 2160 },
    { name: "mini" as const, difficulty: 2.8e8, blockTime: 10, windowSize: 2160 },
    { name: "nano" as const, difficulty: 1.4e8, blockTime: 30, windowSize: 2160 },
  ];
  assert.equal(bestSidechain(1_000_000, chains), "main");
  assert.equal(bestSidechain(20_000, chains), "mini");
  assert.equal(bestSidechain(3_000, chains), "nano");
  assert.equal(bestSidechain(10, chains), "nano");
});
