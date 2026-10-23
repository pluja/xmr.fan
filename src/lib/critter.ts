/* Address art: every Monero address hatches its own pixel critter. The whole address is hashed,
   so changing any character gives a different critter, which makes look-alike addresses easy to spot. */
import { keccak_256 } from "@noble/hashes/sha3.js";

export const SIZE = 16;

/** One letter per pixel: "." empty, o outline, b body, d body shade, l body light, w white, k dark, a accent. */
export type Pixel = "." | "o" | "b" | "d" | "l" | "w" | "k" | "a";

export interface Critter {
  rows: string[];
  colors: Record<Exclude<Pixel, ".">, string> & { bg: string };
  name: string;
}

const HUES = [
  { b: "#ff7a1a", d: "#c4500a", l: "#ffb27a", bg: "#3a2618" },
  { b: "#3fc1a9", d: "#23866f", l: "#9be8d6", bg: "#173029" },
  { b: "#9b6bff", d: "#6a3fd1", l: "#cbb3ff", bg: "#251c3a" },
  { b: "#ff6fae", d: "#c93f7c", l: "#ffb3d4", bg: "#3a1c2a" },
  { b: "#4f8dff", d: "#2c5fc4", l: "#a9c8ff", bg: "#18233a" },
  { b: "#9be15d", d: "#5fa52f", l: "#d0f5ab", bg: "#1f3018" },
  { b: "#ffd23f", d: "#c79a12", l: "#ffeaa3", bg: "#3a3218" },
  { b: "#ff5a4f", d: "#c4302a", l: "#ffaaa3", bg: "#3a1a18" },
];
const ACCENTS = ["#fff1e0", "#ffd23f", "#3fc1a9", "#ff6fae", "#4f8dff", "#ff7a1a"];
const SYLLABLES = ["ba", "bo", "ki", "zu", "mo", "ra", "lu", "xe", "pi", "no", "ta", "vi", "go", "fe", "shi", "ko", "ru", "ze", "mi", "da", "wo", "ne", "chu", "ya"];

/** sfc32, seeded from the hash, so the same address always draws the same critter. */
function generator(seed: Uint8Array) {
  const v = new DataView(seed.buffer, seed.byteOffset, 16);
  let a = v.getUint32(0), b = v.getUint32(4), c = v.getUint32(8), d = v.getUint32(12);
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b + d) | 0;
    d = (d + 1) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function critterFromAddress(address: string): Critter {
  const random = generator(keccak_256(new TextEncoder().encode(address.trim())));
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  const grid: Pixel[][] = Array.from({ length: SIZE }, () => Array<Pixel>(SIZE).fill("."));
  const set = (x: number, y: number, p: Pixel) => {
    if (y < 0 || y >= SIZE || x < 0 || x >= SIZE / 2) return;
    grid[y][x] = p;
    grid[y][SIZE - 1 - x] = p;
  };
  const at = (x: number, y: number) => (y < 0 || y >= SIZE || x < 0 || x >= SIZE ? "." : grid[y][x]);

  // Body: an ellipse with a ragged edge, drawn on the left half and mirrored.
  const rx = 3.8 + random() * 2.2, ry = 3.6 + random() * 2.4;
  const cy = 8.6 + (random() - 0.5);
  const ghost = random() < 0.2;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE / 2; x++) {
    const e = ((x + 0.5 - 8) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
    if (e < 0.75 || (e < 1.15 && random() < 0.55)) set(x, y, "b");
  }
  const top = grid.findIndex((row) => row.includes("b"));
  const bottom = SIZE - 1 - [...grid].reverse().findIndex((row) => row.includes("b"));

  // Shade the lower body, light up a belly or cheeks.
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE / 2; x++) if (grid[y][x] === "b" && y > cy + ry * 0.45) set(x, y, "d");
  if (random() < 0.5) for (let y = Math.round(cy + 1); y < Math.round(cy + ry * 0.6); y++) for (let x = 6; x < 8; x++) if (grid[y][x] === "b") set(x, y, "l");

  // Spots or stripes, then little arms.
  const pattern = pick(["plain", "plain", "spots", "stripes"] as const);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE / 2; x++) {
    if (grid[y][x] !== "b") continue;
    if (pattern === "spots" && random() < 0.12) set(x, y, "l");
    if (pattern === "stripes" && y % 3 === 0 && y > cy - ry * 0.2) set(x, y, "d");
  }
  if (random() < 0.45) {
    const armY = Math.round(cy + 0.5), edge = grid[armY].indexOf("b");
    if (edge > 0) { set(edge - 1, armY, "b"); set(edge - 1, armY - 1, random() < 0.5 ? "b" : "."); }
  }

  // Head gear.
  const gear = pick(["antenna", "horns", "ears", "sprout", "none"] as const);
  const peak = Math.max(0, top - 1);
  if (gear === "antenna") { set(7, peak, "k"); set(7, peak - 1, "k"); set(7, peak - 2, "a"); }
  if (gear === "horns") { set(5, peak, "w"); set(4, peak - 1, "w"); }
  if (gear === "ears") { set(4, peak, "b"); set(4, peak - 1, "b"); set(5, peak, "b"); }
  if (gear === "sprout") { set(7, peak, "k"); set(6, peak - 1, "a"); }

  // Feet, or a wavy hem for ghosts.
  if (ghost) for (let x = 0; x < SIZE / 2; x += 2) set(x + Math.round(8 - rx), bottom, ".");
  else if (bottom < SIZE - 1) { set(5, bottom + 1, "d"); set(4, bottom + 1, "d"); }

  // Face.
  const eyeY = Math.max(top + 1, Math.round(cy - ry * 0.25)), eyeX = 8 - (2 + Math.floor(random() * 2));
  const eyes = pick(["dot", "big", "cyclops", "sleepy"] as const);
  if (eyes === "dot") { set(eyeX, eyeY, "k"); }
  if (eyes === "big") { set(eyeX, eyeY, "w"); set(eyeX - 1, eyeY, "w"); set(eyeX, eyeY + 1, "k"); set(eyeX - 1, eyeY + 1, "w"); }
  if (eyes === "cyclops") { set(7, eyeY, "w"); set(7, eyeY + 1, "k"); set(6, eyeY, "w"); set(6, eyeY + 1, "w"); }
  if (eyes === "sleepy") { set(eyeX, eyeY + 1, "k"); set(eyeX - 1, eyeY + 1, "k"); }
  const mouthY = Math.min(bottom - 1, eyeY + 2 + Math.floor(random() * 2));
  const mouth = pick(["line", "smile", "open", "fangs"] as const);
  if (mouth === "line") { set(7, mouthY, "k"); set(6, mouthY, "k"); }
  if (mouth === "smile") { set(7, mouthY + 1, "k"); set(6, mouthY + 1, "k"); set(5, mouthY, "k"); }
  if (mouth === "open") { set(7, mouthY, "k"); set(7, mouthY + 1, "k"); }
  if (mouth === "fangs") { set(7, mouthY, "k"); set(6, mouthY, "k"); set(6, mouthY + 1, "w"); }

  // Outline every empty pixel that touches the critter.
  const filled = grid.map((row) => row.map((p) => p !== "."));
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (filled[y][x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => filled[y + dy]?.[x + dx] && at(x + dx, y + dy) !== "a")) grid[y][x] = "o";
  }

  const hue = pick(HUES);
  const name = Array.from({ length: 2 }, () => {
    const word = Array.from({ length: 2 + Math.floor(random() * 2) }, () => pick(SYLLABLES)).join("");
    return word[0].toUpperCase() + word.slice(1);
  }).join(" ");
  return {
    rows: grid.map((row) => row.join("")),
    colors: { o: "#151317", b: hue.b, d: hue.d, l: hue.l, w: "#fff8ee", k: "#151317", a: pick(ACCENTS), bg: hue.bg },
    name,
  };
}

/** Paints a critter on a canvas, one square per pixel, with or without its background tile. */
export function drawCritter(g: CanvasRenderingContext2D, critter: Critter, scale: number, background = true) {
  if (background) { g.fillStyle = critter.colors.bg; g.fillRect(0, 0, SIZE * scale, SIZE * scale); }
  critter.rows.forEach((row, y) => [...row].forEach((p, x) => {
    if (p === ".") return;
    g.fillStyle = critter.colors[p as Exclude<Pixel, ".">];
    g.fillRect(x * scale, y * scale, scale, scale);
  }));
}
