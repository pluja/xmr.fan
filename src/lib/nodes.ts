import health from "../data/node-health.json" with { type: "json" };

/** Nodes that answer browsers directly (they send CORS headers), so requests go from the user's browser to the node, not through xmr.fan. */
export const BROWSER_NODE_CANDIDATES = [
  "https://node.sethforprivacy.com",
  "https://xmr.cryptostorm.is:18081",
  "https://xmr-node.cakewallet.com:18081",
  "https://xmr.0xrpc.io",
  "https://xmr1.doggett.tech:18089",
];

/** Nodes to suggest for wallets, checked live on /node. Includes nodes without CORS (wallets don't need it). */
export const WALLET_NODE_CANDIDATES = [
  ...BROWSER_NODE_CANDIDATES,
  "https://node.monerodevs.org:18089",
  "https://node2.monerodevs.org:18089",
  "https://node3.monerodevs.org:18089",
  "https://monero.stackwallet.com:18081",
  "https://xmr.privex.io",
  "http://xmr.stormycloud.org:18089",
  "http://nodes.hashvault.pro:18081",
  "http://node.xmr.rocks:18089",
  "http://nodex.monerujo.io:18081",
  "http://rucknium.me:18081",
];

/** Consecutive failed daily checks (scripts/nodes.ts) after which a node is left out until it recovers. */
export const NODE_FAILURE_LIMIT = 3;

export interface NodeHealth { failures: number; lastOk?: string }
const healthy = (url: string) => ((health as Record<string, NodeHealth>)[url]?.failures ?? 0) < NODE_FAILURE_LIMIT;

export const PUBLIC_NODES = BROWSER_NODE_CANDIDATES.filter(healthy);
export const WALLET_NODES = WALLET_NODE_CANDIDATES.filter(healthy);

export const BLOCK_SECONDS = 120;
export const PICO_PER_XMR = 1e12;

/** "node.example.com:18089" -> "https://node.example.com:18089"; null if it isn't a usable URL. */
export function normalizeNodeUrl(input: string): string | null {
  const s = input.trim().replace(/\/+$/, "");
  if (!s) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (url.pathname !== "/" || url.search || url.hash || url.username) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export const nodeLabel = (url: string) => new URL(url).host;

/** host:port as wallets want it, with the default port spelled out. */
export function walletAddress(url: string): string {
  const u = new URL(url);
  return `${u.hostname}:${u.port || (u.protocol === "https:" ? "443" : "80")}`;
}

export interface NodeCheck {
  url: string;
  ok: boolean;
  error?: "unreachable" | "not_monero" | "private" | "onion" | "timeout";
  ms?: number;
  height?: number;
  /** Highest height among reference public nodes. */
  reference?: number;
  synced?: boolean;
  network?: string;
  restricted?: boolean;
  https?: boolean;
  cors?: boolean;
  updateAvailable?: boolean;
  checkedAt: number;
}

export interface NodeInfo {
  height: number;
  target_height: number;
  difficulty: number;
  tx_pool_size: number;
  block_weight_median: number;
  block_weight_limit: number;
  synchronized: boolean;
  version: string;
  restricted: boolean;
  status: string;
}

export interface BlockHeader {
  height: number;
  timestamp: number;
  difficulty: number;
  reward: number;
  num_txes: number;
  block_weight: number;
  hash: string;
}

export interface FeeEstimate { fee: number; fees?: number[]; quantization_mask: number }
