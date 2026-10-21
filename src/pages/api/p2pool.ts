/* GET /api/p2pool: the three P2Pool sidechains' difficulty and window, cached briefly.
   Proxied because p2pool.observer's bot protection can block browsers. */
import type { APIRoute } from "astro";
import type { Sidechain } from "../../lib/mining";

export const prerender = false;

const CHAINS: Record<Sidechain["name"], string> = { main: "https://p2pool.observer", mini: "https://mini.p2pool.observer", nano: "https://nano.p2pool.observer" };
const TTL_MS = 2 * 60_000;
let cache: { chains: Sidechain[]; at: number } | undefined;

async function load(): Promise<Sidechain[]> {
  const results = await Promise.all(Object.entries(CHAINS).map(async ([name, base]) => {
    try {
      const { sidechain: s } = await (await fetch(`${base}/api/pool_info`, { signal: AbortSignal.timeout(10_000) })).json();
      return { name, difficulty: s.difficulty, blockTime: s.block_time, windowSize: s.window_size } as Sidechain;
    } catch {
      return null;
    }
  }));
  return results.filter((c): c is Sidechain => !!c);
}

export const GET: APIRoute = async () => {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const chains = await load();
    if (chains.length) cache = { chains, at: Date.now() };
  }
  return new Response(JSON.stringify(cache?.chains ?? []), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } });
};
