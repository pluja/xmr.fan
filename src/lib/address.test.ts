import { test } from "node:test";
import assert from "node:assert/strict";
import { differences, integratedAddress, joinTxt, openAliasDomain, openAliasRecord, parseOpenAlias, splitIntegrated } from "./address.ts";
import { EXAMPLE_ADDRESS, parseAddress } from "./monero.ts";

const STANDARD = "44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXft3XjrpDtQGv7SqSsaBYBb98uNbr2VBBEt7f2wfn3RVGQBEP3A";

test("integrated address round trip", () => {
  const r = integratedAddress(STANDARD, "0123456789abcdef");
  assert.ok(r.ok);
  const parsed = parseAddress(r.address);
  assert.ok(parsed.ok && parsed.type === "integrated" && parsed.network === "mainnet");
  assert.equal(parsed.ok && parsed.paymentId, "0123456789abcdef");
  assert.deepEqual(splitIntegrated(r.address), { standard: STANDARD, paymentId: "0123456789abcdef" });
});

test("integrated addresses need a standard address and an 8-byte payment ID", () => {
  assert.deepEqual(integratedAddress(EXAMPLE_ADDRESS, "0123456789abcdef"), { ok: false, error: "not_standard" });
  assert.deepEqual(integratedAddress(STANDARD, "0123"), { ok: false, error: "payment_id" });
  assert.deepEqual(integratedAddress("4abc", "0123456789abcdef"), { ok: false, error: "address" });
  assert.equal(splitIntegrated(STANDARD), null);
});

test("OpenAlias records", () => {
  const record = "oa1:xmr recipient_address=888tNk; recipient_name=Monero Development; tx_description=Donation to Monero Core Team;";
  assert.deepEqual(parseOpenAlias(record), { address: "888tNk", name: "Monero Development", description: "Donation to Monero Core Team" });
  assert.equal(parseOpenAlias("oa1:btc recipient_address=1KTex;"), null);
  assert.equal(parseOpenAlias("v=spf1 -all"), null);
  assert.equal(joinTxt('"oa1:xmr recipient_" "address=888;"'), "oa1:xmr recipient_address=888;");
});

test("OpenAlias names", () => {
  assert.equal(openAliasDomain("donate@getmonero.org"), "donate.getmonero.org");
  assert.equal(openAliasDomain(" Donate.GetMonero.org. "), "donate.getmonero.org");
  assert.equal(openAliasDomain("not a domain"), null);
  assert.equal(openAliasDomain(STANDARD), null);
});

test("OpenAlias record text", () => {
  assert.equal(openAliasRecord(" 888tNk "), "oa1:xmr recipient_address=888tNk;");
  assert.equal(openAliasRecord("888tNk", 'Ana; "x"'), "oa1:xmr recipient_address=888tNk; recipient_name=Ana x;");
  assert.deepEqual(parseOpenAlias(openAliasRecord("888tNk", "Ana")), { address: "888tNk", name: "Ana", description: undefined });
});

test("differences between two addresses", () => {
  assert.deepEqual([...differences("44AFFq", "44AXFq")], [3]);
  assert.deepEqual([...differences("abc", "abcd")], [3]);
  assert.equal(differences(STANDARD, STANDARD).size, 0);
});
