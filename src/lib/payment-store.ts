/* Late subscribers immediately receive the latest state. */
import type { PaymentInput } from "./payment.ts";

export interface PaymentState { input: PaymentInput; ok: boolean }

let latest: PaymentState | undefined;
const listeners = new Set<(s: PaymentState) => void>();

export function publishPayment(state: PaymentState) {
  latest = state;
  listeners.forEach((l) => l(state));
}

export function subscribePayment(listener: (s: PaymentState) => void) {
  listeners.add(listener);
  if (latest) listener(latest);
}
