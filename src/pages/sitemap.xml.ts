/* Each page lists its translations (hreflang). */
import type { APIRoute } from "astro";
import { DEFAULT_LOCALE, LOCALES, localePath } from "../i18n/ui";
import { editionPath, visibleEditions } from "../lib/gazette";
import { TOOLS, toolPath } from "../lib/tools";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export const GET: APIRoute = async ({ site }) => {
  const editions = await visibleEditions();
  const pages: { path: string; lastmod?: string; priority: string }[] = [
    { path: "/", priority: "1.0" },
    ...TOOLS.filter((t) => t.live && t.id !== "gazette").map((t) => ({ path: toolPath(t), priority: "0.9" })),
    { path: "/news", lastmod: editions[0]?.data.generated?.at ?? editions[0]?.data.week, priority: "0.8" },
    ...editions.slice(1).map((e) => ({ path: editionPath(e, editions), lastmod: e.data.generated?.at ?? e.data.week, priority: "0.5" })),
    { path: "/sponsor", priority: "0.4" },
    { path: "/sponsors", priority: "0.3" },
    { path: "/feeds", priority: "0.3" },
  ];
  const href = (lang: (typeof LOCALES)[number], path: string) => esc(new URL(localePath(lang, path), site).href);
  const urls = pages.flatMap(({ path, lastmod, priority }) =>
    LOCALES.map((lang) => [
      "  <url>",
      `    <loc>${href(lang, path)}</loc>`,
      ...LOCALES.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${href(l, path)}"/>`),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${href(DEFAULT_LOCALE, path)}"/>`,
      ...(lastmod ? [`    <lastmod>${lastmod.slice(0, 10)}</lastmod>`] : []),
      `    <priority>${priority}</priority>`,
      "  </url>",
    ].join("\n")),
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
