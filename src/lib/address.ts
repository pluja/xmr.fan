import { addressBytes, addressFromBytes, parseAddress } from "./monero.ts";

const INTEGRATED_PREFIX: Record<number, number> = { 18: 19, 53: 54, 24: 25 };
const STANDARD_PREFIX: Record<number, number> = { 19: 18, 54: 53, 25: 24 };
const PAYMENT_ID_RE = /^[0-9a-fA-F]{16}$/;

const fromHex = (s: string) => Uint8Array.from(s.match(/../g)!, (b) => parseInt(b, 16));
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

export type IntegrateError = "address" | "not_standard" | "payment_id";

/** A standard address plus an 8-byte payment ID, as one integrated address. */
export function integratedAddress(standard: string, paymentId: string): { ok: true; address: string } | { ok: false; error: IntegrateError } {
  const body = addressBytes(standard);
  if (!body) return { ok: false, error: "address" };
  const prefix = INTEGRATED_PREFIX[body[0]];
  if (prefix === undefined) return { ok: false, error: "not_standard" };
  if (!PAYMENT_ID_RE.test(paymentId.trim())) return { ok: false, error: "payment_id" };
  const out = new Uint8Array(73);
  out.set(body);
  out[0] = prefix;
  out.set(fromHex(paymentId.trim()), 65);
  return { ok: true, address: addressFromBytes(out) };
}

export function splitIntegrated(integrated: string): { standard: string; paymentId: string } | null {
  const body = addressBytes(integrated);
  if (!body || STANDARD_PREFIX[body[0]] === undefined) return null;
  const standard = body.slice(0, 65);
  standard[0] = STANDARD_PREFIX[body[0]];
  return { standard: addressFromBytes(standard), paymentId: toHex(body.subarray(65, 73)) };
}

export const randomPaymentId = () => toHex(crypto.getRandomValues(new Uint8Array(8)));

// OpenAlias: a Monero address in a DNS TXT record.

export interface OpenAlias { address: string; name?: string; description?: string }

/** Reads an "oa1:xmr recipient_address=…; recipient_name=…;" record; null for other records. */
export function parseOpenAlias(txt: string): OpenAlias | null {
  const record = txt.trim();
  if (!record.startsWith("oa1:xmr ")) return null;
  const fields = new Map<string, string>();
  for (const part of record.slice(8).split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) fields.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
  }
  const address = fields.get("recipient_address");
  if (!address) return null;
  return { address, name: fields.get("recipient_name") || undefined, description: fields.get("tx_description") || undefined };
}

/** "donate@getmonero.org" -> "donate.getmonero.org"; null unless it looks like a domain. */
export function openAliasDomain(input: string): string | null {
  const s = input.trim().toLowerCase().replace("@", ".").replace(/\.$/, "");
  return /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(s) ? s : null;
}

/** Looks the name up over DNS-over-HTTPS. `dnssec` is true when the resolver validated the answer. */
export async function resolveOpenAlias(domain: string): Promise<{ aliases: (OpenAlias & { valid: boolean })[]; dnssec: boolean }> {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=TXT`, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`dns: ${res.status}`);
  const data: { AD?: boolean; Answer?: { type: number; data: string }[] } = await res.json();
  const texts = (data.Answer ?? []).filter((a) => a.type === 16).map((a) => joinTxt(a.data));
  const aliases = texts.map(parseOpenAlias).filter((a): a is OpenAlias => !!a).map((a) => ({ ...a, valid: parseAddress(a.address).ok }));
  return { aliases, dnssec: !!data.AD };
}

/** TXT data comes as one or more quoted strings: "abc" "def" -> abcdef. */
export const joinTxt = (data: string) => (data.match(/"((?:[^"\\]|\\.)*)"/g) ?? [data]).map((s) => s.replace(/^"|"$/g, "").replace(/\\(.)/g, "$1")).join("");

export function openAliasRecord(address: string, name?: string): string {
  const clean = (s: string) => s.replace(/[;"]/g, "").trim();
  return `oa1:xmr recipient_address=${address.trim()};${name?.trim() ? ` recipient_name=${clean(name)};` : ""}`;
}

/** Lengths may differ too. Address poisoning copies the first and last characters. */
export function differences(a: string, b: string): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) out.add(i);
  return out;
}

/** Groups of four characters, for reading an address aloud or comparing it by eye. */
export const addressGroups = (address: string) => address.match(/.{1,4}/g) ?? [];
