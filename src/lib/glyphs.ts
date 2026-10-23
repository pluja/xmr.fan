/* Address Glyphs v1, reference implementation. See spec/address-glyphs-v1.md.
   An address becomes six glyphs: Argon2id over the normalized address, one byte per glyph. */
import { argon2id } from "@noble/hashes/argon2.js";
import { GLYPHS } from "./glyph-list.ts";

export const NAMESPACES = ["monero", "bitcoin", "litecoin", "evm", "solana"] as const;
export type Namespace = (typeof NAMESPACES)[number];

export const VERSION = 1;
export const GLYPH_COUNT = 6;
/** Exactly 16 bytes, as libsodium's crypto_pwhash requires. */
export const SALT = "AddressGlyphs-v1";
/** Argon2id cost: 16 MiB of memory, two passes, one lane (libsodium's only option). */
export const ARGON2 = { t: 2, m: 16384, p: 1, dkLen: 32 } as const;

const BECH32_PREFIXES: Partial<Record<Namespace, string[]>> = {
  bitcoin: ["bc1", "tb1", "bcrt1"],
  litecoin: ["ltc1", "tltc1", "rltc1"],
};

/**
 * The canonical form of an address, so every wallet hashes the same string: surrounding whitespace removed,
 * case-insensitive formats (bech32, EVM hex) lowercased, everything else left exactly as written.
 */
export function normalize(namespace: Namespace, address: string): string {
  const a = address.trim();
  if (namespace === "evm") {
    if (!/^0x[0-9a-fA-F]{40}$/.test(a)) throw new Error("not an EVM address");
    return a.toLowerCase();
  }
  const lower = a.toLowerCase();
  if (BECH32_PREFIXES[namespace]?.some((p) => lower.startsWith(p))) return lower;
  return a;
}

/** The exact bytes that go into Argon2id as the password. */
export const message = (namespace: Namespace, address: string) => `glyphs/${VERSION}:${namespace}:${normalize(namespace, address)}`;

export interface Glyphs {
  indices: number[];
  emoji: string[];
  names: string[];
}

export function addressGlyphs(namespace: Namespace, address: string): Glyphs {
  const encode = (s: string) => new TextEncoder().encode(s);
  const hash = argon2id(encode(message(namespace, address)), encode(SALT), ARGON2);
  const indices = [...hash.subarray(0, GLYPH_COUNT)];
  return { indices, emoji: indices.map((i) => GLYPHS[i][0]), names: indices.map((i) => GLYPHS[i][1]) };
}

/** The shareable text form: two groups of three, like "🐱🚀🔑 🌲🌙🍕". */
export const glyphText = (g: Glyphs) => `${g.emoji.slice(0, 3).join("")} ${g.emoji.slice(3).join("")}`;
/** The spoken form, for screen readers and phone calls: "cat rocket key · tree moon pizza". */
export const glyphWords = (g: Glyphs, names = g.names) => `${names.slice(0, 3).join(" ")} · ${names.slice(3).join(" ")}`;

/** Best guess at which chain an address belongs to, for tools that take any address. Not part of the spec. */
export function guessNamespace(address: string): Namespace | null {
  const a = address.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return "evm";
  if (/^[48579AB][1-9A-HJ-NP-Za-km-z]{94}([1-9A-HJ-NP-Za-km-z]{11})?$/.test(a)) return "monero";
  const lower = a.toLowerCase();
  if (/^(bc1|tb1|bcrt1)[02-9ac-hj-np-z]{8,87}$/.test(lower) || /^[13mn2][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a)) return "bitcoin";
  if (/^(ltc1|tltc1|rltc1)[02-9ac-hj-np-z]{8,87}$/.test(lower) || /^[LM][1-9A-HJ-NP-Za-km-z]{26,33}$/.test(a)) return "litecoin";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return "solana";
  return null;
}
