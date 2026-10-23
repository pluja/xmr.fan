import { test } from "node:test";
import assert from "node:assert/strict";
import { BADGE_LANGS, BADGE_SIZES, BADGE_TEXTS, BADGE_THEMES, BADGE_WORDS, badgeSvg, badgeTitle, drawBadge } from "./badge.ts";
import { hasGlyphs } from "./pixel-font.ts";

test("the pixel font covers every badge wording", () => {
  for (const lang of BADGE_LANGS) for (const text of BADGE_TEXTS) {
    const { label, line } = BADGE_WORDS[lang][text];
    assert.ok(hasGlyphs(label) && hasGlyphs(line), `${lang} ${text}`);
  }
});

test("badges keep their heights and fit their words", () => {
  const heights = { normal: 56, medium: 40, compact: 28 };
  for (const size of BADGE_SIZES) for (const theme of BADGE_THEMES) {
    const p = drawBadge({ size, theme, text: "accepted", lang: "en" });
    assert.equal(p.h, heights[size]);
  }
  assert.equal(drawBadge({ size: "normal", theme: "light", text: "accepted", lang: "en" }).w, 188);
  assert.ok(drawBadge({ size: "normal", theme: "light", text: "accepted", lang: "fr" }).w > 188);
});

test("corners are cut and the SVG scales without blurring", () => {
  const p = drawBadge({ size: "compact", theme: "dark", text: "pay", lang: "en" });
  assert.equal(p.get(0, 0), null);
  const svg = badgeSvg(p, 2, "XMR");
  assert.match(svg, new RegExp(`width="${p.w * 2}" height="${p.h * 2}"`));
  assert.match(svg, /shape-rendering="crispEdges"/);
});

test("titles read like a sentence", () => {
  assert.equal(badgeTitle({ size: "normal", theme: "light", text: "accepted", lang: "en" }), "We accept Monero");
  assert.equal(badgeTitle({ size: "medium", theme: "light", text: "pay", lang: "en" }), "Pay with Monero");
});
