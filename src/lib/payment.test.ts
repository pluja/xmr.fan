import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePayment } from "./payment.ts";
import { EXAMPLE_ADDRESS } from "./monero.ts";

const keys = (r: ReturnType<typeof validatePayment>) => (r.ok ? [] : r.errors.map((e) => `${e.field}:${e.key}`));

test("builds the URI for a valid request", () => {
  const r = validatePayment({ address: ` ${EXAMPLE_ADDRESS} `, amount: "1,50", name: "Ana", description: "Tip" });
  assert.equal(r.ok && r.uri, `monero:${EXAMPLE_ADDRESS}?tx_amount=1.5&recipient_name=Ana&tx_description=Tip`);
});

test("includes a valid payment ID", () => {
  const r = validatePayment({ address: EXAMPLE_ADDRESS, paymentId: "0123456789abcdef" });
  assert.equal(r.ok && r.uri, `monero:${EXAMPLE_ADDRESS}?tx_payment_id=0123456789abcdef`);
});

test("reports every problem at once", () => {
  const r = validatePayment({ address: "", amount: "1.2.3", paymentId: "xyz", name: "n".repeat(101), description: "d".repeat(201) });
  assert.deepEqual(keys(r), [
    "address:err_required", "amount:err_amount", "paymentId:err_payment_id", "name:err_too_long", "description:err_too_long",
  ]);
});

test("reports address problems", () => {
  assert.deepEqual(keys(validatePayment({ address: EXAMPLE_ADDRESS.slice(0, -1) + "X" })), ["address:err_checksum"]);
  assert.deepEqual(keys(validatePayment({ address: "4abc" })), ["address:err_length"]);
});
