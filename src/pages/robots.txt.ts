import type { APIRoute } from "astro";
import { LOCALES, localePath } from "../i18n/ui";

/* /uri with a query is the API or a prefilled form: the plain /uri page is the one to index. */
export const GET: APIRoute = ({ site }) => {
  const lines = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    ...LOCALES.map((l) => `Disallow: ${localePath(l, "/uri")}?`),
    "",
    `Sitemap: ${new URL("/sitemap.xml", site).href}`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
