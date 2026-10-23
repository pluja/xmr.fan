import type { Key } from "../i18n/ui.ts";
import type { IconName } from "./pixel.ts";

export interface Tool {
  id: "uri" | "proof" | "addr" | "units" | "gazette" | "dl" | "fee" | "node" | "height" | "mining" | "tx" | "donate" | "beat" | "live" | "eli5" | "pool";
  /** Short, shareable URL: xmr.fan/<slug> (and xmr.fan/<lang>/<slug>). */
  slug: string;
  icon: IconName;
  /** false = shown as "Soon"; its URL is reserved but not built yet. */
  live: boolean;
  /** When it went live, for the new-tools feed. */
  added: string;
  /** Column on the home page. */
  group?: ToolGroup;
  /** Uses the wide dark frame (being rolled out tool by tool). */
  dark?: boolean;
}

/** The tool after this one in the list, wrapping around; the newsletter is skipped. */
export function nextTool(tool: Tool): Tool {
  const tools = TOOLS.filter((t) => t.live && t.id !== "gazette");
  return tools[(tools.findIndex((t) => t.id === tool.id) + 1) % tools.length];
}

/** Social share card for a page, drawn by `npm run og`. */
export const ogImage = (lang: string, page: string) => `/og/${lang}/${page}.png`;

export const TOOL_GROUPS = ["paid", "wallet", "numbers", "fun"] as const;
export type ToolGroup = (typeof TOOL_GROUPS)[number];

export const TOOLS: Tool[] = [
  { id: "eli5", slug: "eli5", icon: "bulb", live: true, added: "2026-10-22", group: "fun", dark: true },
  { id: "uri", slug: "uri", icon: "qr", live: true, added: "2026-10-19", group: "paid" },
  { id: "proof", slug: "verify", icon: "check", live: true, added: "2026-10-20", group: "paid", dark: true },
  { id: "tx", slug: "tx", icon: "hourglass", live: true, added: "2026-10-20", group: "paid", dark: true },
  { id: "addr", slug: "address", icon: "lens", live: true, added: "2026-10-20", group: "wallet", dark: true },
  { id: "units", slug: "units", icon: "swap", live: true, added: "2026-10-19", group: "numbers", dark: true },
  { id: "fee", slug: "fee", icon: "tag", live: true, added: "2026-10-20", group: "numbers", dark: true },
  { id: "height", slug: "height", icon: "calendar", live: true, added: "2026-10-20", group: "wallet", dark: true },
  { id: "dl", slug: "checksum", icon: "shield", live: true, added: "2026-10-20", group: "wallet", dark: true },
  { id: "node", slug: "node", icon: "server", live: true, added: "2026-10-20", group: "wallet", dark: true },
  { id: "pool", slug: "mempool", icon: "gauge", live: true, added: "2026-10-23", group: "numbers", dark: true },
  { id: "mining", slug: "mining", icon: "pickaxe", live: true, added: "2026-10-20", group: "numbers", dark: true },
  { id: "beat", slug: "beat", icon: "sound", live: true, added: "2026-10-21", group: "fun", dark: true },
  { id: "live", slug: "live", icon: "notes", live: true, added: "2026-10-21", group: "fun", dark: true },
  { id: "donate", slug: "donate", icon: "heart", live: true, added: "2026-10-21", group: "fun", dark: true },
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
