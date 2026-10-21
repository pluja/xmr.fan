import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchHash, parseHashes, versionOf } from "../hashes.ts";
import key from "../../data/keys/binaryfate.ts";
import { verifiedText } from "./hashes.ts";

const signed = readFileSync(new URL("../fixtures/hashes-v0.18.5.4.txt", import.meta.url), "utf8");


test("the real hashes.txt verifies with binaryFate's key and parses", async () => {
  const files = parseHashes(await verifiedText(signed, key));
  assert.equal(versionOf(files), "v0.18.5.4");
  assert.equal(files.length, 19);
  const gui = files.find((f) => f.name === "monero-gui-win-x64-v0.18.5.4.zip")!;
  assert.equal(gui.group, "GUI");
  assert.equal(gui.sha256, "0b5cbbe0a1fda5ec487a667cea62599114dca3609acaab436b64a38fa84d449c");
});

test("a tampered list is rejected", async () => {
  const tampered = signed.replace("0b5cbbe0a1fda5ec", "0b5cbbe0a1fda5ed");
  await assert.rejects(verifiedText(tampered, key));
});

test("matching a file", () => {
  const files = parseHashes(signed);
  const hash = "1ccac3b476ba75bf6dfdfa848f6520a79b64cdf3457a160eaa0dad82d5a2a042";
  assert.equal(matchHash(hash.toUpperCase(), "renamed.zip", files).kind, "genuine");
  assert.equal(matchHash("0".repeat(64), "monero-win-x64-v0.18.5.4.zip", files).kind, "mismatch");
  assert.equal(matchHash("0".repeat(64), "something.zip", files).kind, "unknown");
});
