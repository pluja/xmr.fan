/* The audio is in English only. */
import type { APIRoute } from "astro";
import { statSync } from "node:fs";
import { useTranslations } from "../../i18n/ui";
import { editionPath, visibleEditions } from "../../lib/gazette";
import { esc, rss } from "../../lib/rss";

const fileSize = (publicPath: string) => { try { return statSync(`public${publicPath}`).size; } catch { return 0; } };
const hms = (s: number) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), Math.floor(s % 60)].map((n) => String(n).padStart(2, "0")).join(":");

export const GET: APIRoute = async ({ site }) => {
  const t = useTranslations("en");
  const editions = await visibleEditions();
  const abs = (path: string) => new URL(path, site).href;
  const cover = abs("/podcast-cover.png");
  return rss({
    title: t("g_title"),
    link: abs("/news"),
    self: abs("/feed/podcast.xml"),
    description: t("seo_desc_gazette"),
    language: "en",
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
    items: editions.filter((e) => e.data.podcast).map((e) => {
      const d = e.data, pod = d.podcast!;
      return {
        title: `${t("g_no", { n: d.no })}: ${d.lead.h}`,
        link: abs(editionPath(e, editions)),
        guid: `xmr.fan/podcast/${e.id}`,
        date: d.generated?.at ?? d.week,
        description: d.recap ?? d.lead.p,
        extra: [
          `<enclosure url="${esc(abs(pod.file))}" length="${fileSize(pod.file)}" type="audio/mpeg"/>`,
          `<itunes:duration>${hms(pod.duration)}</itunes:duration>`,
          `<itunes:episode>${d.no}</itunes:episode>`,
          "<itunes:explicit>false</itunes:explicit>",
        ],
      };
    }),
  });
};
