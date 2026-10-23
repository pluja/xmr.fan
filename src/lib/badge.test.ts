import { test } from "node:test";
import assert from "node:assert/strict";
import { badgeSize } from "./badge.ts";

test("badges grow with their text and include the drop shadow", () => {
  assert.deepEqual(badgeSize("sticker", 100), { w: 182, h: 118 });
  assert.deepEqual(badgeSize("sticker", 200), { w: 238, h: 118 });
  assert.deepEqual(badgeSize("button", 120), { w: 188, h: 48 });
  assert.deepEqual(badgeSize("compact", 80), { w: 126, h: 32 });
});
