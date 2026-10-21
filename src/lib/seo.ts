/* Open Graph locales and schema.org (JSON-LD) objects for search engines and link previews. */
import type { Locale } from "../i18n/ui";

export const OG_LOCALE: Record<Locale, string> = { en: "en_US", es: "es_ES", ru: "ru_RU", fr: "fr_FR", pt: "pt_BR", ja: "ja_JP" };

export const PUBLISHER = { "@type": "Organization", name: "KYCnot.me", url: "https://kycnot.me" } as const;

export type JsonLd = Record<string, unknown>;

export const websiteLd = (url: string, name: string, description: string, lang: Locale): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name, url, description, inLanguage: lang, publisher: PUBLISHER,
});

export const toolLd = (url: string, name: string, description: string, lang: Locale): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name, url, description, inLanguage: lang,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  publisher: PUBLISHER,
});

export const breadcrumbLd = (items: { name: string; url: string }[]): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: item.url })),
});

export const articleLd = (a: { url: string; headline: string; description: string; image?: string; published: string; modified?: string; lang: Locale; section: string }): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  mainEntityOfPage: a.url,
  headline: a.headline.slice(0, 110),
  description: a.description,
  ...(a.image ? { image: [a.image] } : {}),
  datePublished: a.published,
  dateModified: a.modified ?? a.published,
  inLanguage: a.lang,
  articleSection: a.section,
  author: { "@type": "Organization", name: "The xmr.fan Times", url: "https://xmr.fan/news" },
  publisher: { ...PUBLISHER, logo: { "@type": "ImageObject", url: "https://xmr.fan/icon-512.png" } },
});

/** JSON for a <script type="application/ld+json">, safe to inline in HTML. */
export const ldJson = (data: JsonLd | JsonLd[]) => JSON.stringify(data).replace(/</g, "\\u003c");

export const itemListLd = (items: { name: string; url: string }[]): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, url: item.url })),
});

/** Trims text to a meta-description length at a word boundary. */
export function excerpt(text: string, max = 160): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).trimEnd()}…`;
}
