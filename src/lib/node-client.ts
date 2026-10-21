/* Talks to Monero nodes from the browser. Uses the user's own node if they set one,
   otherwise the first public node that answers, and sticks with it for the visit. */
import { PUBLIC_NODES, type BlockHeader, type FeeEstimate, type NodeInfo } from "./nodes";

const CUSTOM_KEY = "xmrfan.node";
const WORKING_KEY = "xmrfan.node.working";
const TIMEOUT_MS = 10_000;

export const customNode = () => localStorage.getItem(CUSTOM_KEY);
export function setCustomNode(url: string | null) {
  if (url) localStorage.setItem(CUSTOM_KEY, url);
  else localStorage.removeItem(CUSTOM_KEY);
  sessionStorage.removeItem(WORKING_KEY);
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();
/** Called when the user switches nodes, so tools can reload their data. */
export const onNodeChange = (l: () => void) => listeners.add(l);

let current: string | undefined;
const nodeListeners = new Set<(node: string) => void>();
/** Called with the node that actually answered. */
export const onNodeUsed = (l: (node: string) => void) => { nodeListeners.add(l); if (current) l(current); };

export class NodeError extends Error {}

function candidates(): string[] {
  const custom = customNode();
  if (custom) return [custom];
  const working = sessionStorage.getItem(WORKING_KEY);
  return working ? [working, ...PUBLIC_NODES.filter((n) => n !== working)] : PUBLIC_NODES;
}

async function post(node: string, path: string, body: unknown): Promise<any> {
  // No Content-Type header: a "simple" request needs no CORS preflight, and monerod doesn't check it.
  const res = await fetch(`${node}${path}`, { method: "POST", body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new NodeError(`${res.status}`);
  return res.json();
}

async function request(path: string, body: unknown, unwrap: (r: any) => any): Promise<any> {
  let last: unknown;
  for (const node of candidates()) {
    try {
      const result = unwrap(await post(node, path, body));
      sessionStorage.setItem(WORKING_KEY, node);
      current = node;
      nodeListeners.forEach((l) => l(node));
      return result;
    } catch (e) {
      last = e;
    }
  }
  throw new NodeError(last instanceof Error ? last.message : "no node answered");
}

export function rpc<T>(method: string, params?: object): Promise<T> {
  return request("/json_rpc", { jsonrpc: "2.0", id: "0", method, params }, (r) => {
    if (r.error) throw new NodeError(r.error.message);
    return r.result;
  });
}

/** monerod's "other" endpoints, like /get_transactions. */
export function call<T>(path: string, body: object): Promise<T> {
  return request(path, body, (r) => {
    if (r.status && r.status !== "OK") throw new NodeError(r.status);
    return r;
  });
}

export const getInfo = () => rpc<NodeInfo>("get_info");
export const getFeeEstimate = () => rpc<FeeEstimate>("get_fee_estimate", { grace_blocks: 10 });
export const getLastBlockHeader = () => rpc<{ block_header: BlockHeader }>("get_last_block_header").then((r) => r.block_header);
export const getBlockHeader = (height: number) =>
  rpc<{ block_header: BlockHeader }>("get_block_header_by_height", { height }).then((r) => r.block_header);
