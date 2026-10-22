/* Client side of QrCode.astro. */
import { drawQr, qrSvg } from "../../lib/qr";

/** Draws `text` into a QrCode box, or restores its placeholder when text is empty. Prints in with an
    animation only when the code first appears. */
export function qrBox(root: HTMLElement) {
  const box = root.querySelector<HTMLElement>("[data-qr]") ?? root;
  const placeholder = box.innerHTML;
  let shown = false;
  return (text: string, alt: string) => {
    if (!text) { box.innerHTML = placeholder; box.classList.remove("reveal"); shown = false; return; }
    const drawing = drawQr(text);
    // Module gaps need at least ~7 physical pixels per module, or they blur into gray.
    const gaps = (box.clientWidth / drawing.size) * devicePixelRatio >= 7;
    box.innerHTML = qrSvg(drawing, alt, { gaps });
    box.classList.toggle("reveal", !shown);
    shown = true;
  };
}
