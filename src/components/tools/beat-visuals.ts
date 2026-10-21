/* The stage for an address beat, drawn on a tiny canvas and scaled up so every pixel is chunky:
   a ring of the 32 steps around the address's QR code, with a ripple on each kick. The address ticker
   and the QR code are drawn on top at full resolution, so the text stays readable and the code
   scannable (also in recorded videos). */
import { STEPS, type Song } from "../../lib/beat";
import { buildUri } from "../../lib/monero";
import { drawQr, type QrDrawing } from "../../lib/qr";

const C = {
  bg: "#2b282d", dim: "#36323a", graphite: "#45404a", line: "#5a5460",
  orange: "#fb8c3c", flame: "#ff6600", cream: "#fff1e4", peach: "#ffd2ad", ash: "#a39ca8",
};

/** Positions in virtual pixels. */
interface Layout { tickerY: number; cx: number; cy: number; r: number; qr: { x: number; y: number; size: number }; signatureY: number }

export class BeatVisuals {
  private buffer = document.createElement("canvas");
  private g = this.buffer.getContext("2d")!;
  private out: CanvasRenderingContext2D;
  private ripples: number[] = [];
  private trail: number[] = [];
  private last = performance.now();
  private raf = 0;
  private layout!: Layout;
  private qr?: QrDrawing;
  private address = "";
  song?: Song;
  step = -1;
  playing = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.out = canvas.getContext("2d")!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  setSong(song: Song, address: string) {
    this.song = song;
    this.address = address;
    this.qr = drawQr(buildUri({ address }));
  }

  start() { if (!this.raf) this.raf = requestAnimationFrame(this.frame); }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }

  /** Called as each step sounds. */
  hit(step: number) {
    this.step = step;
    this.trail = [step, ...this.trail].slice(0, 5);
    if (this.song?.kick[step]) this.ripples.push(0);
  }

  private get W() { return this.buffer.width; }
  private get H() { return this.buffer.height; }

  /** Portrait on narrow screens, wide otherwise; the virtual resolution keeps pixels big. */
  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    const portrait = rect.width < 560;
    this.buffer.width = portrait ? 72 : 128;
    this.buffer.height = portrait ? 100 : 80;
    this.layout = portrait
      ? { tickerY: 2, cx: 36, cy: 46, r: 27, qr: { x: 24, y: 34, size: 24 }, signatureY: 82 }
      : { tickerY: 2, cx: 64, cy: 44, r: 27, qr: { x: 52, y: 32, size: 24 }, signatureY: 73 };
    const dpr = devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.width * dpr * (this.H / this.W));
    this.canvas.style.height = `${rect.width * (this.H / this.W)}px`;
    this.canvas.parentElement?.style.setProperty("--ratio", String(this.W / this.H));
  }

  private center() { return { cx: this.layout.cx, cy: this.layout.cy }; }
  private px(x: number, y: number, color: string, w = 1, h = 1) { this.g.fillStyle = color; this.g.fillRect(Math.round(x), Math.round(y), w, h); }

  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.draw(dt);
    this.out.imageSmoothingEnabled = false;
    this.out.drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height);
    this.ticker();
    this.qrCode();
    this.signature();
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(dt: number) {
    this.px(0, 0, C.bg, this.W, this.H);
    this.ripple(dt);
    this.ring();
  }

  /** Each kick sends a faint circle out from the code to the ring. */
  private ripple(dt: number) {
    const { cx, cy } = this.center(), from = this.layout.qr.size / 2 + 3, to = this.layout.r - 2;
    this.ripples = this.ripples.map((p) => p + dt * 3).filter((p) => p < 1);
    for (const p of this.ripples) {
      const r = from + (to - from) * p, n = Math.round(r * 5);
      const color = p < 0.4 ? C.line : p < 0.75 ? C.graphite : C.dim;
      for (let i = 0; i < n; i++) this.px(cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r, color);
    }
  }

  /** The 32 steps around the code: notes are orange, rests a faint dot, and the playhead leaves a short trail. */
  private ring() {
    const song = this.song;
    if (!song) return;
    const { cx, cy } = this.center(), r = this.layout.r;
    for (let i = 0; i < STEPS; i++) {
      const a = -Math.PI / 2 + (i / STEPS) * Math.PI * 2;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      const age = this.playing ? this.trail.indexOf(i) : -1;
      const note = song.lead[i] !== null;
      if (age === 0) this.px(x - 1.5, y - 1.5, C.cream, 3, 3);
      else if (age > 0) this.px(x - 1, y - 1, age < 3 ? C.peach : C.orange, 2, 2);
      else if (note) this.px(x - 1, y - 1, song.kick[i] ? C.flame : C.orange, 2, 2);
      else this.px(x, y, C.graphite);
    }
  }

  /* ---------- Full-resolution overlays ---------- */

  /** The address like karaoke: the characters being played light up and the line scrolls with them. */
  private ticker() {
    if (!this.address) return;
    const k = this.canvas.width / this.W, o = this.out;
    o.font = `${Math.round(5 * k)}px 'DotGothic16', ui-monospace, monospace`;
    o.textBaseline = "middle";
    o.textAlign = "center";
    const cw = o.measureText("M").width;
    const count = Math.max(9, Math.floor(((this.W - 6) * k) / cw) | 1);
    const playingNow = this.playing && this.step >= 0;
    const half = Math.floor(count / 2);
    const focus = Math.min(this.address.length - 1 - half, Math.max(half, playingNow ? this.step * 3 + 1 : 0)), y = (this.layout.tickerY + 4) * k;
    for (let j = -half; j <= half; j++) {
      const i = focus + j;
      if (i < 0 || i >= this.address.length) continue;
      const lit = playingNow && Math.floor(i / 3) === this.step;
      const fade = Math.abs(j) / (half + 1);
      o.fillStyle = lit ? C.orange : fade < 0.35 ? C.cream : fade < 0.7 ? C.ash : C.line;
      o.fillText(this.address[i], this.canvas.width / 2 + j * cw, y);
    }
    o.textAlign = "start";
  }

  /** A scannable code for sending to the address. Orange finder eyes, and while the music plays an
      orange wave sweeps diagonally over the dark modules with the playhead. Orange stays dark enough
      for scanners, so the code reads at any moment. */
  private qrCode() {
    const qr = this.qr;
    if (!qr) return;
    const k = this.canvas.width / this.W, { x, y, size } = this.layout.qr, o = this.out;
    const pad = Math.round(k * 1.2), x0 = Math.round(x * k), y0 = Math.round(y * k), s = Math.round(size * k);
    o.fillStyle = qr.palette[0];
    o.fillRect(x0 - pad, y0 - pad, s + pad * 2, s + pad * 2);
    const m = s / qr.size;
    const phase = this.playing && this.step >= 0 ? ((this.step + 1) / STEPS) * 1.2 - 0.1 : -1;
    for (const sh of qr.shapes) {
      const finder = sh.c === 1 && !sh.gap;
      const wave = sh.gap && phase >= 0 && Math.abs((sh.x + sh.y) / (2 * qr.size) - phase) < 0.05;
      o.fillStyle = finder || wave ? C.flame : qr.palette[sh.c];
      const g = sh.gap && m >= 5 ? m * 0.1 : 0;
      o.fillRect(x0 + sh.x * m + g, y0 + sh.y * m + g, sh.w * m - 2 * g, sh.h * m - 2 * g);
    }
  }

  /** Where the beat came from, for shared videos. */
  private signature() {
    if (!this.song) return;
    const k = this.canvas.width / this.W, o = this.out, y = this.layout.signatureY * k;
    o.textBaseline = "top";
    o.font = `${Math.round(3.5 * k)}px 'DotGothic16', ui-monospace, monospace`;
    if (this.H > this.W) {
      o.textAlign = "center";
      o.fillStyle = C.orange;
      o.fillText("xmr.fan/beat", (this.W / 2) * k, y);
      o.fillStyle = C.ash;
      o.fillText(`${this.song.bpm} BPM · ${this.song.key}`, (this.W / 2) * k, y + 6 * k);
    } else {
      o.textAlign = "start";
      o.fillStyle = C.orange;
      o.fillText("xmr.fan/beat", 5 * k, y);
      o.textAlign = "end";
      o.fillStyle = C.ash;
      o.fillText(`${this.song.bpm} BPM · ${this.song.key}`, (this.W - 5) * k, y);
    }
    o.textAlign = "start";
  }
}
