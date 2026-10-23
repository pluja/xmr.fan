/* The weekly Times on autopilot, for the scheduled jobs (ops/job.sh).
     npm run gazette:auto -- draft     # write, translate and voice last week's issue, then announce it
     npm run gazette:auto -- publish   # publish it once the review window has passed, unless held
   Each step is skipped when its output already exists, so a failed run can simply run again.
   GAZETTE_REVIEW_HOURS (default 12) is the time between "draft ready" and going live;
   npm run gazette:hold -- <week> stops it. PODCAST_LANGS (default "en,es") picks the audio languages. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { editionSchema, type EditionData } from "../../src/lib/gazette-schema.ts";
import { notify } from "../notify.ts";
import { LANGUAGES } from "./translate.ts";
import { lastFullWeek } from "./week.ts";

const SITE = "https://xmr.fan";
const REVIEW_HOURS = Number(process.env.GAZETTE_REVIEW_HOURS ?? 12);
const PODCAST_LANGS = (process.env.PODCAST_LANGS ?? "en,es").split(",").map((l) => l.trim()).filter(Boolean);

const week = lastFullWeek();
const file = `src/data/gazette/${week.id}.json`;
/** Written when every step of the draft is done; its time starts the review window. */
const draftedMarker = `.gazette/${week.id}.drafted`;
const holdMarker = `.gazette/${week.id}.hold`;

const read = (): EditionData => editionSchema.parse(JSON.parse(readFileSync(file, "utf8")));

function run(script: string, ...args: string[]) {
  console.log(`\n$ npm run ${script} -- ${args.join(" ")}`);
  const { status } = spawnSync("npm", ["run", "--silent", script, "--", ...args], { stdio: "inherit" });
  if (status !== 0) throw new Error(`npm run ${script} ${args.join(" ")} failed (exit ${status})`);
}

const headlines = (e: EditionData) =>
  [e.lead.h, ...Object.values(e.sections).flat().slice(0, 4).map((s) => s.h)].map((h) => `• ${h}`).join("\n");

async function draft() {
  if (!existsSync(file)) run("gazette", "--week", week.id);
  let edition = read();
  if (!edition.draft) return console.log(`No. ${edition.no} is already published.`);

  const untranslated = Object.keys(LANGUAGES).filter((l) => !edition.translations?.[l]);
  if (untranslated.length) {
    run("gazette:translate", week.id, "--lang", untranslated.join(","));
    const missing = untranslated.filter((l) => !read().translations?.[l]);
    if (missing.length) throw new Error(`Translation failed for ${missing.join(", ")}; the next run retries.`);
  }
  for (const lang of PODCAST_LANGS) {
    edition = read();
    const has = lang === "en" ? edition.podcast : edition.podcasts?.[lang];
    if (!has) run("gazette:podcast", week.id, ...(lang === "en" ? [] : ["--lang", lang]));
  }

  if (existsSync(draftedMarker)) return;
  writeFileSync(draftedMarker, new Date().toISOString());
  edition = read();
  const at = new Date(Date.now() + REVIEW_HOURS * 3_600_000).toISOString().slice(11, 16);
  await notify({
    title: `Times No. ${edition.no} is ready for review`,
    body: `${headlines(edition)}\n\nGoes live around ${at} UTC. To stop it: npm run gazette:hold -- ${week.id}`,
    tags: ["newspaper"],
  });
}

async function publish() {
  if (!existsSync(file) || !existsSync(draftedMarker)) return console.log(`The issue for ${week.id} isn't ready yet.`);
  const edition = read();
  if (!edition.draft) return console.log(`No. ${edition.no} is already published.`);
  if (existsSync(holdMarker)) return console.log(`No. ${edition.no} is on hold.`);
  const readyFor = (Date.now() - new Date(readFileSync(draftedMarker, "utf8")).getTime()) / 3_600_000;
  if (readyFor < REVIEW_HOURS) return console.log(`No. ${edition.no} goes live in ${(REVIEW_HOURS - readyFor).toFixed(1)} h.`);
  run("gazette:publish", week.id);
  await notify({ title: `Times No. ${edition.no} is live`, body: edition.lead.h, tags: ["white_check_mark"], click: `${SITE}/news` });
}

const step = process.argv[2];
if (step === "draft") await draft();
else if (step === "publish") await publish();
else {
  console.error("Usage: npm run gazette:auto -- draft | publish");
  process.exit(1);
}
