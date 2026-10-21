/* GET /api/hashes: the official download hashes, only after binaryFate's signature checks out. */
import type { APIRoute } from "astro";
import type { HashList } from "../../lib/hashes";
import { loadHashList } from "../../lib/server/hashes";

export const prerender = false;

const TTL_MS = 60 * 60_000;
let cache: HashList | undefined;

export const GET: APIRoute = async () => {
  if (!cache || Date.now() - cache.checkedAt > TTL_MS) {
    try {
      cache = await loadHashList();
    } catch (e) {
      console.warn("hashes:", (e as Error).message);
      if (!cache) return new Response(JSON.stringify({ error: "unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
  }
  return new Response(JSON.stringify(cache), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=600" } });
};
