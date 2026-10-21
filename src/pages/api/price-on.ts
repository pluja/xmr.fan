/* GET /api/price-on?date=YYYY-MM-DD: XMR's daily close in USD on that day, from Bitfinex.
   Proxied because Bitfinex sends no CORS headers; past days never change, so they're cached. */
import type { APIRoute } from "astro";

export const prerender = false;

const cache = new Map<string, number>();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FIRST_DAY = Date.parse("2017-01-01T00:00:00Z");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": status === 200 ? "public, max-age=86400" : "no-store" } });

export const GET: APIRoute = async ({ url }) => {
  const date = url.searchParams.get("date") ?? "";
  const start = Date.parse(`${date}T00:00:00Z`);
  if (!DATE_RE.test(date) || !Number.isFinite(start) || start < FIRST_DAY || start > Date.now() - 86_400_000) return json({ error: "bad_date" }, 400);
  if (!cache.has(date)) {
    const res = await fetch(`https://api-pub.bitfinex.com/v2/candles/trade:1D:tXMRUSD/hist?start=${start}&end=${start + 86_399_999}&limit=1&sort=1`, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    const candle = res?.ok ? ((await res.json()) as number[][])[0] : undefined;
    if (!candle || candle[0] !== start) return json({ error: "unavailable" }, 502);
    cache.set(date, candle[2]);
  }
  return json({ date, usd: cache.get(date) });
};
