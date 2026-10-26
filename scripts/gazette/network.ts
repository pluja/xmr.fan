/* Network numbers for a week and the week before, from block headers on public
   Monero nodes (restricted RPC). */
import type { EditionData } from "../../src/lib/gazette-schema.ts";
import type { Week } from "./week.ts";

const DEFAULT_NODES = ["https://xmr-node.cakewallet.com:18081", "https://node.monerodevs.org:18089"];
const BLOCK_SECONDS = 120;
const TAIL_EMISSION = 600_000_000_000; // 0.6 XMR per block; the rest of a block's reward is fees
const MAX_RANGE = 1000; // headers per request allowed by restricted nodes
const WEEK = 7 * 86_400;
const HISTORY_WEEKS = 1; // the previous week, for the change shown next to each number

interface Header { height: number; timestamp: number; difficulty: number; num_txes: number; reward: number }
type Stats = NonNullable<EditionData["network"]>["prev"] & {};

async function rpc(node: string, method: string, params?: object): Promise<any> {
  const res = await fetch(`${node}/json_rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "0", method, params }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${method}: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`${method}: ${data.error.message}`);
  return data.result;
}

/** Headers with timestamps in [from, to), found by estimating heights from block time. */
async function headersBetween(node: string, from: number, to: number, tip: Header): Promise<Header[]> {
  const margin = 720; // block times vary; fetch a day extra on each side
  const start = Math.max(0, tip.height - Math.ceil((tip.timestamp - from) / BLOCK_SECONDS) - margin);
  const end = Math.min(tip.height, tip.height - Math.floor((tip.timestamp - to) / BLOCK_SECONDS) + margin);
  const headers: Header[] = [];
  for (let h = start; h <= end; h += MAX_RANGE) {
    const r = await rpc(node, "get_block_headers_range", { start_height: h, end_height: Math.min(h + MAX_RANGE - 1, end) });
    headers.push(...r.headers);
  }
  return headers.filter((x) => x.timestamp >= from && x.timestamp < to);
}

function summarize(headers: Header[], seconds: number): Stats {
  const txs = headers.reduce((n, h) => n + h.num_txes, 0);
  const fees = headers.reduce((n, h) => n + Math.max(0, h.reward - TAIL_EMISSION), 0);
  const difficulty = headers.reduce((n, h) => n + h.difficulty, 0) / Math.max(1, headers.length);
  return {
    hash: Math.round((difficulty / BLOCK_SECONDS / 1e9) * 100) / 100,
    txs: Math.round(txs / (seconds / 86_400)),
    fee: txs ? Number((fees / txs / 1e12).toPrecision(3)) : 0,
  };
}

/** Undefined if no node answers. */
export async function networkStats(
  week: Week,
  nodes = process.env.MONERO_NODES ? process.env.MONERO_NODES.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_NODES,
): Promise<EditionData["network"]> {
  const from = week.from.getTime() / 1000;
  const to = Math.min(week.to.getTime() / 1000, Date.now() / 1000);
  for (const node of nodes) {
    try {
      const info = await rpc(node, "get_info");
      if (!info.synchronized) continue;
      const { block_header: tip } = await rpc(node, "get_last_block_header");
      const current = await headersBetween(node, from, to, tip);
      if (!current.length) throw new Error("no blocks found in the week");
      const earlier: Stats[] = [];
      for (let k = HISTORY_WEEKS; k >= 1; k--) {
        const headers = await headersBetween(node, from - k * WEEK, from - (k - 1) * WEEK, tip);
        if (headers.length) earlier.push(summarize(headers, WEEK));
      }
      return {
        height: info.height,
        ...summarize(current, to - from),
        ...(earlier.length ? { prev: earlier.at(-1), history: earlier.slice(0, -1) } : {}),
      };
    } catch (e) {
      console.warn(`  node ${node} failed: ${(e as Error).message}`);
    }
  }
  return undefined;
}
