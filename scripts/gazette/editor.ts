/* Turns the week's source items into an issue, in three AI steps:
   1. triage: score every item for importance, so noise never reaches the page;
   2. editorial: the lead, a feature, quotes from the community, and the news;
   3. price: a tiny reading of the week's price, with sourced reasons if any.
   The model refers to items by id ("S12"); links and source labels are filled
   in from the items themselves, so the model cannot invent or alter a URL, and
   quotes are checked word for word against what people actually wrote. */
import { z } from "astro/zod";
import { editorialSchema, type EditionData } from "../../src/lib/gazette-schema.ts";
import { chat, type LlmConfig, type Message } from "./llm.ts";
import type { SourceItem } from "./sources.ts";
import { isoDate, type Week } from "./week.ts";

type Market = NonNullable<EditionData["market"]>;
type Editorial = Pick<EditionData, "recap" | "lead" | "art" | "feature" | "quotes" | "upcoming" | "sections">;

const ids = z.array(z.string().regex(/^S\d+$/)).min(1).max(3);

export function formatItems(items: SourceItem[], week: Week, scores?: Map<string, number>, header = true): string {
  const end = isoDate(new Date(week.to.getTime() - 1));
  return (header ? `Week: ${isoDate(week.from)} to ${end} (UTC)\n\n` : "") + items.map((i) =>
    `[${i.id}] ${i.kind} | ${i.source} | ${i.date.slice(0, 10)}${scores ? ` | importance ${scores.get(i.id)}` : ""}\n` +
    `title: ${i.title}\n${i.text ? `text: ${i.text}\n` : ""}`,
  ).join("\n");
}

function parseJson(reply: string): unknown {
  try {
    return JSON.parse(reply.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
  } catch {
    throw new Error("The reply was not valid JSON.");
  }
}

interface CiteRules { used?: Set<string>; scores?: Map<string, number>; minScore?: number }

/** Enforces single use and a minimum score. */
function citer(items: SourceItem[], { used = new Set<string>(), scores, minScore }: CiteRules = {}) {
  const byId = new Map(items.map((i) => [i.id, i]));
  return (list: string[], label: string) => {
    const cited = list.map((id) => {
      const item = byId.get(id);
      if (!item) throw new Error(`"${label}" cites ${id}, which is not in the list.`);
      if (used.has(id)) throw new Error(`${id} is cited more than once.`);
      if (scores && minScore && (scores.get(id) ?? 1) < minScore) {
        throw new Error(`"${label}" cites ${id}, which has importance ${scores.get(id)}; it needs ${minScore} or more.`);
      }
      used.add(id);
      return { src: item.source, url: item.url };
    });
    const [main, ...more] = cited;
    return { ...main, ...(more.length ? { more } : {}) };
  };
}

/** Feeds parse errors back to the model until it accepts the reply. */
async function ask<T>(cfg: LlmConfig, system: string, user: string, parse: (reply: string, last: boolean) => T, attempts = 3): Promise<T> {
  const messages: Message[] = [{ role: "system", content: system }, { role: "user", content: user }];
  for (let attempt = 1; ; attempt++) {
    const reply = await chat(cfg, messages);
    try {
      return parse(reply, attempt >= attempts);
    } catch (e) {
      if (attempt >= attempts) throw e;
      console.warn(`  attempt ${attempt} rejected: ${(e as Error).message.slice(0, 300)}`);
      messages.push({ role: "assistant", content: reply }, { role: "user", content: `${(e as Error).message} Reply again with corrected JSON only.` });
    }
  }
}

export const TRIAGE_PROMPT = `You triage source items for The xmr.fan Times, a weekly Monero newsletter for people who use Monero.

Score every item from 1 to 5 for how much it matters to Monero users this week:
5 = must read: software releases, security fixes or incidents, network upgrades, major exchange, legal or regulatory events affecting Monero, significant research results.
4 = notable: wallet, service or library releases that change something for users, new or funded community proposals (CCS), notable adoption, important warnings.
3 = minor or fun: niche project announcements, meetings that report decisions, small code changes with some user impact, discussions with real substance, delightful community stories.

Monero users also care about privacy and freedom tech beyond Monero. Score that news on the same scale: 4 for major events (a significant GrapheneOS release or security fix, a big surveillance, encryption or privacy-law story), 3 for notable ones, 1 or 2 for routine posts, questions and opinion.
2 = routine: refactors, tests, docs, build changes, meeting schedules, routine user questions, self-promotion. A project announcing itself (often tagged [ANN]) is self-promotion unless it reports a real release, security issue or event.
1 = noise: spam, off-topic, price predictions and chart talk, memes, giveaways, fundraisers unrelated to Monero, personal disputes. Accepting XMR donations does not make a cause Monero news.

Judge code changes by their effect on users, not by their existence. Most items should score 1 or 2; that is expected.
If a list of earlier issues is included, an item that only repeats something already covered scores 1 or 2; a real new development on an earlier story scores as usual.
A post's likes, reposts or upvotes are a hint, not a verdict.

Reply with JSON only, giving a score for every item: {"scores":{"S1":5,"S2":1}}`;

export function parseTriage(reply: string, items: SourceItem[]): Map<string, number> {
  const parsed = z.object({ scores: z.record(z.string(), z.number().int().min(1).max(5)) }).safeParse(parseJson(reply));
  if (!parsed.success) throw new Error(`The JSON does not match {"scores":{...}}: ${parsed.error.message}`);
  const missing = items.filter((i) => !(i.id in parsed.data.scores)).map((i) => i.id);
  if (missing.length > items.length / 10) throw new Error(`Scores are missing for ${missing.join(", ")}.`);
  return new Map(items.map((i) => [i.id, parsed.data.scores[i.id] ?? 1]));
}

/** 1 and 2 are noise and routine; 3 and up is news. */
export const NEWS_FLOOR = 3;
const MAX_NEWS_ITEMS = 40;

export function selectImportant(items: SourceItem[], scores: Map<string, number>): SourceItem[] {
  return [...items]
    .filter((i) => scores.get(i.id)! >= NEWS_FLOOR)
    .sort((a, b) => scores.get(b.id)! - scores.get(a.id)!)
    .slice(0, MAX_NEWS_ITEMS);
}

const PEOPLE = ["social", "community", "news", "privacy"];

/** News may only use important items; the feature and quotes may draw on the rest. */
export function editorialMaterial(items: SourceItem[], scores: Map<string, number>) {
  const news = selectImportant(items, scores);
  const extra = items.filter((i) => {
    const s = scores.get(i.id)!;
    return !news.includes(i) && (s >= 3 || (s >= 2 && PEOPLE.includes(i.kind)));
  });
  return { news, extra, material: [...news, ...extra], floor: NEWS_FLOOR };
}

const draftStory = z.object({ h: z.string().min(1).max(110), p: z.string().min(1).max(700), items: ids });
const draftSchema = z.object({
  recap: z.string().min(20).max(500),
  lead: draftStory,
  art: z.object({ prompt: z.string().min(10).max(400), alt: z.string().min(5).max(200) }).optional(),
  feature: z.object({
    h: z.string().min(1).max(110),
    dek: z.string().max(200).optional(),
    body: z.array(z.string().min(1).max(900)).min(2).max(4),
    items: ids,
  }).nullable().optional(),
  quotes: z.array(z.object({ quote: z.string().min(1).max(300), item: z.string().regex(/^S\d+$/) })).max(3).optional(),
  upcoming: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().max(30).optional(),
    what: z.string().min(1).max(300),
    items: ids,
  })).max(5).optional(),
  sections: z.object({
    dev: z.array(draftStory).max(5),
    eco: z.array(draftStory).max(5),
    comm: z.array(draftStory).max(5),
    privacy: z.array(draftStory).max(5).default([]),
  }),
});

export const EDITORIAL_PROMPT = `You are the editor of The xmr.fan Times, a weekly Monero newsletter that people actually enjoy reading.

You receive the week's source items (S1, S2, ...) in two lists, each item with an importance score from triage: "NEWS ITEMS" (the only items the lead and news sections may use) and "MORE MATERIAL" (for the feature and quotes only). Write the issue:

1. "lead": the story that matters most to Monero users this week. A strong headline (at most 70 characters) and a short standfirst in "p": one or two sentences, at most 45 words, saying what happened and why it matters. Details belong in the news sections, not here.
   "art": a picture to go with the lead, drawn later as minimal, chunky, orange-and-charcoal pixel art (like an enlarged 8-bit sprite) in a 16:9 frame. "prompt": one short sentence naming one or two simple, iconic objects (for example a shield, a key, a coin, a wrench, a padlock) and at most a minimal setting such as a table or a floor; a visual metaphor is fine. No busy scenes, no people, hands or faces, no words, letters or logos. "alt": a short description of the picture for screen readers.
2. "feature": the week's most interesting, surprising or delightful story that is not the lead (it can be wider privacy news Monero users would care about), told as a short article: a headline, a one-line "dek" (standfirst), and 2 to 4 short paragraphs ("body"). Give context and why it matters; you may weave in what people said in the items. Use items scored 3 or more. Use null if nothing deserves it.
3. "quotes": up to 3 short quotes that capture the week's mood: funny, sharp, insightful or telling, from different people where possible. Each is a sentence or two copied word for word from one item ("item": its id), usually a post on X or Reddit. Never edit, translate or combine the words. Skip spam, insults and price predictions. An empty list is fine.
4. "recap": two or three plain sentences on what this week in Monero was about, for the archive and for writing future issues.
5. "upcoming": up to 5 dated events after this week that Monero users may care about (meetings, upgrades, releases, deadlines, conferences), soonest first. "date" is YYYY-MM-DD, "time" the time if given (e.g. "17:00 UTC"), "what" one short sentence. Only events with a date stated in the items and after this week. An empty list is fine.
6. "sections": the rest of the news. "dev" = code, releases, research. "eco" = wallets, services, merchants, funding proposals, adoption. "comm" = community, events, public service announcements. "privacy" = privacy and freedom tech beyond Monero (GrapheneOS, surveillance, encryption, privacy law). Use NEWS ITEMS only. Order each section by importance, most important first. Aim for 3 to 5 stories per section when the material allows, so readers get the full picture of the week; leave out only items that are not worth a reader's minute, and never pad with routine or noise. Each story: a headline and 1 or 2 sentences.

How to write:
- Read naturally, like a well-informed friend telling you about their week in Monero: warm, clear, a little playful where it fits. Vary the rhythm. No corporate tone, no hype, no clickbait, no emoji.
- Use only facts stated in the items. Never add numbers, names, dates, versions or claims that are not in them. If an item is vague, stay vague. Attribute opinions to whoever said them.
- The lead, feature and news stories list the ids of the items they use in "items" (1 to 3, main source first). State only facts found in those items. Use each item in at most one of them (quotes may reuse an item).
- Never cover the same thing twice, in this issue or in the earlier issues listed (if any). When a story continues one from an earlier issue, say so briefly ("Last week we reported...; now...").
- Plain language: briefly explain jargon a regular user would not know.
- Report, never promote: no endorsements, calls to action or sales language. A product or service is news for what changed, not for what it offers.
- No price or market talk in these pieces; the price has its own section.
- Privacy news beyond Monero belongs in "privacy" (or the feature), never presented as Monero news.
- Headlines: sentence case, specific, at most 80 characters.

Reply with JSON only:
{"recap":"...",
 "lead":{"h":"...","p":"...","items":["S1"]},
 "art":{"prompt":"...","alt":"..."},
 "feature":{"h":"...","dek":"...","body":["...","..."],"items":["S2"]},
 "quotes":[{"quote":"exact words","item":"S3"}],
 "upcoming":[{"date":"2026-10-21","time":"17:00 UTC","what":"...","items":["S5"]}],
 "sections":{"dev":[{"h":"...","p":"...","items":["S4"]}],"eco":[],"comm":[],"privacy":[]}}`;

/** Ignores case, whitespace, quote marks and ellipses, so verbatim checks skip formatting. */
const normalize = (s: string) =>
  s.toLowerCase().replace(/[‘’“”"']/g, "").replace(/…|\.\.\./g, "").replace(/\s+/g, " ").trim();

/** "x.com/monero" -> "@monero"; other sources keep their label. */
export const speaker = (item: SourceItem) => (item.source.startsWith("x.com/") ? `@${item.source.slice(6)}` : item.source);

/** Throws with a message the model can act on. On the last attempt (`lenient`), news stories
    that break a citation rule are dropped with a warning instead of failing the whole issue. */
export function resolveDraft(reply: string, items: SourceItem[], scores?: Map<string, number>, newsMinScore = 3, lenient = false): Editorial {
  const json = parseJson(reply) as { sections?: Record<string, unknown[]> };
  if (lenient && json?.sections) for (const k of Object.keys(json.sections)) json.sections[k] = (json.sections[k] ?? []).slice(0, 5);
  const draft = draftSchema.safeParse(json);
  if (!draft.success) throw new Error(`The JSON does not match the requested shape: ${draft.error.message}`);
  const used = new Set<string>();
  const citeNews = citer(items, { used, scores, minScore: newsMinScore });
  const citeFeature = citer(items, { used, scores, minScore: 3 });
  const make = (cite: ReturnType<typeof citer>) => (s: z.infer<typeof draftStory>) => ({ h: s.h.trim(), p: s.p.trim(), ...cite(s.items, s.h) });
  const story = make(citeNews);
  const stories = (list: z.infer<typeof draftStory>[], cite = citeNews) => list.flatMap((s) => {
    try {
      return [make(cite)(s)];
    } catch (e) {
      if (!lenient) throw e;
      console.warn(`  dropped "${s.h}": ${(e as Error).message}`);
      return [];
    }
  });
  const { recap, lead, art, feature, quotes = [], upcoming = [], sections } = draft.data;
  // Within each section: most important first (by the main source's score), keeping the model's order for ties.
  const rank = (list: z.infer<typeof draftStory>[]) =>
    scores ? list.map((st, i) => ({ st, i })).sort((a, b) => (scores.get(b.st.items[0]) ?? 0) - (scores.get(a.st.items[0]) ?? 0) || a.i - b.i).map((x) => x.st) : list;
  const citeEvent = citer(items, {});

  const byId = new Map(items.map((i) => [i.id, i]));
  const resolvedQuotes = quotes.map((q) => {
    const item = byId.get(q.item);
    if (!item) throw new Error(`A quote cites ${q.item}, which is not in the list.`);
    if (!normalize(`${item.title} ${item.text}`).includes(normalize(q.quote))) {
      throw new Error(`The quote "${q.quote.slice(0, 60)}…" is not word for word in ${q.item}. Copy the exact words or drop it.`);
    }
    return { text: q.quote.trim(), who: speaker(item), url: item.url, src: item.source };
  });

  return editorialSchema.parse({
    recap: recap.trim(),
    lead: story(lead),
    ...(art ? { art: { prompt: art.prompt.trim(), alt: art.alt.trim() } } : {}),
    ...(feature ? {
      feature: {
        h: feature.h.trim(),
        ...(feature.dek?.trim() ? { dek: feature.dek.trim() } : {}),
        body: feature.body.map((p) => p.trim()),
        ...citeFeature(feature.items, feature.h),
      },
    } : {}),
    ...(resolvedQuotes.length ? { quotes: resolvedQuotes } : {}),
    ...(upcoming.length ? {
      upcoming: [...upcoming].sort((a, b) => a.date.localeCompare(b.date)).map((u) => ({
        date: u.date, ...(u.time?.trim() ? { time: u.time.trim() } : {}), what: u.what.trim(), ...citeEvent(u.items, u.what),
      })),
    } : {}),
    sections: {
      dev: stories(rank(sections.dev)), eco: stories(rank(sections.eco)), comm: stories(rank(sections.comm)), privacy: stories(rank(sections.privacy)),
    },
  });
}

export const PRICE_PROMPT = `You write the price note for The xmr.fan Times, a weekly Monero newsletter.

The page already shows the week's close, change, range, average volume and Bitcoin's change, next to a price chart. Do not restate those figures.

Write:
1. "summary": one or two short, natural sentences that add something the tiles do not show: when the move happened, where the week sits in the past month, or what stood out. Return "" if there is nothing to add.
2. "drivers": up to 2 possible reasons for the move, each one sentence citing the items it relies on ("items": 1 to 3 ids). A driver must come from an item that itself talks about XMR's price, trading, exchanges, listings or market sentiment; attribute it ("according to @someone ..."). Never present ordinary news as a reason for a price move unless an item makes that link. Empty if no item explains the move.

Describe, do not predict: no price targets, no forecasts, no trading advice, no "bullish" or "bearish". Use only the numbers and facts given.

Reply with JSON only: {"summary":"...","drivers":[{"text":"...","items":["S1"]}]}`;

const pctChange = (now: number, before?: number) => (before ? `${(((now - before) / before) * 100).toFixed(1)}%` : "n/a");

/** Day-by-day closes from the 4-hourly series (6 points a day). */
function dailyMoves(series: number[], week: string): string[] {
  const start = new Date(`${week}T00:00:00Z`).getTime();
  const lines: string[] = [];
  for (let d = 0, prev = series[0]; d * 6 < series.length; d++) {
    const close = series[Math.min(d * 6 + 5, series.length - 1)];
    const day = new Date(start + d * 86_400_000).toUTCString().slice(0, 11);
    lines.push(`  ${day}: close ${close} (${pctChange(close, prev)})`);
    prev = close;
  }
  return lines;
}

export function formatMarket(market: Market, week: string): string {
  return [
    "XMR price in USD (CoinGecko):",
    `- this week: open ${market.open}, close ${market.close}, change ${market.change}%, high ${market.high}, low ${market.low}`,
    `- average 24h volume ${Math.round(market.volume / 1e6)} million USD (${market.volumeChange}% vs previous week); Bitcoin ${market.btcChange}% this week`,
    ...(market.month ? [`- past 30 days: change ${market.month.change}%, high ${market.month.high}, low ${market.month.low}`] : []),
    "- day by day:", ...dailyMoves(market.series, week),
  ].join("\n");
}

const priceSchema = z.object({
  summary: z.string().max(350),
  drivers: z.array(z.object({ text: z.string().min(1).max(350), items: ids })).max(2),
});

export function resolvePrice(reply: string, items: SourceItem[]) {
  const parsed = priceSchema.safeParse(parseJson(reply));
  if (!parsed.success) throw new Error(`The JSON does not match the requested shape: ${parsed.error.message}`);
  const cite = citer(items);
  const { summary, drivers } = parsed.data;
  return {
    summary: summary.trim(),
    drivers: drivers.map((d) => ({ text: d.text.trim(), ...cite(d.items, d.text) })),
    watch: [],
  };
}

const MARKET_WORDS = /\b(price|prices|rally|breakout|resistance|support|volume|delist\w*|listing|exchange|ATH|pump|dump|sell-?off|outperform\w*)\b|\$\d/i;
export const isMarketTalk = (i: SourceItem) =>
  ["social", "community", "news"].includes(i.kind) && MARKET_WORDS.test(`${i.title} ${i.text}`);

/** Separate so the price note can be rerun without touching the rest. */
export async function writePrice(cfg: LlmConfig, items: SourceItem[], scores: Map<string, number>, week: Week, market?: Market) {
  if (!market) return undefined;
  console.log("  price…");
  // Market talk is noise for stories but evidence for the price note, so it is
  // passed on whatever its story score.
  const context = items.filter((i) => (scores.get(i.id) ?? 1) >= 3 || isMarketTalk(i));
  return ask(cfg, PRICE_PROMPT, `${formatMarket(market, week.id)}\n\n${formatItems(context, week)}`, (r) => resolvePrice(r, context));
}

/** `memory` is a digest of earlier issues (see memory.ts), or "" for the first issue. */
export async function writeEdition(cfg: LlmConfig, items: SourceItem[], week: Week, market?: Market, memory = "") {
  const withMemory = (text: string) => (memory ? `${memory}\n\n${text}` : text);
  console.log("  triage…");
  const scores = await ask(cfg, TRIAGE_PROMPT, withMemory(formatItems(items, week)), (r) => parseTriage(r, items));
  const { news, extra, material, floor } = editorialMaterial(items, scores);
  console.log(`  ${news.length} news items, plus ${extra.length} for the feature and quotes, of ${items.length}`);

  console.log("  editorial…");
  const lists = `${formatItems([], week)}NEWS ITEMS\n\n${formatItems(news, week, scores, false)}\nMORE MATERIAL (feature and quotes only)\n\n${formatItems(extra, week, scores, false)}`;
  const editorial = await ask(cfg, EDITORIAL_PROMPT, withMemory(lists), (r, last) => resolveDraft(r, material, scores, floor, last));
  const price = await writePrice(cfg, items, scores, week, market);
  return { editorial, price, scores };
}
