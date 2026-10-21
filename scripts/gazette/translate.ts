/* Translates an issue's text into the site's other languages.
     npm run gazette:translate -- 2026-10-12 [--lang es,ja]
   Only text is sent: links, sources and numbers stay with the English original.
   Each reply must keep the exact shape (same stories, same order) and keep names,
   terms and version numbers unchanged; otherwise it is retried with feedback. */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { editionSchema, translationSchema, type EditionData, type TranslationData } from "../../src/lib/gazette-schema.ts";
import { chat, llmConfigFromEnv, type Message } from "./llm.ts";
import { weekStarting } from "./week.ts";

export const LANGUAGES: Record<string, string> = { es: "Spanish", ru: "Russian", fr: "French", pt: "Brazilian Portuguese", ja: "Japanese" };

/** Words that must appear unchanged in every translation when the English has them. */
const KEEP = ["Monero", "XMR", "CCS", "GrapheneOS", "FCMP++", "CARROT", "Haveno", "Cake Wallet", "Tor", "Bitcoin", "DNSSEC", "RPC", "GUI", "CLI", "xmr.fan"];
// Versions (0.18.5.4, v1.11) must survive; plain decimals (2.96) may use the language's own comma.
const VERSION = /\bv?\d+\.\d+\.\d+(?:\.\d+)?\b|\bv\d+\.\d+\b/g;

export function textOf(e: EditionData): TranslationData {
  const story = (s: { h: string; p: string }) => ({ h: s.h, p: s.p });
  const a = e.market?.analysis;
  return {
    ...(e.recap ? { recap: e.recap } : {}),
    lead: story(e.lead),
    ...(e.art ? { art: { alt: e.art.alt } } : {}),
    ...(e.feature ? { feature: { h: e.feature.h, ...(e.feature.dek ? { dek: e.feature.dek } : {}), body: e.feature.body } } : {}),
    ...(e.quotes?.length ? { quotes: e.quotes.map((q) => ({ text: q.text })) } : {}),
    ...(e.upcoming?.length ? { upcoming: e.upcoming.map((u) => ({ what: u.what })) } : {}),
    sections: { dev: e.sections.dev.map(story), eco: e.sections.eco.map(story), comm: e.sections.comm.map(story), privacy: e.sections.privacy.map(story) },
    ...(a ? { price: { summary: a.summary, drivers: a.drivers.map((d) => d.text) } } : {}),
  };
}

/** Compares keys and array lengths recursively; returns the first difference, or "". */
export function shapeDiff(a: unknown, b: unknown, path = ""): string {
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return `${path || "root"} must be a list of ${a.length}`;
    for (let i = 0; i < a.length; i++) { const d = shapeDiff(a[i], b[i], `${path}[${i}]`); if (d) return d; }
    return "";
  }
  if (a && typeof a === "object") {
    if (!b || typeof b !== "object" || Array.isArray(b)) return `${path || "root"} must be an object`;
    for (const k of Object.keys(a)) { const d = shapeDiff((a as any)[k], (b as any)[k], path ? `${path}.${k}` : k); if (d) return d; }
    const extra = Object.keys(b).filter((k) => !(k in a));
    return extra.length ? `${path || "root"} has unexpected keys: ${extra.join(", ")}` : "";
  }
  return typeof b === "string" && b.trim() ? "" : `${path} must be a non-empty string`;
}

export function missingTerms(source: string, translated: string): string[] {
  const terms = KEEP.filter((t) => source.includes(t));
  const versions = [...new Set(source.match(VERSION) ?? [])];
  return [...terms, ...versions].filter((t) => !translated.includes(t));
}

const prompt = (language: string) => `You translate The xmr.fan Times, a weekly Monero newsletter, from English into ${language}.

- Translate the JSON values; keep every key, the order of items and the number of items exactly the same.
- Sound natural and idiomatic in ${language}, with the same warm, clear, slightly playful tone. Not word for word.
- Keep these unchanged: product and project names, @handles, subreddit names, version numbers, and the terms ${KEEP.join(", ")}.
- "quotes" are things people wrote; translate their meaning faithfully.
- Do not add or remove information.

Reply with the translated JSON only.`;

async function translate(text: TranslationData, lang: string): Promise<TranslationData> {
  const llm = llmConfigFromEnv();
  const source = JSON.stringify(text);
  const messages: Message[] = [{ role: "system", content: prompt(LANGUAGES[lang]) }, { role: "user", content: JSON.stringify(text, null, 2) }];
  for (let attempt = 1; ; attempt++) {
    const reply = await chat(llm, messages);
    try {
      let parsed: unknown;
      try { parsed = JSON.parse(reply.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "")); } catch { throw new Error("The reply was not valid JSON."); }
      const diff = shapeDiff(text, parsed);
      if (diff) throw new Error(`The structure changed: ${diff}.`);
      const missing = missingTerms(source, JSON.stringify(parsed));
      if (missing.length) throw new Error(`These must appear unchanged: ${missing.join(", ")}.`);
      return translationSchema.parse(parsed);
    } catch (e) {
      if (attempt >= 3) throw e;
      console.warn(`  ${lang}: attempt ${attempt} rejected: ${(e as Error).message.slice(0, 200)}`);
      messages.push({ role: "assistant", content: reply }, { role: "user", content: `${(e as Error).message} Reply again with the corrected JSON only.` });
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { lang: { type: "string" } } });
  const week = weekStarting(positionals[0] ?? "");
  const file = `src/data/gazette/${week.id}.json`;
  const langs = values.lang ? values.lang.split(",").map((l) => l.trim()) : Object.keys(LANGUAGES);
  const unknown = langs.filter((l) => !LANGUAGES[l]);
  if (unknown.length) throw new Error(`Unknown language(s): ${unknown.join(", ")}. Use: ${Object.keys(LANGUAGES).join(", ")}`);

  const edition = editionSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  const text = textOf(edition);
  console.log(`Translating No. ${edition.no} into ${langs.join(", ")}…`);
  const results = await Promise.allSettled(langs.map((l) => translate(text, l)));

  // Re-read: the issue may have been edited meanwhile; only translations change.
  const latest = editionSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  const translations = { ...latest.translations };
  results.forEach((r, i) => {
    if (r.status === "fulfilled") { translations[langs[i]] = r.value; console.log(`  ✓ ${langs[i]}: ${r.value.lead.h}`); }
    else console.warn(`  ✗ ${langs[i]}: ${(r.reason as Error).message}`);
  });
  writeFileSync(file, JSON.stringify({ ...latest, translations }, null, 2) + "\n");
}
