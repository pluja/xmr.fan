/* The audio edition of the Times as a podcast feed (Apple Podcasts, AntennaPod, Pocket Casts…),
   one per language that has episodes: /feed/podcast.xml is English, /es/feed/podcast.xml Spanish. */
import type { APIRoute } from "astro";
import { statSync } from "node:fs";
import { LOCALE_NAMES, langFromParams, localePath, useTranslations, type Locale } from "../../../i18n/ui";
import { editionPath, localize, podcastLanguages, visibleEditions } from "../../../lib/gazette";
import { esc, rss } from "../../../lib/rss";

export async function getStaticPaths() {
  return [...(await podcastLanguages())].map((lang) => ({ params: { lang: lang === "en" ? undefined : lang } }));
}

const fileSize = (publicPath: string) => { try { return statSync(`public${publicPath}`).size; } catch { return 0; } };
/** Episodes record their size, because in production the audio lives outside the build (MEDIA_DIR). */
const size = (pod: { file: string; bytes?: number }) => pod.bytes ?? fileSize(pod.file);
const hms = (s: number) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), Math.floor(s % 60)].map((n) => String(n).padStart(2, "0")).join(":");

export const GET: APIRoute = async ({ params, site }) => {
  const lang = langFromParams(params);
  const t = useTranslations(lang);
  const editions = await visibleEditions();
  const abs = (path: string) => new URL(path, site).href;
  const cover = abs("/podcast-cover.png");
  const title = lang === "en" ? t("g_title") : `${t("g_title")} (${LOCALE_NAMES[lang]})`;
  const episodeOf = (data: (typeof editions)[number]["data"]) => (lang === "en" ? data.podcast : data.podcasts?.[lang as Locale]);
  return rss({
    title,
    link: abs(localePath(lang, "/news")),
    self: abs(localePath(lang, "/feed/podcast.xml")),
    description: t("seo_desc_gazette"),
    language: lang,
    image: cover,
    namespaces: ['xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"', 'xmlns:podcast="https://podcastindex.org/namespace/1.0"'],
    extra: [
      `<itunes:image href="${esc(cover)}"/>`,
      "<itunes:author>xmr.fan</itunes:author>",
      `<itunes:summary>${esc(t("seo_desc_gazette"))}</itunes:summary>`,
      '<itunes:category text="Technology"/>',
      '<itunes:category text="News"><itunes:category text="Tech News"/></itunes:category>',
      "<itunes:explicit>false</itunes:explicit>",
      "<itunes:type>episodic</itunes:type>",
      "<podcast:locked>no</podcast:locked>",
    ],
    items: editions.filter((e) => episodeOf(e.data)).map((e) => {
      const d = localize(e.data, lang), pod = episodeOf(e.data)!;
      return {
        title: `${t("g_no", { n: d.no })}: ${d.lead.h}`,
        link: abs(localePath(lang, editionPath(e, editions))),
        guid: `xmr.fan/podcast/${e.id}${lang === "en" ? "" : `/${lang}`}`,
        date: d.generated?.at ?? d.week,
        description: d.recap ?? d.lead.p,
        extra: [
          `<enclosure url="${esc(abs(pod.file))}" length="${size(pod)}" type="audio/mpeg"/>`,
          `<itunes:duration>${hms(pod.duration)}</itunes:duration>`,
          `<itunes:episode>${d.no}</itunes:episode>`,
          "<itunes:explicit>false</itunes:explicit>",
        ],
      };
    }),
  });
};
