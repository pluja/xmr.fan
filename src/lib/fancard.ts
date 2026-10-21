/* The fan card: everything on it is derived from the name, so the same name always gets the same card. */
import { keccak_256 } from "@noble/hashes/sha3.js";

export const RARITIES = ["common", "uncommon", "rare", "legendary", "mythic"] as const;
export const CLASSES = ["node", "miner", "cypherpunk", "maxi", "dev", "shop", "hodler", "memer", "swapper", "ringsigner", "bard"] as const;
export const MOVES = ["ring", "tail", "stealth", "dandelion", "fcmp", "bulletproofs", "viewkey", "churn", "seed", "nokyc"] as const;
export const STATS = ["privacy", "fungibility", "patience", "uptime", "memes"] as const;

export type Rarity = (typeof RARITIES)[number];

export const RARITY_COLORS: Record<Rarity, string> = {
  common: "#a39ca8", uncommon: "#a8e6c1", rare: "#7fb3e8", legendary: "#f2c94c", mythic: "#c58af9",
};

/* Avatar palette indices: 0 background, 1 outline, 2 skin, 3 hood, 4 emblem, 5 accent, 6 accessory, 7 gold, 8 white. */
const BASE = [
  "................",
  "....11111111....",
  "...1333333331...",
  "..133333333331..",
  "..133222222331..",
  "..132222222231..",
  "..132222222231..",
  "..132222222231..",
  "..132222222231..",
  "..133222222331..",
  "..133322223331..",
  ".13333333333331.",
  "1333334333433331",
  "1333334434433331",
  "1333334343433331",
  "1333333333333331",
];

type Pixels = [x: number, y: number, color: number][];
const row = (y: number, from: number, to: number, color: number): Pixels => Array.from({ length: to - from + 1 }, (_, i) => [from + i, y, color]);

const EYES: { pixels: Pixels; minRarity: number }[] = [
  { pixels: [[5, 6, 1], [5, 7, 1], [10, 6, 1], [10, 7, 1]], minRarity: 0 },
  { pixels: [[5, 6, 1], [6, 6, 1], [9, 6, 1], [10, 6, 1]], minRarity: 0 },
  { pixels: [[5, 7, 1], [6, 6, 1], [7, 7, 1], [8, 7, 1], [9, 6, 1], [10, 7, 1]], minRarity: 0 },
  { pixels: [...row(6, 4, 11, 1), [5, 7, 1], [6, 7, 1], [9, 7, 1], [10, 7, 1]], minRarity: 1 },
  { pixels: [...row(6, 4, 11, 5), ...row(7, 4, 11, 5)], minRarity: 1 },
  { pixels: [[5, 6, 5], [10, 6, 5], ...row(6, 0, 3, 5), ...row(6, 12, 15, 5)], minRarity: 2 },
];
const MOUTHS: Pixels[] = [
  [[5, 8, 1], [6, 9, 1], [7, 9, 1], [8, 9, 1], [9, 9, 1], [10, 8, 1]],
  row(9, 6, 9, 1),
  [[7, 9, 1], [8, 9, 1]],
  row(9, 6, 9, 8),
  [[5, 8, 1], [6, 8, 1], [9, 8, 1], [10, 8, 1], [7, 9, 1], [8, 9, 1]],
];
const ACCESSORIES: { pixels: Pixels; minRarity: number }[] = [
  { pixels: [], minRarity: 0 },
  { pixels: [...row(1, 4, 11, 6), [3, 6, 6], [3, 7, 6], [12, 6, 6], [12, 7, 6]], minRarity: 0 },
  { pixels: [...row(0, 5, 10, 5), ...row(1, 4, 11, 5), ...row(2, 3, 12, 5)], minRarity: 0 },
  { pixels: [...row(0, 6, 9, 6), ...row(1, 5, 10, 6)], minRarity: 1 },
  { pixels: [[9, 0, 5], [9, 1, 6]], minRarity: 1 },
  { pixels: [[4, 0, 7], [7, 0, 7], [8, 0, 7], [11, 0, 7], ...row(1, 4, 11, 7)], minRarity: 3 },
  { pixels: [...row(0, 5, 10, 7)], minRarity: 4 },
];
const SKINS = ["#ffd2ad", "#e8b48f", "#c68a5e", "#8d5a3b", "#5c3a24"];
const ALIEN = "#7ed957";
const HOODS: [hood: string, emblem: string][] = [["#fb8c3c", "#fffaf5"], ["#ff6600", "#fffaf5"], ["#45404a", "#fb8c3c"], ["#5a5460", "#ff6600"]];

export interface FanCard {
  name: string;
  number: string;
  rarity: Rarity;
  className: (typeof CLASSES)[number];
  move: (typeof MOVES)[number];
  stats: Record<(typeof STATS)[number], number>;
  /** 16 rows of 16 palette indices. */
  avatar: number[][];
  palette: string[];
}

/** mulberry32: small, fast and good enough to roll dice from a hash. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ").slice(0, 24);

export function fanCard(rawName: string): FanCard {
  const name = normalizeName(rawName) || "anon";
  const hash = keccak_256(new TextEncoder().encode(`xmr.fan/fan:${name.toLowerCase()}`));
  const view = new DataView(hash.buffer);
  const rnd = random(view.getUint32(0));
  const pick = <T>(list: readonly T[]) => list[Math.floor(rnd() * list.length)];

  const roll = rnd();
  const tier = roll < 0.6 ? 0 : roll < 0.85 ? 1 : roll < 0.95 ? 2 : roll < 0.99 ? 3 : 4;
  const rarity = RARITIES[tier];
  const floor = [15, 30, 45, 60, 75][tier];
  const stats = Object.fromEntries(STATS.map((s) => [s, floor + Math.floor(rnd() * (100 - floor))])) as FanCard["stats"];

  const [hood, emblem] = pick(HOODS);
  const skin = tier === 4 && rnd() < 0.5 ? ALIEN : pick(SKINS);
  const palette = [RARITY_COLORS[rarity], "#2b282d", skin, hood, emblem, "#ff3b30", "#a39ca8", "#f2c94c", "#fffaf5"];
  const avatar = BASE.map((line) => [...line].map((c) => (c === "." ? 0 : Number(c))));
  const draw = (pixels: Pixels) => pixels.forEach(([x, y, c]) => (avatar[y][x] = c));
  const allowed = <T extends { minRarity: number }>(list: T[]) => list.filter((v) => v.minRarity <= tier);
  draw(pick(MOUTHS));
  draw(pick(allowed(EYES)).pixels);
  draw(pick(allowed(ACCESSORIES)).pixels);

  return {
    name,
    number: `#${String(view.getUint32(28) % 10000).padStart(4, "0")}`,
    rarity,
    className: pick(CLASSES),
    move: pick(MOVES),
    stats,
    avatar,
    palette,
  };
}

/** The avatar as crisp SVG rectangles. */
export function avatarSvg(card: Pick<FanCard, "avatar" | "palette">, label: string): string {
  const rects = card.avatar.flatMap((line, y) => line.map((c, x) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${card.palette[c]}"/>`));
  const esc = label.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges" role="img" aria-label="${esc}">${rects.join("")}</svg>`;
}
