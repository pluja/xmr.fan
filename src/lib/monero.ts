import { keccak_256 } from "@noble/hashes/sha3.js";

/* Monero's base58 encodes 8-byte blocks into 11 characters each.
   The last, shorter block uses the sizes in ENCODED_SIZES. */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BLOCK = 8;
const ENCODED_BLOCK = 11;
const ENCODED_SIZES = [0, 2, 3, 5, 6, 7, 9, 10, 11];

export function base58Decode(s: string): Uint8Array | null {
  const fullBlocks = Math.floor(s.length / ENCODED_BLOCK);
  const lastBytes = ENCODED_SIZES.indexOf(s.length % ENCODED_BLOCK);
  if (lastBytes < 0) return null;
  const out = new Uint8Array(fullBlocks * BLOCK + lastBytes);

  const decodeBlock = (chunk: string, size: number, offset: number): boolean => {
    let n = 0n;
    for (const ch of chunk) {
      const digit = ALPHABET.indexOf(ch);
      if (digit < 0) return false;
      n = n * 58n + BigInt(digit);
    }
    if (n >> BigInt(size * 8) !== 0n) return false; // overflows the block
    for (let i = size - 1; i >= 0; i--) {
      out[offset + i] = Number(n & 0xffn);
      n >>= 8n;
    }
    return true;
  };

  for (let i = 0; i < fullBlocks; i++) {
    const chunk = s.slice(i * ENCODED_BLOCK, (i + 1) * ENCODED_BLOCK);
    if (!decodeBlock(chunk, BLOCK, i * BLOCK)) return null;
  }
  if (lastBytes > 0 && !decodeBlock(s.slice(fullBlocks * ENCODED_BLOCK), lastBytes, fullBlocks * BLOCK)) {
    return null;
  }
  return out;
}

export function base58Encode(bytes: Uint8Array): string {
  const block = (chunk: Uint8Array, size: number) => {
    let n = 0n;
    for (const b of chunk) n = (n << 8n) | BigInt(b);
    let s = "";
    for (let i = 0; i < size; i++) { s = ALPHABET[Number(n % 58n)] + s; n /= 58n; }
    return s;
  };
  const full = Math.floor(bytes.length / BLOCK);
  let out = "";
  for (let i = 0; i < full; i++) out += block(bytes.subarray(i * BLOCK, (i + 1) * BLOCK), ENCODED_BLOCK);
  const rest = bytes.length % BLOCK;
  if (rest) out += block(bytes.subarray(full * BLOCK), ENCODED_SIZES[rest]);
  return out;
}

/** Network byte + keys (+ payment id) -> address, with its checksum. */
export function addressFromBytes(body: Uint8Array): string {
  const checksum = keccak_256(body).subarray(0, 4);
  const all = new Uint8Array(body.length + 4);
  all.set(body);
  all.set(checksum, body.length);
  return base58Encode(all);
}

/** The address's bytes without the checksum, or null if it is not a valid address. */
export function addressBytes(address: string): Uint8Array | null {
  if (!parseAddress(address).ok) return null;
  return base58Decode(address.trim())!.subarray(0, -4);
}

export type Network = "mainnet" | "testnet" | "stagenet";
export type AddressType = "standard" | "subaddress" | "integrated";

// Network byte -> what it means. All of these fit in a single varint byte.
const PREFIXES: Record<number, [Network, AddressType]> = {
  18: ["mainnet", "standard"], 19: ["mainnet", "integrated"], 42: ["mainnet", "subaddress"],
  53: ["testnet", "standard"], 54: ["testnet", "integrated"], 63: ["testnet", "subaddress"],
  24: ["stagenet", "standard"], 25: ["stagenet", "integrated"], 36: ["stagenet", "subaddress"],
};

export type AddressError = "chars" | "length" | "checksum" | "prefix";

export type ParsedAddress =
  | { ok: true; network: Network; type: AddressType; publicSpendKey: string; publicViewKey: string; paymentId?: string }
  | { ok: false; error: AddressError };

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const B58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

export function parseAddress(input: string): ParsedAddress {
  const s = input.trim();
  if (!B58_RE.test(s)) return { ok: false, error: "chars" };
  if (s.length !== 95 && s.length !== 106) return { ok: false, error: "length" };

  const bytes = base58Decode(s);
  if (!bytes) return { ok: false, error: "chars" };

  const body = bytes.subarray(0, -4);
  const checksum = bytes.subarray(-4);
  const expected = keccak_256(body).subarray(0, 4);
  if (!checksum.every((b, i) => b === expected[i])) return { ok: false, error: "checksum" };

  const meta = PREFIXES[bytes[0]];
  if (!meta) return { ok: false, error: "prefix" };
  const [network, type] = meta;
  const expectedLength = type === "integrated" ? 77 : 69;
  if (bytes.length !== expectedLength) return { ok: false, error: "length" };

  return {
    ok: true,
    network,
    type,
    publicSpendKey: hex(bytes.subarray(1, 33)),
    publicViewKey: hex(bytes.subarray(33, 65)),
    ...(type === "integrated" ? { paymentId: hex(bytes.subarray(65, 73)) } : {}),
  };
}

/* Amounts: accept "0.5" and "0,5"; at most 12 decimals (1 piconero). */
export function normalizeAmount(input: string): string | null {
  const s = input.trim().replace(",", ".");
  if (s === "") return "";
  if (!/^\d*\.?\d{0,12}$/.test(s) || s === ".") return null;
  const [int, frac = ""] = s.split(".");
  const i = (int || "0").replace(/^0+(?=\d)/, "");
  const f = frac.replace(/0+$/, "");
  return f ? `${i}.${f}` : i;
}

export function buildUri(p: { address: string; amount?: string; paymentId?: string; name?: string; description?: string }): string {
  const q: string[] = [];
  if (p.amount) q.push(`tx_amount=${encodeURIComponent(p.amount)}`);
  if (p.paymentId) q.push(`tx_payment_id=${encodeURIComponent(p.paymentId)}`);
  if (p.name) q.push(`recipient_name=${encodeURIComponent(p.name)}`);
  if (p.description) q.push(`tx_description=${encodeURIComponent(p.description)}`);
  return `monero:${p.address.trim()}${q.length ? "?" + q.join("&") : ""}`;
}

/* Units: 1 XMR = 10^12 piconero. String math so nothing gets rounded. */
const PICO = 12;

export function xmrToPico(input: string): string | null {
  const s = normalizeAmount(input);
  if (s === null || s === "") return s;
  const [i, f = ""] = s.split(".");
  return (BigInt(i) * 10n ** BigInt(PICO) + BigInt(f.padEnd(PICO, "0"))).toString();
}

export function picoToXmr(input: string): string | null {
  const s = input.trim();
  if (s === "") return "";
  if (!/^\d+$/.test(s)) return null;
  const padded = s.padStart(PICO + 1, "0");
  const i = BigInt(padded.slice(0, -PICO)).toString();
  const f = padded.slice(-PICO).replace(/0+$/, "");
  return f ? `${i}.${f}` : i;
}

// The "try an example" payment: a donation to the Monero General Fund
// (address as listed on getmonero.org/get-started/contributing).
export const EXAMPLE_AMOUNT = "0.1";
export const EXAMPLE_NAME = "Monero General Fund";
export const EXAMPLE_ADDRESS =
  "888tNkZrPN6JsEgekjMnABU4TBzc2Dt29EPAvkRxbANsAnjyPbb3iQ1YBRk1UXcdRsiKc9dhwMVgN5S9cQUiyoogDavup3H";
