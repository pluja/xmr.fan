/* Self-contained share codes for payment requests: everything is in the link,
   nothing is stored anywhere. Works in the browser and on the server.

   Layout (then base64url):
     [0]   version (high 4 bits) | flags (low 4): 1 amount, 2 name, 4 description, 8 payment id
     [1..] the address bytes without its checksum: network byte + 64 key bytes (+ 8 for integrated)
     then, if flagged: amount (LEB128 piconero), payment id (length byte + bytes),
                       name (LEB128 length + UTF-8), description (same) */
import { addressBytes, addressFromBytes, normalizeAmount, picoToXmr, xmrToPico } from "./monero.ts";
import type { PaymentInput } from "./payment.ts";

const VERSION = 1;
const F_AMOUNT = 1, F_NAME = 2, F_DESC = 4, F_PID = 8;
const INTEGRATED = new Set([19, 54, 25]); // network bytes of integrated addresses

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function toBase64url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.min(4, Math.ceil(((bytes.length - i) * 8) / 6));
    for (let j = 0; j < chars; j++) out += B64[(n >> (18 - 6 * j)) & 63];
  }
  return out;
}

function fromBase64url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 4) {
    const chunk = s.slice(i, i + 4);
    let n = 0;
    for (let j = 0; j < 4; j++) n = (n << 6) | (j < chunk.length ? B64.indexOf(chunk[j]) : 0);
    const bytes = Math.floor((chunk.length * 6) / 8);
    for (let j = 0; j < bytes; j++) out.push((n >> (16 - 8 * j)) & 255);
  }
  return new Uint8Array(out);
}

function writeVarint(out: number[], value: bigint) {
  do {
    let byte = Number(value & 0x7fn);
    value >>= 7n;
    if (value > 0n) byte |= 0x80;
    out.push(byte);
  } while (value > 0n);
}

function reader(bytes: Uint8Array) {
  let i = 0;
  const need = (n: number) => { if (i + n > bytes.length) throw new Error("truncated"); };
  return {
    get pos() { return i; },
    take(n: number) { need(n); const b = bytes.subarray(i, i + n); i += n; return b; },
    varint() {
      let v = 0n, shift = 0n;
      for (;;) {
        need(1);
        const b = bytes[i++];
        v |= BigInt(b & 0x7f) << shift;
        if (!(b & 0x80)) return v;
        shift += 7n;
        if (shift > 70n) throw new Error("varint too long");
      }
    },
    done: () => i === bytes.length,
  };
}

const utf8 = new TextEncoder(), fromUtf8 = new TextDecoder("utf-8", { fatal: true });

export function encodeShare(p: PaymentInput): string | null {
  const addr = addressBytes(p.address);
  if (!addr) return null;
  const amount = normalizeAmount(p.amount ?? "");
  const name = p.name?.trim() ?? "", desc = p.description?.trim() ?? "";
  const pid = p.paymentId?.trim() ?? "";
  const flags = (amount ? F_AMOUNT : 0) | (name ? F_NAME : 0) | (desc ? F_DESC : 0) | (pid ? F_PID : 0);

  const out: number[] = [(VERSION << 4) | flags, ...addr];
  if (amount) writeVarint(out, BigInt(xmrToPico(amount)!));
  if (pid) {
    const bytes = pid.match(/../g)!.map((h) => parseInt(h, 16));
    out.push(bytes.length, ...bytes);
  }
  for (const text of [name, desc]) {
    if (!text) continue;
    const bytes = utf8.encode(text);
    writeVarint(out, BigInt(bytes.length));
    out.push(...bytes);
  }
  return toBase64url(new Uint8Array(out));
}

export function decodeShare(code: string): PaymentInput | null {
  const bytes = fromBase64url(code.trim());
  if (!bytes || bytes.length < 66) return null;
  try {
    const r = reader(bytes);
    const [header] = r.take(1);
    if (header >> 4 !== VERSION) return null;
    const flags = header & 15;
    const network = bytes[1];
    const addr = r.take(INTEGRATED.has(network) ? 73 : 65);
    const input: PaymentInput = { address: addressFromBytes(addr) };
    if (flags & F_AMOUNT) input.amount = picoToXmr(r.varint().toString()) ?? undefined;
    if (flags & F_PID) {
      const [len] = r.take(1);
      if (len !== 8 && len !== 32) return null;
      input.paymentId = Array.from(r.take(len), (b) => b.toString(16).padStart(2, "0")).join("");
    }
    if (flags & F_NAME) input.name = fromUtf8.decode(r.take(Number(r.varint())));
    if (flags & F_DESC) input.description = fromUtf8.decode(r.take(Number(r.varint())));
    return r.done() ? input : null;
  } catch {
    return null;
  }
}
