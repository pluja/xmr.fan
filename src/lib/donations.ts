export const DONATION_CATEGORIES = ["monero", "privacy", "software", "press"] as const;
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
}

/** A random project from `list`, never `current` when there is another choice. */
export function spin<T extends { id: string }>(list: readonly T[], current?: string, random = Math.random): T | undefined {
  const pool = list.length > 1 ? list.filter((d) => d.id !== current) : list;
  return pool[Math.floor(random() * pool.length)];
}
