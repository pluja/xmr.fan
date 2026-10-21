/* Turns an issue into a two-host audio episode.
     npm run gazette:podcast -- 2026-10-12 [--new-script] [--lang es]
   1. An AI model writes a conversation based only on the issue.
   2. Each turn is voiced with nano-gpt's text-to-speech (NANO_GPT_API_KEY).
   3. ffmpeg joins the clips into public/podcast/<week>.mp3.
   Clips are cached in .gazette/podcast/<week>/, so a failed run resumes where it stopped.
   --lang writes and voices the episode in another language from the issue's translation
   (run gazette:translate first); it is saved as public/podcast/<week>.<lang>.mp3.
   Optional: PODCAST_HOSTS="Chris:Chris,Jessica:Jessica" (name:voice), PODCAST_HOSTS_ES (per language),
   PODCAST_TTS_MODEL, PODCAST_MINUTES. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { z } from "astro/zod";
import type { Locale } from "../../src/i18n/ui.ts";
import { localize, type LocalizedData } from "../../src/lib/gazette-localize.ts";
import { editionSchema } from "../../src/lib/gazette-schema.ts";
import { AUDIO_TAGS, cleanTags } from "./audio-tags.ts";
import { chat, llmConfigFromEnv } from "./llm.ts";
import { pastIssues } from "./memory.ts";
import { LANGUAGES } from "./translate.ts";
import { weekStarting } from "./week.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { "new-script": { type: "boolean", default: false }, lang: { type: "string", default: "en" } },
});
const week = weekStarting(positionals[0] ?? "");
const lang = values.lang as Locale;
if (lang !== "en" && !LANGUAGES[lang]) throw new Error(`Unknown language "${lang}". Use: en, ${Object.keys(LANGUAGES).join(", ")}`);
const suffix = lang === "en" ? "" : `.${lang}`;
const editionFile = `src/data/gazette/${week.id}.json`;
const workDir = `.gazette/podcast/${week.id}`;
const scriptFile = `.gazette/${week.id}.podcast${suffix}.json`;
const outFile = `public/podcast/${week.id}${suffix}.mp3`;
const newsUrl = `xmr.fan${lang === "en" ? "" : `/${lang}`}/news`;

const apiKey = process.env.NANO_GPT_API_KEY;
if (!apiKey) throw new Error("Set NANO_GPT_API_KEY for text-to-speech.");
const TTS_MODEL = process.env.PODCAST_TTS_MODEL ?? "elevenlabs/eleven-v4";
const MINUTES = Number(process.env.PODCAST_MINUTES ?? 12);
const HOSTS = (process.env[`PODCAST_HOSTS_${lang.toUpperCase()}`] ?? process.env.PODCAST_HOSTS ?? "Chris:Chris,Jessica:Jessica").split(",").map((h) => {
  const [name, voice = name] = h.split(":").map((s) => s.trim());
  return { name, voice };
});
const SAMPLE_RATE = 44_100;

const edition = editionSchema.parse(JSON.parse(readFileSync(editionFile, "utf8")));
if (lang !== "en" && !edition.translations?.[lang]) throw new Error(`No ${LANGUAGES[lang]} text yet: run npm run gazette:translate -- ${week.id} --lang ${lang}`);
const issue = localize(edition, lang);

function issueAsText(e: LocalizedData): string {
  const story = (s: { h: string; p: string }) => `- ${s.h}: ${s.p}`;
  const previous = pastIssues(e.week, 1)[0];
  const parts = [`Issue No. ${e.no}, week of ${e.week}.`];
  if (previous?.recap) parts.push(`LAST WEEK (No. ${previous.no}; mention only if a story continues)\n${previous.recap}`);
  parts.push(`LEAD\n${story(e.lead)}`);
  const sponsorDir = "src/data/sponsors";
  const sponsors = existsSync(sponsorDir)
    ? readdirSync(sponsorDir).filter((f) => f.startsWith(e.week) && f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`${sponsorDir}/${f}`, "utf8")))
    : [];
  if (sponsors.length) parts.push(`SPONSORS (thank them warmly by name in the sign-off, in one or two sentences)\n${sponsors.map((sp) => `${sp.name}: ${sp.line}`).join("\n")}`);
  if (e.feature) parts.push(`FEATURE\n${e.feature.h}${e.feature.dek ? ` (${e.feature.dek})` : ""}\n${e.feature.body.join("\n")}`);
  if (e.upcoming?.length) parts.push(`COMING UP\n${e.upcoming.map((u) => `- ${u.date}${u.time ? ` ${u.time}` : ""}: ${u.what}`).join("\n")}`);
  if (e.quotes?.length) {
    const quote = (q: NonNullable<LocalizedData["quotes"]>[number]) => (q.gloss ? `- ${q.who}: "${q.gloss}" (translated from: "${q.text}")` : `- ${q.who}: "${q.text}"`);
    parts.push(`OVERHEARD (exact quotes)\n${e.quotes.map(quote).join("\n")}`);
  }
  for (const [name, key] of [["DEVELOPMENT", "dev"], ["ECOSYSTEM", "eco"], ["COMMUNITY", "comm"], ["PRIVACY BEYOND MONERO", "privacy"]] as const) {
    if (e.sections[key].length) parts.push(`${name}\n${e.sections[key].map(story).join("\n")}`);
  }
  if (e.network) {
    const n = e.network;
    parts.push(`NETWORK (weekly averages; previous week in brackets)\nhashrate ${n.hash} GH/s [${n.prev?.hash ?? "?"}], ${n.txs} transactions per day [${n.prev?.txs ?? "?"}], average fee ${n.fee} XMR [${n.prev?.fee ?? "?"}]`);
  }
  if (e.market) {
    const m = e.market;
    parts.push(`PRICE (USD)\nopen ${m.open}, close ${m.close}, change ${m.change}%, range ${m.low} to ${m.high}, Bitcoin ${m.btcChange}%\n${m.analysis?.summary ?? ""}\n${(m.analysis?.drivers ?? []).map((d) => `- ${d.text}`).join("\n")}`);
  }
  return parts.join("\n\n");
}

const PODCAST_PROMPT = `Write the script for this week's episode of "The xmr.fan Times" podcast: a conversation of about ${MINUTES} minutes (around ${MINUTES * 150} words) between two hosts, ${HOSTS.map((h) => h.name).join(" and ")}, about the issue below.

The facts:
- Use only facts from the issue. No new facts, numbers or claims. No price predictions, no trading advice.
- When you quote someone from OVERHEARD, use their exact words and say who said it.

The conversation:
- Two people who know Monero well and enjoy talking about it, explaining the week to a curious listener. Make it a real back-and-forth, not two people reading alternate paragraphs: they ask each other questions, follow up ("wait, so what does that mean for my wallet?"), react with surprise or delight, tease each other lightly, sometimes finish a thought the other started, and hand over naturally.
- Short turns, usually 1 to 3 sentences; an occasional longer one when explaining something.
- Structure: a quick hello and what is coming up; the lead; the price; the feature; a few quotes from OVERHEARD; the other news, grouped naturally; the network numbers in a sentence or two; a short sign-off pointing listeners to ${newsUrl} for the links.

Voice direction (the audio is generated by a voice model that understands tags):
- You may add these tags, in square brackets, right before or after the words they color: ${AUDIO_TAGS.map((t) => `[${t}]`).join(", ")}. Use them where a real person would, about once every three or four turns, never two in a row from the same host. No other tags.
- Use ellipses (...) for natural pauses and occasional fillers ("hm", "right", "okay so") sparingly.

Write for the ear: no URLs, no markdown, no emoji. Say numbers the way people say them ("about six gigahashes per second", "around five hundred ninety dollars"). Explain abbreviations the first time (CCS is the Community Crowdfunding System).

${lang === "en" ? "" : `Language: write the whole conversation in natural, spoken ${LANGUAGES[lang]}, as native speakers would talk, not as a translation. Keep names of people, projects and software as they are. Quotes from OVERHEARD come translated: use the translation and say that it is translated. The voice tags stay in English, exactly as listed. Say numbers the way ${LANGUAGES[lang]} speakers say them.\n\n`}Reply with JSON only: {"turns":[{"host":"${HOSTS[0].name}","text":"..."}]}`;

const scriptSchema = z.object({
  turns: z.array(z.object({ host: z.enum(HOSTS.map((h) => h.name) as [string, ...string[]]), text: z.string().min(1).max(1200) })).min(10),
});
type Turn = z.infer<typeof scriptSchema>["turns"][number];

async function writeScript(): Promise<Turn[]> {
  const llm = llmConfigFromEnv();
  const messages = [
    { role: "system" as const, content: PODCAST_PROMPT },
    { role: "user" as const, content: issueAsText(issue) },
  ];
  for (let attempt = 1; ; attempt++) {
    const reply = await chat(llm, messages);
    try {
      const parsed = scriptSchema.safeParse(JSON.parse(reply.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "")));
      if (!parsed.success) throw new Error(`The JSON does not match the requested shape: ${parsed.error.message}`);
      const words = parsed.data.turns.reduce((n, t) => n + t.text.replace(/\[[^\]]*\]/g, "").split(/\s+/).length, 0);
      if (words < MINUTES * 110) throw new Error(`The script has ${words} words; it needs about ${MINUTES * 150}.`);
      return parsed.data.turns.map((t) => ({ ...t, text: cleanTags(t.text) })).filter((t) => t.text);
    } catch (e) {
      if (attempt >= 3) throw e;
      console.warn(`  attempt ${attempt} rejected: ${(e as Error).message.slice(0, 200)}`);
      messages.push({ role: "assistant", content: reply } as never, { role: "user", content: `${(e as Error).message} Reply again with JSON only.` } as never);
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tts(text: string, voice: string): Promise<Buffer> {
  const res = await fetch("https://nano-gpt.com/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey! },
    body: JSON.stringify({ input: text, voice, speed: 1, model: TTS_MODEL, stability: 0.5, similarity: 0.75 }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`TTS request failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const job = await res.json();
  let audioUrl: string | undefined = job.audioUrl;
  for (let waited = 0; !audioUrl; waited += 2000) {
    if (waited > 300_000) throw new Error("TTS took longer than 5 minutes");
    await sleep(2000);
    const params = new URLSearchParams({ runId: job.runId, model: TTS_MODEL });
    const status = await (await fetch(`https://nano-gpt.com/api/tts/status?${params}`, { headers: { "x-api-key": apiKey! } })).json();
    if (status.status === "failed" || status.error) throw new Error(`TTS failed: ${JSON.stringify(status).slice(0, 200)}`);
    if (status.status === "completed") audioUrl = status.audioUrl;
  }
  const audio = await fetch(audioUrl!, { signal: AbortSignal.timeout(120_000) });
  if (!audio.ok) throw new Error(`Audio download failed: ${audio.status}`);
  return Buffer.from(await audio.arrayBuffer());
}

/** Clips already on disk are reused. */
async function voiceTurns(turns: Turn[]): Promise<string[]> {
  mkdirSync(workDir, { recursive: true });
  // Named by content, so a rewritten script only voices the lines that changed.
  const files = turns.map((t) => `${workDir}/${createHash("sha1").update(`${TTS_MODEL}|${t.host}|${t.text}`).digest("hex").slice(0, 16)}.mp3`);
  let next = 0, done = 0;
  const worker = async () => {
    while (next < turns.length) {
      const i = next++;
      if (!existsSync(files[i])) {
        const voice = HOSTS.find((h) => h.name === turns[i].host)!.voice;
        for (let attempt = 1; ; attempt++) {
          try { writeFileSync(files[i], await tts(turns[i].text, voice)); break; }
          catch (e) { if (attempt >= 3) throw e; await sleep(5000 * attempt); }
        }
      }
      process.stdout.write(`\r  voiced ${++done}/${turns.length}`);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  process.stdout.write("\n");
  return files;
}

function join(clips: string[]): number {
  const ffmpeg = (...args: string[]) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
  // Same format for every piece, so the concat demuxer can join them losslessly.
  const wav = (src: string) => src.replace(/\.mp3$/, ".wav");
  for (const clip of clips) ffmpeg("-i", clip, "-ar", String(SAMPLE_RATE), "-ac", "1", "-c:a", "pcm_s16le", wav(clip));
  const pause = `${workDir}/pause.wav`;
  ffmpeg("-f", "lavfi", "-i", `anullsrc=r=${SAMPLE_RATE}:cl=mono`, "-t", "0.35", "-c:a", "pcm_s16le", pause);
  const list = `${workDir}/list.txt`;
  writeFileSync(list, clips.flatMap((c) => [`file '${wav(c).split("/").pop()}'`, "file 'pause.wav'"]).join("\n"));
  mkdirSync("public/podcast", { recursive: true });
  ffmpeg("-f", "concat", "-safe", "0", "-i", list, "-ac", "1", "-b:a", "64k", outFile);
  const pcmBytes = clips.reduce((n, c) => n + statSync(wav(c)).size - 44, 0) + clips.length * statSync(pause).size;
  return Math.round(pcmBytes / 2 / SAMPLE_RATE);
}

console.log(`Podcast for the week of ${week.id}${lang === "en" ? "" : ` (${LANGUAGES[lang]})`}`);
let turns: Turn[];
if (existsSync(scriptFile) && !values["new-script"]) {
  turns = JSON.parse(readFileSync(scriptFile, "utf8"));
  console.log(`Reusing the script in ${scriptFile} (--new-script to rewrite it)`);
} else {
  console.log("Writing the script…");
  turns = await writeScript();
  writeFileSync(scriptFile, JSON.stringify(turns, null, 2));
}
const chars = turns.reduce((n, t) => n + t.text.length, 0);
console.log(`  ${turns.length} turns, ${chars} characters`);

console.log(`Voicing with ${TTS_MODEL} (${HOSTS.map((h) => `${h.name}: ${h.voice}`).join(", ")})…`);
const clips = await voiceTurns(turns);
console.log("Joining with ffmpeg…");
const duration = join(clips);

// Re-read the issue: it may have been edited while the audio was being made.
const latest = editionSchema.parse(JSON.parse(readFileSync(editionFile, "utf8")));
const episode = { file: `/podcast/${week.id}${suffix}.mp3`, duration, hosts: HOSTS.map((h) => h.name), transcript: turns };
writeFileSync(editionFile, JSON.stringify(
  lang === "en" ? { ...latest, podcast: episode } : { ...latest, podcasts: { ...latest.podcasts, [lang]: episode } },
  null, 2,
) + "\n");
console.log(`\n${outFile}: ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}. Added to ${editionFile}.`);
