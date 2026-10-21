import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ed25519 } from "@noble/curves/ed25519.js";
import { bytesToNumberLE, hexToBytes } from "@noble/curves/utils.js";
import { parseAddress } from "./monero.ts";
import { checkTxKey, checkTxProof, isTxid, parseTxKey, scanOutputs, txFromJson, type ProofTx } from "./txproof.ts";

// Each fixture is { txid, as_json } as returned by a public node's /get_transactions.
function fixture(name: string): { txid: string; tx: ProofTx } {
  const { txid, as_json } = JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
  return { txid, tx: txFromJson(as_json)! };
}

// docs.getmonero.org/rpc-library/wallet-rpc (check_tx_key, check_tx_proof): stagenet, RingCT type 2, subaddress.
const RPC_DOCS = {
  ...fixture("stagenet-19d5089f"),
  txKey: "feba662cf8fb6d0d0da18fc9b70ab28e01cc76311278fdd7fe7ab16360762b06",
  address: "7BnERTpvL5MbCLtj5n9No7J5oE5hHiB3tVCK5cjSvCsYWD2WRJLFuWeKTLiXo5QJqt2ZwUaLy2Vh1Ad51K7FNgqcHgjW85o",
  message: "this is my transaction",
  signature:
    "InProofV13vqBCT6dpSAXkypZmSEMPGVnNRFDX2vscUYeVS4WnSVnV5BwLs31T9q6Etfj9Wts6tAxSAS4gkMeSYzzLS7Gt4vvCSQRh9niGJMUDJsB5hTzb2XJiCkUzWkkcjLFBBRVD5QZ",
  received: 1_000_000_000_000n,
};

// docs.featherwallet.org/guides/formatted-tx-proofs: mainnet, CLSAG (type 5), standard address.
const FEATHER = {
  ...fixture("mainnet-46d9f3ea"),
  address: "463o7kTG4n2AEHNhhV91BK7kZsKd4vRh78xt6LM7Px7o3cp5eZgyuyLHVAWeEkfLcoC78WMZuJ3xZ1SiM4RhbciCB8b8pGS",
  message: "A small donation.",
  signature:
    "OutProofV2SWYVZHfqBwYGNYxDRZryBdXomxA9hS3VLWiRiQZ9YNutAGoq1QxB7j\nAYwRrhoxJBQ8jj7XCNNfvSwgQaVFjWY5EQHJRW3LgPtV3UmefmQ2wFJPh2iTaCH8\nzETWpxTrf2RiVY",
};

// onion-monero-blockchain-explorer README (api/outputs): Monero General Fund, mainnet, RingCT type 1.
const EXPLORER_README = {
  ...fixture("mainnet-17049bc5"),
  address: "44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXft3XjrpDtQGv7SqSsaBYBb98uNbr2VBBEt7f2wfn3RVGQBEP3A",
  viewKey: "f359631075708155cc3d92a32b75a7d02a5dcf27756707b47a2b31b21c389501",
  received: 34_980_000_000_000n,
};

// github.com/Blockchair/Blockchair.Support/issues/1729 (amount in its monero.com / localmonero receipts,
// also what xmrchain.net/api/outputs reports): mainnet, BP+ with view tags (type 6), subaddress.
const BLOCKCHAIR_ISSUE = {
  ...fixture("mainnet-e02085d3"),
  txKey: "b4e94e0030c727c374a51f4f4b8a3f74d9503338cc3a64028c918be9f8e6ec00",
  address: "86bZHZtaaCSb1mAtMbE2xF339YDhoucZu3XDLUpAFJK3X1MA4yY3j8xVKNk2ySfw5AGY2knCAyis7Be7YLZ9cKbsNUKJQT1",
  received: 124_000_000_000n,
};

// github.com/haveno-dex/haveno/issues/2241 (amount per Haveno; xmrchain.net/api/outputs agrees): mainnet, type 6, standard address.
const HAVENO_ISSUE = {
  ...fixture("mainnet-dd994f69"),
  txKey: "3da9070a4fdcee64b7012ddd3a94a835d09d072e4a81d5579ade3e5012002804",
  address: "48ovMffRgPjTR9tjTGxDMY6qdrswcwxdF6yaZAXPVGZLfEdLYW8dRYG4j26jvX2MdQQAhg2447ogTMzuW1Fo4vioGnZc5qJ",
  received: 500_961_430_000n,
};

// github.com/monero-project/monero/issues/6750 (check_tx_key output quoted there): stagenet, type 4, subaddress.
const MONERO_ISSUE_6750 = {
  address: "74wn1gQU5zEGCDco9XPM1H494Z7LJxGcuWe1u6GS2QpXBakL47K9oGpWUQbuSPJ33qBsN3FQ8uftRQ97ZrTC17rjDqVZDG2",
  changeAddress: "53BfKq328TnLjye9PU2qgiHnmbSvayJeef7C2X5LX5dgF4CpjfgzybaKDkJZGw9Vfreng6WRs86o6Btqpw4TJchPGHWU8Cc",
  payments: [
    { ...fixture("stagenet-1e701f4a"), txKey: "bf2e43ad85027610eea97377f6c6d55a8b4a07aa248be4c4a0b6747af3ba5209", received: 9_999_873_540_000n },
    { ...fixture("stagenet-15a0cc30"), txKey: "ee6572fd11495d8332c9eb4943bc660392062f039218a762deeee3dbae38cf0a", received: 1_000_000_000_000n },
  ],
};

// github.com/SlowBearDigger/xmr-pay @26d25ee, demo/public/index.html + test/live-stagenet.js ("faucet sent 0.1"):
// stagenet, type 6, subaddress, empty message.
const XMR_PAY_DEMO = {
  ...fixture("stagenet-787a2f62"),
  address: "75a4WYbeKsdGjdFHqxpgNMSi3oqb1z9yx9m6qvNt3ZbTBpoFnD7EqicUZtCVsQoNPKXF5cMcTLJaTCkYiZVzddby9zc7bFV",
  message: "",
  signature:
    "InProofV2Ew5hfsLrjdgW4nM13ctRu16SjzrbkPLxqSG3LwShzmeaihLci59yPS31f6Ab6wyu23JVTV8JjZFEmb76Q3rD1fBJ65a4dxUnmKTL9CAeutcZdGGtdzjoTaWWTbHJsvMp6VCT",
  received: 100_000_000_000n,
};

const OTHER_MAINNET_ADDRESS =
  "888tNkZrPN6JsEgekjMnABU4TBzc2Dt29EPAvkRxbANsAnjyPbb3iQ1YBRk1UXcdRsiKc9dhwMVgN5S9cQUiyoogDavup3H";

function flipChar(s: string, at: number): string {
  return s.slice(0, at) + (s[at] === "A" ? "B" : "A") + s.slice(at + 1);
}

test("isTxid and parseTxKey validate their input", () => {
  assert.equal(isTxid(RPC_DOCS.txid), true);
  assert.equal(isTxid(RPC_DOCS.txid.slice(1)), false);
  assert.equal(parseTxKey(RPC_DOCS.txKey)?.length, 1);
  assert.equal(parseTxKey(RPC_DOCS.txKey + RPC_DOCS.txKey)?.length, 2);
  assert.equal(parseTxKey(RPC_DOCS.txKey.slice(2)), null);
  assert.equal(parseTxKey("ff".repeat(32)), null, "not a reduced scalar");
});

test("txFromJson reads outputs, ecdh info and extra", () => {
  const { tx } = RPC_DOCS;
  assert.equal(tx.rctType, 2);
  assert.equal(tx.outputs.length, 2);
  assert.equal(tx.ecdhInfo[0].mask?.length, 64);
  assert.equal(FEATHER.tx.rctType, 5);
  assert.equal(FEATHER.tx.ecdhInfo[0].amount.length, 16);
  assert.equal(txFromJson({ nope: true }), null);
});

test("checkTxKey matches the wallet RPC docs example (subaddress, old RingCT)", () => {
  const r = checkTxKey(RPC_DOCS);
  assert.equal(r.ok, true);
  assert.equal(r.total, RPC_DOCS.received);
  assert.deepEqual(r.outputs, [{ index: 1, amount: RPC_DOCS.received, commitmentOk: true }]);
  assert.equal(r.txPubKeyMatches, true);
});

test("checkTxKey rejects a wrong key or address", () => {
  const wrongKey = checkTxKey({ ...RPC_DOCS, txKey: RPC_DOCS.txKey.replace(/^fe/, "fd") });
  assert.deepEqual([wrongKey.ok, wrongKey.error, wrongKey.txPubKeyMatches], [false, "no-outputs", false]);
  assert.equal(checkTxKey({ ...RPC_DOCS, address: OTHER_MAINNET_ADDRESS }).error, "no-outputs");
  assert.equal(checkTxKey({ ...RPC_DOCS, address: "nope" }).error, "bad-address");
  assert.equal(checkTxKey({ ...RPC_DOCS, txKey: "xyz" }).error, "bad-key");
});

test("checkTxProof verifies the wallet RPC docs InProofV1", () => {
  const r = checkTxProof(RPC_DOCS);
  assert.deepEqual([r.ok, r.kind, r.version, r.total], [true, "in", 1, RPC_DOCS.received]);
  assert.equal(checkTxProof({ ...RPC_DOCS, message: "wrong message" }).error, "bad-signature");
});

test("checkTxProof verifies Feather's OutProofV2 (CLSAG)", () => {
  const r = checkTxProof(FEATHER);
  assert.deepEqual([r.ok, r.kind, r.version], [true, "out", 2]);
  assert.equal(r.outputs.length, 1);
  assert.equal(r.outputs[0].commitmentOk, true);
});

test("checkTxProof rejects tampered proofs", () => {
  assert.equal(checkTxProof({ ...FEATHER, message: "A small donation" }).error, "bad-signature");
  assert.equal(checkTxProof({ ...FEATHER, address: OTHER_MAINNET_ADDRESS }).error, "bad-signature");
  assert.equal(checkTxProof({ ...FEATHER, signature: flipChar(FEATHER.signature, 60) }).error, "bad-signature");
  assert.equal(checkTxProof({ ...FEATHER, signature: FEATHER.signature.replace("V2", "V1") }).error, "bad-signature");
  assert.equal(checkTxProof({ ...FEATHER, signature: FEATHER.signature.slice(0, -1) }).error, "bad-signature-format");
  assert.equal(checkTxProof({ ...FEATHER, txid: RPC_DOCS.txid, tx: RPC_DOCS.tx }).error, "bad-signature");
});

test("checkTxKey decodes a BP+ payment to a subaddress (view tags, short ecdh)", () => {
  const r = checkTxKey(BLOCKCHAIR_ISSUE);
  assert.equal(r.ok, true);
  assert.deepEqual(r.outputs, [{ index: 1, amount: BLOCKCHAIR_ISSUE.received, commitmentOk: true }]);
  assert.equal(r.txPubKeyMatches, true);
});

test("checkTxKey decodes a BP+ payment to a standard address", () => {
  const r = checkTxKey(HAVENO_ISSUE);
  assert.deepEqual([r.ok, r.total, r.txPubKeyMatches], [true, HAVENO_ISSUE.received, true]);
  assert.equal(checkTxKey({ ...HAVENO_ISSUE, address: BLOCKCHAIR_ISSUE.address }).error, "no-outputs");
});

test("checkTxKey matches monero#6750 (type 4) and finds nothing for the change address", () => {
  for (const payment of MONERO_ISSUE_6750.payments) {
    const r = checkTxKey({ ...payment, address: MONERO_ISSUE_6750.address });
    assert.deepEqual([r.ok, r.total, r.outputs[0]?.commitmentOk], [true, payment.received, true]);
  }
  const [, second] = MONERO_ISSUE_6750.payments;
  assert.equal(checkTxKey({ ...second, address: MONERO_ISSUE_6750.changeAddress }).error, "no-outputs");
});

test("checkTxKey rejects more additional keys than outputs", () => {
  const { txKey } = BLOCKCHAIR_ISSUE;
  assert.equal(checkTxKey({ ...BLOCKCHAIR_ISSUE, txKey: txKey.repeat(4) }).error, "bad-key");
});

test("checkTxProof verifies an InProofV2 to a subaddress (type 6, empty message)", () => {
  const r = checkTxProof(XMR_PAY_DEMO);
  assert.deepEqual([r.ok, r.kind, r.version, r.total], [true, "in", 2, XMR_PAY_DEMO.received]);
  assert.equal(checkTxProof({ ...XMR_PAY_DEMO, message: " " }).error, "bad-signature");
  assert.equal(checkTxProof({ ...XMR_PAY_DEMO, signature: XMR_PAY_DEMO.signature.replace("InProof", "OutProof") }).error, "bad-signature");
});

test("scanOutputs decodes the explorer README's view-key example (RingCT type 1)", () => {
  const { tx, address, viewKey, received } = EXPLORER_README;
  const view = bytesToNumberLE(hexToBytes(viewKey));
  const txPubKey = ed25519.Point.fromBytes(tx.extra.subarray(1, 33));
  const parsed = parseAddress(address);
  assert.ok(parsed.ok);
  const spend = ed25519.Point.fromHex(parsed.publicSpendKey);
  const r = scanOutputs(tx, { spend }, txPubKey.multiplyUnsafe(view).multiplyUnsafe(8n));
  assert.deepEqual(r.outputs, [{ index: 0, amount: received, commitmentOk: true }]);
});
