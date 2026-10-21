/* Shared by the /uri form (browser) and the /uri API (server). */
import type { Key } from "../i18n/ui.ts";
import { buildUri, normalizeAmount, parseAddress, type ParsedAddress } from "./monero.ts";

export interface PaymentInput {
  address: string;
  amount?: string;
  paymentId?: string;
  name?: string;
  description?: string;
}

export type PaymentField = keyof PaymentInput;

export interface PaymentError {
  field: PaymentField;
  key: Key;
  vars?: Record<string, string | number>;
}

export type PaymentResult =
  | { ok: true; uri: string; address: Extract<ParsedAddress, { ok: true }> }
  | { ok: false; errors: PaymentError[]; address?: ParsedAddress };

export const LIMITS = { name: 100, description: 200 } as const;

const PAYMENT_ID_RE = /^([0-9a-fA-F]{16}|[0-9a-fA-F]{64})$/;

export function validatePayment(input: PaymentInput): PaymentResult {
  const errors: PaymentError[] = [];
  const address = input.address.trim();
  const paymentId = input.paymentId?.trim() ?? "";
  const name = input.name?.trim() ?? "";
  const description = input.description?.trim() ?? "";

  let parsed: ParsedAddress | undefined;
  if (!address) {
    errors.push({ field: "address", key: "err_required" });
  } else {
    parsed = parseAddress(address);
    if (!parsed.ok) errors.push({ field: "address", key: `err_${parsed.error}`, vars: { n: address.length } });
  }

  const amount = normalizeAmount(input.amount ?? "");
  if (amount === null) errors.push({ field: "amount", key: "err_amount" });

  if (paymentId && !PAYMENT_ID_RE.test(paymentId)) {
    errors.push({ field: "paymentId", key: "err_payment_id" });
  } else if (paymentId && parsed?.ok && parsed.type === "integrated") {
    errors.push({ field: "paymentId", key: "err_payment_id_integrated" });
  }

  if (name.length > LIMITS.name) errors.push({ field: "name", key: "err_too_long", vars: { n: LIMITS.name } });
  if (description.length > LIMITS.description) {
    errors.push({ field: "description", key: "err_too_long", vars: { n: LIMITS.description } });
  }

  if (errors.length || !parsed?.ok) return { ok: false, errors, address: parsed };
  return {
    ok: true,
    address: parsed,
    uri: buildUri({ address, amount: amount || undefined, paymentId: paymentId || undefined, name, description }),
  };
}
