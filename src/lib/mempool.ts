/* Reads mempool stats into a few gauges and a verdict: calm, busy, congested or flooded. */

export interface PoolStats { bytes_total: number; fee_total: number; txs_total: number; oldest: number }

export type PoolState = "calm" | "busy" | "jam" | "flood";

export interface PoolAssessment {
  /** Waiting bytes as a share of one block's no-penalty size; 1 = a full block. */
  fill: number;
  /** Average fee per byte as a multiple of the low-priority rate. */
  feeMultiple: number;
  /** feeMultiple on a log scale from 1× (0) to the highest priority (1). */
  feeLevel: number;
  /** Index of the highest priority the average fee reaches. */
  priority: number;
  state: PoolState;
}

/** Average weight of the given blocks as a share of the no-penalty size. */
export const recentFullness = (headers: readonly { block_weight: number }[], median: number) =>
  headers.length ? headers.reduce((sum, h) => sum + h.block_weight, 0) / headers.length / Math.max(1, median) : 0;

export function assessPool(stats: PoolStats, median: number, fees: readonly number[], recent = 0): PoolAssessment {
  const fill = stats.bytes_total / Math.max(1, median);
  const low = fees[0] || 1, top = fees.at(-1) || low;
  const feeMultiple = stats.bytes_total ? stats.fee_total / stats.bytes_total / low : 0;
  const feeLevel = feeMultiple <= 1 ? (feeMultiple ? 0.02 : 0) : Math.min(1, Math.log(feeMultiple) / Math.log(Math.max(2, top / low)));
  const perByte = feeMultiple * low;
  const priority = Math.max(0, fees.findLastIndex((f) => perByte >= f * 0.9));
  // Full recent blocks mean the pool is being drained as fast as it fills, so count that as busy too.
  const state: PoolState = fill >= 3 ? "flood" : fill > 1 ? "jam" : fill >= 0.5 || recent >= 0.9 ? "busy" : "calm";
  return { fill, feeMultiple, feeLevel, priority, state };
}
