/* "We accept Monero" badges in pixel art: a dark tab with the pixel Monero logo and a panel with
   bitmap lettering. Built pixel by pixel, so they export as crisp SVG that needs no font. */
import { glyph, GLYPH_W, textWidth } from "./pixel-font.ts";

export const BADGE_SIZES = ["normal", "medium", "compact"] as const;
export type BadgeSize = (typeof BADGE_SIZES)[number];
export const BADGE_THEMES = ["light", "dark", "orange"] as const;
export type BadgeTheme = (typeof BADGE_THEMES)[number];
export const BADGE_TEXTS = ["accepted", "pay", "donate"] as const;
export type BadgeText = (typeof BADGE_TEXTS)[number];
export const BADGE_LANGS = ["en", "es", "fr", "pt", "ru"] as const;
export type BadgeLang = (typeof BADGE_LANGS)[number];

/** Normal badges show a small label over MONERO; medium ones a single line. */
export const BADGE_WORDS: Record<BadgeLang, Record<BadgeText, { label: string; line: string }>> = {
  en: { accepted: { label: "WE ACCEPT", line: "MONERO ACCEPTED" }, pay: { label: "PAY WITH", line: "PAY WITH MONERO" }, donate: { label: "DONATE WITH", line: "DONATE MONERO" } },
  es: { accepted: { label: "ACEPTAMOS", line: "SE ACEPTA MONERO" }, pay: { label: "PAGA CON", line: "PAGA CON MONERO" }, donate: { label: "DONA CON", line: "DONA CON MONERO" } },
  fr: { accepted: { label: "NOUS ACCEPTONS", line: "MONERO ACCEPTÉ" }, pay: { label: "PAYEZ EN", line: "PAYEZ EN MONERO" }, donate: { label: "DONS EN", line: "DONS EN MONERO" } },
  pt: { accepted: { label: "ACEITAMOS", line: "MONERO ACEITO" }, pay: { label: "PAGUE COM", line: "PAGUE COM MONERO" }, donate: { label: "DOE COM", line: "DOE COM MONERO" } },
  ru: { accepted: { label: "ПРИНИМАЕМ", line: "ПРИНИМАЕМ MONERO" }, pay: { label: "ОПЛАТА В", line: "ОПЛАТА В MONERO" }, donate: { label: "ДОНАТЫ В", line: "ДОНАТЫ В MONERO" } },
};

const LOGO = [
  "....oooo....",
  "..oooooooo..",
  ".oooooooooo.",
  "oowwoooowwoo",
  "oowwwoowwwoo",
  "oowwkwwkwwoo",
  "oowwkkkkwwoo",
  "oowwkkkkwwoo",
  "wwwwkkkkwwww",
  ".kkkkkkkkkk.",
  "..kkkkkkkk..",
  "....kkkk....",
];
const LOGO_COLORS: Record<string, string> = { o: "#ff8e3c", k: "#77717e", w: "#ffffff" };
const CHECK = ["........", ".......#", "#.....##", "##...##.", ".##.##..", "..###...", "...#...."];
const HEART = [".......", ".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."];

interface Theme {
  /** The logo tab and the frame around the panel. */
  tab: string;
  panel: string;
  /** Lit top edge and shaded bottom edge of the panel. */
  light: string;
  shade: string;
  label: string;
  text: string;
  accent: string;
  /** Whether the panel sits inside a frame, or runs to the edges. */
  framed: boolean;
}

const THEMES: Record<BadgeTheme, Theme> = {
  light: { tab: "#2e2c32", panel: "#fffaf3", light: "#ffffff", shade: "#ebe1d4", label: "#8a8492", text: "#2e2c32", accent: "#e8711f", framed: true },
  dark: { tab: "#1f1d22", panel: "#36333b", light: "#45414b", shade: "#2b2930", label: "#a9a4ae", text: "#f4f0ea", accent: "#ff8e3c", framed: false },
  orange: { tab: "#2e2c32", panel: "#ff8e3c", light: "#ffb070", shade: "#e8711f", label: "#5a3418", text: "#2e2c32", accent: "#fffaf3", framed: true },
};

export interface BadgeOptions { size: BadgeSize; theme: BadgeTheme; text: BadgeText; lang: BadgeLang }

/** A grid of colored pixels; null is transparent. */
export class Pixels {
  readonly w: number;
  readonly h: number;
  readonly data: (string | null)[];
  constructor(w: number, h: number) { this.w = w; this.h = h; this.data = Array(w * h).fill(null); }
  set(x: number, y: number, color: string | null) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = color; }
  get(x: number, y: number) { return this.data[y * this.w + x]; }
  fill(x: number, y: number, w: number, h: number, color: string | null) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, color); }
  bitmap(rows: string[], x: number, y: number, scale: number, color: (ch: string) => string | null) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") this.fill(x + i * scale, y + j * scale, scale, scale, color(ch)); }));
  }
  /** Letters with their cap tops at `y`; accents rise two font pixels above. */
  text(text: string, x: number, y: number, scale: number, gap: number, color: (index: number) => string) {
    [...text].forEach((ch, i) => {
      const rows = glyph(ch);
      if (rows) this.bitmap(rows, x + i * (GLYPH_W + gap) * scale, y - 2 * scale, scale, () => color(i));
    });
  }
}

/** Whether character `i` of a line belongs to `word`, for coloring it. */
function within(line: string, word: string) {
  const at = line.indexOf(word);
  return (i: number) => at >= 0 && i >= at && i < at + word.length;
}

export function drawBadge(o: BadgeOptions): Pixels {
  const t = THEMES[o.theme];
  const words = BADGE_WORDS[o.lang][o.text];
  const mark = o.text === "donate" ? HEART : CHECK;
  // Each size: height (also the logo tab's width), the panel's content width and its side padding.
  let h: number, content: number, pad: number;
  if (o.size === "normal") { h = 56; content = Math.max(textWidth(words.label, 1, 2), textWidth("MONERO", 2, 1)); pad = 30; }
  else if (o.size === "medium") { h = 40; content = textWidth(words.line, 1, 2); pad = 18; }
  else { h = 28; content = textWidth("XMR", 2, 1) + 6 + mark[0].length * 2; pad = 9; }
  const tab = h, inset = t.framed ? 2 : 0;
  const panelW = content + pad * 2;
  const w = tab + panelW + inset;
  const p = new Pixels(w, h);

  p.fill(0, 0, w, h, t.tab);
  const px = tab, py = inset, ph = h - inset * 2;
  p.fill(px, py, panelW, ph, t.panel);
  p.fill(px, py, panelW, 1, t.light);
  p.fill(px, py + ph - 1, panelW, 1, t.shade);

  const logoScale = o.size === "normal" ? 3 : 2;
  const logo = 12 * logoScale;
  p.bitmap(LOGO, Math.floor((tab - logo) / 2), Math.floor((h - logo) / 2), logoScale, (ch) => LOGO_COLORS[ch]);

  const left = (width: number) => px + Math.floor((panelW - width) / 2);
  if (o.size === "normal") {
    // The label (7 px), a 7 px gap and MONERO (14 px), as one block centered in the panel.
    const top = py + Math.floor((ph - 28) / 2);
    p.text(words.label, left(textWidth(words.label, 1, 2)), top, 1, 2, () => t.label);
    p.text("MONERO", left(textWidth("MONERO", 2, 1)), top + 14, 2, 1, () => t.text);
  } else if (o.size === "medium") {
    const lit = within(words.line, "MONERO");
    p.text(words.line, left(content), py + Math.floor((ph - 7) / 2), 1, 2, (i) => (lit(i) ? t.accent : t.text));
  } else {
    const top = py + Math.floor((ph - 14) / 2);
    const x = left(content);
    p.text("XMR", x, top, 2, 1, () => t.text);
    p.bitmap(mark, x + textWidth("XMR", 2, 1) + 6, top, 2, () => t.accent);
  }

  // Stepped corners, like the site's other pixel edges.
  const steps = o.size === "normal" ? [[0, 0], [1, 0], [0, 1]] : [[0, 0]];
  for (const [dx, dy] of steps) {
    p.set(dx, dy, null); p.set(w - 1 - dx, dy, null); p.set(dx, h - 1 - dy, null); p.set(w - 1 - dx, h - 1 - dy, null);
  }
  return p;
}

/** The pixels as a small SVG: one path per color, one run per row. */
export function badgeSvg(p: Pixels, scale: number, title: string): string {
  const runs = new Map<string, string[]>();
  for (let y = 0; y < p.h; y++) {
    let x = 0;
    while (x < p.w) {
      const c = p.get(x, y);
      let end = x + 1;
      while (end < p.w && p.get(end, y) === c) end++;
      if (c) runs.set(c, [...(runs.get(c) ?? []), `M${x} ${y}h${end - x}v1h-${end - x}z`]);
      x = end;
    }
  }
  const escape = (s: string) => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
  const paths = [...runs].map(([c, d]) => `<path fill="${c}" d="${d.join("")}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.w} ${p.h}" width="${p.w * scale}" height="${p.h * scale}" shape-rendering="crispEdges" role="img" aria-label="${escape(title)}"><title>${escape(title)}</title>${paths}</svg>`;
}

/** Paints the pixels on a canvas at `scale`. */
export function paintBadge(canvas: HTMLCanvasElement, p: Pixels, scale: number) {
  canvas.width = p.w * scale; canvas.height = p.h * scale;
  const g = canvas.getContext("2d")!;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const c = p.get(x, y);
    if (!c) continue;
    g.fillStyle = c;
    g.fillRect(x * scale, y * scale, scale, scale);
  }
}

/** Readable text for alt and title, like "We accept Monero". */
export function badgeTitle(o: BadgeOptions) {
  const words = BADGE_WORDS[o.lang][o.text];
  const s = o.size === "medium" ? words.line : o.size === "normal" ? `${words.label} MONERO` : "XMR";
  return (s.charAt(0) + s.slice(1).toLowerCase()).replace(/monero/gi, "Monero").replace(/xmr/gi, "XMR");
}
