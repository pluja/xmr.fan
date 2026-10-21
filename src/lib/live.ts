/* Turns the live mempool into music: what changed since the last poll, and a note for each transaction. */

export const POLL_SECONDS = 5;

/** Notes of C minor pentatonic over two octaves, as MIDI numbers. */
const NOTES = [60, 63, 65, 67, 70, 72, 75, 77, 79, 82];

export interface PoolChange { added: string[]; removed: string[] }

export function diffPool(previous: ReadonlySet<string>, current: readonly string[]): PoolChange {
  const now = new Set(current);
  return {
    added: current.filter((h) => !previous.has(h)),
    removed: [...previous].filter((h) => !now.has(h)),
  };
}

/** The same transaction always plays the same note. */
export const noteFor = (txHash: string) => NOTES[parseInt(txHash.slice(0, 8), 16) % NOTES.length];

/** A hash's first byte as a color index, so each transaction keeps its color on screen. */
export const shadeFor = (txHash: string) => parseInt(txHash.slice(8, 10), 16);
