/* The live stage, in chunky pixels like the beat: waiting transactions are beveled tokens stacked in a
   glass jar; when a block is found, the mined ones fly up, pack into a block and slide onto the chain.
   Tokens can be hovered (they pop and show their ID) and clicked. Text is drawn on top at full
   resolution so it stays sharp. */
import type { FeeTier } from "../../lib/live";

const C = {
  bg: "#2b282d", dim: "#36323a", graphite: "#45404a", line: "#5a5460", ash: "#a39ca8",
  orange: "#fb8c3c", flame: "#ff6600", cream: "#fff1e4", peach: "#ffd2ad", ember: "#e0712c", red: "#ff3b30",
};
/** Token colors: [face, highlight, shade]. */
/** Token colors per fee tier, [face, highlight, shade]: muted for low fees, gold for high. */
export const FEE_TONES: [string, string, string][] = [
  ["#9c6a48", "#c08a62", "#6e4630"], [C.orange, C.peach, "#c4621f"], ["#ffd24a", "#fff1b0", "#c99a1a"],
];
/** Token sizes, largest first: the jar uses the biggest one that still fits every transaction. */
const SIZES = [6, 5, 4, 3];
const num = (n: number) => n.toLocaleString();
const BLOCK_SECONDS = 120;

interface Tx { x: number; y: number; tx: number; ty: number; tone: [string, string, string]; glow: number; pop: number; leaving: boolean }
interface Block { height: number; x: number }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string }
interface Layout { jar: { x: number; y: number; w: number; h: number }; chainY: number; forge: { x: number; y: number }; bar: { x: number; y: number; w: number } }

export interface LiveLabels { height: (h: number) => string; waiting: (n: number) => string; ago: (seconds: number) => string; newBlock: string }

export class LiveVisuals {
  private buffer = document.createElement("canvas");
  private g = this.buffer.getContext("2d")!;
  private out: CanvasRenderingContext2D;
  private layout!: Layout;
  private txs = new Map<string, Tx>();
  private order: string[] = [];
  private blocks: Block[] = [];
  private sparks: Spark[] = [];
  private stars: { x: number; y: number; phase: number }[] = [];
  private banner = 0;
  private shake = 0;
  private last = performance.now();
  private raf = 0;
  private hovered?: string;
  private size = SIZES[0];
  private pointer?: { x: number; y: number };
  height = 0;
  lastBlockAt = Date.now();

  constructor(private canvas: HTMLCanvasElement, private labels: LiveLabels) {
    this.out = canvas.getContext("2d")!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  start() { if (!this.raf) this.raf = requestAnimationFrame(this.frame); }

  private get W() { return this.buffer.width; }
  private get H() { return this.buffer.height; }
  private get portrait() { return this.H > this.W; }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    const portrait = rect.width < 560;
    this.buffer.width = portrait ? 72 : 128;
    this.buffer.height = portrait ? 124 : 80;
    this.layout = portrait
      ? { jar: { x: 9, y: 30, w: 54, h: 66 }, chainY: 108, forge: { x: 36, y: 22 }, bar: { x: 16, y: 17, w: 40 } }
      : { jar: { x: 31, y: 16, w: 66, h: 46 }, chainY: 67, forge: { x: 64, y: 8 }, bar: { x: 4, y: 16, w: 22 } };
    const dpr = devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.width * dpr * (this.H / this.W));
    this.canvas.style.height = `${rect.width * (this.H / this.W)}px`;
    this.canvas.parentElement?.style.setProperty("--ratio", String(this.W / this.H));
    this.stars = Array.from({ length: Math.round(this.W / 4) }, () => ({ x: Math.floor(Math.random() * this.W), y: Math.floor(Math.random() * this.H), phase: Math.random() * 6 }));
    this.reflow();
  }

  private cols(size = this.size) { return Math.floor(this.layout.jar.w / size); }
  private capacity(size = this.size) { return this.cols(size) * Math.floor(this.layout.jar.h / size); }

  /** Slot i, counted from the bottom-left of the jar. Past capacity, tokens pile on the top row. */
  private slot(i: number) {
    const { x, y, w, h } = this.layout.jar, size = this.size, cols = this.cols(), rows = Math.floor(h / size);
    const row = Math.min(rows - 1, Math.floor(i / cols));
    const offset = Math.floor((w - cols * size) / 2);
    return { x: x + offset + (i % cols) * size, y: y + h - size - row * size };
  }

  private reflow() {
    this.size = SIZES.find((s) => this.capacity(s) >= this.order.length) ?? SIZES.at(-1)!;
    this.order.forEach((hash, i) => { const t = this.txs.get(hash); if (t && !t.leaving) Object.assign(t, { tx: this.slot(i).x, ty: this.slot(i).y }); });
  }

  /** New transactions in the pool; `instant` places them without the fall (first load). */
  add(hashes: string[], tiers: ReadonlyMap<string, FeeTier>, instant = false) {
    for (const hash of hashes) {
      if (this.txs.has(hash)) continue;
      this.order.push(hash);
      if (this.capacity() < this.order.length) this.reflow();
      const s = this.slot(this.order.length - 1);
      this.txs.set(hash, {
        x: s.x, y: instant ? s.y : this.layout.jar.y - 8 - Math.random() * 16, tx: s.x, ty: s.y,
        tone: FEE_TONES[tiers.get(hash) ?? 1], glow: 0, pop: 0, leaving: false,
      });
    }
  }

  /** The first look at the network: the chain already has its recent blocks. */
  begin(height: number) {
    this.height = height;
    this.lastBlockAt = Date.now();
    const size = 9;
    const count = Math.ceil(this.W / size);
    this.blocks = Array.from({ length: count }, (_, i) => ({ height: height - count + 1 + i, x: this.W - 6 - (count - i) * size }));
  }

  /** Lights a transaction as its note plays. */
  ring(hash: string) {
    const t = this.txs.get(hash);
    if (t) t.glow = 1;
  }

  /** The transaction under a point in CSS pixels, if any. */
  hit(clientX: number, clientY: number): string | undefined {
    const rect = this.canvas.getBoundingClientRect();
    const vx = ((clientX - rect.left) / rect.width) * this.W, vy = ((clientY - rect.top) / rect.height) * this.H;
    this.pointer = { x: vx, y: vy };
    for (let i = this.order.length - 1; i >= 0; i--) {
      const t = this.txs.get(this.order[i]);
      if (t && vx >= t.x - 0.5 && vx < t.x + this.size + 0.5 && vy >= t.y - 0.5 && vy < t.y + this.size + 0.5) return this.order[i];
    }
    return undefined;
  }

  /** A hovered token pops and sparkles. */
  poke(hash: string | undefined) {
    this.hovered = hash;
    const t = hash && this.txs.get(hash);
    if (!t) return;
    t.pop = 1;
    t.glow = Math.max(t.glow, 0.7);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      this.sparks.push({ x: t.x + this.size / 2, y: t.y, vx: Math.cos(a) * 18, vy: Math.sin(a) * 18, life: 0.35, color: t.tone[1] });
    }
  }

  leave() { this.hovered = undefined; this.pointer = undefined; }

  /** A block was found: the mined transactions fly into a new block that joins the chain. */
  block(height: number, mined: string[]) {
    const { forge } = this.layout;
    for (const hash of mined) {
      const t = this.txs.get(hash);
      if (t) Object.assign(t, { leaving: true, tx: forge.x - 1 + (Math.random() * 8 - 4), ty: forge.y });
    }
    this.order = this.order.filter((h) => !mined.includes(h));
    this.reflow();
    this.height = height;
    this.lastBlockAt = Date.now();
    this.banner = 1;
    this.shake = 1;
    this.blocks.push({ height, x: this.W + 4 });
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      this.sparks.push({ x: forge.x, y: forge.y, vx: Math.cos(a) * (24 + Math.random() * 16), vy: Math.sin(a) * (24 + Math.random() * 16), life: 0.7, color: i % 2 ? C.peach : C.orange });
    }
  }

  private px(x: number, y: number, color: string, w = 1, h = 1) { this.g.fillStyle = color; this.g.fillRect(Math.round(x), Math.round(y), w, h); }

  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.draw(dt, now / 1000);
    const k = this.canvas.width / this.W;
    const dx = this.shake > 0 ? Math.round((Math.random() - 0.5) * 2 * this.shake) * k : 0;
    this.out.imageSmoothingEnabled = false;
    this.out.fillStyle = C.bg;
    this.out.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.out.drawImage(this.buffer, dx, 0, this.canvas.width, this.canvas.height);
    this.text();
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(dt: number, time: number) {
    this.px(0, 0, C.bg, this.W, this.H);
    for (const s of this.stars) this.px(s.x, s.y, Math.sin(time * 1.3 + s.phase) > 0.6 ? C.line : C.dim);
    this.timer();
    this.jar();
    this.tokens(dt, time);
    this.chain(dt);
    this.sparks = this.sparks.filter((s) => (s.life -= dt) > 0);
    for (const s of this.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 30 * dt; this.px(s.x, s.y, s.color); }
    this.banner = Math.max(0, this.banner - dt * 0.4);
    this.shake = Math.max(0, this.shake - dt * 3);
  }

  /** Progress toward the 2-minute block target; red once a block is overdue. */
  private timer() {
    const { x, y, w } = this.layout.bar;
    const seconds = (Date.now() - this.lastBlockAt) / 1000;
    const fill = Math.min(w, Math.round((seconds / BLOCK_SECONDS) * w));
    this.px(x, y, C.graphite, w, 2);
    this.px(x, y, seconds > BLOCK_SECONDS ? C.red : C.orange, fill, 2);
  }

  /** A glass jar: walls with a lip, a thick base and a light reflection inside. */
  private jar() {
    const { x, y, w, h } = this.layout.jar;
    this.px(x - 1, y + 2, C.dim, w + 2, h);
    this.px(x - 2, y, C.line, 1, h + 2);
    this.px(x + w + 1, y, C.line, 1, h + 2);
    this.px(x - 3, y, C.ash, 2, 1);
    this.px(x + w + 1, y, C.ash, 2, 1);
    this.px(x - 2, y + h + 2, C.line, w + 4, 2);
    this.px(x + 1, y + 4, "#4a4450", 1, h - 8);
  }

  private tokens(dt: number, time: number) {
    for (const [hash, t] of this.txs) {
      const speed = t.leaving ? 6 : 8;
      t.x += (t.tx - t.x) * Math.min(1, dt * speed);
      t.y += (t.ty - t.y) * Math.min(1, dt * (t.y < t.ty ? speed : speed * 0.7));
      t.glow = Math.max(0, t.glow - dt * 2.2);
      t.pop = Math.max(0, t.pop - dt * 4);
      if (t.leaving && Math.abs(t.y - t.ty) < 1) { this.txs.delete(hash); continue; }
      const bob = t.glow > 0 ? Math.round(Math.sin(time * 20) * t.glow) : 0;
      const lift = Math.round(t.pop * 2);
      const [face, light, shade] = t.glow > 0.5 ? [C.cream, C.cream, C.peach] : t.tone;
      const x = t.x, y = t.y - lift + bob, n = this.size - 1;
      this.px(x, y, face, n, n);
      this.px(x, y, light, n, 1);
      this.px(x, y, light, 1, n);
      this.px(x + n - 1, y + 1, shade, 1, n - 1);
      this.px(x + 1, y + n - 1, shade, n - 1, 1);
    }
  }

  /** The chain on a rail: blocks slide in from the right, the newest one lit. */
  private chain(dt: number) {
    const y = this.layout.chainY, size = 6, gap = 3, right = this.W - 6;
    this.px(0, y + Math.floor(size / 2), C.graphite, this.W, 1);
    this.blocks = this.blocks.slice(-Math.ceil(this.W / (size + gap)) - 1);
    this.blocks.forEach((b, i) => {
      const target = right - (this.blocks.length - 1 - i) * (size + gap) - size;
      b.x += (target - b.x) * Math.min(1, dt * 4);
      const newest = i === this.blocks.length - 1;
      this.px(b.x, y, newest ? C.peach : C.line, size, size);
      this.px(b.x + 1, y + 1, newest ? C.flame : C.graphite, size - 2, size - 2);
      this.px(b.x + 2, y + 2, newest ? C.orange : C.dim, size - 4, size - 4);
    });
  }

  private text() {
    const k = this.canvas.width / this.W, o = this.out, portrait = this.portrait;
    const font = (size: number) => `${Math.round(size * k)}px 'DotGothic16', ui-monospace, monospace`;
    const cx = (this.W / 2) * k;
    o.textBaseline = "top";
    if (this.height) {
      o.textAlign = portrait ? "center" : "start";
      o.font = font(5);
      o.fillStyle = C.orange;
      o.fillText(this.labels.height(this.height), portrait ? cx : 4 * k, 3 * k);
      o.font = font(3.6);
      o.fillStyle = C.ash;
      o.fillText(this.labels.ago(Math.floor((Date.now() - this.lastBlockAt) / 1000)), portrait ? cx : 4 * k, 10 * k);
      o.font = font(portrait ? 4 : 5);
      o.fillStyle = C.cream;
      o.textAlign = portrait ? "center" : "end";
      const waiting = this.labels.waiting(this.order.length);
      if (portrait) o.fillText(waiting, cx, (this.layout.jar.y + this.layout.jar.h + 5) * k);
      else o.fillText(waiting, (this.W - 4) * k, 3 * k);
      const overflow = this.order.length - this.capacity();
      if (overflow > 0) {
        o.textAlign = "end";
        o.font = font(3.5);
        o.fillStyle = C.peach;
        o.fillText(`+${num(overflow)}`, (this.layout.jar.x + this.layout.jar.w) * k, (this.layout.jar.y - 5) * k);
      }
      const newest = this.blocks.at(-1);
      if (newest) {
        o.textAlign = "center";
        o.font = font(3);
        o.fillStyle = C.ash;
        o.fillText(num(newest.height), (newest.x + 3) * k, (this.layout.chainY + 7) * k);
      }
    }
    if (this.banner > 0) {
      o.globalAlpha = Math.min(1, this.banner * 2);
      o.textAlign = "center";
      o.font = font(portrait ? 7 : 8);
      o.fillStyle = C.orange;
      o.fillText(this.labels.newBlock, cx, (this.layout.jar.y + this.layout.jar.h / 2 - 6) * k);
      o.globalAlpha = 1;
    }
    const t = this.hovered && this.txs.get(this.hovered);
    if (t && this.pointer) {
      const label = `${this.hovered!.slice(0, 8)}…${this.hovered!.slice(-4)}`;
      o.font = font(3.5);
      const w = o.measureText(label).width + 2 * k;
      const lx = Math.min(this.canvas.width - w - k, Math.max(k, this.pointer.x * k - w / 2)), ly = (t.y - 7) * k;
      o.fillStyle = C.bg;
      o.fillRect(lx, ly, w, 5 * k);
      o.strokeStyle = C.orange;
      o.lineWidth = Math.max(1, k / 3);
      o.strokeRect(lx, ly, w, 5 * k);
      o.textAlign = "start";
      o.fillStyle = C.cream;
      o.fillText(label, lx + k, ly + 0.8 * k);
    }
    o.textAlign = "start";
  }
}
