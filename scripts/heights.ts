/* Samples block timestamps along the chain into src/data/heights.json, so date <-> height
   conversions work instantly (the /height tool refines them on a live node).
     node --experimental-strip-types scripts/heights.ts */
import { writeFileSync } from "node:fs";

const NODE = process.env.MONERO_NODE ?? "https://node.sethforprivacy.com";
const STEP = 10_000;
const CONCURRENCY = 8;

async function header(height: number): Promise<[number, number]> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${NODE}/json_rpc`, {
        method: "POST",
        body: JSON.stringify({ jsonrpc: "2.0", id: "0", method: "get_block_header_by_height", params: { height } }),
        signal: AbortSignal.timeout(20_000),
      });
      const { result } = await res.json();
      return [height, result.block_header.timestamp];
    } catch (e) {
      if (attempt >= 4) throw e;
    }
  }
}

const info = await (await fetch(`${NODE}/json_rpc`, { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: "0", method: "get_info" }) })).json();
const tip = info.result.height - 1;
// The genesis block has timestamp 0, so the chain starts at block 1.
const heights = [1, ...[...Array(Math.floor(tip / STEP)).keys()].map((i) => (i + 1) * STEP), tip];
const samples: [number, number][] = [];
for (let i = 0; i < heights.length; i += CONCURRENCY) samples.push(...(await Promise.all(heights.slice(i, i + CONCURRENCY).map(header))));
writeFileSync("src/data/heights.json", JSON.stringify(samples) + "\n");
console.log(`${samples.length} samples up to height ${tip}`);
