import { test } from "node:test";
import assert from "node:assert/strict";
import { cardModel, codeFromHash } from "./card.ts";
import { EXAMPLE_ADDRESS } from "./monero.ts";
import { decodeShare, encodeShare } from "./share.ts";

test("a share code becomes a card", () => {
  const code = encodeShare({ address: EXAMPLE_ADDRESS, amount: "0.10", name: " Fund " })!;
  const card = cardModel(decodeShare(codeFromHash(`#c=${code}`)!))!;
  assert.equal(card.address, EXAMPLE_ADDRESS);
  assert.equal(card.amount, "0.1");
  assert.equal(card.name, "Fund");
  assert.equal(card.description, undefined);
  assert.match(card.uri, /^monero:888tNk.*tx_amount=0\.1/);
});

test("no card without a valid request", () => {
  assert.equal(cardModel(null), null);
  assert.equal(cardModel({ address: "4abc" }), null);
  assert.equal(codeFromHash(""), null);
  assert.equal(codeFromHash("#x=1"), null);
});
