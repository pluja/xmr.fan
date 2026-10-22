/* The official list of Monero download hashes (getmonero.org/downloads/hashes.txt). */

export interface HashEntry { name: string; sha256: string; group: string }
export interface HashList { version: string; files: HashEntry[]; signer: string; fingerprint: string; checkedAt: number }

/** Reads "<sha256>  <file>" lines, grouped by the "## CLI" / "## GUI" headings. */
export function parseHashes(text: string): HashEntry[] {
  let group = "";
  const files: HashEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)/);
    if (heading) { group = heading[1].trim(); continue; }
    const m = line.match(/^([0-9a-f]{64})\s+\*?(\S+)$/i);
    if (m) files.push({ sha256: m[1].toLowerCase(), name: m[2], group });
  }
  return files;
}

export const versionOf = (files: HashEntry[]) => files.map((f) => f.name.match(/-(v\d+(?:\.\d+)+)\./)?.[1]).find(Boolean) ?? "";

export type Match =
  | { kind: "genuine"; entry: HashEntry }
  | { kind: "mismatch"; entry: HashEntry }
  | { kind: "unknown" };

/** A hash is genuine if it's in the list; a known file name with another hash is a mismatch. */
export function matchHash(sha256: string, fileName: string | undefined, files: HashEntry[]): Match {
  const hash = sha256.trim().toLowerCase();
  const entry = files.find((f) => f.sha256 === hash);
  if (entry) return { kind: "genuine", entry };
  const named = fileName ? files.find((f) => f.name === fileName) : undefined;
  return named ? { kind: "mismatch", entry: named } : { kind: "unknown" };
}

export const DOWNLOADS_PAGE = "https://www.getmonero.org/downloads/";
export const VERIFY_GUIDE = "https://www.getmonero.org/resources/user-guides/verification-allos-advanced.html";

const OS: Record<string, string> = { win: "Windows", mac: "macOS", linux: "Linux", android: "Android", freebsd: "FreeBSD" };
const ARCH: Record<string, string> = { x64: "x64", x86: "x86", armv7: "ARMv7", armv8: "ARM64", riscv64: "RISC-V" };

export interface FileInfo { kind: "gui" | "cli" | "source"; os: string; platform: string; installer: boolean }

/** "monero-gui-install-win-x64-v0.18.5.4.exe" -> GUI, Windows, "Windows x64", installer. */
export function describeFile(name: string): FileInfo {
  const parts = name.replace(/-v\d[\d.]*\..*$/, "").split("-").slice(1);
  const gui = parts[0] === "gui";
  if (gui) parts.shift();
  const installer = parts[0] === "install";
  if (installer) parts.shift();
  if (parts[0] === "source") return { kind: "source", os: "Source", platform: "Source", installer: false };
  const os = OS[parts[0]] ?? parts[0];
  const arch = parts[0] === "mac" && parts[1] === "armv8" ? "Apple silicon" : parts[0] === "mac" && parts[1] === "x64" ? "Intel" : ARCH[parts[1]] ?? parts[1] ?? "";
  return { kind: gui ? "gui" : "cli", os, platform: `${os} ${arch}`.trim(), installer };
}

/** The official mirror keeps CLI files under /cli/ and GUI files under /gui/. */
export const downloadUrl = (name: string) => `https://downloads.getmonero.org/${name.startsWith("monero-gui-") ? "gui" : "cli"}/${name}`;
