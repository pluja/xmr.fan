/* The stage for an address beat, drawn on a tiny canvas and scaled up so every pixel is chunky:
   a ring sequencer of the 32 steps around the address's QR code, sparks on the kick, pixel rain,
   spectrum bars and the address bytes. The address ticker and the QR code are drawn on top at full
   resolution, so the text stays readable and the code scannable (also in recorded videos).
   It keeps idling gently when the music is stopped. */
import { STEPS, type Song } from "../../lib/beat";
import { buildUri } from "../../lib/monero";
import { drawQr, type QrDrawing } from "../../lib/qr";

const C = {
  bg: "#2b282d", dim: "#36323a", graphite: "#45404a", line: "#5a5460",
  orange: "#fb8c3c", flame: "#ff6600", cream: "#fff1e4", mint: "#a8e6c1", peach: "#ffd2ad",
};

interface Spark { x: number; y: number; vx: number; vy: number; life: number }
interface Drop { x: number; y: number; speed: number }
/** Positions in virtual pixels. */
interface Layout { tickerY: number; bytesY: number; cx: number; cy: number; r: number; qr: { x: number; y: number; size: number }; specH: number }

export class BeatVisuals {
  private buffer = document.createElement("canvas");
  private g = this.buffer.getContext("2d")!;
  private out: CanvasRenderingContext2D;
  private sparks: Spark[] = [];
  private drops: Drop[] = [];
  private peaks: number[] = [];
  private pulse = 0;
  private trail: number[] = [];
  private last = performance.now();
  private raf = 0;
  private layout!: Layout;
  private qr?: QrDrawing;
  private address = "";
  song?: Song;
  step = -1;
  playing = false;
  bins?: () => Uint8Array;

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
    if (this.song?.kick[step]) {
      this.pulse = 1;
      this.burst(14);
    }
  }

  private get W() { return this.buffer.width; }
  private get H() { return this.buffer.height; }

  /** Portrait on narrow screens, wide otherwise; the virtual resolution keeps pixels big. */
  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    const portrait = rect.width < 560;
    this.buffer.width = portrait ? 72 : 128;
    this.buffer.height = portrait ? 120 : 80;
    this.layout = portrait
      ? { tickerY: 2, bytesY: 12, cx: 36, cy: 46, r: 27, qr: { x: 24, y: 34, size: 24 }, specH: 16 }
      : { tickerY: 2, bytesY: 12, cx: 64, cy: 45, r: 27, qr: { x: 52, y: 33, size: 24 }, specH: 7 };
    const dpr = devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.width * dpr * (this.H / this.W));
    this.canvas.style.height = `${rect.width * (this.H / this.W)}px`;
    this.canvas.parentElement?.style.setProperty("--ratio", String(this.W / this.H));
    this.drops = Array.from({ length: Math.round(this.W / 3) }, () => ({ x: Math.floor(Math.random() * this.W), y: Math.random() * this.H, speed: 0.5 + Math.random() }));
  }

  private burst(n: number) {
    const { cx, cy } = this.center();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const v = 18 + Math.random() * 22;
      this.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 });
    }
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
    const g = this.g, { W, H } = this;
    g.fillStyle = C.bg;
    g.fillRect(0, 0, W, H);
    this.rain(dt);
    this.bytes();
    this.ring();
    this.spectrum(dt);
    this.updateSparks(dt);
    this.pulse = Math.max(0, this.pulse - dt * 4);
  }

  private rain(dt: number) {
    const tempo = this.playing && this.song ? this.song.bpm / 60 : 0.25;
    for (const d of this.drops) {
      d.y += d.speed * tempo * 14 * dt;
      if (d.y > this.H) { d.y = -3; d.x = Math.floor(Math.random() * this.W); }
      const color = this.pulse > 0.5 ? C.graphite : C.dim;
      this.px(d.x, d.y, color, 1, 2);
      this.px(d.x, d.y + 2, this.pulse > 0.5 ? C.line : C.graphite);
    }
  }

  private bytes() {
    const song = this.song;
    if (!song) return;
    const n = song.bytes.length, x0 = Math.floor((this.W - n) / 2);
    const lit = this.step < 0 ? -1 : this.step;
    song.bytes.forEach((v, i) => {
      const on = i === 1 + lit || i === 33 + lit;
      const k = v / 255;
      this.px(x0 + i, this.layout.bytesY, on ? C.cream : k > 0.66 ? C.orange : k > 0.33 ? C.flame : C.graphite, 1, on ? 3 : 2);
    });
  }

  /** Three rings around the QR code: melody outside, bass in the middle, drums inside. */
  private ring() {
    const song = this.song;
    if (!song) return;
    const { cx, cy } = this.center();
    const r = this.layout.r;
    for (let i = 0; i < STEPS; i++) {
      const a = -Math.PI / 2 + (i / STEPS) * Math.PI * 2;
      const at = (radius: number) => [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius] as const;
      const age = this.trail.indexOf(i);
      const head = this.playing && age === 0;
      const glow = this.playing && age > 0 ? 1 - age / 5 : 0;
      const lead = song.lead[i] !== null, bass = song.bass[i] !== null, drum = song.kick[i] || song.snare[i];
      const [lx, ly] = at(r), [bx, by] = at(r - 4), [dx, dy] = at(r - 8);
      this.px(lx - 1, ly - 1, head ? C.cream : lead ? (glow ? C.peach : C.orange) : C.graphite, 2, 2);
      if (bass) this.px(bx - 1, by - 1, head ? C.cream : glow ? C.cream : C.mint, 2, 2);
      if (drum) this.px(dx, dy, head || glow > 0.5 ? C.cream : song.snare[i] ? C.flame : C.line);
    }
  }


  private spectrum(dt: number) {
    const bins = this.playing ? this.bins?.() : undefined;
    const bars = this.W > 100 ? 24 : 16;
    const w = Math.floor(this.W / bars), maxH = this.layout.specH;
    for (let b = 0; b < bars; b++) {
      const v = bins ? bins[Math.floor((b / bars) * bins.length * 0.8)] / 255 : 0.04 + 0.03 * Math.sin(performance.now() / 600 + b);
      const h = Math.max(1, Math.round(v * maxH));
      this.peaks[b] = Math.max(h, (this.peaks[b] ?? 0) - dt * 14);
      const x = b * w + Math.floor((this.W - bars * w) / 2);
      for (let y = 0; y < h; y++) this.px(x, this.H - 1 - y, y > maxH * 0.7 ? C.peach : y > maxH * 0.4 ? C.orange : C.flame, w - 1, 1);
      this.px(x, this.H - 2 - Math.round(this.peaks[b]), C.cream, w - 1, 1);
    }
  }

  private updateSparks(dt: number) {
    this.sparks = this.sparks.filter((s) => (s.life -= dt) > 0);
    for (const s of this.sparks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      this.px(s.x, s.y, s.life > 0.3 ? C.peach : C.orange);
    }
  }

  /* ---------- Full-resolution overlays ---------- */

  /** The address like karaoke: the characters being played light up and the line scrolls with them. */
  private ticker() {
    if (!this.address) return;
    const k = this.canvas.width / this.W, o = this.out;
    o.font = `${Math.round(6 * k)}px 'DotGothic16', ui-monospace, monospace`;
    o.textBaseline = "middle";
    o.textAlign = "center";
    const cw = o.measureText("M").width;
    const count = Math.max(9, Math.floor(((this.W - 6) * k) / cw) | 1);
    const playingNow = this.playing && this.step >= 0;
    const focus = playingNow ? this.step * 3 + 1 : Math.floor(count / 2);
    const half = Math.floor(count / 2), y = (this.layout.tickerY + 4) * k;
    for (let j = -half; j <= half; j++) {
      const i = focus + j;
      if (i < 0 || i >= this.address.length) continue;
      const lit = playingNow && Math.floor(i / 3) === this.step;
      const fade = Math.abs(j) / (half + 1);
      o.fillStyle = lit ? C.orange : fade < 0.35 ? C.cream : fade < 0.7 ? "#a39ca8" : C.line;
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
    o.fillStyle = C.graphite;
    o.fillRect(x0 - pad - Math.round(k * 0.6), y0 - pad - Math.round(k * 0.6), s + 2 * pad + Math.round(k * 1.2), s + 2 * pad + Math.round(k * 1.2));
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

  /** Where the beat came from, for shared videos: left of the ring when wide, under it when tall. */
  private signature() {
    if (!this.song) return;
    const k = this.canvas.width / this.W, o = this.out;
    o.textBaseline = "top";
    if (this.H > this.W) {
      o.textAlign = "center";
      o.font = `${Math.round(5 * k)}px 'DotGothic16', ui-monospace, monospace`;
      o.fillStyle = C.orange;
      o.fillText("xmr.fan/beat", (this.W / 2) * k, 80 * k);
      o.font = `${Math.round(4 * k)}px 'DotGothic16', ui-monospace, monospace`;
      o.fillStyle = "#a39ca8";
      o.fillText(`${this.song.bpm} BPM · ${this.song.key}`, (this.W / 2) * k, 87 * k);
      o.textAlign = "start";
      return;
    }
    o.font = `${Math.round(4 * k)}px 'DotGothic16', ui-monospace, monospace`;
    o.fillStyle = C.orange;
    o.fillText("xmr.fan/beat", 5 * k, 40 * k);
    o.font = `${Math.round(3.5 * k)}px 'DotGothic16', ui-monospace, monospace`;
    o.fillStyle = "#a39ca8";
    o.fillText(`${this.song.bpm} BPM · ${this.song.key}`, 5 * k, 46 * k);
  }
}
