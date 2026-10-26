import { test } from "node:test";
import assert from "node:assert/strict";
import { lastFullWeek, weekStarting, inWeek } from "./week.ts";
import { resolveDraft, formatItems, parseTriage, selectImportant, resolvePrice, isMarketTalk, speaker } from "./editor.ts";
import { excerpt, type SourceItem } from "./sources.ts";

test("last full week runs Monday to Monday", () => {
  const w = lastFullWeek(new Date("2026-10-20T15:00:00Z")); // a Tuesday
  assert.equal(w.id, "2026-10-12");
  assert.equal(w.to.toISOString(), "2026-10-19T00:00:00.000Z");
  assert.equal(lastFullWeek(new Date("2026-10-19T00:00:00Z")).id, "2026-10-12"); // Monday itself
  assert.equal(lastFullWeek(new Date("2026-10-18T23:59:59Z")).id, "2026-10-05"); // Sunday
});

test("weeks must start on a Monday", () => {
  assert.throws(() => weekStarting("2026-10-13"));
  const w = weekStarting("2026-10-12");
  assert.equal(inWeek(new Date("2026-10-18T23:59:59Z"), w), true);
  assert.equal(inWeek(new Date("2026-10-19T00:00:00Z"), w), false);
});

test("excerpts strip tags and cap length", () => {
  assert.equal(excerpt("<p>Hello <b>world</b></p>\n\n again", 100), "Hello world again");
  assert.equal(excerpt("x".repeat(50), 10).length, 10);
  assert.equal(excerpt("It&#39;s &amp; &quot;new&quot; &#x2014; ok &bogus;"), 'It\'s & "new" \u2014 ok &bogus;');
});

const items: SourceItem[] = [
  { id: "S1", source: "github.com/monero-project/monero", kind: "release", title: "monero v1", url: "https://github.com/r/1", date: "2026-10-17T00:00:00Z", text: "fixes" },
  { id: "S2", source: "getmonero.org", kind: "blog", title: "Post", url: "https://getmonero.org/p", date: "2026-10-16T00:00:00Z", text: "" },
];
const RECAP = "A quiet week: one release and a few small fixes.";
// Editorial replies need a recap; price replies have none, so only add it where a lead is present.
const reply = (o: Record<string, unknown>) => "```json\n" + JSON.stringify("lead" in o && !("recap" in o) ? { recap: RECAP, ...o } : o) + "\n```";

test("resolves item ids into links and source labels", () => {
  const r = resolveDraft(reply({
    lead: { h: "Release", p: "A release.", items: ["S1"] },
    sections: { dev: [], eco: [{ h: "Post", p: "A post.", items: ["S2"] }], comm: [] },
  }), items);
  assert.deepEqual(r.lead, { h: "Release", p: "A release.", src: "github.com/monero-project/monero", url: "https://github.com/r/1" });
  assert.equal(r.sections.eco[0].url, "https://getmonero.org/p");
});

test("a story can cite several items: the first is the main source", () => {
  const r = resolveDraft(reply({ lead: { h: "Both", p: "P", items: ["S2", "S1"] }, sections: { dev: [], eco: [], comm: [] } }), items);
  assert.equal(r.lead.url, "https://getmonero.org/p");
  assert.deepEqual(r.lead.more, [{ src: "github.com/monero-project/monero", url: "https://github.com/r/1" }]);
});

test("rejects unknown or reused items, bad JSON and wrong shapes", () => {
  const story = (...items: string[]) => ({ h: "H", p: "P", items });
  assert.throws(() => resolveDraft(reply({ lead: story("S9"), sections: { dev: [], eco: [], comm: [] } }), items), /S9/);
  assert.throws(() => resolveDraft(reply({ lead: story("S1"), sections: { dev: [story("S2", "S1")], eco: [], comm: [] } }), items), /more than once/);
  assert.throws(() => resolveDraft(reply({ lead: story(), sections: { dev: [], eco: [], comm: [] } }), items), /shape/);
  assert.throws(() => resolveDraft("not json", items), /not valid JSON/);
  assert.throws(() => resolveDraft(reply({ lead: story("S1") }), items), /shape/);
});

test("formats items for the model with ids and the week", () => {
  const text = formatItems(items, weekStarting("2026-10-12"));
  assert.match(text, /^Week: 2026-10-12 to 2026-10-18/);
  assert.match(text, /\[S1\] release \| github.com\/monero-project\/monero \| 2026-10-17/);
});

test("triage scores every item, defaulting the odd missing one to 1", () => {
  const many: SourceItem[] = Array.from({ length: 12 }, (_, n) => ({ ...items[0], id: `S${n + 1}`, url: `https://x/${n}` }));
  const scores = Object.fromEntries(many.slice(0, 11).map((i) => [i.id, 2]));
  const r = parseTriage(JSON.stringify({ scores }), many);
  assert.equal(r.get("S12"), 1);
  assert.throws(() => parseTriage(JSON.stringify({ scores: { S1: 2 } }), many), /missing/);
  assert.throws(() => parseTriage(JSON.stringify({ scores: { S1: 9 } }), items), /match/);
});

test("news may use everything scored 3 or more, best first; 1s and 2s stay out", () => {
  const pool: SourceItem[] = Array.from({ length: 8 }, (_, n) => ({ ...items[0], id: `S${n + 1}` }));
  const scores = new Map(pool.map((i, n) => [i.id, [3, 5, 2, 4, 3, 1, 3, 2][n]]));
  assert.deepEqual(selectImportant(pool, scores).map((i) => i.id), ["S2", "S4", "S1", "S5", "S7"]);
});

test("price drivers resolve to sources; unknown ids are rejected", () => {
  const ok = resolvePrice(JSON.stringify({ summary: "", drivers: [{ text: "Release.", items: ["S1"] }], watch: [] }), items);
  assert.equal(ok.drivers[0].url, "https://github.com/r/1");
  assert.equal(ok.summary, "");
  assert.throws(() => resolvePrice(JSON.stringify({ summary: "y", drivers: [{ text: "z", items: ["S7"] }], watch: [] }), items), /S7/);
});

const post: SourceItem = { id: "S3", source: "x.com/alice", kind: "social", title: "Monero is cash", url: "https://x.com/alice/status/1", date: "2026-10-15T00:00:00Z", text: "Monero is digital cash, and that's the point. (40 likes, 2 reposts)" };
const empty = { dev: [], eco: [], comm: [] };

test("quotes must be word for word; who said it comes from the source", () => {
  const all = [...items, post];
  const r = resolveDraft(reply({ lead: { h: "L", p: "P", items: ["S1"] }, quotes: [{ quote: "Monero is digital cash, and that’s the point.", item: "S3" }], sections: empty }), all);
  assert.deepEqual(r.quotes, [{ text: "Monero is digital cash, and that’s the point.", who: "@alice", url: "https://x.com/alice/status/1", src: "x.com/alice" }]);
  assert.throws(() => resolveDraft(reply({ lead: { h: "L", p: "P", items: ["S1"] }, quotes: [{ quote: "Monero is the future of money.", item: "S3" }], sections: empty }), all), /word for word/);
  assert.equal(speaker(items[1]), "getmonero.org");
});

test("the feature resolves with its sources and cannot reuse the lead's item", () => {
  const all = [...items, post];
  const r = resolveDraft(reply({ lead: { h: "L", p: "P", items: ["S1"] }, feature: { h: "F", dek: "D", body: ["one", "two"], items: ["S2", "S3"] }, sections: empty }), all);
  assert.equal(r.feature?.url, "https://getmonero.org/p");
  assert.deepEqual(r.feature?.body, ["one", "two"]);
  assert.throws(() => resolveDraft(reply({ lead: { h: "L", p: "P", items: ["S1"] }, feature: { h: "F", body: ["a", "b"], items: ["S1"] }, sections: empty }), all), /more than once/);
});

test("news stories need the importance floor", () => {
  const scores = new Map([["S1", 5], ["S2", 2]]);
  assert.throws(() => resolveDraft(reply({ lead: { h: "L", p: "P", items: ["S1"] }, sections: { dev: [{ h: "H", p: "P", items: ["S2"] }], eco: [], comm: [] } }), items, scores, 4), /importance 2/);
});

test("market talk is recognised for the price section", () => {
  const post = (title: string, kind: SourceItem["kind"] = "social") => ({ ...items[0], kind, title, text: "" });
  assert.equal(isMarketTalk(post("Monero ($XMR) at $585 while the market stays flat")), true);
  assert.equal(isMarketTalk(post("XMR breaks resistance on rising volume")), true);
  assert.equal(isMarketTalk(post("New wallet release")), false);
  assert.equal(isMarketTalk(post("price talk in a release note", "release")), false);
});

test("podcast keeps known audio tags and drops the rest", async () => {
  const { cleanTags } = await import("./audio-tags.ts");
  assert.equal(cleanTags("[Laughs] No way. [pause] Really? [curious]"), "[laughs] No way. Really? [curious]");
  assert.equal(cleanTags("[music swells]"), "");
});

test("art files get the right extension from their bytes", async () => {
  const { imageExtension } = await import("./art.ts");
  assert.equal(imageExtension(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])), "png");
  assert.equal(imageExtension(Buffer.from("RIFF0000WEBPVP8 ")), "webp");
  assert.equal(imageExtension(Buffer.from([0xff, 0xd8, 0xff])), "jpg");
  assert.throws(() => imageExtension(Buffer.from("nope")));
});

test("memory: links cited in recent issues are dropped, and the digest lists them newest first", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { pastIssues, dropCovered, formatMemory } = await import("./memory.ts");
  const dir = mkdtempSync(`${tmpdir()}/times-`);
  const issue = (no: number, week: string, url: string, extra = {}) => writeFileSync(`${dir}/${week}.json`, JSON.stringify({
    no, week, recap: `Recap ${no}.`, lead: { h: `Lead ${no}`, p: "P", src: "s", url }, sections: { dev: [], eco: [], comm: [] }, ...extra,
  }));
  issue(1, "2026-09-28", "https://github.com/r/1");
  issue(2, "2026-10-05", "https://getmonero.org/p");
  issue(3, "2026-10-12", "https://later.example/x"); // not before the week being written
  issue(9, "2026-09-21", "https://sample.example/x", { sample: true });

  const past = pastIssues("2026-10-12", 4, dir);
  assert.deepEqual(past.map((e) => e.no), [2, 1]);
  const { fresh, dropped } = dropCovered(items, past);
  assert.equal(dropped, 2);
  assert.equal(fresh.length, 0);
  assert.match(formatMemory(past), /No\. 2, week of 2026-10-05: Recap 2\.\n  Headlines: Lead 2/);
  assert.equal(formatMemory([]), "");
});

test("on the last attempt, stories breaking citation rules are dropped instead of failing the issue", () => {
  const scores = new Map([["S1", 5], ["S2", 2]]);
  const draft = reply({ lead: { h: "L", p: "P", items: ["S1"] }, sections: { dev: [{ h: "Low", p: "P", items: ["S2"] }], eco: [], comm: [] } });
  assert.throws(() => resolveDraft(draft, items, scores, 4));
  const r = resolveDraft(draft, items, scores, 4, true);
  assert.deepEqual(r.sections.dev, []);
  assert.equal(r.lead.url, "https://github.com/r/1");
});

test("translations must keep the shape, names and version numbers", async () => {
  const { shapeDiff, missingTerms } = await import("./translate.ts");
  const en = { lead: { h: "Monero v0.18.5.4 is out", p: "P" }, sections: { dev: [{ h: "a", p: "b" }], eco: [] } };
  assert.equal(shapeDiff(en, { lead: { h: "Sale Monero v0.18.5.4", p: "P" }, sections: { dev: [{ h: "x", p: "y" }], eco: [] } }), "");
  assert.match(shapeDiff(en, { lead: { h: "x", p: "y" }, sections: { dev: [], eco: [] } }), /sections\.dev must be a list of 1/);
  assert.match(shapeDiff(en, { lead: { h: "x", p: "y", extra: "z" }, sections: { dev: [{ h: "x", p: "y" }], eco: [] } }), /unexpected keys: extra/);
  assert.match(shapeDiff(en, { lead: { h: "", p: "y" }, sections: { dev: [{ h: "x", p: "y" }], eco: [] } }), /lead\.h must be a non-empty string/);
  assert.deepEqual(missingTerms("Monero v0.18.5.4 on GrapheneOS", "モネロ v0.18.5.4 GrapheneOS"), ["Monero"]);
  assert.deepEqual(missingTerms("Monero 0.18.5.4", "Monero 0.18.5"), ["0.18.5.4"]);
  assert.deepEqual(missingTerms("Monero asks 2.96 XMR, v1.11 out", "Monero pide 2,96 XMR, v1.11"), []);
});

test("upcoming events resolve with sources, soonest first; news is ordered by importance", () => {
  const scores = new Map([["S1", 5], ["S2", 4], ["S3", 3]]);
  const all = [...items, { ...items[1], id: "S3", url: "https://getmonero.org/q" }];
  const r = resolveDraft(reply({
    lead: { h: "L", p: "P", items: ["S1"] },
    upcoming: [
      { date: "2026-10-28", what: "Later", items: ["S2"] },
      { date: "2026-10-21", time: "17:00 UTC", what: "Sooner", items: ["S3"] },
    ],
    sections: { dev: [{ h: "Minor", p: "P", items: ["S3"] }, { h: "Major", p: "P", items: ["S2"] }], eco: [], comm: [] },
  }), all, scores, 3);
  assert.deepEqual(r.upcoming?.map((u) => [u.date, u.time, u.what]), [["2026-10-21", "17:00 UTC", "Sooner"], ["2026-10-28", undefined, "Later"]]);
  assert.deepEqual(r.sections.dev.map((s) => s.h), ["Major", "Minor"]);
});

test("sponsor tiers: totals add up across sponsorships; ids come from names", async () => {
  const { slugify, tierOf, summarizeSponsors } = await import("../../src/lib/sponsor-schema.ts");
  const tiers = [{ key: "fan", minUsd: 50 }, { key: "bigfan", minUsd: 150 }, { key: "superfan", minUsd: 500 }, { key: "legend", minUsd: 1000 }];
  assert.equal(slugify("Proton Mail!"), "proton-mail");
  assert.equal(slugify("Café Zürich"), "cafe-zurich");
  assert.equal(tierOf(tiers, 50), "fan");
  assert.equal(tierOf(tiers, 499.99), "bigfan");
  assert.equal(tierOf(tiers, 1000), "legend");
  const s = (week: string, sponsor: string, usd: number, name = sponsor) => ({ week, sponsor, name, line: "l", usd });
  const [a, b] = summarizeSponsors([s("2026-10-05", "acme", 60, "Acme Old"), s("2026-10-12", "acme", 100, "Acme"), s("2026-10-12", "zed", 50)], tiers)
    .sort((x, y) => y.total - x.total);
  assert.deepEqual([a.name, a.total, a.times, a.tier, a.latest], ["Acme", 160, 2, "bigfan", "2026-10-12"]);
  assert.deepEqual([b.name, b.times, b.tier], ["zed", 1, "fan"]);
});

test("sponsor requests must accept the rules", async () => {
  const { requestSchema } = await import("../../src/lib/sponsor-schema.ts");
  const ok = { name: "A", line: "B", url: "", week: "", amount: "0.1", txid: "a".repeat(64), txkey: "b".repeat(64), contact: "", accept: "yes" };
  assert.equal(requestSchema.safeParse(ok).success, true);
  assert.equal(requestSchema.safeParse({ ...ok, accept: "" }).success, false);
  assert.equal(requestSchema.safeParse({ ...ok, url: "javascript:alert(1)" }).success, false);
});

test("podcast audio spells out names the voice would read as one word", async () => {
  const { forSpeech } = await import("./pronounce.ts");
  assert.equal(forSpeech("Update monerod, then FCMP++."), "Update monero D, then F C M P plus plus.");
  assert.equal(forSpeech("monerodevs.org and xmr.fan stay as they are"), "monerodevs.org and xmr.fan stay as they are");
});
