/* Transaction weights and fees, following wallet2's estimates (CLSAG, Bulletproofs+, view tags, ring size 16). */

const RING = 16;
const TX_PUBKEY_EXTRA = 33;
const DUMMY_PAYMENT_ID_EXTRA = 11;

export const PRIORITIES = ["low", "medium", "high", "highest"] as const;
export type Priority = (typeof PRIORITIES)[number];

const log2Ceil = (n: number, from = 0) => { let k = from; while (1 << k < n) k++; return k; };

/** wallet2 estimate_tx_size: serialized size in bytes. */
export function estimateTxSize(inputs: number, outputs: number): number {
  // Two-output transactions carry a dummy encrypted payment ID, so all payments look alike.
  const extra = TX_PUBKEY_EXTRA + (outputs === 2 ? DUMMY_PAYMENT_ID_EXTRA : 0);
  const bulletproofPlus = (2 * (6 + log2Ceil(outputs)) + 6) * 32 + 3;
  return 1 + 6
    + inputs * (1 + 6 + RING * 2 + 32)
    + outputs * (6 + 32)
    + extra
    + 1
    + bulletproofPlus
    + inputs * (32 * RING + 64)
    + outputs // view tags
    + 32 * inputs // pseudo outputs
    + 8 * outputs // encrypted amounts
    + 32 * outputs // commitments
    + 4; // fee
}

/** wallet2 estimate_tx_weight: size plus the Bulletproofs clawback for more than two outputs. */
export function estimateTxWeight(inputs: number, outputs: number): number {
  const size = estimateTxSize(inputs, outputs);
  if (outputs <= 2) return size;
  const base = (32 * (6 + 7 * 2)) / 2;
  const log = log2Ceil(outputs, 2);
  const proof = 32 * (6 + 2 * (6 + log));
  return size + Math.floor(((base * (1 << log) - proof) * 4) / 5);
}

/** Fee in piconero: weight times the per-byte rate, rounded up to the node's quantization. */
export function feeFor(weight: number, perByte: number, quantizationMask: number): number {
  const mask = Math.max(1, quantizationMask);
  return Math.ceil((weight * perByte) / mask) * mask;
}

/** Blocks for the low-priority queue to clear. */
export const blocksToClear = (poolBytes: number, medianWeight: number) => Math.max(1, Math.ceil(poolBytes / Math.max(1, medianWeight)));
