import { test } from "node:test";
import assert from "node:assert/strict";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { drawQr, qrPng, qrSvg, type QrStyle } from "./qr.ts";
import { buildUri, EXAMPLE_ADDRESS } from "./monero.ts";

// Decodes our PNG with an independent QR reader.
async function decode(text: string, style: QrStyle, scale: number): Promise<string | undefined> {
  const png = PNG.sync.read(Buffer.from(await qrPng(drawQr(text, style), scale)));
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
}

const URIS = {
  short: buildUri({ address: EXAMPLE_ADDRESS }),
  full: buildUri({ address: EXAMPLE_ADDRESS, amount: "0.25", name: "Ana", description: "Coffee ☕ and cake" }),
  // 200 Japanese characters: 1800 bytes once percent-encoded, forcing weaker error correction.
  long: buildUri({ address: EXAMPLE_ADDRESS, description: "あ".repeat(200) }),
};

for (const style of ["pixel", "plain"] as const) {
  for (const [name, uri] of Object.entries(URIS)) {
    test(`${style} QR decodes back to the ${name} URI at every scale`, async () => {
      for (let scale = 3; scale <= 14; scale++) assert.equal(await decode(uri, style, scale), uri, `scale ${scale}`);
    });
  }
}

test("PNG has a valid signature and the requested size", async () => {
  const d = drawQr(URIS.short);
  const bytes = await qrPng(d, 4);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const png = PNG.sync.read(Buffer.from(bytes));
  assert.equal(png.width, d.size * 4);
});

test("SVG escapes its label", () => {
  assert.match(qrSvg(drawQr(URIS.short), 'a "quoted" <label>'), /aria-label="a &#34;quoted&#34; &#60;label&#62;"/);
});

test("throws when the text cannot fit in any QR code", () => {
  assert.throws(() => drawQr("x".repeat(5000)));
});
