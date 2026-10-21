/* Draws the social share image and app icons from the site's own pixel art.
     node --experimental-strip-types scripts/brand-images.ts */
import { writeFileSync } from "node:fs";
import { encodeIndexedPng } from "../src/lib/png.ts";
import { iconBitmap, layoutText, type IconName } from "../src/lib/pixel.ts";

const PALETTE = ["#fb8c3c", "#2b282d"];
const ORANGE = 0, INK = 1;

class Canvas {
  w: number; h: number; pixels: Uint8Array;
  constructor(w: number, h: number, fill: number) { this.w = w; this.h = h; this.pixels = new Uint8Array(w * h).fill(fill); }
  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let j = Math.max(0, y); j < Math.min(this.h, y + h); j++) this.pixels.fill(c, j * this.w + Math.max(0, x), j * this.w + Math.min(this.w, x + w));
  }
  bitmap(rows: readonly string[], x: number, y: number, scale: number, c: number) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => ch === "#" && this.rect(x + i * scale, y + j * scale, scale, scale, c)));
  }
  png() {
    const raw = new Uint8Array((this.w + 1) * this.h);
    for (let y = 0; y < this.h; y++) raw.set(this.pixels.subarray(y * this.w, (y + 1) * this.w), y * (this.w + 1) + 1);
    return encodeIndexedPng(this.w, this.h, PALETTE, raw);
  }
}

async function socialImage() {
  const c = new Canvas(1200, 630, ORANGE);
  const word = layoutText("xmr.fan");
  const scale = 18;
  for (const r of word.rects) c.rect(96 + r.x * scale, 130 + r.y * scale, scale, scale, INK);
  // Dither from orange into the ink band, as on the site.
  const cell = 8, top = 392;
  [0.25, 0.5, 0.75].forEach((density, band) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 1200 / cell; x++) {
      const on = density === 0.5 ? (x + y) % 2 === 0 : density === 0.25 ? x % 2 === 0 && y === 0 : !(x % 2 === 1 && y === 1);
      if (on) c.rect(x * cell, top + band * 2 * cell + y * cell, cell, cell, INK);
    }
  });
  c.rect(0, top + 48, 1200, 630 - top - 48, INK);
  const icons: IconName[] = ["qr", "check", "hourglass", "lens", "swap", "tag", "calendar", "shield", "server", "pickaxe", "paper"];
  const size = 8 * 7, gap = (1200 - 2 * 72 - icons.length * size) / (icons.length - 1);
  icons.forEach((name, i) => c.bitmap(iconBitmap(name), Math.round(72 + i * (size + gap)), 508, 7, ORANGE));
  return c.png();
}

/** The favicon's 9x9 "x", scaled up, with an ink margin of `pad` pixels. */
async function appIcon(size: number) {
  const rows = [".........", ".........", "..#...#..", "...#.#...", "....#....", "...#.#...", "..#...#..", ".........", "........."];
  const scale = Math.floor(size / 9), pad = Math.floor((size - scale * 9) / 2);
  const c = new Canvas(size, size, INK);
  c.bitmap(rows, pad, pad, scale, ORANGE);
  return c.png();
}

/** Podcast apps ask for a 1400–3000 px square cover. */
async function podcastCover() {
  const size = 1400;
  const c = new Canvas(size, size, INK);
  c.bitmap(iconBitmap("sound"), (size - 8 * 48) / 2, 260, 48, ORANGE);
  const word = layoutText("the xmr.fan times");
  const scale = Math.floor((size - 160) / word.width);
  const x0 = Math.round((size - word.width * scale) / 2);
  for (const r of word.rects) c.rect(x0 + r.x * scale, 860 + r.y * scale, scale, scale, ORANGE);
  return c.png();
}

writeFileSync("public/og.png", await socialImage());
writeFileSync("public/podcast-cover.png", await podcastCover());
for (const [file, size] of [["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]] as const) writeFileSync(`public/${file}`, await appIcon(size));
console.log("public/og.png, podcast-cover.png, apple-touch-icon.png, icon-192.png, icon-512.png");
