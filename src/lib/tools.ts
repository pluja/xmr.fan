import type { Key } from "../i18n/ui.ts";
import type { IconName } from "./pixel.ts";

export interface Tool {
  id: "uri" | "proof" | "addr" | "units" | "gazette" | "dl" | "fee" | "node" | "height" | "mining" | "tx" | "donate" | "fan" | "beat";
  /** Short, shareable URL: xmr.fan/<slug> (and xmr.fan/<lang>/<slug>). */
  slug: string;
  icon: IconName;
  /** false = shown as "Soon"; its URL is reserved but not built yet. */
  live: boolean;
  /** When it went live, for the new-tools feed. */
  added: string;
}

export const TOOLS: Tool[] = [
  { id: "uri", slug: "uri", icon: "qr", live: true, added: "2026-10-19" },
  { id: "proof", slug: "verify", icon: "check", live: true, added: "2026-10-20" },
  { id: "tx", slug: "tx", icon: "swap", live: true, added: "2026-10-20" },
  { id: "addr", slug: "address", icon: "lens", live: true, added: "2026-10-20" },
  { id: "units", slug: "units", icon: "scale", live: true, added: "2026-10-19" },
  { id: "fee", slug: "fee", icon: "coin", live: true, added: "2026-10-20" },
  { id: "height", slug: "height", icon: "calendar", live: true, added: "2026-10-20" },
  { id: "dl", slug: "checksum", icon: "shield", live: true, added: "2026-10-20" },
  { id: "node", slug: "node", icon: "node", live: true, added: "2026-10-20" },
  { id: "mining", slug: "mining", icon: "trophy", live: true, added: "2026-10-20" },
  { id: "donate", slug: "donate", icon: "heart", live: true, added: "2026-10-21" },
  { id: "fan", slug: "fan", icon: "crown", live: true, added: "2026-10-21" },
  { id: "beat", slug: "beat", icon: "sound", live: true, added: "2026-10-21" },
  { id: "gazette", slug: "news", icon: "paper", live: true, added: "2026-10-19" },
];

export const toolPath = (t: Tool) => `/${t.slug}`;

/** /uri has its own route because it also serves an API. */
const OWN_ROUTE: Tool["id"][] = ["gazette", "uri"];

export const TOOL_PAGES = TOOLS.filter((t) => t.live && !OWN_ROUTE.includes(t.id));

export const getTool = (id: Tool["id"]) => TOOLS.find((t) => t.id === id)!;

export const titleKey = (t: Tool) => `t_${t.id}` as Key;
export const descKey = (t: Tool) => `d_${t.id}` as Key;
export const seoTitleKey = (t: Tool) => `seo_title_${t.id}` as Key;
export const seoDescKey = (t: Tool) => `seo_desc_${t.id}` as Key;
