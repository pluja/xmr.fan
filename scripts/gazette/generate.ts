/* Writes a draft issue of The xmr.fan Times for one week.
     npm run gazette                    # the last complete week
     npm run gazette -- --week 2026-10-12 [--force] [--reuse-sources]
     npm run gazette -- --week 2026-10-12 --only-price   # refresh the numbers and redo the price note only
     npm run gazette -- --week 2026-10-12 --only-art     # redraw the headline art from its brief
   Needs OPENAI_ENDPOINT, MODEL and API_KEY. Optional NANO_GPT_API_KEY adds X and
   Reddit (with votes). The draft only appears in development until it is
   approved with: npm run gazette:publish -- <week> */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { editionSchema, type EditionData } from "../../src/lib/gazette-schema.ts";
import { drawImage } from "./art.ts";
import { writeEdition, writePrice } from "./editor.ts";
import { llmConfigFromEnv } from "./llm.ts";
import { dropCovered, formatMemory, pastIssues } from "./memory.ts";
import { marketWeek } from "./market.ts";
import { networkStats } from "./network.ts";
import { collectSources, type SourceItem } from "./sources.ts";
import { lastFullWeek, weekStarting } from "./week.ts";

const EDITIONS_DIR = "src/data/gazette";
const WORK_DIR = ".gazette";

const { values } = parseArgs({
  options: {
    week: { type: "string" },
    force: { type: "boolean", default: false },
    // Rewrite a draft from the sources saved last time, without fetching them again.
    "reuse-sources": { type: "boolean", default: false },
    // Refresh the numbers and rewrite only the price note; the rest and the podcast stay.
    "only-price": { type: "boolean", default: false },
    "only-art": { type: "boolean", default: false },
  },
});
const week = values.week ? weekStarting(values.week) : lastFullWeek();
const outFile = `${EDITIONS_DIR}/${week.id}.json`;
if (values["only-price"]) {
  await redoPrice();
  process.exit(0);
}
if (values["only-art"]) {
  const edition = editionSchema.parse(JSON.parse(readFileSync(outFile, "utf8")));
  if (!edition.art) throw new Error(`${outFile} has no art brief.`);
  const art = await makeArt(edition.art);
  // Re-read: the issue may have changed while the picture was drawn (e.g. a podcast run).
  const latest = editionSchema.parse(JSON.parse(readFileSync(outFile, "utf8")));
  writeFileSync(outFile, JSON.stringify({ ...latest, art }, null, 2) + "\n");
  console.log(`Art (${art.file}): ${edition.art.prompt}`);
  process.exit(0);
}
if (existsSync(outFile) && !values.force) {
  console.error(`${outFile} already exists. Use --force to replace it.`);
  process.exit(1);
}
const llm = llmConfigFromEnv();
const sourcesFile = `${WORK_DIR}/${week.id}.sources.json`;

const report = (ok: boolean, name: string, detail: string) => console.log(`  ${ok ? "✓" : "✗"} ${name}: ${detail}`);
const settle = <T>(name: string, p: Promise<T>) =>
  p.then((v) => (report(true, name, "ok"), v)).catch((e) => (report(false, name, (e as Error).message), undefined));

console.log(`The xmr.fan Times, week of ${week.id}`);
let items: SourceItem[];
if (values["reuse-sources"]) {
  if (!existsSync(sourcesFile)) throw new Error(`No saved sources at ${sourcesFile}; run without --reuse-sources first.`);
  items = JSON.parse(readFileSync(sourcesFile, "utf8"));
  console.log(`Reusing ${items.length} saved source items`);
} else {
  console.log("Collecting sources…");
  const collected = await collectSources(week);
  for (const r of collected.report) report(!r.error, r.name, r.error ?? `${r.count} items`);
  items = collected.items;
}
const [network, market] = await Promise.all([settle("network stats", networkStats(week)), settle("price (CoinGecko)", marketWeek(week))]);
if (!items.length) {
  console.error("No source items for this week; nothing to write.");
  process.exit(1);
}
mkdirSync(WORK_DIR, { recursive: true });
writeFileSync(sourcesFile, JSON.stringify(items, null, 2));

console.log(`Writing with ${llm.model}…`);
const past = pastIssues(week.id);
const covered = dropCovered(items, past);
if (past.length) console.log(`Remembering ${past.length} earlier issue(s); ${covered.dropped} already-covered item(s) dropped`);
const { editorial, price, scores } = await writeEdition(llm, covered.fresh, week, market, formatMemory(past));
if (editorial.art) {
  console.log("  art…");
  editorial.art = await makeArt(editorial.art).catch((e) => {
    console.warn(`  art failed: ${(e as Error).message}`);
    return editorial.art;
  });
}

// For the human reviewer.
const triage = items
  .map((i) => ({ score: scores.get(i.id), id: i.id, source: i.source, title: i.title, url: i.url }))
  .sort((a, b) => b.score! - a.score!);
writeFileSync(`${WORK_DIR}/${week.id}.triage.json`, JSON.stringify(triage, null, 2));

const others = readdirSync(EDITIONS_DIR)
  .filter((f) => f.endsWith(".json") && f !== `${week.id}.json`)
  .map((f) => JSON.parse(readFileSync(`${EDITIONS_DIR}/${f}`, "utf8")) as EditionData)
  .filter((e) => !e.sample);
const edition = editionSchema.parse({
  no: Math.max(0, ...others.map((e) => e.no)) + 1,
  week: week.id,
  draft: true,
  ...editorial,
  network,
  market: market && { ...market, analysis: price },
  generated: { model: llm.model, at: new Date().toISOString(), items: items.length },
});
writeFileSync(outFile, JSON.stringify(edition, null, 2) + "\n");

console.log(`\nDraft written to ${outFile} (No. ${edition.no})\n`);
console.log(`Lead: ${edition.lead.h}`);
for (const [key, stories] of Object.entries(edition.sections)) for (const s of stories) console.log(`  [${key}] ${s.h}`);
if (edition.feature) console.log(`\nFeature: ${edition.feature.h}`);
for (const q of edition.quotes ?? []) console.log(`Quote: "${q.text}" (${q.who})`);
if (price) console.log(`Price: ${price.summary || "(no note)"}${price.drivers.map((d) => `\n  driver: ${d.text}`).join("")}`);
console.log(`\nReview it (sources and scores in ${WORK_DIR}/), then optionally: npm run gazette:podcast -- ${week.id}`);
console.log(`Publish with: npm run gazette:publish -- ${week.id}`);

async function redoPrice() {
  const sourcesFile = `${WORK_DIR}/${week.id}.sources.json`, triageFile = `${WORK_DIR}/${week.id}.triage.json`;
  for (const f of [outFile, sourcesFile, triageFile]) if (!existsSync(f)) throw new Error(`${f} is missing; generate the issue first.`);
  const edition = editionSchema.parse(JSON.parse(readFileSync(outFile, "utf8")));
  const items: SourceItem[] = JSON.parse(readFileSync(sourcesFile, "utf8"));
  const scores = new Map<string, number>(JSON.parse(readFileSync(triageFile, "utf8")).map((t: { id: string; score: number }) => [t.id, t.score]));
  console.log(`Price note for the week of ${week.id}`);
  const [network, market] = await Promise.all([networkStats(week), marketWeek(week)]);
  const price = await writePrice(llmConfigFromEnv(), items, scores, week, market);
  writeFileSync(outFile, JSON.stringify(editionSchema.parse({ ...edition, network, market: market && { ...market, analysis: price } }), null, 2) + "\n");
  console.log(`Price: ${price?.summary || "(no note)"}`);
  for (const d of price?.drivers ?? []) console.log(`  driver: ${d.text}`);
}

/** Draws the brief as pixel art. The original is kept in .gazette/; the site gets a
    WebP (quality 92 keeps the dithering crisp at about a tenth of the PNG's size). */
async function makeArt(art: NonNullable<EditionData["art"]>): Promise<NonNullable<EditionData["art"]>> {
  if (!process.env.NANO_GPT_API_KEY) throw new Error("NANO_GPT_API_KEY is needed for images");
  const { bytes, ext } = await drawImage(art.prompt);
  mkdirSync(WORK_DIR, { recursive: true });
  const original = `${WORK_DIR}/${week.id}.art.${ext}`;
  writeFileSync(original, bytes);
  mkdirSync("public/news-art", { recursive: true });
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", original, "-c:v", "libwebp", "-q:v", "92", "-compression_level", "6", `public/news-art/${week.id}.webp`]);
  return { ...art, file: `/news-art/${week.id}.webp` };
}
