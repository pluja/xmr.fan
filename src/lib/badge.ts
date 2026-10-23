/* "Monero accepted" badges, drawn on a canvas: a classic two-part badge, a pill and a pixel sticker. */
import { MONERO_LOGO } from "./qr.ts";

export const BADGE_STYLES = ["classic", "pill", "pixel"] as const;
export type BadgeStyle = (typeof BADGE_STYLES)[number];
export const BADGE_THEMES = ["light", "dark", "orange"] as const;
export type BadgeTheme = (typeof BADGE_THEMES)[number];
export const BADGE_TEXTS = ["accepted", "pay", "donate"] as const;
export type BadgeText = (typeof BADGE_TEXTS)[number];

const PIXEL_THEMES: Record<BadgeTheme, { bg: string; fg: string; edge: string; shadow: string }> = {
  orange: { bg: "#fb8c3c", fg: "#2b282d", edge: "#2b282d", shadow: "#7a3510" },
  dark: { bg: "#2b282d", fg: "#fff1e4", edge: "#fb8c3c", shadow: "#151317" },
  light: { bg: "#fffaf5", fg: "#2b282d", edge: "#2b282d", shadow: "#fb8c3c" },
};
const ORANGE = "#f26822", GRAY = "#4c4c4c";
/** Body, the big MONERO word and the line under it. */
const THEMES: Record<BadgeTheme, { body: string; big: string; sub: string; edgeTop: string; edgeBottom: string }> = {
  light: { body: "#f9f7f4", big: ORANGE, sub: GRAY, edgeTop: ORANGE, edgeBottom: GRAY },
  dark: { body: "#232126", big: ORANGE, sub: "#f3ece4", edgeTop: ORANGE, edgeBottom: "#4c4950" },
  orange: { body: ORANGE, big: "#ffffff", sub: "#2b282d", edgeTop: "#ffffff", edgeBottom: GRAY },
};
const LOGO_COLORS: Record<string, string> = { o: "#ff6600", k: "#4c4c4c", w: "#ffffff" };

export interface BadgeOptions {
  style: BadgeStyle;
  theme: BadgeTheme;
  /** The whole phrase, for the pixel style. */
  text: string;
  /** The line under MONERO, for the classic and pill styles. */
  sub: string;
  pixelFont: string;
  font: string;
}

/** The Monero logo with a one-pixel outline, so it stands out on any background. */
function drawLogo(g: CanvasRenderingContext2D, x: number, y: number, px: number, outline: string) {
  const n = MONERO_LOGO.length;
  const lit = (cx: number, cy: number) => MONERO_LOGO[cy]?.[cx] !== undefined && MONERO_LOGO[cy][cx] !== ".";
  g.fillStyle = outline;
  for (let cy = -1; cy <= n; cy++) for (let cx = -1; cx <= n; cx++) {
    if (lit(cx, cy)) continue;
    if (lit(cx + 1, cy) || lit(cx - 1, cy) || lit(cx, cy + 1) || lit(cx, cy - 1)) g.fillRect(x + cx * px, y + cy * px, px, px);
  }
  MONERO_LOGO.forEach((row, cy) => [...row].forEach((ch, cx) => {
    if (!LOGO_COLORS[ch]) return;
    g.fillStyle = LOGO_COLORS[ch];
    g.fillRect(x + cx * px, y + cy * px, px, px);
  }));
}

/* The Monero symbol on a 100-unit square: a white M line whose feet run out to the edges, orange above it, gray below. */
const M_WHITE = [[-60, 63], [17, 63], [17, 22], [50, 55], [83, 22], [83, 63], [160, 63], [160, 75], [71, 75], [71, 51], [50, 72], [29, 51], [29, 75], [-60, 75]];
const M_GRAY = [[-60, 75], [29, 75], [29, 51], [50, 72], [71, 51], [71, 75], [160, 75], [160, 200], [-60, 200]];

function paintSymbol(g: CanvasRenderingContext2D, x: number, y: number, unit: number, w: number, h: number) {
  const poly = (points: number[][], color: string) => {
    g.beginPath();
    points.forEach(([px, py], i) => (i ? g.lineTo : g.moveTo).call(g, x + px * unit, y + py * unit));
    g.closePath();
    g.fillStyle = color;
    g.fill();
  };
  g.fillStyle = ORANGE;
  g.fillRect(x - 60 * unit, y - 60 * unit, w + 120 * unit, h + 120 * unit);
  poly(M_GRAY, GRAY);
  poly(M_WHITE, "#ffffff");
}

/** The round Monero logo. */
function drawSymbol(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  paintSymbol(g, cx - r, cy - r, (r * 2) / 100, r * 2, r * 2);
  g.restore();
}

/** A border that is orange on top and gray below, like the logo. */
function splitStroke(g: CanvasRenderingContext2D, top: number, height: number, t: (typeof THEMES)[BadgeTheme], split = 0.62) {
  const grad = g.createLinearGradient(0, top, 0, top + height);
  grad.addColorStop(0, t.edgeTop); grad.addColorStop(split, t.edgeTop);
  grad.addColorStop(split, t.edgeBottom); grad.addColorStop(1, t.edgeBottom);
  return grad;
}

const MARGIN = 14;
const BIG = (size: number, font: string) => `800 ${size}px ${font}`;
const SUB = (size: number, font: string) => `italic 800 ${size}px ${font}`;

function measure(g: CanvasRenderingContext2D, font: string, text: string, spacing = "0px") {
  g.font = font;
  g.letterSpacing = spacing;
  const w = g.measureText(text).width;
  g.letterSpacing = "0px";
  return w;
}

/** Size of the classic and pill badges in CSS pixels, margin for the shadow included. */
export function badgeSize(style: Exclude<BadgeStyle, "pixel">, bigWidth: number, subWidth: number) {
  if (style === "classic") return { w: Math.ceil(176 + Math.max(bigWidth, subWidth) + 30) + MARGIN * 2, h: 120 + MARGIN * 2 };
  return { w: Math.ceil(68 + Math.max(bigWidth, subWidth) + 26) + MARGIN * 2, h: 56 + MARGIN * 2 };
}

function drawClassic(canvas: HTMLCanvasElement, o: BadgeOptions, scale: number) {
  const g = canvas.getContext("2d")!;
  const big = measure(g, BIG(46, o.font), "MONERO", "2px"), sub = measure(g, SUB(21, o.font), o.sub.toUpperCase());
  const { w, h } = badgeSize("classic", big, sub);
  canvas.width = w * scale; canvas.height = h * scale;
  g.setTransform(scale, 0, 0, scale, 0, 0);
  const t = THEMES[o.theme], x = MARGIN, y = MARGIN, bw = w - MARGIN * 2, bh = h - MARGIN * 2, panel = 132;
  g.save();
  g.shadowColor = "rgba(0, 0, 0, 0.28)"; g.shadowBlur = 12; g.shadowOffsetY = 4;
  g.beginPath(); g.roundRect(x, y, bw, bh, 26); g.fillStyle = t.body; g.fill();
  g.restore();
  // The logo panel: a big crop of the symbol behind a chevron.
  g.save();
  g.beginPath(); g.roundRect(x, y, bw, bh, 26); g.clip();
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + panel, y); g.lineTo(x + panel + 22, y + bh / 2); g.lineTo(x + panel, y + bh); g.lineTo(x, y + bh); g.closePath(); g.clip();
  paintSymbol(g, x + 4, y - 8, 1.32, panel + 22, bh);
  g.restore();
  if (o.theme === "orange") {
    // An orange body would melt into the orange panel, so the chevron gets a white edge.
    g.save();
    g.beginPath(); g.roundRect(x, y, bw, bh, 26); g.clip();
    g.beginPath(); g.moveTo(x + panel, y); g.lineTo(x + panel + 22, y + bh / 2); g.lineTo(x + panel, y + bh);
    g.lineWidth = 4; g.strokeStyle = "#ffffff"; g.stroke();
    g.restore();
  }
  g.lineWidth = 5;
  g.strokeStyle = splitStroke(g, y, bh, t);
  g.beginPath(); g.roundRect(x + 2.5, y + 2.5, bw - 5, bh - 5, 24); g.stroke();
  const tx = x + 176;
  g.textBaseline = "alphabetic"; g.textAlign = "left";
  g.font = BIG(46, o.font); g.letterSpacing = "2px"; g.fillStyle = t.big; g.fillText("MONERO", tx, y + 62);
  g.letterSpacing = "0px";
  g.font = SUB(21, o.font); g.fillStyle = t.sub; g.fillText(o.sub.toUpperCase(), tx, y + 94);
  return { w, h };
}

function drawPill(canvas: HTMLCanvasElement, o: BadgeOptions, scale: number) {
  const g = canvas.getContext("2d")!;
  const big = measure(g, BIG(21, o.font), "MONERO", "1px"), sub = measure(g, SUB(12, o.font), o.sub.toUpperCase());
  const { w, h } = badgeSize("pill", big, sub);
  canvas.width = w * scale; canvas.height = h * scale;
  g.setTransform(scale, 0, 0, scale, 0, 0);
  const t = THEMES[o.theme], x = MARGIN, y = MARGIN, bw = w - MARGIN * 2, bh = h - MARGIN * 2;
  g.save();
  g.shadowColor = "rgba(0, 0, 0, 0.25)"; g.shadowBlur = 8; g.shadowOffsetY = 3;
  g.beginPath(); g.roundRect(x, y, bw, bh, bh / 2); g.fillStyle = t.body; g.fill();
  g.restore();
  g.lineWidth = 3;
  g.strokeStyle = splitStroke(g, y, bh, t);
  g.beginPath(); g.roundRect(x + 1.5, y + 1.5, bw - 3, bh - 3, bh / 2 - 1.5); g.stroke();
  drawSymbol(g, x + 30, y + bh / 2, 20);
  g.textAlign = "left"; g.textBaseline = "alphabetic";
  g.font = BIG(21, o.font); g.letterSpacing = "1px"; g.fillStyle = t.big; g.fillText("MONERO", x + 62, y + 27);
  g.letterSpacing = "0px";
  g.font = SUB(12, o.font); g.fillStyle = t.sub; g.fillText(o.sub.toUpperCase(), x + 62, y + 43);
  return { w, h };
}

/** Pixel sticker size in CSS pixels, shadow included. */
export const pixelSize = (textWidth: number) => ({ w: Math.max(176, Math.ceil(textWidth) + 32) + 6, h: 118 });

function drawPixel(canvas: HTMLCanvasElement, o: BadgeOptions, scale: number) {
  const g = canvas.getContext("2d")!;
  const font = `15px ${o.pixelFont}`;
  g.font = font;
  const { w, h } = pixelSize(g.measureText(o.text).width);
  canvas.width = w * scale; canvas.height = h * scale;
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.imageSmoothingEnabled = false;
  const c = PIXEL_THEMES[o.theme], bw = w - 6, bh = h - 6;
  g.fillStyle = c.shadow; g.fillRect(6, 6, bw, bh);
  g.fillStyle = c.edge; g.fillRect(0, 0, bw, bh);
  g.fillStyle = c.bg; g.fillRect(3, 3, bw - 6, bh - 6);
  drawLogo(g, Math.round(bw / 2 - 26), 16, 4, c.fg);
  g.font = font; g.fillStyle = c.fg; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(o.text, bw / 2, 89);
  return { w, h };
}

/** Draws the badge at `scale` times its size; returns the size in CSS pixels. */
export function drawBadge(canvas: HTMLCanvasElement, o: BadgeOptions, scale: number) {
  return o.style === "classic" ? drawClassic(canvas, o, scale) : o.style === "pill" ? drawPill(canvas, o, scale) : drawPixel(canvas, o, scale);
}
