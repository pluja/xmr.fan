/* The collectible card a critter is shown on: name, rarity, art window, number and the address it hatched from. */
import { drawCritter, SIZE, type Critter, type Rarity } from "./critter.ts";

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
  /** "Rare", "Legendary"… in the page's language. */
  rarityLabel: string;
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

  // Art window: a backdrop that fades down, a soft spotlight and a ground shadow.
  const wx = 18, wy = 42, ww = CARD_W - 36, wh = 178;
  g.fillStyle = frame.dark; g.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
  const sky = g.createLinearGradient(0, wy, 0, wy + wh);
  sky.addColorStop(0, c.backdrop[0]); sky.addColorStop(1, c.backdrop[1]);
  g.fillStyle = sky; g.fillRect(wx, wy, ww, wh);
  g.save();
  g.beginPath(); g.rect(wx, wy, ww, wh); g.clip();
  const glow = g.createRadialGradient(CARD_W / 2, wy + 86, 8, CARD_W / 2, wy + 86, 110);
  glow.addColorStop(0, `${c.colors.l}55`); glow.addColorStop(1, `${c.colors.l}00`);
  g.fillStyle = glow; g.fillRect(wx, wy, ww, wh);
  // Twinkling stars, more of them on rarer cards.
  const stars = { common: 10, rare: 18, epic: 26, legendary: 36 }[c.rarity];
  for (let i = 0; i < stars; i++) {
    const sx = wx + (sparkleAt(i, 1) % ww), sy = wy + (sparkleAt(i, 2) % (wh - 40));
    const on = (Math.floor(t * 2 + i * 0.7) % 4) !== 0;
    g.fillStyle = on ? "#fff8ee" : "#fff8ee55";
    g.fillRect(sx, sy, 2, 2);
    if (c.rarity !== "common" && i % 5 === 0 && on) { g.fillRect(sx - 2, sy, 6, 2); g.fillRect(sx, sy - 2, 2, 6); }
  }
  g.fillStyle = "#00000055";
  g.beginPath(); g.ellipse(CARD_W / 2, wy + wh - 18, 58, 8, 0, 0, Math.PI * 2); g.fill();
  const scale = 7, size = SIZE * scale;
  const bob = Math.sin(t * 2.4) > 0.3 ? -scale / 2 : 0;
  drawCritter(g, c, Math.round((CARD_W - size) / 2), wy + wh - size - 10 + bob, scale, { blink: o.blink, hidden: o.hidden });
  g.restore();

  // Rarity and number.
  g.font = `13px ${o.font}`;
  g.fillStyle = frame.base;
  g.fillText(o.rarityLabel.toUpperCase(), 18, 238);
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
