/* XMR price over a week, from CoinGecko's free API (USD). */
import type { EditionData } from "../../src/lib/gazette-schema.ts";
import type { Week } from "./week.ts";

type Point = [number, number]; // [ms, value]
interface Chart { prices: Point[]; total_volumes: Point[]; market_caps: Point[] }

const DAY = 86_400_000;
const WEEK = 7 * DAY;

async function chart(coin: string, days: number): Promise<Chart> {
  // Up to 90 days, CoinGecko returns hourly points.
  const url = `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=${days}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "xmr.fan-gazette/1.0", ...(process.env.COINGECKO_API_KEY ? { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY } : {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`CoinGecko ${coin}: ${res.status}`);
  return res.json();
}

const between = (points: Point[], from: number, to: number) => points.filter(([t]) => t >= from && t < to);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const pct = (a: number, b: number) => Math.round(((b - a) / a) * 1000) / 10;
const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

function weekChange(prices: Point[], from: number, to: number) {
  const pts = between(prices, from, to);
  if (pts.length < 2) throw new Error("not enough price data for the week");
  return { pts, open: pts[0][1], close: pts[pts.length - 1][1] };
}

function monthContext(prices: Point[], to: number) {
  const pts = between(prices, to - 30 * DAY, to);
  if (pts.length < 2) return undefined;
  const values = pts.map(([, p]) => p);
  return { change: pct(values[0], values.at(-1)!), high: round(Math.max(...values)), low: round(Math.min(...values)) };
}

export async function marketWeek(week: Week): Promise<NonNullable<EditionData["market"]>> {
  const from = week.from.getTime();
  const to = Math.min(week.to.getTime(), Date.now());
  const days = Math.min(90, Math.ceil((Date.now() - (to - 30 * DAY)) / DAY) + 1);
  const [xmr, btc] = await Promise.all([chart("monero", days), chart("bitcoin", days)]);

  const { pts, open, close } = weekChange(xmr.prices, from, to);
  const btcWeek = weekChange(btc.prices, from, to);
  const volume = mean(between(xmr.total_volumes, from, to).map(([, v]) => v));
  const prevVolume = mean(between(xmr.total_volumes, from - WEEK, from).map(([, v]) => v));
  const caps = between(xmr.market_caps, from, to);

  const series: number[] = [];
  for (let t = from; t < to; t += 4 * 3_600_000) {
    const p = pts.filter(([pt]) => pt < t + 4 * 3_600_000).at(-1);
    if (p) series.push(round(p[1]));
  }

  return {
    open: round(open),
    close: round(close),
    high: round(Math.max(...pts.map(([, p]) => p))),
    low: round(Math.min(...pts.map(([, p]) => p))),
    change: pct(open, close),
    volume: Math.round(volume),
    volumeChange: prevVolume ? pct(prevVolume, volume) : 0,
    mcap: Math.round(caps.at(-1)?.[1] ?? 0),
    btcChange: pct(btcWeek.open, btcWeek.close),
    series,
    month: monthContext(xmr.prices, to),
  };
}
