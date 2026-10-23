/* The collectible card a critter is shown on: name and rarity gems, its home, species, number and the address it hatched from. */
import type { Scene } from "./critter-parts.ts";
import { critterBounds, drawCritter, type Critter, type Rarity } from "./critter.ts";

export const CARD_W = 240, CARD_H = 336;

const FRAMES: Record<Rarity, { base: string; light: string; dark: string }> = {
  common: { base: "#8c8494", light: "#c9c2cf", dark: "#4a4450" },
  rare: { base: "#4f8dff", light: "#a9c8ff", dark: "#1f3f8a" },
  epic: { base: "#b46bff", light: "#dcbcff", dark: "#5a2a9a" },
  legendary: { base: "#ffc83d", light: "#fff0b3", dark: "#9a6a05" },
};
const GEMS: Record<Rarity, number> = { common: 1, rare: 2, epic: 3, legendary: 4 };

export interface CardOptions {
  address: string;
  /** Species and home, like "Frog · Ocean", in the page's language. */
  kindLabel: string;
  /** "Hatched from" in the page's language. */
  fromLabel: string;
  font: string;
  /** Seconds since the card appeared, for the idle bob and the foil shine. */
  time?: number;
  blink?: boolean;
  /** Critter rows still hidden while it hatches. */
  hidden?: number;
}

/** Same dither for everything: a sparse checker, for the backdrop and the shine. */
const sparkleAt = (n: number, seed: number) => ((n * 2654435761 + seed * 40503) >>> 0) % 997;

export function drawCard(g: CanvasRenderingContext2D, c: Critter, o: CardOptions) {
  const t = o.time ?? 0;
  const frame = FRAMES[c.rarity];
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, CARD_W, CARD_H);

  // Bevelled frame.
  g.fillStyle = frame.dark; g.fillRect(0, 0, CARD_W, CARD_H);
  g.fillStyle = frame.light; g.fillRect(0, 0, CARD_W - 3, CARD_H - 3);
  g.fillStyle = frame.base; g.fillRect(3, 3, CARD_W - 6, CARD_H - 6);
  g.fillStyle = "#1c1a1f"; g.fillRect(9, 9, CARD_W - 18, CARD_H - 18);

  // Name and rarity gems.
  g.font = `17px ${o.font}`;
  g.textBaseline = "middle"; g.textAlign = "left";
  g.fillStyle = "#fff1e4";
  g.fillText(c.name, 18, 26, 150);
  for (let i = 0; i < 4; i++) {
    const x = CARD_W - 24 - i * 12, on = i < GEMS[c.rarity];
    g.fillStyle = on ? frame.base : "#3a363f";
    g.fillRect(x + 2, 21, 4, 10); g.fillRect(x, 23, 8, 6);
    if (on) { g.fillStyle = frame.light; g.fillRect(x + 2, 23, 2, 2); }
  }

  // Art window: the critter's home, a soft spotlight and a ground shadow.
  const wx = 18, wy = 42, ww = CARD_W - 36, wh = 178;
  g.fillStyle = frame.dark; g.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
  g.save();
  g.beginPath(); g.rect(wx, wy, ww, wh); g.clip();
  drawScene(g, c.scene, wx, wy, ww, wh, t);
  const glow = g.createRadialGradient(CARD_W / 2, wy + 96, 8, CARD_W / 2, wy + 96, 100);
  glow.addColorStop(0, "#ffffff2a"); glow.addColorStop(1, "#ffffff00");
  g.fillStyle = glow; g.fillRect(wx, wy, ww, wh);
  g.fillStyle = "#00000055";
  g.beginPath(); g.ellipse(CARD_W / 2, wy + wh - 10, 64, 6, 0, 0, Math.PI * 2); g.fill();
  // As big as fits: the critter's bounding box, scaled by a whole number and standing on the ground.
  const box = critterBounds(c);
  const scale = Math.max(3, Math.min(7, Math.floor((ww - 20) / box.w), Math.floor((wh - 28) / box.h)));
  const bob = Math.sin(t * 2.4) > 0.3 ? -Math.ceil(scale / 2) : 0;
  const cx = Math.round(CARD_W / 2 - (box.x + box.w / 2) * scale), cy = wy + wh - 8 - (box.y + box.h) * scale;
  drawCritter(g, c, cx, cy + bob, scale, { blink: o.blink, hidden: o.hidden });
  if (c.rarity !== "common") {
    const stars = { rare: 4, epic: 7, legendary: 12 }[c.rarity];
    for (let i = 0; i < stars; i++) {
      if ((Math.floor(t * 2 + i * 0.7) % 3) === 0) continue;
      const sx = wx + 8 + (sparkleAt(i, 5) % (ww - 16)), sy = wy + 8 + (sparkleAt(i, 6) % (wh - 60));
      g.fillStyle = "#fff8ee"; g.fillRect(sx - 2, sy, 6, 2); g.fillRect(sx, sy - 2, 2, 6);
    }
  }
  g.restore();

  // Rarity and number.
  g.font = `13px ${o.font}`;
  g.fillStyle = "#fff1e4";
  g.fillText(o.kindLabel, 18, 238, 160);
  g.textAlign = "right"; g.fillStyle = "#a59dab";
  g.fillText(`#${String(c.number).padStart(4, "0")}`, CARD_W - 18, 238);
  g.fillStyle = "#3a363f"; g.fillRect(18, 250, CARD_W - 36, 2);

  // The address it hatched from, in chunks.
  g.textAlign = "left"; g.fillStyle = "#8c8494";
  g.font = `11px ${o.font}`;
  g.fillText(o.fromLabel, 18, 266);
  g.font = `500 12px "JetBrains Mono Variable", ui-monospace, monospace`;
  const a = o.address;
  const lines = [a.slice(0, 24), `${a.slice(24, 36)}…${a.slice(-11)}`];
  lines.forEach((line, i) => {
    g.fillStyle = "#e9e1d9";
    g.fillText(line, 18, 284 + i * 16);
  });
  g.font = `11px ${o.font}`;
  g.textAlign = "right"; g.fillStyle = "#6f6874";
  g.fillText("xmr.fan/art", CARD_W - 18, CARD_H - 22);

  // Foil: a band of light sweeping across rare cards.
  if (c.rarity !== "common") {
    const sweep = ((t * 0.35) % 1.6) - 0.3;
    const x0 = sweep * (CARD_W + CARD_H);
    const shine = g.createLinearGradient(x0 - 60, 0, x0 + 60, CARD_H * 0.6);
    shine.addColorStop(0, "#ffffff00"); shine.addColorStop(0.5, c.rarity === "legendary" ? "#fff3c455" : "#ffffff30"); shine.addColorStop(1, "#ffffff00");
    g.fillStyle = shine;
    g.fillRect(0, 0, CARD_W, CARD_H);
  }
}

/** Fills the art window with one of eight homes, in chunky 4-pixel blocks. */
function drawScene(g: CanvasRenderingContext2D, scene: Scene, x: number, y: number, w: number, h: number, t: number) {
  const block = (bx: number, by: number, bw: number, bh: number, color: string) => { g.fillStyle = color; g.fillRect(x + bx, y + by, bw, bh); };
  const sky = (top: string, bottom: string) => {
    const grad = g.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, top); grad.addColorStop(1, bottom);
    g.fillStyle = grad; g.fillRect(x, y, w, h);
  };
  const twinkle = (count: number, color: string, maxY: number, seed: number) => {
    for (let i = 0; i < count; i++) {
      const on = (Math.floor(t * 1.5 + i * 0.9) % 4) !== 0;
      block(sparkleAt(i, seed) % w, sparkleAt(i, seed + 1) % maxY, 2, 2, on ? color : `${color}55`);
    }
  };
  const ground = h - 20;
  if (scene === "ocean") {
    sky("#6ec6ff", "#1f5fa8");
    for (let i = 0; i < 4; i++) block(0, ground - 8 + i * 8, w, 4, i % 2 ? "#2f7ad1" : "#4b9be6");
    block(0, ground + 8, w, 20, "#e8d29a");
    for (let i = 0; i < 6; i++) { const by = (sparkleAt(i, 3) % 120) - ((t * 12 + i * 20) % 140) + 140; block(sparkleAt(i, 4) % w, by, 4, 4, "#bfe6ff88"); }
  } else if (scene === "forest") {
    sky("#2f5f3a", "#16301c");
    for (let i = 0; i < 7; i++) {
      const tx = (i * 37 + 6) % w, th = 50 + (sparkleAt(i, 7) % 40);
      for (let r = 0; r < th; r += 8) block(tx + r / 4, ground - th + r, Math.max(4, (th - r) / 1.8 - r / 4), 8, i % 2 ? "#24492c" : "#1d3d24");
    }
    block(0, ground, w, 20, "#2c5a2f");
    twinkle(8, "#e8ff8a", ground - 20, 11);
  } else if (scene === "desert") {
    sky("#ffb067", "#ff7a3d");
    g.fillStyle = "#ffe08a"; g.beginPath(); g.arc(x + w - 42, y + 38, 20, 0, Math.PI * 2); g.fill();
    block(0, ground - 12, w * 0.6, 12, "#e8a35a");
    block(w * 0.45, ground - 6, w * 0.55, 6, "#d99048");
    block(0, ground, w, 20, "#f2c178");
  } else if (scene === "snow") {
    sky("#bfe0f5", "#7fb2d9");
    block(0, ground - 8, w, 28, "#f4fbff");
    block(0, ground - 8, w, 2, "#ffffff");
    for (let i = 0; i < 18; i++) { const fy = (sparkleAt(i, 9) + t * 18) % (ground - 8); block(sparkleAt(i, 10) % w, fy, 2, 2, "#ffffff"); }
  } else if (scene === "space") {
    sky("#1b1036", "#0b0717");
    twinkle(28, "#ffffff", h, 12);
    g.fillStyle = "#c7643a"; g.beginPath(); g.arc(x + 40, y + 42, 16, 0, Math.PI * 2); g.fill();
    block(16, 40, 48, 3, "#f0b37e");
    block(0, ground, w, 20, "#3a2a5c");
  } else if (scene === "city") {
    sky("#1d2a5c", "#0f1430");
    twinkle(10, "#ffffff", 60, 13);
    for (let i = 0; i < 8; i++) {
      const bw = 18 + (sparkleAt(i, 14) % 14), bh = 40 + (sparkleAt(i, 15) % 60), bx = i * 26 - 4;
      block(bx, ground - bh, bw, bh, i % 2 ? "#18204a" : "#141a3c");
      for (let wy2 = ground - bh + 6; wy2 < ground - 6; wy2 += 10) for (let wx2 = bx + 4; wx2 < bx + bw - 4; wx2 += 8)
        if (sparkleAt(wx2 * 7 + wy2, 16) % 3 === 0) block(wx2, wy2, 4, 4, "#ffd96a");
    }
    block(0, ground, w, 20, "#232a4a");
  } else if (scene === "lava") {
    sky("#3a0d0d", "#1a0606");
    block(0, ground - 4, w, 24, "#ff5a1f");
    for (let i = 0; i < 10; i++) block((i * 23 + Math.floor(t * 8)) % w, ground - 4 + (i % 3) * 6, 8, 4, "#ffc23d");
    for (let i = 0; i < 10; i++) { const ey = ground - ((t * 20 + sparkleAt(i, 17)) % ground); block(sparkleAt(i, 18) % w, ey, 2, 2, "#ff9b3d"); }
  } else {
    sky("#9fdcff", "#d9f3ff");
    for (const [cx, cy] of [[30, 26], [130, 44]]) { block(cx, cy, 32, 8, "#ffffff"); block(cx + 8, cy - 6, 16, 6, "#ffffff"); }
    block(0, ground - 4, w, 24, "#5cc15a");
    block(0, ground - 4, w, 2, "#86dd7a");
    for (let i = 0; i < 12; i++) block(sparkleAt(i, 19) % w, ground + (sparkleAt(i, 20) % 14), 2, 2, i % 2 ? "#ff8fc8" : "#ffd23f");
  }
}
