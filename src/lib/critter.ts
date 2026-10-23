/* Address art: every Monero address hatches its own pixel critter. The whole address is hashed into a
   species, colors, a signature item and a home, so look-alike addresses hatch strangers. */
import { keccak_256 } from "@noble/hashes/sha3.js";
import { HUES, ITEM_COLORS, ITEMS, MARKINGS, SCENES, SPECIES, TAILS, type Hue, type ItemName, type Scene, type Species } from "./critter-parts.ts";

export const GRID_W = 36, GRID_H = 32;

export const RARITIES = ["common", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];
/** Chance of each rarity, in the same order. */
export const RARITY_ODDS = [0.8, 0.15, 0.04, 0.01] as const;

/**
 * Pixels are color keys: "" empty, o outline, b body, d shade, l light, m marking, w white, e eye, s sparkle,
 * p blush, t tongue, a accent, and "i" plus a letter for item colors.
 */
export interface Critter {
  pixels: string[][];
  colors: Record<string, string>;
  name: string;
  species: Species;
  hue: Hue;
  item: ItemName;
  scene: Scene;
  rarity: Rarity;
  /** A serial number from 1 to 9999, like a trading card. */
  number: number;
  /** First and last row of the eyes, for blinking; null when they're covered or already shut. */
  eyeRows: [number, number] | null;
}

const SYLLABLES = ["pi", "bo", "ka", "zu", "mo", "ru", "ti", "na", "lu", "ko", "fe", "ba", "mi", "do", "sa", "yu", "ro", "ni", "pu", "ge", "wa", "chi", "to", "ri"];

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

const BODY = new Set(["b", "d", "l", "m"]);
/** Bodies are 20 pixels wide, from column X0, so they mirror around X0 + 9.5. */
const X0 = 6;
const mirror = (x: number) => X0 + 19 - (x - X0);

export function critterFromAddress(address: string): Critter {
  const hash = keccak_256(new TextEncoder().encode(address.trim()));
  const random = generator(hash);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];

  const species = pick(Object.keys(SPECIES) as Species[]);
  const hue = pick(Object.keys(HUES) as Hue[]);
  const marking = pick(MARKINGS.filter((m) => !m.avoid.includes(hue))).color;
  const item = pick(Object.keys(ITEMS) as ItemName[]);
  const scene = pick(SCENES);
  const roll = random();
  const rarity: Rarity = roll < 0.01 ? "legendary" : roll < 0.05 ? "epic" : roll < 0.2 ? "rare" : "common";

  const grid: string[][] = Array.from({ length: GRID_H }, () => Array<string>(GRID_W).fill(""));
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID_W && y < GRID_H;
  const set = (x: number, y: number, p: string) => { if (inside(x, y)) grid[y][x] = p; };
  const get = (x: number, y: number) => (inside(x, y) ? grid[y][x] : "");
  const isBody = (x: number, y: number) => BODY.has(get(x, y));

  // Body: the left half mirrored, standing on row 30.
  const template: readonly string[] = SPECIES[species];
  const y0 = 30 - (template.length - 1);
  let eyeX = -1, eyeY = -1;
  template.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === ".") return;
    if (ch === "E") { eyeX = X0 + c; eyeY = y0 + r; }
    // An eye cell takes the color beside it, so eyes on a white face disc sit on white.
    const p = ch === "#" ? "b" : ch === "k" ? "e" : ch === "E" ? ({ m: "m", w: "w" } as Record<string, string>)[row[c + 1]] ?? "b" : ch;
    set(X0 + c, y0 + r, p);
    set(mirror(X0 + c), y0 + r, p);
  }));

  const pattern = pick(["plain", "plain", "spots", "stripes"] as const);
  for (let y = 0; y < GRID_H; y++) for (let x = X0; x < X0 + 10; x++) {
    if (grid[y][x] !== "b") continue;
    if (pattern === "spots" && random() < 0.07) { set(x, y, "m"); set(mirror(x), y, "m"); }
    if (pattern === "stripes" && y % 3 === 0 && y < eyeY) { set(x, y, "d"); set(mirror(x), y, "d"); }
  }

  const rows = grid.map((row, y) => (row.some((p) => BODY.has(p)) ? y : -1)).filter((y) => y >= 0);
  const top = rows[0], bottom = rows.at(-1)!;
  const centerTop = grid.findIndex((row) => BODY.has(row[X0 + 9]));
  const rightEdge = (y: number) => grid[y].findLastIndex((p) => BODY.has(p));
  const leftEdge = (y: number) => grid[y].findIndex((p) => BODY.has(p));

  // Eyes: two pixels wide, the left one at eyeX and the right one mirrored.
  const eyes = pick(["bead", "bead", "tall", "round", "sleepy", "glare"] as const);
  const rightEyeX = mirror(eyeX) - 1;
  const tall = eyes === "tall" && isBody(eyeX, eyeY + 2) && isBody(eyeX + 1, eyeY + 2);
  const eyeH = tall ? 3 : eyes === "sleepy" ? 1 : 2;
  for (const [ex, inner] of [[eyeX, eyeX + 1], [rightEyeX, rightEyeX]] as const) {
    if (eyes === "sleepy") { set(ex, eyeY + 1, "e"); set(ex + 1, eyeY + 1, "e"); continue; }
    if (eyes === "round") { for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(ex + dx, eyeY + dy, "w"); set(inner, eyeY + 1, "e"); continue; }
    for (let y = 0; y < eyeH; y++) { set(ex, eyeY + y, "e"); set(ex + 1, eyeY + y, "e"); }
    set(ex, eyeY, "s");
    if (eyes === "glare") { set(ex, eyeY - 1, "o"); set(ex + 1, eyeY - 1, "o"); }
  }
  if ((eyes === "bead" || eyes === "tall") && random() < 0.6) {
    for (const x of [eyeX - 1, rightEyeX + 2]) if (isBody(x, eyeY + eyeH)) set(x, eyeY + eyeH, "p");
  }

  // Mouth, unless the species has a beak or no face below the eyes.
  const mouthY = eyeY + eyeH + 1;
  const cx = X0 + 9;
  const beak = species === "owl" || species === "penguin" || species === "robot";
  if (!beak && isBody(cx, mouthY) && isBody(cx, mouthY + 1)) {
    const mouth = pick(["smile", "open", "cat", "fang", "tiny"] as const);
    if (mouth === "smile") { set(cx - 1, mouthY, "e"); set(cx + 2, mouthY, "e"); set(cx, mouthY + 1, "e"); set(cx + 1, mouthY + 1, "e"); }
    if (mouth === "open") { set(cx, mouthY, "e"); set(cx + 1, mouthY, "e"); set(cx, mouthY + 1, "t"); set(cx + 1, mouthY + 1, "e"); }
    if (mouth === "cat") { for (const x of [cx - 1, cx, cx + 1, cx + 2]) set(x, mouthY, "e"); set(cx - 1, mouthY - 1, "e"); set(cx + 2, mouthY - 1, "e"); }
    if (mouth === "fang") { set(cx, mouthY, "e"); set(cx + 1, mouthY, "e"); set(cx + 1, mouthY + 1, "w"); }
    if (mouth === "tiny") { set(cx, mouthY, "e"); set(cx + 1, mouthY, "e"); }
  }

  // A tail on the right breaks the symmetry, which makes a silhouette easier to remember.
  const tail = TAILS[species];
  if (tail) {
    const ty = bottom - 1, tx = rightEdge(ty) + 1;
    tail.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== ".") set(tx + c, ty - (tail.length - 1) + r, ch === "#" ? "b" : ch); }));
  }

  // The signature item.
  const it = ITEMS[item];
  const paint = (rows: readonly string[], x: number, y: number) =>
    rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== ".") set(x + c, y + r, `i${ch}`); }));
  let eyesCovered = false;
  if (it.at === "hand") {
    const hy = top + Math.round((bottom - top) * 0.55);
    // The grip sits just outside the body; critters with a tail hold things on the other side.
    const side = tail ? -1 : 1;
    let x = (tail ? leftEdge(hy) - 1 : rightEdge(hy) + 1) - it.grip[0];
    const y = hy - it.grip[1];
    // Slide it outwards until it no longer covers the body.
    const covers = (ix: number) => it.rows.some((row, r) => [...row].some((ch, c) => ch !== "." && isBody(ix + c, y + r)));
    for (let n = 0; n < 10 && covers(x); n++) x += side;
    paint(it.rows, x, y);
  } else if (item === "headphones") {
    const lx = leftEdge(eyeY) - 1, rx = rightEdge(eyeY) + 1, band = centerTop - 1;
    for (let x = lx; x <= rx; x++) set(x, band, "ik");
    for (let y = band; y < eyeY + 3; y++) { set(lx, y, "ik"); set(rx, y, "ik"); }
    for (let y = eyeY; y < eyeY + 3; y++) { set(lx - 1, y, "ir"); set(rx + 1, y, "ir"); }
  } else if (it.at === "head") {
    const width = Math.max(...it.rows.map((r) => r.length));
    paint(it.rows, X0 + 10 - Math.ceil(width / 2), centerTop - it.rows.length);
  } else if (it.at === "eyes") {
    eyesCovered = true;
    for (let x = eyeX - 1; x <= rightEyeX + 2; x++) set(x, eyeY, "ik");
    for (const ex of [eyeX - 1, rightEyeX]) for (let x = ex; x < ex + 3; x++) set(x, eyeY + 1, "ik");
    set(eyeX, eyeY, "iw"); set(rightEyeX + 1, eyeY, "iw");
  } else {
    const ny = Math.min(bottom - 3, mouthY + 2);
    for (let y = ny; y < ny + 2; y++) for (let x = leftEdge(y); x <= rightEdge(y); x++) set(x, y, "ir");
    const end = rightEdge(ny) - 2;
    set(end, ny + 2, "ir"); set(end + 1, ny + 2, "ir"); set(end, ny + 3, "ir");
  }

  // Light from the top left: edges facing up or left catch it, edges facing down or right fall in shade.
  const lit = grid.map((row) => [...row]);
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
    if (grid[y][x] !== "b") continue;
    if (!isBody(x, y + 1) || !isBody(x + 1, y)) lit[y][x] = "d";
    else if (!isBody(x, y - 1) || !isBody(x - 1, y)) lit[y][x] = "l";
  }
  // Outline everything, items included, so the shape reads on any backdrop.
  const filled = lit.map((row) => row.map((p) => p !== ""));
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
    if (filled[y][x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => filled[y + dy]?.[x + dx])) lit[y][x] = "o";
  }

  const colors: Record<string, string> = { ...HUES[hue], m: marking, w: "#fffaf2", e: "#1a1420", s: "#ffffff", p: "#ff8fb1", t: "#ff4f6d", a: "#ffb02e", c: "#c8693a" };
  for (const [k, v] of Object.entries(ITEM_COLORS)) colors[`i${k}`] = v;
  const name = Array.from({ length: random() < 0.3 ? 3 : 2 }, () => pick(SYLLABLES)).join("");
  return {
    pixels: lit,
    colors,
    name: name[0].toUpperCase() + name.slice(1),
    species, hue, item, scene, rarity,
    number: (((hash[30] << 8) | hash[31]) % 9999) + 1,
    eyeRows: eyesCovered || eyes === "sleepy" ? null : [eyeY, eyeY + eyeH - 1],
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
  const eyes = critter.eyeRows;
  critter.pixels.forEach((row, cy) => {
    if (cy < (o.hidden ?? 0)) return;
    row.forEach((p, cx) => {
      if (!p) return;
      let key = p;
      // Shut eyes: the eye rows take the body color, except a dark line along the bottom.
      if (o.blink && eyes && cy >= eyes[0] && cy <= eyes[1] && (p === "e" || p === "s" || p === "w")) key = cy === eyes[1] ? "e" : "b";
      g.fillStyle = critter.colors[key];
      g.fillRect(x + cx * scale, y + cy * scale, scale, scale);
    });
  });
}

/** The smallest box around a critter's pixels. */
export function critterBounds(c: Critter) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  c.pixels.forEach((row, y) => row.forEach((p, x) => {
    if (!p) return;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }));
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
