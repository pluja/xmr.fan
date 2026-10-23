/* "Monero accepted" badges, drawn on a canvas in the site's pixel style. */
import { MONERO_LOGO } from "./qr.ts";

export const BADGE_STYLES = ["sticker", "button", "compact"] as const;
export type BadgeStyle = (typeof BADGE_STYLES)[number];
export const BADGE_THEMES = ["orange", "dark", "light"] as const;
export type BadgeTheme = (typeof BADGE_THEMES)[number];
export const BADGE_TEXTS = ["accepted", "pay", "donate"] as const;
export type BadgeText = (typeof BADGE_TEXTS)[number];

const THEMES: Record<BadgeTheme, { bg: string; fg: string; edge: string; shadow: string }> = {
  orange: { bg: "#fb8c3c", fg: "#2b282d", edge: "#2b282d", shadow: "#7a3510" },
  dark: { bg: "#2b282d", fg: "#fff1e4", edge: "#fb8c3c", shadow: "#151317" },
  light: { bg: "#fffaf5", fg: "#2b282d", edge: "#2b282d", shadow: "#fb8c3c" },
};
const LOGO_COLORS: Record<string, string> = { o: "#ff6600", k: "#4c4c4c", w: "#ffffff" };
const SHADOW = { sticker: 6, button: 4, compact: 0 } as const;

export interface BadgeOptions { style: BadgeStyle; theme: BadgeTheme; text: string; font: string }

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

/** Badge size in CSS pixels for a given text width, shadow included. */
export function badgeSize(style: BadgeStyle, textWidth: number) {
  const s = SHADOW[style];
  if (style === "sticker") return { w: Math.max(176, Math.ceil(textWidth) + 32) + s, h: 112 + s };
  if (style === "button") return { w: Math.ceil(textWidth) + 64 + s, h: 44 + s };
  return { w: Math.ceil(textWidth) + 46, h: 32 };
}

const FONT_SIZE = { sticker: 15, button: 15, compact: 13 } as const;

/** Draws the badge at `scale` times its size; returns the size in CSS pixels. */
export function drawBadge(canvas: HTMLCanvasElement, o: BadgeOptions, scale: number) {
  const g = canvas.getContext("2d")!;
  const font = `${FONT_SIZE[o.style]}px ${o.font}`;
  g.font = font;
  const { w, h } = badgeSize(o.style, g.measureText(o.text).width);
  canvas.width = w * scale;
  canvas.height = h * scale;
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.imageSmoothingEnabled = false;
  const c = THEMES[o.theme], s = SHADOW[o.style];
  const bw = w - s, bh = h - s;
  if (s) { g.fillStyle = c.shadow; g.fillRect(s, s, bw, bh); }
  g.fillStyle = c.edge; g.fillRect(0, 0, bw, bh);
  const edge = o.style === "compact" ? 2 : 3;
  g.fillStyle = c.bg; g.fillRect(edge, edge, bw - edge * 2, bh - edge * 2);
  g.font = font;
  g.textBaseline = "middle";
  if (o.style === "sticker") {
    drawLogo(g, Math.round(bw / 2 - 26), 16, 4, c.fg);
    g.fillStyle = c.fg;
    g.textAlign = "center";
    g.fillText(o.text, bw / 2, 89);
  } else if (o.style === "button") {
    drawLogo(g, 14, Math.round(bh / 2 - 13), 2, c.fg);
    g.fillStyle = c.fg;
    g.textAlign = "left";
    g.fillText(o.text, 50, bh / 2 + 1);
  } else {
    drawLogo(g, 6, 3, 2, c.fg);
    g.fillStyle = c.fg;
    g.textAlign = "left";
    g.fillText(o.text, 38, bh / 2 + 1);
  }
  return { w, h };
}
