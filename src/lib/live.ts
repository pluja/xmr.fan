/* Turns the live mempool into music: what changed since the last poll, and a note for each transaction. */

export const POLL_SECONDS = 5;

/** C minor pentatonic, as semitones above C. */
const SCALE = [0, 3, 5, 7, 10];

/** Low, normal or high fee, compared with the node's fee estimates for each priority. */
export type FeeTier = 0 | 1 | 2;

export interface PoolChange { added: string[]; removed: string[] }

export function diffPool(previous: ReadonlySet<string>, current: readonly string[]): PoolChange {
  const now = new Set(current);
  return {
    added: current.filter((h) => !previous.has(h)),
    removed: [...previous].filter((h) => !now.has(h)),
  };
}

/** Wallets pay a multiple of the base fee per byte; anything from about the third priority up counts as high. */
export function feeTier(fee: number, bytes: number, estimates: readonly number[]): FeeTier {
  const perByte = fee / bytes;
  if (estimates[2] && perByte >= estimates[2] * 0.9) return 2;
  if (estimates[1] && perByte >= estimates[1] * 0.9) return 1;
  return 0;
}

/** The same transaction always plays the same note; higher fees play an octave higher. */
export const noteFor = (txHash: string, tier: FeeTier = 1) => 48 + tier * 12 + SCALE[parseInt(txHash.slice(0, 8), 16) % SCALE.length];
