import { normalizeAmount } from "./monero.ts";
import { validatePayment, type PaymentInput } from "./payment.ts";

export interface CardModel { uri: string; address: string; amount?: string; name?: string; description?: string }

export function cardModel(input: PaymentInput | null): CardModel | null {
  if (!input) return null;
  const r = validatePayment(input);
  if (!r.ok) return null;
  return {
    uri: r.uri,
    address: input.address.trim(),
    amount: normalizeAmount(input.amount ?? "") || undefined,
    name: input.name?.trim() || undefined,
    description: input.description?.trim() || undefined,
  };
}

/** The code from a URL fragment like "#c=AQ…". */
export const codeFromHash = (hash: string) => new URLSearchParams(hash.replace(/^#/, "")).get("c");
