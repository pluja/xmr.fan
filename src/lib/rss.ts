/* RSS 2.0 documents for the feeds under /feed/. */

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface FeedItem { title: string; link: string; guid: string; date: string; description: string; extra?: string[] }
export interface Feed { title: string; link: string; self: string; description: string; language: string; image: string; extra?: string[]; namespaces?: string[]; items: FeedItem[] }

const rfc822 = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toUTCString();

export function rss(f: Feed): Response {
  const items = f.items.map((i) => [
    "    <item>",
    `      <title>${esc(i.title)}</title>`,
    `      <link>${esc(i.link)}</link>`,
    `      <guid isPermaLink="false">${esc(i.guid)}</guid>`,
    `      <pubDate>${rfc822(i.date)}</pubDate>`,
    `      <description>${esc(i.description)}</description>`,
    ...(i.extra ?? []).map((x) => `      ${x}`),
    "    </item>",
  ].join("\n"));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"${(f.namespaces ?? []).map((n) => ` ${n}`).join("")}>
  <channel>
    <title>${esc(f.title)}</title>
    <link>${esc(f.link)}</link>
    <description>${esc(f.description)}</description>
    <language>${f.language}</language>
    <atom:link href="${esc(f.self)}" rel="self" type="application/rss+xml"/>
    <image><url>${esc(f.image)}</url><title>${esc(f.title)}</title><link>${esc(f.link)}</link></image>
${(f.extra ?? []).map((x) => `    ${x}`).join("\n")}
${items.join("\n")}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
