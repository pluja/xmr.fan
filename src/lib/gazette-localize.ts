import type { Locale } from "../i18n/ui.ts";
import type { EditionData } from "./gazette-schema.ts";

type Data = EditionData;
type SectionKey = keyof Data["sections"];
export type LocalizedData = Omit<Data, "quotes"> & {
  quotes?: (NonNullable<Data["quotes"]>[number] & { gloss?: string })[];
  translated: boolean;
  /** Language of `podcast`: the page's language when an episode exists in it, otherwise English. */
  audioLang: Locale;
};

/** Falls back to English. Quotes keep the original words, with the translation as a `gloss`. */
export function localize(d: Data, lang: Locale): LocalizedData {
  const localPodcast = lang === "en" ? undefined : d.podcasts?.[lang];
  const audio = { podcast: localPodcast ?? d.podcast, audioLang: localPodcast ? lang : ("en" as Locale) };
  const tr = lang === "en" ? undefined : d.translations?.[lang];
  if (!tr) return { ...d, ...audio, translated: false };
  const story = <S extends { h: string; p: string }>(s: S, t?: { h: string; p: string }) => (t ? { ...s, h: t.h, p: t.p } : s);
  const sections = Object.fromEntries(
    Object.entries(d.sections).map(([k, list]) => [k, list.map((s, i) => story(s, tr.sections[k as SectionKey]?.[i]))]),
  ) as Data["sections"];
  const a = d.market?.analysis;
  return {
    ...d,
    ...audio,
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
