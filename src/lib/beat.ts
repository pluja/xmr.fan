/* Turns an address into a looping chiptune: the checksum sets tempo and key, the spend key the melody,
   the view key the bass, and spare bits the drums. The same address always plays the same song. */
import { base58Decode } from "./monero.ts";

export const STEPS = 32;

/** Pentatonic scales are named by their mode only. */
const SCALES: Record<string, number[]> = {
  minor: [0, 3, 5, 7, 10],
  major: [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export interface Song {
  bpm: number;
  key: string;
  scale: string;
  /** MIDI note per step, or null for a rest. */
  lead: (number | null)[];
  bass: (number | null)[];
  kick: boolean[];
  snare: boolean[];
  hat: boolean[];
  /** The address bytes, for the visualizer. */
  bytes: Uint8Array;
}

/** The song for a valid address's bytes (base58-decoded, checksum included). */
export function songFromBytes(bytes: Uint8Array): Song {
  const spend = bytes.subarray(1, 33), view = bytes.subarray(33, 65), check = bytes.subarray(bytes.length - 4);
  const scaleName = Object.keys(SCALES)[check[0] % Object.keys(SCALES).length];
  const scale = SCALES[scaleName];
  const root = 57 + (check[1] % 12);
  const noteAt = (n: number, octave: number) => root + octave * 12 + scale[n % scale.length] + 12 * Math.floor(n / scale.length);

  const lead = Array.from({ length: STEPS }, (_, i) => (spend[i] < 96 ? null : noteAt(spend[i] % (scale.length * 2), 0)));
  const bass = Array.from({ length: STEPS }, (_, i) => (i % 2 === 0 && view[i] >= 64 ? noteAt(view[i] % scale.length, -2) : null));
  const bits = (byteA: number, byteB: number) => Array.from({ length: STEPS }, (_, i) => (((i < 16 ? byteA << 8 | byteB : byteB << 8 | byteA) >> (i % 16)) & 1) === 1);
  const kickBits = bits(view[2], view[3]);
  const hatBits = bits(spend[4], spend[5]);
  return {
    bpm: 96 + (check[2] % 48),
    key: NOTE_NAMES[root % 12],
    scale: scaleName,
    lead,
    bass,
    kick: kickBits.map((b, i) => i % 8 === 0 || (b && i % 2 === 0)),
    snare: Array.from({ length: STEPS }, (_, i) => i % 8 === 4),
    hat: hatBits.map((b, i) => b || i % 4 === 2),
    bytes,
  };
}

export function songFromAddress(address: string): Song | null {
  const bytes = base58Decode(address.trim());
  return bytes && (bytes.length === 69 || bytes.length === 77) ? songFromBytes(bytes) : null;
}

export const midiToHz = (note: number) => 440 * 2 ** ((note - 69) / 12);
