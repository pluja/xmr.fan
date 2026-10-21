import type { APIRoute } from "astro";
import { langFromParams, localeParams, localePath, useTranslations } from "../../../i18n/ui";
import { rss } from "../../../lib/rss";
import { TOOLS, seoDescKey, titleKey, toolPath } from "../../../lib/tools";

export const getStaticPaths = () => localeParams().map((params) => ({ params }));

export const GET: APIRoute = ({ params, site }) => {
  const lang = langFromParams(params);
  const t = useTranslations(lang);
  const abs = (path: string) => new URL(path, site).href;
  const tools = TOOLS.filter((tool) => tool.live && tool.id !== "gazette").sort((a, b) => b.added.localeCompare(a.added));
  return rss({
    title: `xmr.fan · ${t("feed_tools")}`,
    link: abs(localePath(lang, "/")),
    self: abs(localePath(lang, "/feed/tools.xml")),
    description: t("seo_home_desc"),
    language: lang,
    image: abs("/icon-512.png"),
    items: tools.map((tool) => ({
      title: t(titleKey(tool)),
      link: abs(localePath(lang, toolPath(tool))),
      guid: `xmr.fan/tool/${tool.id}`,
      date: tool.added,
      description: t(seoDescKey(tool)),
    })),
  });
};
