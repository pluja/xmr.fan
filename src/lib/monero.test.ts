import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAddress, buildUri, normalizeAmount, xmrToPico, picoToXmr, EXAMPLE_ADDRESS } from "./monero.ts";

const GENERAL_FUND_PRIMARY =
  "44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXft3XjrpDtQGv7SqSsaBYBb98uNbr2VBBEt7f2wfn3RVGQBEP3A";

test("accepts a real mainnet subaddress", () => {
  const r = parseAddress(EXAMPLE_ADDRESS);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.network, "mainnet");
    assert.equal(r.type, "subaddress");
    assert.equal(r.publicSpendKey.length, 64);
  }
});

test("accepts a real mainnet standard address", () => {
  const r = parseAddress(GENERAL_FUND_PRIMARY);
  assert.deepEqual(r.ok && [r.network, r.type], ["mainnet", "standard"]);
});

test("ignores surrounding whitespace", () => {
  assert.equal(parseAddress(`  ${EXAMPLE_ADDRESS}\n`).ok, true);
});

test("detects a one-character typo via the checksum", () => {
  const typo = EXAMPLE_ADDRESS.slice(0, 40) + (EXAMPLE_ADDRESS[40] === "a" ? "b" : "a") + EXAMPLE_ADDRESS.slice(41);
  assert.deepEqual(parseAddress(typo), { ok: false, error: "checksum" });
});

test("rejects bad characters and lengths", () => {
  assert.deepEqual(parseAddress("0OIl" + EXAMPLE_ADDRESS.slice(4)), { ok: false, error: "chars" });
  assert.deepEqual(parseAddress(EXAMPLE_ADDRESS.slice(0, 90)), { ok: false, error: "length" });
  assert.deepEqual(parseAddress("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"), { ok: false, error: "chars" });
});

test("builds a monero: URI with encoded parameters", () => {
  assert.equal(
    buildUri({ address: "4abc", amount: "0.5", name: "Ana & Bo", description: "コーヒー" }),
    "monero:4abc?tx_amount=0.5&recipient_name=Ana%20%26%20Bo&tx_description=%E3%82%B3%E3%83%BC%E3%83%92%E3%83%BC",
  );
  assert.equal(buildUri({ address: "4abc" }), "monero:4abc");
});

test("normalizes amounts", () => {
  assert.equal(normalizeAmount("0,50"), "0.5");
  assert.equal(normalizeAmount("007"), "7");
  assert.equal(normalizeAmount(".25"), "0.25");
  assert.equal(normalizeAmount(""), "");
  assert.equal(normalizeAmount("1.0000000000001"), null); // 13 decimals
  assert.equal(normalizeAmount("abc"), null);
  assert.equal(normalizeAmount("-1"), null);
});

test("converts units exactly", () => {
  assert.equal(xmrToPico("1.5"), "1500000000000");
  assert.equal(xmrToPico("0.000000000001"), "1");
  assert.equal(xmrToPico("18446744.073709551616"), "18446744073709551616");
  assert.equal(picoToXmr("1"), "0.000000000001");
  assert.equal(picoToXmr("1500000000000"), "1.5");
  assert.equal(picoToXmr("12x"), null);
});
