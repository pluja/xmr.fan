import { readStrings } from "../../i18n/format";
import { cardModel, codeFromHash, type CardModel } from "../../lib/card";
import { drawQr, GAP, qrSvg } from "../../lib/qr";
import { decodeShare } from "../../lib/share";

export const cardFromLocation = (): CardModel | null => {
  const code = codeFromHash(location.hash);
  return code ? cardModel(decodeShare(code)) : null;
};

export function mountCard(root: HTMLElement, card: CardModel) {
  const t = readStrings(root);
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  $("[data-name]").textContent = card.name ?? "";
  $("[data-amount]").textContent = card.amount ? `${card.amount} XMR` : "";
  $("[data-desc]").textContent = card.description ?? "";
  $("[data-address]").textContent = card.address;
  $<HTMLAnchorElement>("[data-open]").href = card.uri;
  root.hidden = false;

  const qrBox = $("[data-qr]");
  const drawing = drawQr(card.uri);
  // Module gaps need ~7 physical pixels per module, or they blur into gray.
  qrBox.innerHTML = qrSvg(drawing, t("qr_alt"), { gaps: (qrBox.clientWidth / drawing.size) * devicePixelRatio >= 7 });

  const copy = $<HTMLButtonElement>("[data-copy]"), label = copy.querySelector("span")!;
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(card.address); } catch { getSelection()?.selectAllChildren($("[data-address]")); return; }
    label.textContent = t("copied");
    setTimeout(() => (label.textContent = t("card_copy_address")), 1400);
  });
  $("[data-download]").addEventListener("click", () => downloadCard(card, t));
}

const C = { ink: "#2b282d", orange: "#fb8c3c", flame: "#ff6600", cream: "#fff1e4", graphite: "#45404a" };
const PIXEL = "'DotGothic16', monospace", SANS = "'Manrope Variable', system-ui, sans-serif", MONO = "ui-monospace, Menlo, monospace";

/** Breaks by words, or anywhere for addresses. */
function wrap(ctx: CanvasRenderingContext2D, font: string, text: string, width: number, anywhere = false): string[] {
  ctx.font = font;
  const parts = anywhere || !/\s/.test(text) ? [...text] : text.split(/(\s+)/);
  const lines: string[] = [];
  let line = "";
  for (const p of parts) {
    if (line && ctx.measureText(line + p).width > width) { lines.push(line.trimEnd()); line = p.trimStart(); }
    else line += p;
  }
  return line ? [...lines, line] : lines;
}

async function downloadCard(card: CardModel, t: (k: string) => string) {
  await Promise.all([`30px ${PIXEL}`, `22px ${SANS}`].map((f) => document.fonts.load(f)));
  const W = 800, P = 44, inner = W - 2 * P, SHADOW = 12, BAR = 76;
  const ctx = document.createElement("canvas").getContext("2d")!;

  type Line = { text: string; font: string; color: string; h: number };
  const block = (text: string | undefined, font: string, color: string, h: number, anywhere = false): Line[] =>
    text ? wrap(ctx, font, text, inner, anywhere).map((l) => ({ text: l, font, color, h })) : [];
  const head = [
    ...block(card.name, `34px ${PIXEL}`, C.ink, 46),
    ...block(card.amount && `${card.amount} XMR`, `52px ${PIXEL}`, C.flame, 66),
    ...block(card.description, `22px ${SANS}`, C.graphite, 32),
  ];
  const tail = [...block(card.address, `18px ${MONO}`, C.ink, 26, true), { text: "", font: "", color: "", h: 18 }, ...block(t("card_made"), `20px ${PIXEL}`, C.graphite, 28)];
  const sum = (ls: Line[]) => ls.reduce((n, l) => n + l.h, 0);
  const H = BAR + P + sum(head) + (head.length ? 24 : 0) + inner + 28 + sum(tail) + P;

  const canvas = ctx.canvas;
  canvas.width = W + SHADOW; canvas.height = H + SHADOW;
  ctx.fillStyle = C.ink; ctx.fillRect(SHADOW, SHADOW, W, H);
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.cream; ctx.fillRect(4, 4, W - 8, H - 8);
  ctx.fillStyle = C.ink; ctx.fillRect(4, 4, W - 8, BAR - 4);
  ctx.fillStyle = C.orange; ctx.font = `30px ${PIXEL}`; ctx.textBaseline = "middle"; ctx.fillText(t("card_title"), P, BAR / 2 + 2);

  ctx.textBaseline = "top";
  const draw = (ls: Line[], y: number) => {
    for (const l of ls) { if (l.text) { ctx.font = l.font; ctx.fillStyle = l.color; ctx.fillText(l.text, P, y); } y += l.h; }
    return y;
  };
  let y = draw(head, BAR + P) + (head.length ? 24 : 0);

  const qr = drawQr(card.uri);
  const m = inner / qr.size;
  ctx.fillStyle = qr.palette[0]; ctx.fillRect(P, y, inner, inner);
  for (const s of qr.shapes) {
    const g = s.gap ? GAP : 0;
    ctx.fillStyle = qr.palette[s.c];
    // Whole pixels keep the modules crisp.
    const x0 = Math.round(P + (s.x + g) * m), y0 = Math.round(y + (s.y + g) * m);
    ctx.fillRect(x0, y0, Math.round(P + (s.x + s.w - g) * m) - x0, Math.round(y + (s.y + s.h - g) * m) - y0);
  }
  ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.strokeRect(P - 2, y - 2, inner + 4, inner + 4);
  draw(tail, y + inner + 28);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const slug = (card.name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `monero-payment-card${slug ? `-${slug}` : ""}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }, "image/png");
}
