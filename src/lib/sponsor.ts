/* Sponsorships: pay what you want from a minimum, approved by hand; everything a
   sponsor gives adds up to a lasting tier.
   - src/data/sponsorship.json: payment address, minimum and tiers (empty address = not open yet).
   - src/data/sponsors/*.json: approved sponsorships (see scripts/sponsor.ts).
   - Requests from the form are stored outside the site (SPONSOR_REQUESTS_DIR). */
import { z } from "astro/zod";
import config from "../data/sponsorship.json";
import { parseAddress } from "./monero.ts";
import { summarizeSponsors, type Sponsor } from "./sponsor-schema.ts";

export * from "./sponsor-schema.ts";

export const sponsorshipSchema = z.object({
  address: z.string(),
  minUsd: z.number().positive(),
  tiers: z.array(z.object({ key: z.enum(["fan", "bigfan", "superfan", "legend"]), minUsd: z.number().min(0) })).min(1),
});
export const sponsorship = sponsorshipSchema.parse(config);
export type TierKey = (typeof sponsorship.tiers)[number]["key"];

/** Open only once a valid mainnet address is configured. */
export const sponsorshipOpen = (() => {
  const a = parseAddress(sponsorship.address);
  return a.ok && a.network === "mainnet";
})();

export const summarize = (all: Sponsor[]) => summarizeSponsors(all, sponsorship.tiers);
