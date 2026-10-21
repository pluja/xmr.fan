/* Collects the week's raw material from public Monero sources. Each source fails
   on its own: a broken feed shrinks the issue but never blocks it. */
import { XMLParser } from "fast-xml-parser";
import { inWeek, isoDate, type Week } from "./week.ts";

export interface SourceItem {
  /** Short reference the editor model uses, e.g. "S12". */
  id: string;
  /** Label shown to readers next to the link. */
  source: string;
  kind: "release" | "code" | "meeting" | "blog" | "news" | "newsletter" | "funding" | "community" | "social" | "privacy";
  title: string;
  url: string;
  date: string;
  text: string;
}
type Item = Omit<SourceItem, "id">;

const UA = "Mozilla/5.0 (compatible; xmr.fan-gazette/1.0; +https://xmr.fan)";

async function get(url: string, headers: Record<string, string> = {}): Promise<Response> {
  const res = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal: AbortSignal.timeout(45_000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} ${(await res.text()).slice(0, 200)}`.trim());
  return res;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export const excerpt = (s: unknown, max = 600) =>
  String(s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) =>
      e[0] === "#" ? String.fromCodePoint(parseInt(e.slice(e[1] === "x" ? 2 : 1), e[1] === "x" ? 16 : 10)) : ENTITIES[e.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const github = (path: string) =>
  get(`https://api.github.com${path}`, {
    Accept: "application/vnd.github+json",
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  }).then((r) => r.json());

async function githubReleases(repo: string, w: Week): Promise<Item[]> {
  const releases: any[] = await github(`/repos/${repo}/releases?per_page=10`);
  return releases
    .filter((r) => r.published_at && inWeek(new Date(r.published_at), w))
    .map((r) => ({
      source: `github.com/${repo}`,
      kind: "release" as const,
      title: `${repo.split("/")[1]} ${r.tag_name}${r.name && r.name !== r.tag_name ? `: ${r.name}` : ""}`,
      url: r.html_url,
      date: r.published_at,
      text: excerpt(r.body, 1500),
    }));
}

async function githubMergedPulls(repo: string, w: Week): Promise<Item[]> {
  const range = `${isoDate(w.from)}..${isoDate(new Date(w.to.getTime() - 1))}`;
  const q = encodeURIComponent(`repo:${repo} is:pr is:merged merged:${range}`);
  const data = await github(`/search/issues?q=${q}&per_page=100`);
  const pulls: any[] = data.items ?? [];
  if (!pulls.length) return [];
  const label = `github.com/${repo}`;
  // One summary item for the week's activity, plus the individual pull requests.
  const summary: Item = {
    source: label,
    kind: "code",
    title: `${data.total_count} pull requests merged in ${repo} this week`,
    url: `https://github.com/${repo}/pulls?q=${encodeURIComponent(`is:pr is:merged merged:${range}`)}`,
    date: isoDate(w.from),
    text: excerpt(pulls.map((p) => p.title).join("; "), 2500),
  };
  return [summary, ...pulls.slice(0, 40).map((p) => ({
    source: label,
    kind: "code" as const,
    title: p.title,
    url: p.html_url,
    date: p.pull_request?.merged_at ?? p.closed_at,
    text: excerpt(p.body, 300),
  }))];
}

async function githubIssues(repo: string, kind: Item["kind"], w: Week): Promise<Item[]> {
  const issues: any[] = await github(`/repos/${repo}/issues?state=all&since=${w.from.toISOString()}&per_page=50`);
  return issues
    .filter((i) => inWeek(new Date(i.created_at), w))
    .map((i) => ({ source: `github.com/${repo}`, kind, title: i.title, url: i.html_url, date: i.created_at, text: excerpt(i.body, 800) }));
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", htmlEntities: true });
const asArray = <T>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
const textOf = (x: any): string => (typeof x === "object" && x !== null ? x["#text"] ?? "" : String(x ?? ""));

function atomLink(link: any): string {
  const links = asArray(link);
  const alt = links.find((l: any) => typeof l === "object" && (!l["@rel"] || l["@rel"] === "alternate")) ?? links[0];
  return typeof alt === "object" ? alt["@href"] : String(alt ?? "");
}

interface Feed {
  source: string;
  url: string;
  kind: Item["kind"];
  max?: number;
  titlePrefix?: string;
  /** Keep only items matching this (for general outlets that rarely cover Monero). */
  match?: RegExp;
}

const MONERO = /\bmonero\b|\bXMR\b|privacy coins?/i;

async function feed(f: Feed, w: Week): Promise<Item[]> {
  const doc = xml.parse(await (await get(f.url)).text());
  const rss = asArray(doc.rss?.channel?.item).map((i: any) => ({
    title: textOf(i.title), url: textOf(i.link), date: textOf(i.pubDate ?? i["dc:date"]), text: textOf(i.description),
  }));
  const atom = asArray(doc.feed?.entry).map((e: any) => ({
    title: textOf(e.title), url: atomLink(e.link), date: textOf(e.published ?? e.updated), text: textOf(e.summary ?? e.content),
  }));
  return [...rss, ...atom]
    .filter((i) => i.url && i.date && inWeek(new Date(i.date), w))
    .filter((i) => !f.match || f.match.test(`${i.title} ${i.text}`))
    .slice(0, f.max ?? 30)
    .map((i) => ({
      source: f.source,
      kind: f.kind,
      // Some feeds (e.g. Mastodon) have no titles: use the start of the post.
      title: `${f.titlePrefix ?? ""}${excerpt(i.title, 200) || excerpt(i.text, 120)}`,
      url: i.url,
      date: new Date(i.date).toISOString(),
      text: excerpt(i.text),
    }));
}

const FEEDS: Feed[] = [
  { source: "getmonero.org", url: "https://www.getmonero.org/feed.xml", kind: "blog" },
  { source: "monero.observer", url: "https://monero.observer/feed.xml", kind: "news", max: 30 },
  { source: "revuo-xmr.com", url: "https://www.revuo-xmr.com/index.xml", kind: "newsletter" },
  { source: "CCS proposals", url: "https://repo.getmonero.org/monero-project/ccs-proposals/-/merge_requests.atom", kind: "funding" },
  // Crypto outlets: only what mentions Monero.
  { source: "cointelegraph.com", url: "https://cointelegraph.com/rss/tag/monero", kind: "news" },
  { source: "coindesk.com", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", kind: "news", match: MONERO },
  { source: "decrypt.co", url: "https://decrypt.co/feed", kind: "news", match: MONERO },
  { source: "theblock.co", url: "https://www.theblock.co/rss.xml", kind: "news", match: MONERO },
  // Privacy and freedom tech that Monero users tend to care about.
  { source: "404media.co", url: "https://www.404media.co/rss/", kind: "privacy", max: 15 },
  { source: "therecord.media", url: "https://therecord.media/feed", kind: "privacy", max: 10 },
  { source: "blog.torproject.org", url: "https://blog.torproject.org/rss.xml", kind: "privacy" },
  { source: "signal.org", url: "https://signal.org/blog/rss.xml", kind: "privacy" },
  { source: "grapheneos.org", url: "https://grapheneos.org/releases.atom", kind: "privacy", titlePrefix: "GrapheneOS release " },
  { source: "grapheneos.social", url: "https://grapheneos.social/@GrapheneOS.rss", kind: "privacy", max: 15 },
  { source: "eff.org", url: "https://www.eff.org/rss/updates.xml", kind: "privacy", max: 15 },
  { source: "privacyguides.org", url: "https://www.privacyguides.org/articles/feed_rss_created.xml", kind: "privacy" },
];

// X and Reddit via nano-gpt: optional and paid, needs NANO_GPT_API_KEY.

const NANO = "https://nano-gpt.com/api/v1";
const nanoKey = () => process.env.NANO_GPT_API_KEY;

/** Override with GAZETTE_X_ACCOUNTS. */
const X_ACCOUNTS = (process.env.GAZETTE_X_ACCOUNTS ?? "monero,cakewallet,sethforprivacy,fluffypony,MoneroObserver,haveno_network,feather_wallet,GrapheneOS,privacyguides")
  .split(",").map((a) => a.trim()).filter(Boolean);

async function xSearch(query: string, limit: number, w: Week): Promise<any[]> {
  // X's recent search only reaches back 7 days, and end_time must be in the past. Run the
  // generator early in the week (Monday) to cover the whole previous week.
  const start = new Date(Math.max(w.from.getTime(), Date.now() - 7 * 86_400_000 + 600_000));
  const end = new Date(Math.min(w.to.getTime(), Date.now() - 60_000));
  if (start >= end) return [];
  const params = new URLSearchParams({
    query, limit: String(limit), sort_order: "relevancy", start_time: start.toISOString(), end_time: end.toISOString(),
  });
  const res = await get(`${NANO}/x/search?${params}`, { Authorization: `Bearer ${nanoKey()}` });
  const { data } = await res.json();
  const users = new Map((data?.includes?.users ?? []).map((u: any) => [u.id, u.username]));
  return (data?.data ?? []).map((t: any) => ({ ...t, username: users.get(t.author_id) ?? "i" }));
}

async function xPosts(w: Week): Promise<Item[]> {
  const curated = X_ACCOUNTS.length ? `(${X_ACCOUNTS.map((a) => `from:${a}`).join(" OR ")}) -is:retweet` : "";
  const popular = (min: number) => (posts: any[]) => posts.filter((t) => (t.public_metrics?.like_count ?? 0) >= min);
  const [fromAccounts, general, market] = await Promise.all([
    curated ? xSearch(curated, 30, w) : [],
    // General search is mostly noise; keep only posts people engaged with.
    xSearch("(monero OR #monero OR #XMR) -is:retweet -is:reply lang:en", 30, w).then(popular(20)),
    // Market commentary, so the price section can say why XMR moved (and who said so).
    xSearch("(monero OR $XMR OR #XMR) (price OR rally OR breakout OR resistance OR support OR volume OR delisting) -is:retweet -is:reply lang:en", 20, w).then(popular(10)),
  ]);
  const seen = new Set<string>();
  return [...fromAccounts, ...general, ...market]
    .filter((t) => !seen.has(t.id) && seen.add(t.id))
    .filter((t) => inWeek(new Date(t.created_at), w))
    .map((t) => ({
      source: `x.com/${t.username}`,
      kind: "social" as const,
      title: excerpt(t.text, 120),
      url: `https://x.com/${t.username}/status/${t.id}`,
      date: t.created_at,
      text: `${excerpt(t.text, 500)} (${t.public_metrics?.like_count ?? 0} likes, ${t.public_metrics?.retweet_count ?? 0} reposts)`,
    }));
}

const SUBREDDITS: { name: string; kind: Item["kind"] }[] = [
  { name: "Monero", kind: "community" },
  { name: "privacy", kind: "privacy" },
  { name: "GrapheneOS", kind: "privacy" },
];

async function redditTop(w: Week): Promise<Item[]> {
  const res = await fetch(`${NANO}/reddit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${nanoKey()}`, "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({
      startUrls: SUBREDDITS.map((r) => ({ url: `https://www.reddit.com/r/${r.name}/top/?t=week` })),
      maxItems: 60, maxPostCount: 20, maxComments: 0, resultLimit: 60, sort: "top", time: "week",
      includeNSFW: false, searchPosts: true, searchComments: false, searchCommunities: false, searchUsers: false,
    }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const { items = [] } = await res.json();
  return items
    .filter((p: any) => p.dataType === "post" && p.url && inWeek(new Date(p.createdAt), w))
    .map((p: any) => {
      const sub = SUBREDDITS.find((r) => r.name.toLowerCase() === String(p.parsedCommunityName ?? "").toLowerCase()) ?? SUBREDDITS[0];
      return {
        source: `reddit.com/r/${sub.name}`,
        kind: sub.kind,
        title: excerpt(p.title, 200),
        url: p.url,
        date: p.createdAt,
        // Vote counts are not always returned; leave them out rather than show a misleading 0.
        text: excerpt(p.body, 500) + (p.upVotes != null ? ` (${p.upVotes} upvotes, ${p.numberOfComments ?? 0} comments)` : ""),
      };
    });
}

const redditRss = (sub: (typeof SUBREDDITS)[number]): Feed => ({
  source: `reddit.com/r/${sub.name}`, url: `https://www.reddit.com/r/${sub.name}/top/.rss?t=week&limit=25`, kind: sub.kind, max: 20,
});
const redditFallback = (w: Week) =>
  Promise.all(SUBREDDITS.map((sub) => feed(redditRss(sub), w).catch(() => []))).then((lists) => lists.flat());

export interface Collected { items: SourceItem[]; report: { name: string; count: number; error?: string }[] }

export async function collectSources(w: Week): Promise<Collected> {
  const jobs: [string, Promise<Item[]>][] = [
    ["monero releases", githubReleases("monero-project/monero", w)],
    ["monero-gui releases", githubReleases("monero-project/monero-gui", w)],
    ["monero merged pull requests", githubMergedPulls("monero-project/monero", w)],
    ["meetings (monero-project/meta)", githubIssues("monero-project/meta", "meeting", w)],
    ...FEEDS.map((f): [string, Promise<Item[]>] => [f.source, feed(f, w)]),
    // With a nano-gpt key: Reddit with vote counts (RSS as fallback) and X. Without: Reddit RSS only.
    ...(nanoKey()
      ? [
          ["reddit", redditTop(w).catch((e) => {
            console.warn(`  Reddit via nano-gpt failed (${(e as Error).message}); using the RSS feeds`);
            return redditFallback(w);
          })] as [string, Promise<Item[]>],
          ["x.com", xPosts(w)] as [string, Promise<Item[]>],
        ]
      : [["reddit (RSS)", redditFallback(w)] as [string, Promise<Item[]>]]),
  ];
  const settled = await Promise.allSettled(jobs.map(([, p]) => p));
  const seen = new Set<string>();
  const items: SourceItem[] = [];
  const report = settled.map((r, i) => {
    const name = jobs[i][0];
    if (r.status === "rejected") return { name, count: 0, error: String(r.reason?.message ?? r.reason) };
    const fresh = r.value.filter((it) => !seen.has(it.url) && seen.add(it.url));
    for (const it of fresh) items.push({ id: `S${items.length + 1}`, ...it });
    return { name, count: fresh.length };
  });
  return { items, report };
}
