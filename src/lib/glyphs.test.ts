import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GLYPHS } from "./glyph-list.ts";
import { addressGlyphs, glyphText, glyphWords, guessNamespace, message, normalize, type Namespace } from "./glyphs.ts";

const spec = JSON.parse(readFileSync(new URL("../../spec/address-glyphs-v1-vectors.json", import.meta.url), "utf8"));
const list = JSON.parse(readFileSync(new URL("../../spec/address-glyphs-v1-list.json", import.meta.url), "utf8"));

test("the glyph list matches the spec and has no repeats", () => {
  assert.equal(GLYPHS.length, 256);
  list.forEach((g: { index: number; emoji: string; name: string }) => assert.deepEqual(GLYPHS[g.index], [g.emoji, g.name]));
  assert.equal(new Set(GLYPHS.map((g) => g[0])).size, 256);
  assert.equal(new Set(GLYPHS.map((g) => g[1])).size, 256);
});

test("every test vector matches, computed independently with libargon2", () => {
  for (const v of spec.vectors) {
    const ns = v.namespace as Namespace;
    assert.equal(normalize(ns, v.input), v.normalized, v.note);
    assert.equal(message(ns, v.input), v.message, v.note);
    const g = addressGlyphs(ns, v.input);
    assert.deepEqual(g.indices, v.indices, v.note);
    assert.equal(g.emoji.join(""), v.emoji, v.note);
  }
});

test("text and spoken forms split the glyphs into two groups of three", () => {
  const g = { indices: [], emoji: ["🐱", "🚀", "🔑", "🌲", "🌙", "🍕"], names: ["cat", "rocket", "key", "tree", "moon", "pizza"] };
  assert.equal(glyphText(g), "🐱🚀🔑 🌲🌙🍕");
  assert.equal(glyphWords(g), "cat rocket key · tree moon pizza");
});

test("guessing a namespace covers the common formats", () => {
  assert.equal(guessNamespace(spec.vectors[0].input), "monero");
  assert.equal(guessNamespace("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"), "bitcoin");
  assert.equal(guessNamespace("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"), "evm");
  assert.equal(guessNamespace("ltc1qg82tt8x0ch2t9fpkmx6lt7hzgpklx2zy2j4jhv"), "litecoin");
  assert.equal(guessNamespace("hello"), null);
});
