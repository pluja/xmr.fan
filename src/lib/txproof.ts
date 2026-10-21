import { ed25519 } from "@noble/curves/ed25519.js";
import { bytesToHex, bytesToNumberLE, concatBytes, hexToBytes, numberToBytesLE } from "@noble/curves/utils.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { base58Decode, parseAddress } from "./monero.ts";

type Point = InstanceType<typeof ed25519.Point>;
const Point = ed25519.Point;
const L = Point.CURVE().n;
const G = Point.BASE;
const H = Point.fromHex("8b655970153799af2aeadc9ff1add0ea6c7251d54154cfa92c173a0dd39c1f94");
const INV_EIGHT = modL(pow(8n, L - 2n));
const ZERO_KEY = new Uint8Array(32);
const ascii = (s: string) => new TextEncoder().encode(s);

/** Build it with `txFromJson`. */
export interface ProofTx {
  version: number;
  /** 0 = coinbase/no RingCT, 1-3 = old RingCT (32-byte ecdh), 4+ = short ecdh. */
  rctType: number;
  outputs: { key: string; viewTag?: number; amount: bigint }[];
  ecdhInfo: { amount: string; mask?: string }[];
  commitments: string[];
  extra: Uint8Array;
}

export type TxProofError =
  | "bad-tx"
  | "bad-txid"
  | "bad-key"
  | "bad-address"
  | "bad-signature-format"
  | "bad-signature"
  | "no-tx-pubkey"
  | "no-outputs"
  | "commitment-mismatch"
  | "unsupported-tx-type";

export interface ReceivedOutput {
  index: number;
  amount: bigint;
  /** True when amount·H + mask·G equals the output's commitment (always true for public amounts). */
  commitmentOk: boolean;
}

export interface PaymentCheck {
  ok: boolean;
  error?: TxProofError;
  outputs: ReceivedOutput[];
  /** Sum of the outputs whose commitment checks out, in piconero. */
  total: bigint;
}

export interface TxKeyCheck extends PaymentCheck {
  /** Whether r·G (or r·B for a subaddress) is the tx public key in extra; wallets may still use additional keys. */
  txPubKeyMatches?: boolean;
}

export interface TxProofCheck extends PaymentCheck {
  kind?: "out" | "in";
  version?: 1 | 2;
}

const HEX64 = /^[0-9a-fA-F]{64}$/;

export const isTxid = (s: string) => HEX64.test(s.trim());

/** Wallet tx key string -> [main key, ...additional keys] as scalars, or null. */
export function parseTxKey(input: string): bigint[] | null {
  const s = input.trim();
  if (s.length === 0 || s.length % 64 !== 0 || !/^[0-9a-fA-F]+$/.test(s)) return null;
  const keys = s.match(/.{64}/g)!.map((h) => bytesToNumberLE(hexToBytes(h)));
  return keys.every((k) => k < L) ? keys : null;
}

/** Picks what the checks need out of the `as_json` of a `/get_transactions` response. */
export function txFromJson(asJson: unknown): ProofTx | null {
  try {
    const tx = (typeof asJson === "string" ? JSON.parse(asJson) : asJson) as any;
    const rct = tx.rct_signatures ?? { type: 0 };
    const outputs = tx.vout.map((o: any) => {
      const tagged = o.target.tagged_key;
      const key: string = tagged ? tagged.key : o.target.key;
      if (!HEX64.test(key)) throw new Error("output key");
      return { key, amount: BigInt(o.amount), ...(tagged ? { viewTag: parseInt(tagged.view_tag, 16) } : {}) };
    });
    return {
      version: Number(tx.version),
      rctType: Number(rct.type),
      outputs,
      ecdhInfo: rct.ecdhInfo ?? [],
      commitments: rct.outPk ?? [],
      extra: Uint8Array.from(tx.extra),
    };
  } catch {
    return null;
  }
}

export function checkTxKey({ tx, txKey, address }: { tx: ProofTx; txKey: string; address: string }): TxKeyCheck {
  const recipient = recipientKeys(address);
  if (!recipient) return failure("bad-address");
  const keys = parseTxKey(txKey);
  if (!keys || keys.length - 1 > tx.outputs.length) return failure("bad-key");
  const { txPubKeys } = parseExtra(tx.extra);
  const [main, ...additional] = keys.map((r) => mul(recipient.view, r).multiplyUnsafe(8n));
  const scan = scanOutputs(tx, recipient, main, additional);
  const txPubKey = mul(recipient.isSubaddress ? recipient.spend : G, keys[0]).toHex();
  return { ...scan, txPubKeyMatches: txPubKeys.includes(txPubKey) };
}

export function checkTxProof({
  tx, txid, address, message, signature,
}: { tx: ProofTx; txid: string; address: string; message: string; signature: string }): TxProofCheck {
  if (!isTxid(txid)) return failure("bad-txid");
  const recipient = recipientKeys(address);
  if (!recipient) return failure("bad-address");
  const parsed = parseProofSignature(signature);
  if (!parsed) return failure("bad-signature-format");
  const { kind, version, proofs } = parsed;

  const clear = (key: string) => (kind === "in" ? clearTorsion(key) : key);
  const extra = parseExtra(tx.extra);
  const mainKeys = extra.txPubKeys.filter((k) => kind === "in" || k !== bytesToHex(ZERO_KEY)).map(clear);
  const additionalKeys = extra.additionalPubKeys.map(clear);
  if (mainKeys.length === 0) return { ...failure("no-tx-pubkey"), kind, version };
  if (additionalKeys.length + 1 !== proofs.length) return { ...failure("bad-signature-format"), kind, version };

  const prefixHash = keccak_256(concatBytes(hexToBytes(txid.trim()), ascii(message)));
  const B = recipient.isSubaddress ? recipient.spendHex : null;
  const verify = (txPubKey: string, i: number) =>
    kind === "out"
      ? verifyTxProofSig(prefixHash, txPubKey, recipient.viewHex, B, proofs[i], version)
      : verifyTxProofSig(prefixHash, recipient.viewHex, txPubKey, B, proofs[i], version);

  const good = [mainKeys.some((k) => verify(k, 0)), ...additionalKeys.map((k, i) => verify(k, i + 1))];
  if (!good.some(Boolean)) return { ...failure("bad-signature"), kind, version };

  const derivations = proofs.map((p, i) => (good[i] ? Point.fromBytes(p.sharedSecret).multiplyUnsafe(8n) : null));
  const [main, ...additional] = derivations;
  return { ...scanOutputs(tx, recipient, main, additional), kind, version };
}

interface Recipient { spend: Point; view: Point; spendHex: string; viewHex: string; isSubaddress: boolean }

function recipientKeys(address: string): Recipient | null {
  const parsed = parseAddress(address);
  if (!parsed.ok) return null;
  try {
    return {
      spend: Point.fromHex(parsed.publicSpendKey),
      view: Point.fromHex(parsed.publicViewKey),
      spendHex: parsed.publicSpendKey,
      viewHex: parsed.publicViewKey,
      isSubaddress: parsed.type === "subaddress",
    };
  } catch {
    return null;
  }
}

/** wallet2::check_tx_key_helper: finds the recipient's outputs given the 8·r·A derivations. */
export function scanOutputs(
  tx: ProofTx,
  recipient: { spend: Point },
  mainDerivation: Point | null,
  additionalDerivations: (Point | null)[] = [],
): PaymentCheck {
  const ecdhOk = tx.ecdhInfo.length === tx.outputs.length && tx.ecdhInfo.every((e) => tx.rctType >= 4 || e.mask);
  if (tx.rctType > 6 || (tx.rctType > 0 && !ecdhOk)) return failure("unsupported-tx-type");
  const outputs: ReceivedOutput[] = [];
  tx.outputs.forEach((out, index) => {
    const derivation = [mainDerivation, additionalDerivations[index]].find((d) => d && ownsOutput(d, out, index, recipient.spend));
    if (derivation) outputs.push({ index, ...decodeAmount(tx, index, derivationToScalar(derivation, index)) });
  });
  if (outputs.length === 0) return failure("no-outputs");
  const total = outputs.reduce((sum, o) => (o.commitmentOk ? sum + o.amount : sum), 0n);
  const allOk = outputs.every((o) => o.commitmentOk);
  return { ok: allOk, ...(allOk ? {} : { error: "commitment-mismatch" as const }), outputs, total };
}

function ownsOutput(derivation: Point, out: ProofTx["outputs"][number], index: number, spend: Point): boolean {
  if (out.viewTag !== undefined && viewTag(derivation, index) !== out.viewTag) return false;
  return G.multiplyUnsafe(derivationToScalar(derivation, index)).add(spend).toHex() === out.key.toLowerCase();
}

function decodeAmount(tx: ProofTx, index: number, sharedScalar: bigint): Omit<ReceivedOutput, "index"> {
  if (tx.version === 1 || tx.rctType === 0) return { amount: tx.outputs[index].amount, commitmentOk: true };
  const ecdh = tx.ecdhInfo[index];
  const shared = scalarBytes(sharedScalar);
  let mask: bigint;
  let amount: bigint;
  if (tx.rctType >= 4) {
    const pad = keccak_256(concatBytes(ascii("amount"), shared));
    const encrypted = hexToBytes(ecdh.amount.slice(0, 16));
    amount = bytesToNumberLE(encrypted.map((b, i) => b ^ pad[i]));
    mask = hashToScalar(concatBytes(ascii("commitment_mask"), shared));
  } else {
    const s1 = hashToScalar(shared);
    const s2 = hashToScalar(scalarBytes(s1));
    mask = modL(bytesToNumberLE(hexToBytes(ecdh.mask!)) - s1);
    amount = modL(bytesToNumberLE(hexToBytes(ecdh.amount)) - s2);
    if (amount >= 1n << 64n) return { amount, commitmentOk: false };
  }
  const commitment = mul(G, mask).add(mul(H, amount));
  return { amount, commitmentOk: commitment.toHex() === tx.commitments[index]?.toLowerCase() };
}

interface ProofPart { sharedSecret: Uint8Array; c: bigint; r: bigint }

const PROOF_HEADERS = { OutProofV1: ["out", 1], OutProofV2: ["out", 2], InProofV1: ["in", 1], InProofV2: ["in", 2] } as const;
const ENCODED_KEY = 44;
const ENCODED_SIG = 88;

function parseProofSignature(input: string): { kind: "out" | "in"; version: 1 | 2; proofs: ProofPart[] } | null {
  const s = input.replace(/\s+/g, "");
  const header = (Object.keys(PROOF_HEADERS) as (keyof typeof PROOF_HEADERS)[]).find((h) => s.startsWith(h));
  if (!header) return null;
  const body = s.slice(header.length);
  const chunk = ENCODED_KEY + ENCODED_SIG;
  if (body.length === 0 || body.length % chunk !== 0) return null;
  const proofs: ProofPart[] = [];
  for (let at = 0; at < body.length; at += chunk) {
    const sharedSecret = base58Decode(body.slice(at, at + ENCODED_KEY));
    const sig = base58Decode(body.slice(at + ENCODED_KEY, at + chunk));
    if (sharedSecret?.length !== 32 || sig?.length !== 64) return null;
    proofs.push({ sharedSecret, c: bytesToNumberLE(sig.subarray(0, 32)), r: bytesToNumberLE(sig.subarray(32)) });
  }
  const [kind, version] = PROOF_HEADERS[header];
  return { kind, version, proofs };
}

/** crypto::check_tx_proof: Schnorr proof that R = r·G (or r·B) and D = r·A for the same r. */
function verifyTxProofSig(prefixHash: Uint8Array, R: string, A: string, B: string | null, proof: ProofPart, version: 1 | 2): boolean {
  if (proof.c >= L || proof.r >= L) return false;
  try {
    const D = Point.fromBytes(proof.sharedSecret);
    const X = Point.fromHex(R).multiplyUnsafe(proof.c).add(mul(B ? Point.fromHex(B) : G, proof.r));
    const Y = D.multiplyUnsafe(proof.c).add(Point.fromHex(A).multiplyUnsafe(proof.r));
    const parts = [prefixHash, proof.sharedSecret, X.toBytes(), Y.toBytes()];
    if (version === 2) {
      parts.push(keccak_256(ascii("TXPROOF_V2")), hexToBytes(R), hexToBytes(A), B ? hexToBytes(B) : ZERO_KEY);
    }
    return hashToScalar(concatBytes(...parts)) === proof.c;
  } catch {
    return false;
  }
}

function parseExtra(extra: Uint8Array): { txPubKeys: string[]; additionalPubKeys: string[] } {
  const txPubKeys: string[] = [];
  let additionalPubKeys: string[] | undefined;
  let at = 0;
  const varint = () => {
    let n = 0;
    for (let shift = 0; at < extra.length; shift += 7) {
      const b = extra[at++];
      n += (b & 0x7f) * 2 ** shift;
      if (b < 0x80) return n;
    }
    throw new Error("truncated varint");
  };
  const take = (n: number) => {
    if (at + n > extra.length) throw new Error("truncated field");
    return extra.subarray(at, (at += n));
  };
  try {
    while (at < extra.length) {
      const tag = extra[at++];
      if (tag === 0x00) break;
      else if (tag === 0x01) txPubKeys.push(bytesToHex(take(32)));
      else if (tag === 0x04) {
        const keys = Array.from({ length: varint() }, () => bytesToHex(take(32)));
        additionalPubKeys ??= keys;
      } else if (tag === 0x02 || tag === 0x03 || tag === 0xde) take(varint());
      else break;
    }
  } catch {
    // Like parse_tx_extra, keep the fields read before the malformed one.
  }
  return { txPubKeys, additionalPubKeys: additionalPubKeys ?? [] };
}

function derivationToScalar(derivation: Point, index: number): bigint {
  return hashToScalar(concatBytes(derivation.toBytes(), varintBytes(index)));
}

function viewTag(derivation: Point, index: number): number {
  return keccak_256(concatBytes(ascii("view_tag"), derivation.toBytes(), varintBytes(index)))[0];
}

/** pubkey_clear_torsion: (P·8⁻¹)·8 keeps only the prime-order component. */
function clearTorsion(key: string): string {
  try {
    return Point.fromHex(key).multiplyUnsafe(INV_EIGHT).multiplyUnsafe(8n).toHex();
  } catch {
    return Point.ZERO.toHex();
  }
}

function varintBytes(n: number): Uint8Array {
  const out: number[] = [];
  for (; n >= 0x80; n = Math.floor(n / 0x80)) out.push((n % 0x80) | 0x80);
  out.push(n);
  return Uint8Array.from(out);
}

function hashToScalar(data: Uint8Array): bigint {
  return modL(bytesToNumberLE(keccak_256(data)));
}

function scalarBytes(s: bigint): Uint8Array {
  return numberToBytesLE(s, 32);
}

function mul(p: Point, scalar: bigint): Point {
  return p.multiplyUnsafe(modL(scalar));
}

function modL(n: bigint): bigint {
  return ((n % L) + L) % L;
}

function pow(base: bigint, exp: bigint): bigint {
  let result = 1n;
  for (let b = modL(base); exp > 0n; exp >>= 1n, b = (b * b) % L) if (exp & 1n) result = (result * b) % L;
  return result;
}

function failure(error: TxProofError): PaymentCheck {
  return { ok: false, error, outputs: [], total: 0n };
}
