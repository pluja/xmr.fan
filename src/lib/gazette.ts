import { getCollection, type CollectionEntry } from "astro:content";
import type { Locale } from "../i18n/ui.ts";

export type Edition = CollectionEntry<"gazette">;
export type Story = Edition["data"]["lead"];
export type SectionKey = keyof Edition["data"]["sections"];

export const latestFirst = (eds: Edition[]) => [...eds].sort((a, b) => b.data.week.localeCompare(a.data.week));

/** Newest first. Drafts only appear in development, for review. */
export async function visibleEditions(): Promise<Edition[]> {
  const all = await getCollection("gazette");
  // GAZETTE_SHOW_DRAFTS=1 includes drafts in a build too (for a staging preview).
  const showDrafts = import.meta.env.DEV || process.env.GAZETTE_SHOW_DRAFTS === "1";
  return latestFirst(showDrafts ? all : all.filter((e) => !e.data.draft));
}

export const formatDate = (iso: string, lang: Locale) =>
  new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${iso}T00:00:00Z`));

export const formatNumber = (n: number, lang: Locale, opts?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(lang, opts).format(n);

/** The latest edition is at /news; older ones at /news/<week>. `all` is newest first. */
export const editionPath = (e: Edition, all: Edition[]) => (e.id === all[0]?.id ? "/news" : `/news/${e.id}`);

type Data = Edition["data"];
export type LocalizedData = Omit<Data, "quotes"> & { quotes?: (NonNullable<Data["quotes"]>[number] & { gloss?: string })[]; translated: boolean };

/** Falls back to English. Quotes keep the original words, with the translation as a `gloss`. */
export function localize(d: Data, lang: Locale): LocalizedData {
  const tr = lang === "en" ? undefined : d.translations?.[lang];
  if (!tr) return { ...d, translated: false };
  const story = <S extends { h: string; p: string }>(s: S, t?: { h: string; p: string }) => (t ? { ...s, h: t.h, p: t.p } : s);
  const sections = Object.fromEntries(
    Object.entries(d.sections).map(([k, list]) => [k, list.map((s, i) => story(s, tr.sections[k as SectionKey]?.[i]))]),
  ) as Data["sections"];
  const a = d.market?.analysis;
  return {
    ...d,
    translated: true,
    recap: tr.recap ?? d.recap,
    lead: story(d.lead, tr.lead),
    sections,
    ...(d.art ? { art: { ...d.art, alt: tr.art?.alt ?? d.art.alt } } : {}),
    ...(d.feature ? { feature: { ...d.feature, h: tr.feature?.h ?? d.feature.h, dek: tr.feature?.dek ?? d.feature.dek, body: tr.feature?.body ?? d.feature.body } } : {}),
    ...(d.quotes ? { quotes: d.quotes.map((q, i) => ({ ...q, gloss: tr.quotes?.[i]?.text })) } : {}),
    ...(d.upcoming ? { upcoming: d.upcoming.map((u, i) => ({ ...u, what: tr.upcoming?.[i]?.what ?? u.what })) } : {}),
    ...(d.market && a ? {
      market: {
        ...d.market,
        analysis: {
          summary: tr.price?.summary ?? a.summary,
          drivers: a.drivers.map((dr, i) => ({ ...dr, text: tr.price?.drivers[i] ?? dr.text })),
          watch: [],
        },
      },
    } : {}),
  };
}

/** Biggest first. */
export async function sponsorsFor(week: string) {
  return (await getCollection("sponsors")).map((s) => s.data).filter((s) => s.week === week).sort((a, b) => b.usd - a.usd);
}
