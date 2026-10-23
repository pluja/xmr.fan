/* Address art: every Monero address hatches its own pixel critter. The whole address is hashed,
   so changing any character gives a different critter, which makes look-alike addresses easy to spot. */
import { keccak_256 } from "@noble/hashes/sha3.js";

export const SIZE = 24;

/**
 * One letter per pixel: "." empty, o outline, b body, d shade, l light, w white, e eye, s eye sparkle,
 * p blush, t tongue, a accent, g gold.
 */
export type Pixel = "." | "o" | "b" | "d" | "l" | "w" | "e" | "s" | "p" | "t" | "a" | "g";
export type Paint = Exclude<Pixel, ".">;

export const RARITIES = ["common", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];
/** Chance of each rarity, in the same order. */
export const RARITY_ODDS = [0.8, 0.15, 0.04, 0.01] as const;

export interface Critter {
  rows: string[];
  colors: Record<Paint, string>;
  /** Two backdrop colors, top and bottom. */
  backdrop: [string, string];
  name: string;
  rarity: Rarity;
  /** A serial number from 1 to 9999, like a trading card. */
  number: number;
  /** First and last row of the eyes, for blinking; null when they're already shut. */
  eyeRows: [number, number] | null;
}

const HUES = [
  { o: "#5a2108", d: "#d1520c", b: "#ff7a1a", l: "#ffb27a", sky: ["#4a2a1c", "#1f1714"] },
  { o: "#0d3b33", d: "#22917a", b: "#3fc1a9", l: "#a3eedd", sky: ["#163a33", "#0f1c1a"] },
  { o: "#2a1660", d: "#6a3fd1", b: "#9b6bff", l: "#d2bdff", sky: ["#2c2248", "#15121f"] },
  { o: "#5c1233", d: "#d1477f", b: "#ff6fae", l: "#ffc2dc", sky: ["#4a1f33", "#1f131a"] },
  { o: "#0f2559", d: "#2f63c9", b: "#4f8dff", l: "#b3d0ff", sky: ["#1d2c4a", "#11161f"] },
  { o: "#1f420c", d: "#5ca62e", b: "#9be15d", l: "#d7f7b5", sky: ["#253b1c", "#121a10"] },
  { o: "#5c4205", d: "#cf9d12", b: "#ffd23f", l: "#fff0b3", sky: ["#4a3d1a", "#1f1a10"] },
  { o: "#5c0f0c", d: "#cc332c", b: "#ff5a4f", l: "#ffb8b3", sky: ["#4a1d1b", "#1f1211"] },
];
const ACCENTS = ["#fff1e0", "#ffd23f", "#3fc1a9", "#ff6fae", "#4f8dff", "#ff7a1a", "#9be15d"];
const SYLLABLES = ["ba", "bo", "ki", "zu", "mo", "ra", "lu", "xe", "pi", "no", "ta", "vi", "go", "fe", "shi", "ko", "ru", "ze", "mi", "da", "wo", "ne", "chu", "ya", "pa", "rin", "mu", "zo"];

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
  const hash = keccak_256(new TextEncoder().encode(address.trim()));
  const random = generator(hash);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  const roll = random();
  const rarity: Rarity = roll < 0.01 ? "legendary" : roll < 0.05 ? "epic" : roll < 0.2 ? "rare" : "common";

  const grid: Pixel[][] = Array.from({ length: SIZE }, () => Array<Pixel>(SIZE).fill("."));
  const HALF = SIZE / 2;
  const inside = (x: number, y: number) => y >= 0 && y < SIZE && x >= 0 && x < SIZE;
  const set = (x: number, y: number, p: Pixel) => {
    if (!inside(x, y) || x >= HALF) return;
    grid[y][x] = p;
    grid[y][SIZE - 1 - x] = p;
  };
  const get = (x: number, y: number): Pixel => (inside(x, y) ? grid[y][x] : ".");
  const isBody = (p: Pixel) => p === "b" || p === "d" || p === "l";
  const bodyRows = () => grid.map((row, y) => (row.some(isBody) ? y : -1)).filter((y) => y >= 0);

  // Body: a soft ellipse with a ragged edge, drawn on the left half and mirrored.
  const shape = pick(["blob", "blob", "tall", "wide", "ghost", "slime"] as const);
  const rx = shape === "wide" ? 8 + random() * 1.5 : shape === "tall" ? 5 + random() : 6 + random() * 1.8;
  const ry = shape === "tall" ? 8 + random() * 1.2 : shape === "wide" ? 5.5 + random() : 6 + random() * 1.6;
  const cy = 13.8 + (random() - 0.5);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < HALF; x++) {
    const dx = (x + 0.5 - HALF) / rx;
    let dy = (y + 0.5 - cy) / ry;
    // Slimes sit flat and spread at the bottom.
    if (shape === "slime" && dy > 0) dy *= 0.6;
    const e = dx * dx + dy * dy;
    // A thin ragged band keeps the outline organic without turning it into fuzz.
    if (e < 0.92 || (e < 1.04 && random() < 0.4)) set(x, y, "b");
  }
  const top = bodyRows()[0];
  let bottom = bodyRows().at(-1)!;
  if (shape === "ghost") for (let x = 0; x < HALF; x++) if (x % 3 === 0) set(x, bottom, ".");
  bottom = bodyRows().at(-1)!;

  // Markings.
  const pattern = pick(["plain", "belly", "belly", "spots", "stripes"] as const);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < HALF; x++) {
    if (get(x, y) !== "b") continue;
    const belly = ((x + 0.5 - HALF) / (rx * 0.55)) ** 2 + ((y + 0.5 - (cy + ry * 0.35)) / (ry * 0.45)) ** 2 < 1;
    if (pattern === "belly" && belly) set(x, y, "l");
    if (pattern === "spots" && random() < 0.1) set(x, y, "l");
    if (pattern === "stripes" && y % 3 === 0 && y < cy) set(x, y, "d");
  }

  // Head gear, with the rarest critters wearing a halo or a crown.
  const gear = rarity === "legendary" ? "halo" : rarity === "epic" ? "crown" : pick(["antenna", "horns", "ears", "sprout", "spikes", "none"] as const);
  const peak = top - 1;
  const at = (dx: number) => HALF - 1 - dx;
  if (gear === "antenna") { set(at(0), peak, "o"); set(at(0), peak - 1, "o"); set(at(0), peak - 2, "a"); set(at(1), peak - 2, "a"); set(at(0), peak - 3, "a"); }
  if (gear === "horns") { set(at(3), peak, "w"); set(at(4), peak, "w"); set(at(4), peak - 1, "w"); set(at(5), peak - 2, "w"); }
  if (gear === "ears") { set(at(3), peak, "b"); set(at(4), peak, "b"); set(at(5), peak, "b"); set(at(4), peak - 1, "b"); set(at(5), peak - 1, "p"); set(at(5), peak - 2, "b"); }
  if (gear === "sprout") { set(at(0), peak, "o"); set(at(0), peak - 1, "o"); set(at(1), peak - 2, "a"); set(at(2), peak - 2, "a"); set(at(1), peak - 1, "a"); }
  if (gear === "spikes") for (const i of [0, 3]) { set(at(i), peak, "d"); set(at(i), peak - 1, "d"); }
  if (gear === "crown") { for (let i = 0; i < 4; i++) set(at(i), peak, "g"); set(at(0), peak - 1, "a"); set(at(3), peak - 1, "g"); set(at(3), peak - 2, "g"); set(at(1), peak - 1, "g"); }
  if (gear === "halo") { for (let i = 0; i < 4; i++) { set(at(i), peak - 4, "g"); set(at(i), peak - 2, "g"); } set(at(4), peak - 3, "g"); }

  // Arms and feet.
  if (random() < 0.6) {
    const armY = Math.round(cy + 1.5), edge = grid[armY].findIndex(isBody);
    if (edge > 1) { set(edge - 1, armY, "b"); set(edge - 2, armY - (random() < 0.5 ? 1 : 0), "b"); }
  }
  if (shape !== "ghost" && shape !== "slime" && bottom + 1 < SIZE) {
    const footX = grid[bottom].findIndex(isBody) + 1;
    set(footX, bottom + 1, "d"); set(footX + 1, bottom + 1, "d");
  }

  // Face.
  const eyeY = Math.max(top + 2, Math.round(cy - ry * 0.3));
  const eyeX = HALF - 3 - Math.floor(random() * 2);
  const eyes = pick(["cute", "cute", "round", "visor", "angry", "happy", "cyclops"] as const);
  if (eyes === "cute" || eyes === "angry") {
    for (let y = 0; y < 3; y++) { set(eyeX, eyeY + y, "e"); set(eyeX - 1, eyeY + y, "e"); }
    set(eyeX - 1, eyeY, "s");
    if (eyes === "angry") { set(eyeX - 1, eyeY - 2, "o"); set(eyeX, eyeY - 1, "o"); set(eyeX + 1, eyeY - 1, "o"); }
  }
  if (eyes === "round") {
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) set(eyeX - x, eyeY + y, "w");
    for (const [x, y] of [[0, 1], [1, 1], [0, 2], [1, 2]]) set(eyeX - x, eyeY + y, "e");
  }
  if (eyes === "visor") {
    for (let x = eyeX - 2; x < HALF; x++) { set(x, eyeY, "e"); set(x, eyeY + 1, "e"); }
    set(eyeX - 1, eyeY, "a"); set(eyeX, eyeY, "a");
  }
  if (eyes === "happy") { set(eyeX - 1, eyeY + 1, "e"); set(eyeX, eyeY, "e"); set(eyeX + 1, eyeY + 1, "e"); }
  if (eyes === "cyclops") {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 2; x++) set(HALF - 1 - x, eyeY + y, "w");
    set(HALF - 1, eyeY + 1, "e"); set(HALF - 1, eyeY + 2, "e"); set(HALF - 2, eyeY + 2, "e"); set(HALF - 2, eyeY + 1, "s");
  }
  if ((eyes === "cute" || eyes === "happy") && random() < 0.7) { set(eyeX - 1, eyeY + 3, "p"); set(eyeX - 2, eyeY + 3, "p"); }
  const mouthY = Math.min(bottom - 2, eyeY + (eyes === "cyclops" ? 5 : 4));
  const mouth = pick(["cat", "smile", "fang", "open", "tiny"] as const);
  if (mouth === "cat") { set(HALF - 1, mouthY, "e"); set(HALF - 2, mouthY + 1, "e"); set(HALF - 3, mouthY, "e"); }
  if (mouth === "smile") { set(HALF - 1, mouthY + 1, "e"); set(HALF - 2, mouthY + 1, "e"); set(HALF - 3, mouthY, "e"); }
  if (mouth === "fang") { set(HALF - 1, mouthY, "e"); set(HALF - 2, mouthY, "e"); set(HALF - 2, mouthY + 1, "w"); }
  if (mouth === "open") { set(HALF - 1, mouthY, "e"); set(HALF - 2, mouthY, "e"); set(HALF - 1, mouthY + 1, "t"); set(HALF - 2, mouthY + 1, "e"); }
  if (mouth === "tiny") set(HALF - 1, mouthY, "e");

  // Light from the top left: edges facing up or left catch it, edges facing down or right fall in shade.
  const lit = grid.map((row) => [...row]);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (grid[y][x] !== "b") continue;
    if (!isBody(get(x, y + 1)) || !isBody(get(x + 1, y)) || (y > cy && !isBody(get(x, y + 2)))) lit[y][x] = "d";
    else if (!isBody(get(x, y - 1)) || (y < cy && !isBody(get(x - 1, y)))) lit[y][x] = "l";
  }
  // Outline everything that touches the critter, except floating gold and accents.
  const filled = lit.map((row) => row.map((p) => p !== "."));
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (filled[y][x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => filled[y + dy]?.[x + dx] && !"ag".includes(lit[y + dy][x + dx]))) lit[y][x] = "o";
  }

  const hue = pick(HUES);
  const name = Array.from({ length: 2 }, () => {
    const word = Array.from({ length: 2 + Math.floor(random() * 2) }, () => pick(SYLLABLES)).join("");
    return word[0].toUpperCase() + word.slice(1);
  }).join(" ");
  return {
    rows: lit.map((row) => row.join("")),
    colors: { o: hue.o, b: hue.b, d: hue.d, l: hue.l, w: "#fffaf2", e: "#1a1420", s: "#ffffff", p: "#ff8fb1", t: "#ff4f6d", a: pick(ACCENTS), g: "#ffd23f" },
    backdrop: hue.sky as [string, string],
    name,
    rarity,
    number: (((hash[30] << 8) | hash[31]) % 9999) + 1,
    eyeRows: eyes === "happy" ? null : [eyeY, eyeY + { cute: 2, angry: 2, round: 2, visor: 1, cyclops: 3 }[eyes]],
  };
}

export interface DrawOptions {
  /** Eyes closed, for blinking. */
  blink?: boolean;
  /** Rows hidden from the top, while hatching. */
  hidden?: number;
}

/** Paints a critter at (x, y), one square of `scale` per pixel. */
export function drawCritter(g: CanvasRenderingContext2D, critter: Critter, x: number, y: number, scale: number, o: DrawOptions = {}) {
  critter.rows.forEach((row, cy) => {
    if (cy < (o.hidden ?? 0)) return;
    [...row].forEach((p, cx) => {
      if (p === ".") return;
      let paint = p as Paint;
      // Shut eyes: the eye rows take the body color, except a dark line along the bottom.
      const eyes = critter.eyeRows;
      if (o.blink && eyes && cy >= eyes[0] && cy <= eyes[1] && "esw".includes(p)) paint = cy === eyes[1] ? "e" : "b";
      g.fillStyle = critter.colors[paint];
      g.fillRect(x + cx * scale, y + cy * scale, scale, scale);
    });
  });
}
