import { getCollection, type CollectionEntry } from "astro:content";
import type { Locale } from "../i18n/ui.ts";

export { localize, type LocalizedData } from "./gazette-localize.ts";

export type Edition = CollectionEntry<"gazette">;
export type Story = Edition["data"]["lead"];
export type SectionKey = keyof Edition["data"]["sections"];

export const latestFirst = (eds: Edition[]) => [...eds].sort((a, b) => b.data.week.localeCompare(a.data.week));

/** Newest first. Drafts only appear in development and in the keyed preview (/news/preview/<week>). */
export async function visibleEditions(withDrafts = false): Promise<Edition[]> {
  const all = await getCollection("gazette");
  // GAZETTE_SHOW_DRAFTS=1 includes drafts in a build too (for a staging preview).
  const showDrafts = withDrafts || import.meta.env.DEV || process.env.GAZETTE_SHOW_DRAFTS === "1";
  return latestFirst(showDrafts ? all : all.filter((e) => !e.data.draft));
}

export const formatDate = (iso: string, lang: Locale) =>
  new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${iso}T00:00:00Z`));

export const formatNumber = (n: number, lang: Locale, opts?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(lang, opts).format(n);

/** The latest edition is at /news; older ones at /news/<week>. `all` is newest first. */
export const editionPath = (e: Edition, all: Edition[]) => (e.id === all[0]?.id ? "/news" : `/news/${e.id}`);

/** Biggest first. */
export async function sponsorsFor(week: string) {
  return (await getCollection("sponsors")).map((s) => s.data).filter((s) => s.week === week).sort((a, b) => b.usd - a.usd);
}

/** Languages with at least one episode; English is the main podcast. */
export async function podcastLanguages(): Promise<Set<Locale>> {
  const langs = new Set<Locale>(["en"]);
  for (const e of await visibleEditions()) for (const l of Object.keys(e.data.podcasts ?? {})) langs.add(l as Locale);
  return langs;
}

export const podcastFeedPath = (lang: Locale, langs: Set<Locale>) => (lang !== "en" && langs.has(lang) ? `/${lang}/feed/podcast.xml` : "/feed/podcast.xml");
