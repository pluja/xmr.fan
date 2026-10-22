/* The little animated pictures of Monero ELI5. Each scene draws on a tiny canvas scaled up into
   chunky pixels, with any words drawn on top at full resolution. Scenes only animate while visible. */

const C = {
  bg: "#2b282d", dim: "#36323a", graphite: "#45404a", line: "#5a5460", ash: "#a39ca8",
  orange: "#fb8c3c", flame: "#ff6600", cream: "#fff1e4", peach: "#ffd2ad", red: "#ff3b30", mint: "#a8e6c1", sky: "#8ecbff", lilac: "#e0b0ff",
};
/** People, told apart by color. */
const PEOPLE = [C.peach, C.mint, C.sky, C.lilac, C.orange, C.cream];
const W = 96, H = 54;

const SPRITES = {
  person: [".###.", ".###.", "..#..", "#####", ".###.", ".#.#.", ".#.#."],
  bank: ["......#......", "....#####....", "..#########..", "#############", ".............", ".#.#.#.#.#.#.", ".#.#.#.#.#.#.", ".#.#.#.#.#.#.", ".............", "#############"],
  eyeOpen: [".###.", "##o##", ".###."],
  eyeShut: [".....", "#####", "....."],
  note: ["####", "#oo#", "####"],
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
    const dt = Math.min(0.05, (now - this.last) / 1000);
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

/* ---------- 1. Paying is passing a note: the bank reads and copies it ---------- */
export function noteScene() {
  return (s: Scene, t: number) => {
    const p = t % 5;
    ground(s);
    s.sprite("person", 8, 40, C.peach);
    s.sprite("person", 83, 40, C.mint);
    s.sprite("bank", 41, 37, C.line);
    const reading = p > 1.5 && p < 2.6;
    s.sprite(reading ? "eyeOpen" : "eyeShut", 45, 30, reading ? C.orange : C.line, C.bg);
    const copies = Math.min(6, Math.floor(t / 5) + (p > 2.1 ? 1 : 0));
    for (let i = 0; i < copies; i++) s.px(56 + (i % 2), 46 - i * 2, C.cream, 4, 1);
    const [x, y] = p < 1.5 ? [lerp(14, 45, p / 1.5), 41 - Math.sin((p / 1.5) * Math.PI) * 8]
      : p < 2.6 ? [45, 41] : p < 4 ? [lerp(45, 78, (p - 2.6) / 1.4), 41 - Math.sin(((p - 2.6) / 1.4) * Math.PI) * 8] : [78, 41];
    if (!reading) s.sprite("note", x, y, C.cream, C.line);
  };
}

/* ---------- 2. Glass wall vs sealed wall ---------- */
interface Note { from: number; to: number; amount: number; born: number }
export function wallScene() {
  const state = { sealed: false };
  const notes: Note[] = Array.from({ length: 12 }, () => randomNote(-10));
  function randomNote(born: number): Note {
    const from = Math.floor(Math.random() * PEOPLE.length);
    return { from, to: (from + 1 + Math.floor(Math.random() * (PEOPLE.length - 1))) % PEOPLE.length, amount: 1 + Math.floor(Math.random() * 4), born };
  }
  let next = 1;
  const draw = (s: Scene, t: number) => {
    s.px(6, 2, C.dim, 84, 37);
    for (let i = 0; i < 6; i++) s.line(10 + i * 16, 36, 20 + i * 16, 5, "#3c3842");
    if (t > next) { notes[Math.floor(Math.random() * notes.length)] = randomNote(t); next = t + 1.2; }
    const traced = Math.floor(t / 2.5) % PEOPLE.length;
    notes.forEach((n, i) => {
      const x = 10 + (i % 4) * 20, y = 5 + Math.floor(i / 4) * 11;
      const fresh = t - n.born < 0.3;
      s.px(x, y, fresh ? C.cream : C.graphite, 17, 8);
      if (state.sealed) {
        for (let j = 0; j < 9; j++) s.px(x + 2 + ((j * 7 + Math.floor(t * 6) * 3) % 10), y + 2 + (j % 4), j % 2 ? C.line : C.ash);
        s.sprite("lock", x + 13, y + 2, C.orange, C.bg);
      } else {
        if (n.from === traced || n.to === traced) { s.px(x - 1, y - 1, C.orange, 19, 1); s.px(x - 1, y + 8, C.orange, 19, 1); s.px(x - 1, y, C.orange, 1, 8); s.px(x + 17, y, C.orange, 1, 8); }
        s.px(x + 2, y + 3, PEOPLE[n.from], 2, 2);
        s.line(x + 5, y + 4, x + 7, y + 4, C.ash);
        s.px(x + 9, y + 3, PEOPLE[n.to], 2, 2);
        for (let a = 0; a < n.amount; a++) s.px(x + 12 + a, y + 2, C.orange, 1, 4 - (a % 2));
      }
    });
    ground(s);
    s.sprite("person", 46, 40, state.sealed ? C.ash : PEOPLE[traced]);
    s.sprite("lens", 51, 38, state.sealed ? C.line : C.cream);
    if (state.sealed) s.text("?", 43, 41, { color: C.cream, size: 6 });
  };
  return { draw, state };
}

/* ---------- 3. Ring signatures: one of the crowd signed, nobody knows who ---------- */
export function ringScene() {
  const crowd = 11, state = { picked: -1, pickedAt: 0 };
  const xs = Array.from({ length: crowd }, (_, i) => 5 + i * 8);
  const draw = (s: Scene, t: number) => {
    ground(s);
    s.px(40, 3, C.cream, 16, 11);
    for (let j = 0; j < 3; j++) s.px(42, 5 + j * 3, C.line, 12 - j * 3, 1);
    s.line(43, 12, 52, 12, C.orange);
    const active = Math.floor(t * 4) % crowd;
    xs.forEach((x, i) => {
      s.line(48, 14, x + 2, 38, i === active ? C.orange : C.dim);
      const bob = state.picked === i ? -Math.round(Math.abs(Math.sin((t - state.pickedAt) * 8)) * 2 * Math.max(0, 1 - (t - state.pickedAt))) : 0;
      s.sprite("person", x, 40 + bob, PEOPLE[i % PEOPLE.length]);
      if (state.picked === i) s.text("?", x + 2.5, 35, { color: C.orange, size: 6 });
    });
  };
  /** The person at a point, or -1. */
  const hit = (x: number, y: number) => (y < 30 ? -1 : xs.findIndex((px) => x >= px - 1.5 && x < px + 6.5));
  return { draw, state, hit };
}

/* ---------- 4. Stealth addresses: each payment lands in a new one-time box only you can spot ---------- */
export function stealthScene() {
  const cols = 11, rows = 7;
  let boxes: { slot: number; mine: boolean; born: number }[] = [];
  let next = 0;
  return (s: Scene, t: number) => {
    ground(s);
    s.sprite("person", 5, 40, C.orange);
    s.px(11, 36, C.orange, 7, 4);
    s.px(12, 37, C.bg, 5, 1);
    s.px(12, 39, C.flame, 3, 1);
    s.px(25, 3, C.dim, 67, 43);
    if (t > next) {
      if (boxes.length >= cols * rows * 0.8) boxes = [];
      const free = Array.from({ length: cols * rows }, (_, i) => i).filter((i) => !boxes.some((b) => b.slot === i));
      boxes.push({ slot: free[Math.floor(Math.random() * free.length)], mine: Math.random() < 0.3, born: t });
      next = t + 0.45;
    }
    const scan = 25 + ((t % 6) / 3) * 67;
    for (const b of boxes) {
      const x = 27 + (b.slot % cols) * 6, y = 5 + Math.floor(b.slot / cols) * 6;
      const lit = b.mine && t % 6 < 4.5 && scan > x;
      const pop = t - b.born < 0.2;
      s.px(x, y, pop ? C.cream : lit ? C.orange : C.line, 4, 4);
      s.px(x + 1, y + 1, lit ? C.flame : C.graphite, 2, 1);
    }
    if (t % 6 < 3) { s.px(scan, 3, C.peach, 1, 43); s.sprite("key", scan - 3, 0, C.peach); }
  };
}

/* ---------- 5. Locked amounts that still balance ---------- */
export function balanceScene() {
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
    const pan = (cx: number, y: number, boxes: boolean[], sizes: number[]) => {
      s.line(cx - 7, y + 10, cx, y, C.line);
      s.line(cx + 7, y + 10, cx, y, C.line);
      s.px(cx - 8, y + 10, C.ash, 17, 1);
      let bx = cx - 7;
      boxes.forEach((on, i) => {
        if (!on) return;
        const sz = sizes[i];
        s.px(bx, y + 10 - sz, C.orange, sz, sz);
        s.px(bx + Math.floor(sz / 2), y + 10 - sz + 1, C.bg, 1, Math.max(1, sz - 3));
        bx += sz + 1;
      });
    };
    pan(14, 20 + tilt, left, [6, 6]);
    pan(82, 20 - tilt, right, [6, 5, 3]);
    if (p > 3.4 && p < 6.5) s.sprite("check", 45, 6, C.mint);
  };
}

/** A little shop: striped awning, a window and a door. */
function shop(s: Scene, x: number, y: number, stripe: string) {
  for (let i = 0; i < 10; i++) s.px(x + i, y, i % 2 ? C.cream : stripe, 1, 2);
  s.px(x, y + 2, C.line, 10, 7);
  s.px(x + 1, y + 3, C.peach, 3, 2);
  s.px(x + 6, y + 4, C.bg, 3, 5);
}

/* ---------- 6. Fungibility: coins with a history get refused ---------- */
export function fungibleScene(labels: { btc: string; xmr: string }) {
  return (s: Scene, t: number) => {
    s.px(0, 26, C.graphite, W, 1);
    s.text(labels.btc, 3, 7, { align: "start", size: 3.6 });
    s.text(labels.xmr, 3, 33, { align: "start", size: 3.6, color: C.orange });
    shop(s, 84, 11, C.ash);
    shop(s, 84, 37, C.orange);
    for (let i = 0; i < 3; i++) {
      const p = ((t + i * 1.4) % 4.2) / 4.2, x = 4 + p * 78;
      const n = Math.floor((t + i * 1.4) / 4.2) + i;
      const tainted = n % 3 === 0;
      const bounce = tainted && x > 76;
      const tx = bounce ? 76 - (x - 76) * 3 : x;
      s.line(Math.max(0, tx - 14), 16, tx - 1, 16, tainted ? C.red : C.line, 1);
      s.sprite("coin", tx, 14, tainted ? C.red : C.ash, C.cream);
      if (bounce) s.sprite("cross", tx, 7, C.red);
      s.sprite("coin", x, 40, C.orange, C.peach);
      if (x > 78) s.sprite("check", 83, 31, C.mint);
    }
  };
}

/* ---------- 7. A network of ordinary computers adding a page every ~2 minutes ---------- */
export function networkScene(minutes: string) {
  const nodes = [[8, 4], [30, 2], [54, 5], [78, 3], [18, 18], [42, 17], [66, 19], [86, 16], [6, 30], [32, 30], [56, 31], [80, 30]];
  const links = nodes.flatMap(([x, y], i) => nodes.map(([x2, y2], j) => [i, j, Math.hypot(x - x2, y - y2)] as const)).filter(([i, j, d]) => i < j && d < 27);
  let pages = 7, born = 0;
  return (s: Scene, t: number) => {
    for (const [i, j] of links) s.line(nodes[i][0] + 3, nodes[i][1] + 3, nodes[j][0] + 3, nodes[j][1] + 3, C.graphite);
    for (let k = 0; k < 4; k++) {
      const [i, j] = links[(Math.floor(t / 0.8) * 7 + k * 5) % links.length];
      const p = (t / 0.8) % 1;
      s.px(lerp(nodes[i][0] + 3, nodes[j][0] + 3, p), lerp(nodes[i][1] + 3, nodes[j][1] + 3, p), C.orange, 2, 2);
    }
    for (const [x, y] of nodes) s.sprite("computer", x, y, C.ash, C.graphite);
    if (t - born > 4) { pages++; born = t; }
    const slide = ease((t - born) / 0.6) * 9;
    for (let i = 0; i < 11; i++) {
      const x = 84 - i * 9 - 9 + slide, newest = i === 0;
      if (x < -8) continue;
      s.px(x, 43, newest ? C.orange : C.line, 7, 8);
      s.px(x + 1, 45, newest ? C.cream : C.graphite, 5, 1);
      s.px(x + 1, 47, newest ? C.cream : C.graphite, 4, 1);
      if (i > 0) s.px(x + 7, 47, C.line, 2, 1);
    }
    s.text(minutes, 88, 39, { size: 3.4, color: C.orange, align: "end" });
    void pages;
  };
}

/* ---------- 8. Your secret words are the key to your money ---------- */
export function keysScene() {
  return (s: Scene, t: number) => {
    const p = t % 8;
    ground(s);
    s.px(8, 4, C.cream, 36, 41);
    const words = Math.min(25, Math.floor(p / 0.12));
    for (let i = 0; i < words; i++) s.px(11 + (i % 5) * 6.5, 7 + Math.floor(i / 5) * 7, C.line, 5, 2);
    const open = p > 4.6;
    const kx = lerp(46, 60, (p - 3.4) / 1.2);
    s.px(64, 14, C.line, 26, 32);
    s.px(66, 16, C.bg, 22, 28);
    if (open) {
      for (let i = 0; i < 6; i++) s.sprite("coin", 68 + (i % 3) * 6, 26 + Math.floor(i / 3) * 7 - Math.max(0, Math.round((5.2 - p) * 6)), C.orange, C.peach);
      s.px(88, 16, C.graphite, 4, 28);
    } else {
      s.px(66, 16, C.graphite, 22, 28);
      s.px(84, 28, C.ash, 2, 4);
    }
    if (p > 3.2 && !open) s.sprite("key", kx, 29, C.orange);
  };
}
