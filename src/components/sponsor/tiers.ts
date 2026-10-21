import type { IconName } from "../../lib/pixel";
import type { TierKey } from "../../lib/sponsor";

export const TIER_LOOK: Record<TierKey, { icon: IconName; card: string; badge: string; name: string }> = {
  fan: { icon: "star", card: "border-2 border-graphite bg-cream", badge: "text-graphite", name: "text-ink" },
  bigfan: { icon: "heart", card: "border-2 border-ink bg-cream shadow-[4px_4px_0_var(--color-ink)]", badge: "text-flame", name: "text-ink" },
  superfan: { icon: "crown", card: "border-2 border-ink bg-peach shadow-[6px_6px_0_var(--color-flame)]", badge: "text-flame", name: "text-ink" },
  legend: { icon: "trophy", card: "legend border-2 border-orange bg-ink text-cream shadow-[6px_6px_0_var(--color-flame)]", badge: "text-orange", name: "text-orange" },
};
