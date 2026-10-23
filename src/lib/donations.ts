import type { Locale } from "../i18n/ui";

export const DONATION_CATEGORIES = ["monero", "privacy", "software", "press", "knowledge"] as const;
export type DonationCategory = (typeof DONATION_CATEGORIES)[number];

export interface Donation {
  id: string;
  name: string;
  category: DonationCategory;
  address: string;
  /** The project's own page that shows this address. */
  source: string;
  /** Last day scripts/donations.ts found the address on `source`. */
  checked: string;
  openalias?: string;
  /** Set by scripts/donations.ts when the page loads but no longer shows the address. */
  missing?: boolean;
  /** One short sentence per site language. */
  description: Record<Locale, string>;
}

/** Addresses not confirmed for this long are hidden, even if their page only blocked the checker. */
export const STALE_DAYS = 90;

/** Whether the roulette may offer a project: its address is still on its page and was confirmed recently. */
export function listed(d: Pick<Donation, "checked" | "missing">, today = new Date()): boolean {
  return !d.missing && today.getTime() - new Date(`${d.checked}T00:00:00Z`).getTime() <= STALE_DAYS * 86_400_000;
}

/** A random project from `list`, never `current` when there is another choice. */
export function spin<T extends { id: string }>(list: readonly T[], current?: string, random = Math.random): T | undefined {
  const pool = list.length > 1 ? list.filter((d) => d.id !== current) : list;
  return pool[Math.floor(random() * pool.length)];
}
