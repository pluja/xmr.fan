import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeShare, decodeShare } from "./share.ts";
import { addressFromBytes, addressBytes, EXAMPLE_ADDRESS } from "./monero.ts";

const STANDARD = "44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXft3XjrpDtQGv7SqSsaBYBb98uNbr2VBBEt7f2wfn3RVGQBEP3A";

test("addresses survive bytes and back, checksum included", () => {
  for (const a of [EXAMPLE_ADDRESS, STANDARD]) assert.equal(addressFromBytes(addressBytes(a)!), a);
  assert.equal(addressBytes("4abc"), null);
});

test("share codes round-trip every field", () => {
  const input = { address: EXAMPLE_ADDRESS, amount: "0.1", name: "Monero General Fund", description: "Donación ☕ コーヒー", paymentId: "0123456789abcdef" };
  const code = encodeShare(input)!;
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeShare(code), input);
});

test("share codes are compact", () => {
  const bare = encodeShare({ address: EXAMPLE_ADDRESS })!;
  const typical = encodeShare({ address: EXAMPLE_ADDRESS, amount: "0.25", name: "Ana", description: "Coffee" })!;
  assert.equal(bare.length, 88);        // 66 bytes, shorter than the 95-character address itself
  assert.ok(typical.length <= 112, `${typical.length}`); // 83 bytes
  assert.deepEqual(decodeShare(bare), { address: EXAMPLE_ADDRESS });
});

test("malformed or tampered codes are rejected", () => {
  const code = encodeShare({ address: EXAMPLE_ADDRESS, amount: "1", name: "x" })!;
  assert.equal(decodeShare("not a code!"), null);
  assert.equal(decodeShare(code.slice(0, 40)), null);
  assert.equal(decodeShare(code + "AAAA"), null);                // trailing junk
  assert.equal(decodeShare("Q" + code.slice(1)), null);          // wrong version
  assert.equal(encodeShare({ address: "4abc" }), null);
});
