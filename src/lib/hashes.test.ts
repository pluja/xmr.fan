import { test } from "node:test";
import assert from "node:assert/strict";
import { describeFile, downloadUrl, matchHash } from "./hashes.ts";

test("file names describe the build", () => {
  assert.deepEqual(describeFile("monero-gui-install-win-x64-v0.18.5.4.exe"), { kind: "gui", os: "Windows", platform: "Windows x64", installer: true });
  assert.deepEqual(describeFile("monero-gui-mac-armv8-v0.18.5.4.dmg"), { kind: "gui", os: "macOS", platform: "macOS Apple silicon", installer: false });
  assert.equal(describeFile("monero-linux-riscv64-v0.18.5.4.tar.bz2").platform, "Linux RISC-V");
  assert.equal(describeFile("monero-android-armv8-v0.18.5.4.tar.bz2").kind, "cli");
  assert.equal(describeFile("monero-gui-source-v0.18.5.4.tar.bz2").kind, "source");
  assert.equal(describeFile("monero-source-v0.18.5.4.tar.bz2").kind, "source");
});

test("downloads point at the official mirror", () => {
  assert.equal(downloadUrl("monero-gui-mac-x64-v0.18.5.4.dmg"), "https://downloads.getmonero.org/gui/monero-gui-mac-x64-v0.18.5.4.dmg");
  assert.equal(downloadUrl("monero-win-x64-v0.18.5.4.zip"), "https://downloads.getmonero.org/cli/monero-win-x64-v0.18.5.4.zip");
});

test("a known name with another hash is a mismatch", () => {
  const files = [{ name: "a.zip", sha256: "aa".repeat(32), group: "CLI" }];
  assert.equal(matchHash("AA".repeat(32), undefined, files).kind, "genuine");
  assert.equal(matchHash("bb".repeat(32), "a.zip", files).kind, "mismatch");
  assert.equal(matchHash("bb".repeat(32), "b.zip", files).kind, "unknown");
});
