/* Converts between dates and block heights by interpolating between sampled blocks
   (src/data/heights.json, refreshed with `npm run heights`); past the last sample it
   extrapolates at the 2-minute target. Times are Unix seconds. */
import { BLOCK_SECONDS } from "./nodes.ts";

/** [height, timestamp], as stored in heights.json. */
export type Sample = readonly number[];

const interpolate = (x: number, x0: number, x1: number, y0: number, y1: number) => y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);

/** Index i such that key(samples[i]) <= x < key(samples[i + 1]), clamped to the table. */
function segment(samples: readonly Sample[], x: number, key: 0 | 1): number {
  let lo = 0, hi = samples.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (samples[mid][key] <= x) lo = mid; else hi = mid - 1;
  }
  return lo;
}

export function heightAt(time: number, samples: readonly Sample[]): number {
  const first = samples[0], last = samples[samples.length - 1];
  if (time <= first[1]) return first[0];
  if (time >= last[1]) return Math.floor(last[0] + (time - last[1]) / BLOCK_SECONDS);
  const i = segment(samples, time, 1);
  const [h0, t0] = samples[i], [h1, t1] = samples[i + 1];
  return Math.floor(interpolate(time, t0, t1, h0, h1));
}

export function timeAt(height: number, samples: readonly Sample[]): number {
  const first = samples[0], last = samples[samples.length - 1];
  if (height <= first[0]) return first[1];
  if (height >= last[0]) return last[1] + (height - last[0]) * BLOCK_SECONDS;
  const i = segment(samples, height, 0);
  const [h0, t0] = samples[i], [h1, t1] = samples[i + 1];
  return Math.round(interpolate(height, h0, h1, t0, t1));
}

/** Wallets scan from the restore height, so starting a little early costs minutes; starting late misses funds. */
export const SAFETY_DAYS = 7;
export const SAFETY_CHOICES = [1, 7, 30] as const;
export const restoreHeight = (exact: number, days: number = SAFETY_DAYS) => Math.max(0, exact - Math.round((days * 86_400) / BLOCK_SECONDS));
