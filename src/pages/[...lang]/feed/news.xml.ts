import type { APIRoute } from "astro";
import { langFromParams, localeParams, localePath, useTranslations } from "../../../i18n/ui";
import { editionPath, localize, visibleEditions } from "../../../lib/gazette";
import { rss } from "../../../lib/rss";

export const getStaticPaths = () => localeParams().map((params) => ({ params }));

export const GET: APIRoute = async ({ params, site }) => {
  const lang = langFromParams(params);
  const t = useTranslations(lang);
  const editions = await visibleEditions();
  const abs = (path: string) => new URL(path, site).href;
  return rss({
    title: t("g_title"),
    link: abs(localePath(lang, "/news")),
    self: abs(localePath(lang, "/feed/news.xml")),
    description: t("seo_desc_gazette"),
    language: lang,
    image: abs("/icon-512.png"),
    items: editions.map((e) => {
      const d = localize(e.data, lang);
      return {
        title: `${t("g_no", { n: d.no })}: ${d.lead.h}`,
        link: abs(localePath(lang, editionPath(e, editions))),
        guid: abs(localePath(lang, `/news/${e.id}`)),
        date: d.generated?.at ?? d.week,
        description: d.recap ?? d.lead.p,
      };
    }),
  });
};
