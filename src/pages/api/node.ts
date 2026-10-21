/* GET /api/node?url=<node>: checks one node. GET /api/node?list: the suggested public nodes. */
import type { APIRoute } from "astro";
import { normalizeNodeUrl, WALLET_NODES, type NodeCheck } from "../../lib/nodes";
import { checkNode } from "../../lib/server/node-check";

export const prerender = false;

const LIST_TTL_MS = 5 * 60_000;
const PER_MINUTE = 20;

let list: { checks: NodeCheck[]; at: number } | undefined;
let listPending: Promise<NodeCheck[]> | undefined;
const hits = new Map<string, { n: number; since: number }>();

const json = (body: unknown, status = 200, maxAge = 0) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store" } });

function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.since > 60_000) { hits.set(ip, { n: 1, since: now }); return false; }
  return ++h.n > PER_MINUTE;
}

export const GET: APIRoute = async ({ url, clientAddress }) => {
  if (url.searchParams.has("list")) {
    if (!list || Date.now() - list.at > LIST_TTL_MS) {
      listPending ??= Promise.all(WALLET_NODES.map((n) => checkNode(n))).finally(() => (listPending = undefined));
      list = { checks: await listPending, at: Date.now() };
    }
    return json(list.checks, 200, 60);
  }
  const input = url.searchParams.get("url") ?? "";
  const node = normalizeNodeUrl(input);
  if (!node) return json({ error: "bad_url" }, 400);
  if (limited(clientAddress)) return json({ error: "rate_limited" }, 429);
  const check = await checkNode(node);
  // Without a scheme we tried HTTPS first; many nodes only speak plain HTTP.
  if (!check.ok && check.error !== "private" && !/^https?:\/\//i.test(input.trim())) {
    const plain = await checkNode(node.replace(/^https:/, "http:"));
    if (plain.ok) return json(plain);
  }
  return json(check);
};
