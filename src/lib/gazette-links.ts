/** Every { src, url } an issue cites, anywhere in it, grouped by site and without duplicates. */
export function linksBySite(data: unknown): { site: string; links: { src: string; url: string }[] }[] {
  const seen = new Map<string, { src: string; url: string }>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (typeof o.url === "string" && typeof o.src === "string" && !seen.has(o.url)) seen.set(o.url, { src: o.src, url: o.url });
    Object.entries(o).forEach(([key, child]) => key !== "translations" && walk(child));
  };
  walk(data);
  const groups = new Map<string, { src: string; url: string }[]>();
  for (const link of seen.values()) {
    const site = new URL(link.url).hostname.replace(/^www\./, "");
    groups.set(site, [...(groups.get(site) ?? []), link]);
  }
  return [...groups].map(([site, links]) => ({ site, links })).sort((a, b) => b.links.length - a.links.length || a.site.localeCompare(b.site));
}

/** A short, readable name for a cited URL: "monero #11459", "monero-gui v0.18.5.4", "tech meeting 19 october". */
export function linkLabel(url: string): string {
  const u = new URL(url);
  const segs = u.pathname.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
  if (u.hostname.endsWith("github.com") && segs.length >= 2) {
    const [, repo, kind, ...rest] = segs;
    if (kind === "pull" || kind === "issues") return `${repo} #${rest[0]}`;
    if (kind === "releases" && rest[0] === "tag") return `${repo} ${rest[1]}`;
    return [repo, kind, ...rest].filter(Boolean).join("/");
  }
  if (segs.includes("merge_requests")) return `MR !${segs.at(-1)}`;
  const last = segs.at(-1) ?? u.hostname;
  if (/^\d{6,}$/.test(last)) return `${segs.at(-3) ?? segs.at(-2) ?? "post"} …${last.slice(-5)}`;
  const words = last.replace(/\.\w{2,5}$/, "").replace(/[-_]+/g, " ").trim();
  return words.length > 60 ? `${words.slice(0, 59).trimEnd()}…` : words;
}
