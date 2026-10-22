/* The little animated pictures of Monero ELI5. Each scene draws on a tiny canvas scaled up into
   chunky pixels, with any words drawn on top at full resolution. Scenes only animate while visible. */

const C = {
  bg: "#2b282d", dim: "#36323a", graphite: "#45404a", line: "#5a5460", ash: "#a39ca8",
  orange: "#fb8c3c", flame: "#ff6600", cream: "#fff1e4", peach: "#ffd2ad", red: "#ff3b30", mint: "#a8e6c1", sky: "#8ecbff", lilac: "#e0b0ff",
};
const W = 96, H = 54;

const SPRITES = {
  person: [".###.", ".###.", "..#..", "#####", ".###.", ".#.#.", ".#.#."],
  bank: ["......#......", "....#####....", "..#########..", "#############", ".............", ".#.#.#.#.#.#.", ".#.#.#.#.#.#.", ".#.#.#.#.#.#.", ".............", "#############"],
  lock: [".#.", "#.#", "###", "#o#", "###"],
  key: ["###.....", "#.######", "###.#.#."],
  coin: [".###.", "##o##", "#o###", "#####", ".###."],
  check: ["......#", ".....##", "#...##.", "##.##..", ".###...", "..#...."],
  cross: ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  computer: ["#######", "#ooooo#", "#ooooo#", "#######", "..###..", ".#####."],
  lens: [".##..", "#..#.", "#..#.", ".##..", "...##"],
};
type Sprite = keyof typeof SPRITES;

interface Label { text: string; x: number; y: number; color: string; size: number; align: CanvasTextAlign }

export class Scene {
  private buffer = document.createElement("canvas");
  private g = this.buffer.getContext("2d")!;
  private out: CanvasRenderingContext2D;
  private labels: Label[] = [];
  private last = 0;
  private raf = 0;
  private t = 0;
  get time() { return this.t; }

  constructor(private canvas: HTMLCanvasElement, private draw: (s: Scene, t: number, dt: number) => void) {
    this.buffer.width = W;
    this.buffer.height = H;
    this.out = canvas.getContext("2d")!;
    new ResizeObserver(() => this.resize()).observe(canvas);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    new IntersectionObserver(([e]) => {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      if (e.isIntersecting && !still) { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); }
    }).observe(canvas);
    if (still) { this.t = 2.5; setTimeout(() => this.render(0)); }
  }

  /** Converts a pointer position into scene pixels. */
  point(e: { clientX: number; clientY: number }) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  private resize() {
    const w = this.canvas.getBoundingClientRect().width, dpr = devicePixelRatio || 1;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(w * dpr * (H / W));
    this.render(0);
  }

  private frame = (now: number) => {
    // A frame timestamp can predate the performance.now() taken when the loop started.
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.t += dt;
    this.render(dt);
    this.raf = requestAnimationFrame(this.frame);
  };

  private render(dt: number) {
    this.labels = [];
    this.px(0, 0, C.bg, W, H);
    this.draw(this, this.t, dt);
    const o = this.out, k = this.canvas.width / W;
    o.imageSmoothingEnabled = false;
    o.drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height);
    o.textBaseline = "middle";
    for (const l of this.labels) {
      o.font = `${Math.round(l.size * k)}px 'DotGothic16', ui-monospace, monospace`;
      o.fillStyle = l.color;
      o.textAlign = l.align;
      o.fillText(l.text, l.x * k, l.y * k);
    }
  }

  px(x: number, y: number, color: string, w = 1, h = 1) { this.g.fillStyle = color; this.g.fillRect(Math.round(x), Math.round(y), w, h); }

  /** '#' takes the color, 'o' the second color. */
  sprite(name: Sprite, x: number, y: number, color: string, second: string = C.bg) {
    SPRITES[name].forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === "#") this.px(x + i, y + j, color);
      else if (ch === "o") this.px(x + i, y + j, second);
    }));
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string, dash = 0) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) if (!dash || Math.floor(i / dash) % 2 === 0) this.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, color);
  }

  text(text: string, x: number, y: number, { color = C.ash, size = 4, align = "center" as CanvasTextAlign } = {}) {
    this.labels.push({ text, x, y, color, size, align });
  }
}

const ease = (p: number) => (p < 0 ? 0 : p > 1 ? 1 : p * p * (3 - 2 * p));
const lerp = (a: number, b: number, p: number) => a + (b - a) * ease(p);
const ground = (s: Scene) => s.px(0, 47, C.graphite, W, 1);

/* ---------- 1. Send money to anyone, anywhere, without a bank ---------- */
export function sendScene(labels: { minutes: string }) {
  const cx = 48, cy = 22, r = 12;
  return (s: Scene, t: number) => {
    ground(s);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      const lon = Math.asin(x / Math.sqrt(r * r - y * y || 1)) + t * 0.6, lat = y / r;
      const land = Math.sin(lon * 3) + Math.cos(lat * 5 + lon) > 0.9;
      s.px(cx + x, cy + y, land ? "#5c8a6a" : x * x + y * y > (r - 1.5) ** 2 ? "#28405a" : "#2f4b66");
    }
    s.sprite("bank", 42, 37, C.graphite);
    s.sprite("cross", 46, 39, C.red);
    s.sprite("person", 6, 40, C.orange);
    s.sprite("person", 85, 40, C.mint);
    const p = t % 4.2, q = p / 2.6;
    if (p < 2.6) {
      for (let k = 4; k >= 0; k--) {
        const qq = Math.max(0, q - k * 0.025), x = 12 + qq * 70, y = 36 - Math.sin(Math.PI * qq) * 34;
        if (k) s.px(x + 2, y + 2, C.peach); else s.sprite("coin", x, y, C.orange, C.peach);
      }
    } else {
      s.sprite("check", 84, 31, C.mint);
      s.text(labels.minutes, 87.5, 27, { color: C.mint, size: 3.4 });
    }
  };
}

/* ---------- 2. A shared blockchain kept by computers everywhere ---------- */
export function networkScene(labels: { minutes: string; blockchain: string }) {
  const nodes = [[8, 3], [30, 1], [54, 4], [78, 2], [18, 15], [42, 14], [66, 16], [86, 13], [6, 27], [32, 26], [56, 28], [80, 26]];
  const links = nodes.flatMap(([x, y], i) => nodes.map(([x2, y2], j) => [i, j, Math.hypot(x - x2, y - y2)] as const)).filter(([i, j, d]) => i < j && d < 27);
  let born = 0;
  return (s: Scene, t: number) => {
    for (const [i, j] of links) s.line(nodes[i][0] + 3, nodes[i][1] + 3, nodes[j][0] + 3, nodes[j][1] + 3, C.graphite);
    for (let k = 0; k < 5; k++) {
      const [i, j] = links[(Math.floor(t / 0.7 + k * 0.37) * 7 + k * 5) % links.length];
      const p = (t / 0.7 + k * 0.37) % 1;
      s.px(lerp(nodes[i][0] + 3, nodes[j][0] + 3, p), lerp(nodes[i][1] + 3, nodes[j][1] + 3, p), C.orange, 2, 2);
    }
    for (const [x, y] of nodes) s.sprite("computer", x, y, C.ash, C.graphite);
    if (t - born > 4) born = t;
    const slide = ease((t - born) / 0.6) * 9;
    for (let i = 0; i < 11; i++) {
      const x = 84 - i * 9 - 9 + slide, newest = i === 0;
      if (x < -8) continue;
      s.px(x, 43, newest ? C.orange : C.line, 7, 8);
      s.px(x + 1, 45, newest ? C.cream : C.graphite, 5, 1);
      s.px(x + 1, 47, newest ? C.cream : C.graphite, 4, 1);
      if (i > 0) s.px(x + 7, 47, C.line, 2, 1);
    }
    s.text(labels.blockchain, 3, 39, { size: 3.4, align: "start" });
    s.text(labels.minutes, 92, 39, { size: 3.4, color: C.orange, align: "end" });
  };
}

/* ---------- 3. A public ledger anyone can read, vs Monero's ---------- */
interface Row { from: string; to: string; amount: string; mine: boolean; born: number }
export function ledgerScene(labels: { from: string; to: string; amount: string; linked: (n: number) => string }) {
  const state = { sealed: false };
  const you = "4Ab9…e21c";
  const hex = () => Math.random().toString(16).slice(2, 6);
  const other = () => `${hex()}…${hex()}`;
  const row = (born: number): Row => {
    const mine = Math.random() < 0.4, sending = Math.random() < 0.5;
    return { from: mine && sending ? you : other(), to: mine && !sending ? you : other(), amount: (Math.random() * 3).toFixed(2), mine, born };
  };
  let rows: Row[] = Array.from({ length: 6 }, () => row(-9)), next = 1, linked = 0;
  const draw = (s: Scene, t: number) => {
    if (t > next) {
      const r = row(t);
      if (r.mine) linked++;
      rows = [r, ...rows].slice(0, 6);
      next = t + 1.6;
    }
    const slide = (1 - ease((t - rows[0].born) / 0.4)) * 7;
    rows.forEach((r, i) => {
      const y = 13 + i * 6.5 - slide;
      if (y > 44) return;
      const highlight = !state.sealed && r.mine;
      s.px(4, y - 2.5, highlight ? "#4a3a33" : i % 2 ? C.bg : C.dim, 88, 6);
      if (highlight) s.px(4, y - 2.5, C.orange, 1, 6);
      const alpha = i === 0 ? ease((t - r.born) / 0.4) : 1;
      if (alpha < 0.5 || y < 11) return;
      if (state.sealed) {
        s.text("••••••", 6, y + 0.5, { size: 3.4, align: "start", color: C.line });
        s.text("••••••", 46, y + 0.5, { size: 3.4, align: "start", color: C.line });
        s.sprite("lock", 88, y - 2, C.orange, C.bg);
        s.text("•••", 86, y + 0.5, { size: 3.4, align: "end", color: C.line });
      } else {
        s.text(r.from, 6, y + 0.5, { size: 3.4, align: "start", color: r.from === you ? C.orange : C.cream });
        s.text("→", 40, y + 0.5, { size: 3.4, color: C.ash });
        s.text(r.to, 46, y + 0.5, { size: 3.4, align: "start", color: r.to === you ? C.orange : C.cream });
        s.text(r.amount, 91, y + 0.5, { size: 3.4, align: "end", color: C.cream });
      }
    });
    s.px(0, 0, C.bg, W, 9);
    s.text(labels.from, 6, 5, { size: 3.2, align: "start" });
    s.text(labels.to, 46, 5, { size: 3.2, align: "start" });
    s.text(labels.amount, 91, 5, { size: 3.2, align: "end" });
    s.px(4, 8, C.line, 88, 1);
    s.px(0, 44, C.bg, W, 10);
    s.px(4, 45, C.line, 88, 1);
    s.sprite("lens", 5, 47, state.sealed ? C.line : C.orange);
    s.text(labels.linked(state.sealed ? 0 : linked), 13, 49.5, { size: 3.4, align: "start", color: state.sealed ? C.ash : C.orange });
  };
  return { draw, state };
}

/* ---------- 4. Ring signatures: one of these past payments is the real one ---------- */
export function ringScene(labels: { valid: string }) {
  const count = 16, state = { picked: -1, pickedAt: 0 };
  const xs = Array.from({ length: count }, (_, i) => 1 + i * 6);
  const draw = (s: Scene, t: number) => {
    ground(s);
    const p = t % 6;
    const shown = p < 2.2 ? Math.floor((p / 2.2) * count) : p < 5.2 ? count : 0;
    const lit = p >= 2.2 && p < 5.2;
    s.px(40, 3, C.cream, 16, 11);
    for (let j = 0; j < 3; j++) s.px(42, 5 + j * 2.5, C.line, 12 - j * 3, 1);
    s.line(43, 12, 52, 12, C.orange);
    xs.forEach((x, i) => {
      if (i < shown) s.line(41 + (i * 14) / (count - 1), 14, x + 2, 38, lit ? "#7a4a2c" : C.graphite);
      const bob = state.picked === i ? -Math.round(Math.abs(Math.sin((t - state.pickedAt) * 8)) * 2 * Math.max(0, 1 - (t - state.pickedAt))) : 0;
      s.sprite("coin", x, 40 + bob, i < shown && lit ? C.orange : C.ash, i < shown && lit ? C.peach : C.cream);
      if (state.picked === i) s.text("?", x + 2.5, 35, { color: C.cream, size: 6 });
    });
    if (lit) { s.sprite("check", 58, 5, C.mint); s.text(labels.valid, 67, 8, { color: C.mint, size: 3.4, align: "start" }); }
  };
  const hit = (x: number, y: number) => (y < 30 ? -1 : xs.findIndex((px) => x >= px - 0.5 && x < px + 5.5));
  return { draw, state, hit, count };
}

/* ---------- 5. Stealth addresses: one-time addresses only your wallet recognizes ---------- */
export function stealthScene(labels: { address: string; blockchain: string }) {
  const cols = 11, rows = 6;
  let boxes: { slot: number; mine: boolean; born: number }[] = [];
  let next = 0;
  return (s: Scene, t: number) => {
    ground(s);
    s.sprite("person", 6, 40, C.orange);
    s.px(12, 35, C.orange, 9, 5);
    s.px(13, 36, C.bg, 7, 1);
    s.px(13, 38, C.flame, 4, 1);
    s.text(labels.address, 3, 30, { size: 3, color: C.orange, align: "start" });
    s.text(labels.blockchain, 58, 4.5, { size: 3.2 });
    s.px(25, 8, C.dim, 67, 38);
    if (t > next) {
      if (boxes.length >= cols * rows * 0.8) boxes = [];
      const free = Array.from({ length: cols * rows }, (_, i) => i).filter((i) => !boxes.some((b) => b.slot === i));
      boxes.push({ slot: free[Math.floor(Math.random() * free.length)], mine: Math.random() < 0.3, born: t });
      next = t + 0.45;
    }
    const cycle = t % 6, scanning = cycle < 3, scan = 25 + (cycle / 3) * 67;
    for (const b of boxes) {
      const x = 27 + (b.slot % cols) * 6, y = 10 + Math.floor(b.slot / cols) * 6;
      const lit = b.mine && cycle < 4.8 && (scan > x || !scanning);
      const pop = t - b.born < 0.2;
      s.px(x, y, pop ? C.cream : lit ? C.orange : C.line, 4, 4);
      s.px(x + 1, y + 1, lit ? C.flame : C.graphite, 2, 1);
    }
    if (scanning) { s.px(scan, 8, C.peach, 1, 38); s.sprite("key", scan - 3, 48, C.peach); }
  };
}

/* ---------- 6. Encrypted amounts that still add up ---------- */
export function balanceScene(labels: { in: string; out: string; fee: string; valid: string }) {
  return (s: Scene, t: number) => {
    const p = t % 7;
    ground(s);
    s.px(46, 20, C.line, 4, 27);
    s.px(42, 45, C.line, 12, 2);
    const left = [p > 0.4, p > 0.9], right = [p > 1.8, p > 2.3, p > 2.8];
    const weight = (left[0] ? 2 : 0) + (left[1] ? 2 : 0) - (right[0] ? 2 : 0) - (right[1] ? 1.6 : 0) - (right[2] ? 0.4 : 0);
    const tilt = Math.max(-4, Math.min(4, weight * 1.2));
    s.line(14, 20 + tilt, 82, 20 - tilt, C.ash);
    s.px(47, 18, C.orange, 2, 2);
    const pan = (cx: number, y: number, boxes: boolean[], sizes: number[], label: string) => {
      s.line(cx - 7, y + 10, cx, y, C.line);
      s.line(cx + 7, y + 10, cx, y, C.line);
      s.px(cx - 8, y + 10, C.ash, 17, 1);
      s.text(label, cx, y + 14, { size: 3.2 });
      let bx = cx - 7;
      boxes.forEach((on, i) => {
        if (!on) return;
        const sz = sizes[i];
        s.px(bx, y + 10 - sz, C.orange, sz, sz);
        if (sz > 3) s.text("?", bx + sz / 2, y + 10 - sz / 2, { size: 3.4, color: C.bg });
        bx += sz + 1;
      });
    };
    pan(14, 20 + tilt, left, [6, 6], labels.in);
    pan(82, 20 - tilt, right, [6, 5, 3], labels.out);
    if (right[2]) s.text(labels.fee, 89, 4 - tilt + 20 - 8, { size: 2.8, color: C.ash });
    if (p > 3.4 && p < 6.5) { s.sprite("check", 44, 4, C.mint); s.text(labels.valid, 48, 13, { size: 3.2, color: C.mint }); }
  };
}

/** A little shop: striped awning, a window and a door. */
function shop(s: Scene, x: number, y: number, stripe: string) {
  for (let i = 0; i < 10; i++) s.px(x + i, y, i % 2 ? C.cream : stripe, 1, 2);
  s.px(x, y + 2, C.line, 10, 7);
  s.px(x + 1, y + 3, C.peach, 3, 2);
  s.px(x + 6, y + 4, C.bg, 3, 5);
}

/* ---------- 7. Fungibility: coins with a history get refused ---------- */
export function fungibleScene(labels: { btc: string; xmr: string; refused: string }) {
  return (s: Scene, t: number) => {
    s.px(0, 26, C.graphite, W, 1);
    s.text(labels.btc, 3, 6, { align: "start", size: 3.6 });
    s.text(labels.xmr, 3, 32, { align: "start", size: 3.6, color: C.orange });
    shop(s, 84, 11, C.ash);
    shop(s, 84, 37, C.orange);
    for (let i = 0; i < 3; i++) {
      const p = ((t + i * 1.4) % 4.2) / 4.2, x = 4 + p * 78;
      const n = Math.floor((t + i * 1.4) / 4.2) * 3 + i;
      const tainted = n % 4 === 1;
      const bounce = tainted && x > 76;
      const tx = bounce ? 76 - (x - 76) * 3 : x;
      s.line(Math.max(0, tx - 14), 16, tx - 1, 16, tainted ? C.red : C.line, 1);
      s.sprite("coin", tx, 14, tainted ? C.red : C.ash, C.cream);
      if (bounce) s.text(labels.refused, 80, 7, { size: 3.2, color: C.red, align: "end" });
      s.sprite("coin", x, 40, C.orange, C.peach);
      if (x > 78) s.sprite("check", 85, 29, C.mint);
    }
  };
}

/* ---------- 8. The seed words open your wallet ---------- */
export function seedScene(labels: { wallet: string }) {
  return (s: Scene, t: number) => {
    const p = t % 8;
    ground(s);
    s.px(8, 4, C.cream, 36, 41);
    s.px(8, 4, C.peach, 36, 1);
    const words = Math.min(16, Math.floor(p / 0.16));
    for (let i = 0; i < words; i++) {
      const x = 11 + (i % 4) * 8, y = 9 + Math.floor(i / 4) * 9;
      s.px(x, y, C.ash, 1, 1);
      s.px(x + 2, y, C.line, 5 - (i % 2), 2);
    }
    const open = p > 4.6;
    s.text(labels.wallet, 77, 9, { size: 3.2 });
    s.px(64, 14, C.line, 26, 32);
    s.px(66, 16, C.bg, 22, 28);
    if (open) {
      for (let i = 0; i < 6; i++) s.sprite("coin", 68 + (i % 3) * 6, 26 + Math.floor(i / 3) * 7 - Math.max(0, Math.round((5.2 - p) * 6)), C.orange, C.peach);
      s.px(88, 16, C.graphite, 4, 28);
    } else {
      s.px(66, 16, C.graphite, 22, 28);
      s.px(84, 28, C.ash, 2, 4);
      if (p > 3) s.sprite("key", lerp(40, 76, (p - 3) / 1.4), 29, C.orange);
    }
  };
}
