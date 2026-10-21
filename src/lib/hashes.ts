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
