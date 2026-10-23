import { test } from "node:test";
import assert from "node:assert/strict";
import { badgeSize, pixelSize } from "./badge.ts";

test("badges grow with their longest line and leave room for the shadow", () => {
  assert.deepEqual(badgeSize("classic", 200, 150), { w: 434, h: 148 });
  assert.deepEqual(badgeSize("classic", 200, 260), { w: 494, h: 148 });
  assert.deepEqual(badgeSize("pill", 100, 80), { w: 222, h: 84 });
});

test("the pixel sticker keeps a minimum width", () => {
  assert.deepEqual(pixelSize(100), { w: 182, h: 118 });
  assert.deepEqual(pixelSize(200), { w: 238, h: 118 });
});
