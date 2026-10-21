import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { txStage, txSummary } from "./tx.ts";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8")).as_json;

test("summary of a real RingCT transaction", () => {
  assert.deepEqual(txSummary(fixture("mainnet-e02085d3")), { coinbase: false, inputs: 1, outputs: 2, ringSize: 16, fee: 30660000, unlockTime: 0, version: 2 });
});

test("coinbase transactions have no inputs to spend and no fee", () => {
  const s = txSummary({ version: 2, unlock_time: 3000060, vin: [{ gen: { height: 3000000 } }], vout: [{ amount: 600000000000 }], rct_signatures: { type: 0 } });
  assert.equal(s?.coinbase, true);
  assert.equal(s?.fee, 0);
  assert.equal(s?.ringSize, undefined);
});

test("garbage is rejected and stages follow confirmations", () => {
  assert.equal(txSummary("not json"), null);
  assert.equal(txStage(true, 0), "pool");
  assert.equal(txStage(false, 3), "confirming");
  assert.equal(txStage(false, 10), "spendable");
});
