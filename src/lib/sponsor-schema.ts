/* Sponsor data shapes, kept free of config imports so scripts can use them too. */
import { z } from "astro/zod";

export const LIMITS = { name: 40, line: 120, url: 200, contact: 120 } as const;

/** One approved sponsorship. A sponsor (same `sponsor` id) can have several, in different weeks. */
export const sponsorSchema = z.object({
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // the issue (its Monday) it appears in
  // Stable sponsor id, so repeat sponsorships add up. (Not "slug": Astro's loader would
  // use that as the entry id, and a sponsor's sponsorships would overwrite each other.)
  sponsor: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(LIMITS.name),
  line: z.string().min(1).max(LIMITS.line),
  url: z.url().max(LIMITS.url).optional(),
  usd: z.number().min(0), // value when paid; sums set the sponsor's tier (never shown publicly)
});
export type Sponsor = z.infer<typeof sponsorSchema>;

export const requestSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.name),
  line: z.string().trim().min(1).max(LIMITS.line),
  url: z.union([z.literal(""), z.url().max(LIMITS.url).refine((u) => /^https?:\/\//.test(u), "must start with http(s)://")]),
  week: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  amount: z.string().trim().regex(/^\d+(\.\d{1,12})?$/, "must be an XMR amount like 0.1"),
  txid: z.string().trim().regex(/^[0-9a-fA-F]{64}$/, "must be 64 hexadecimal characters"),
  txkey: z.string().trim().regex(/^[0-9a-fA-F]{64,}$/, "must be at least 64 hexadecimal characters"),
  contact: z.string().trim().max(LIMITS.contact),
  accept: z.literal("yes", { message: "the sponsorship rules must be accepted" }),
});
export type SponsorRequest = z.infer<typeof requestSchema>;

/** "Proton Mail" -> "proton-mail" */
export const slugify = (name: string) =>
  name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sponsor";

export interface Tier { key: string; minUsd: number }

/** Tiers may be in any order. */
export const tierOf = <T extends Tier>(tiers: T[], totalUsd: number): T["key"] =>
  [...tiers].sort((a, b) => b.minUsd - a.minUsd).find((t) => totalUsd >= t.minUsd)?.key ?? tiers[0].key;

export interface SponsorSummary<K extends string = string> { id: string; name: string; line: string; url?: string; total: number; times: number; latest: string; tier: K }

/** One entry per sponsor, with the latest name, line and link. */
export function summarizeSponsors<T extends Tier>(all: Sponsor[], tiers: T[]): SponsorSummary<T["key"]>[] {
  const by = new Map<string, Sponsor[]>();
  for (const s of all) by.set(s.sponsor, [...(by.get(s.sponsor) ?? []), s]);
  return [...by.values()].map((list) => {
    const latest = [...list].sort((a, b) => b.week.localeCompare(a.week))[0];
    const total = list.reduce((n, s) => n + s.usd, 0);
    return { id: latest.sponsor, name: latest.name, line: latest.line, url: latest.url, total, times: list.length, latest: latest.week, tier: tierOf(tiers, total) };
  });
}
