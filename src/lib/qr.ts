/* QR codes in two styles, drawn from one list of shapes:
   - "pixel": the xmr.fan look. Separated square modules, solid finder eyes,
     and the Monero symbol in the middle (covered by high error correction).
   - "plain": classic black on white, for picky scanners.
   The same shapes become an SVG (page) or a PNG (download and API). */
import qrcode from "qrcode-generator";
import { encodeIndexedPng } from "./png.ts";

export type QrStyle = "pixel" | "plain";
type Ecl = "L" | "M" | "Q" | "H";

const QUIET = 4; // modules of empty margin, as the QR spec asks

// Palette indices double as PNG palette entries.
const PALETTES: Record<QrStyle, string[]> = {
  pixel: ["#fffaf5", "#2b282d", "#f26822", "#4c4c4c"],
  plain: ["#ffffff", "#000000"],
};
const BG = 0, INK = 1, LOGO_ORANGE = 2, LOGO_GRAY = 3;

// The Monero symbol at 13x13, sampled from the official press-kit image
// (getmonero.org/press-kit), in its official colors. o = orange, k = gray,
// w = the white M band (drawn as background, like the transparent version), . = outside.
export const MONERO_LOGO = [
  "....ooooo....",
  "..ooooooooo..",
  ".ooooooooooo.",
  ".ooooooooooo.",
  "oowwooooowwoo",
  "oowwwooowwwoo",
  "oowwwwowwwwoo",
  "oowwkwwwkwwoo",
  "oowwkkwkkwwoo",
  ".wwwkkkkkwww.",
  ".kkkkkkkkkkk.",
  "..kkkkkkkkk..",
  "....kkkkk....",
];
const LOGO_COLORS: Record<string, number> = { o: LOGO_ORANGE, k: LOGO_GRAY };

/** A filled rectangle in module units. `gap` marks data modules drawn with a margin. */
interface Shape { x: number; y: number; w: number; h: number; c: number; gap?: boolean }

export interface QrDrawing {
  /** Size in modules, quiet zone included. */
  size: number;
  shapes: Shape[];
  palette: string[];
}

/** Encodes with the strongest error correction that fits. Throws if the text is too long for any QR code. */
function encode(text: string, levels: Ecl[]) {
  for (const ecl of levels) {
    try {
      const qr = qrcode(0, ecl);
      qr.addData(text, "Byte");
      qr.make();
      return { qr, ecl };
    } catch {
      // too long for this level; try a weaker one
    }
  }
  throw new Error("Text is too long for a QR code");
}

export function drawQr(text: string, style: QrStyle = "pixel"): QrDrawing {
  const { qr, ecl } = encode(text, style === "pixel" ? ["H", "Q", "M", "L"] : ["M", "L"]);
  const n = qr.getModuleCount();
  const shapes: Shape[] = [];
  const at = (x: number, y: number) => ({ x: x + QUIET, y: y + QUIET });

  // The logo needs the redundancy of H or Q to cover modules safely.
  // It clears its own area plus a one-module margin.
  const logo = style === "pixel" && (ecl === "H" || ecl === "Q") ? MONERO_LOGO.length : 0;
  const logoStart = Math.floor((n - logo) / 2);
  const inLogoArea = (x: number, y: number) =>
    logo > 0 && x >= logoStart - 1 && x <= logoStart + logo && y >= logoStart - 1 && y <= logoStart + logo;

  const finders = [[0, 0], [n - 7, 0], [0, n - 7]];
  const inFinder = (x: number, y: number) => finders.some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);

  // Data modules: separated squares in pixel style, full squares in plain.
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!qr.isDark(y, x) || inFinder(x, y) || inLogoArea(x, y)) continue;
      shapes.push({ ...at(x, y), w: 1, h: 1, c: INK, gap: style === "pixel" });
    }
  }

  // Finder eyes as solid rings, so they stay crisp and easy to detect.
  for (const [fx, fy] of finders) {
    const p = at(fx, fy);
    shapes.push(
      { x: p.x, y: p.y, w: 7, h: 1, c: INK }, { x: p.x, y: p.y + 6, w: 7, h: 1, c: INK },
      { x: p.x, y: p.y + 1, w: 1, h: 5, c: INK }, { x: p.x + 6, y: p.y + 1, w: 1, h: 5, c: INK },
      { x: p.x + 2, y: p.y + 2, w: 3, h: 3, c: INK },
    );
  }

  if (logo) {
    MONERO_LOGO.forEach((row, ly) => [...row].forEach((ch, lx) => {
      if (!(ch in LOGO_COLORS)) return;
      shapes.push({ ...at(logoStart + lx, logoStart + ly), w: 1, h: 1, c: LOGO_COLORS[ch] });
    }));
  }

  return { size: n + QUIET * 2, shapes, palette: PALETTES[style] };
}

export const GAP = 0.1; // module margin for `gap` shapes, as a fraction of a module

/** `gaps: false` draws data modules as full squares (for small on-screen sizes). */
export function qrSvg(d: QrDrawing, label: string, { gaps = true } = {}): string {
  const esc = label.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const byColor = new Map<number, string>();
  for (const s of d.shapes) {
    const g = s.gap && gaps ? GAP : 0;
    const path = `M${s.x + g} ${s.y + g}h${s.w - 2 * g}v${s.h - 2 * g}h${2 * g - s.w}z`;
    byColor.set(s.c, (byColor.get(s.c) ?? "") + path);
  }
  const paths = [...byColor].map(([c, path]) => `<path fill="${d.palette[c]}" d="${path}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.size} ${d.size}" shape-rendering="crispEdges" role="img" aria-label="${esc}">` +
    `<rect width="${d.size}" height="${d.size}" fill="${d.palette[BG]}"/>${paths}</svg>`;
}

/** Rasterizes at `scale` whole pixels per module. */
export async function qrPng(d: QrDrawing, scale = 10): Promise<Uint8Array> {
  const w = d.size * scale;
  const rowLen = w + 1; // leading filter byte per row
  const raw = new Uint8Array(rowLen * w); // all zeros = filter "none" + background
  // Gaps must be whole pixels: uneven, rounded gaps make modules irregular and
  // break decoding. Below 8px per module there is no room for them.
  const gapPx = scale >= 8 ? Math.round(scale * GAP) : 0;
  for (const s of d.shapes) {
    const g = s.gap ? gapPx : 0;
    const x0 = s.x * scale + g, x1 = (s.x + s.w) * scale - g;
    const y0 = s.y * scale + g, y1 = (s.y + s.h) * scale - g;
    for (let y = y0; y < y1; y++) raw.fill(s.c, y * rowLen + 1 + x0, y * rowLen + 1 + x1);
  }

  return encodeIndexedPng(w, w, d.palette, raw);
}
