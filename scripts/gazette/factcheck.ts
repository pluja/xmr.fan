/* Checks a written issue against the items each story cites, for the human reviewer.
   Two passes: every number or version in a story must appear in its sources, and an AI
   reader lists claims its sources do not support. Nothing is changed; flags are reported. */
import { z } from "astro/zod";
import type { EditionData } from "../../src/lib/gazette-schema.ts";
import { ask, parseJson } from "./editor.ts";
import type { LlmConfig } from "./llm.ts";
import type { SourceItem } from "./sources.ts";

export interface Flag { story: string; claim: string; problem: string }

/** `when` is an event's ISO date: kept out of the number check, since sources write dates as words ("November 18th"). */
interface CheckedStory { h: string; text: string; sources: SourceItem[]; when?: string }

/** Years are left out: sources rarely state the year of their own news. */
const YEAR = /^(19|20)\d\d$/;

function numberTokens(text: string): string[] {
  return (text.match(/\d[\d.,:%]*\d|\d/g) ?? []).map((t) => t.replace(/,(?=\d{3}\b)/g, "")).filter((t) => !YEAR.test(t));
}

export function unsupportedNumbers(storyText: string, sourceText: string): string[] {
  const known = new Set(numberTokens(sourceText));
  return [...new Set(numberTokens(storyText))].filter((t) => !known.has(t));
}

export function checkedStories(edition: EditionData, items: SourceItem[]): CheckedStory[] {
  const byUrl = new Map(items.map((i) => [i.url, i]));
  const sourcesOf = (s: { url: string; more?: { url: string }[] }) =>
    [s.url, ...(s.more ?? []).map((m) => m.url)].flatMap((url) => byUrl.get(url) ?? []);
  return [
    { h: edition.lead.h, text: `${edition.lead.h}. ${edition.lead.p}`, sources: sourcesOf(edition.lead) },
    ...(edition.feature
      ? [{ h: edition.feature.h, text: [edition.feature.h, edition.feature.dek ?? "", ...edition.feature.body].join(" "), sources: sourcesOf(edition.feature) }]
      : []),
    ...Object.values(edition.sections).flat().map((s) => ({ h: s.h, text: `${s.h}. ${s.p}`, sources: sourcesOf(s) })),
    ...(edition.upcoming ?? []).map((u) => ({ h: u.what, text: `${u.time ?? ""} ${u.what}`.trim(), sources: sourcesOf(u), when: u.date })),
  ];
}

const sourceText = (sources: SourceItem[]) => sources.map((i) => `${i.title} ${i.text}`).join(" ");

export function numberFlags(stories: CheckedStory[]): Flag[] {
  return stories.flatMap((s) =>
    unsupportedNumbers(s.text, sourceText(s.sources)).map((n) => ({ story: s.h, claim: n, problem: "this number is not in the cited sources" })),
  );
}

export const FACTCHECK_PROMPT = `You fact-check The xmr.fan Times, a weekly Monero newsletter, before a human editor reviews it.

For each numbered story you get its text and the source items it cites. Earlier issues may be listed first: use them only to check what a story says about past coverage ("last week we reported..."). List every claim in a story that its sources do not support: invented or changed names, numbers, versions, dates or events; opinions presented as fact; a plan or agenda presented as something that already happened; advice the sources do not give. Plain explanations of well-known terms are fine. Do not flag style, tone or missing details. List only claims with a problem: never include a claim you checked and found supported.

Reply with JSON only: {"flags":[{"story":1,"claim":"the exact words from the story","problem":"what the sources say instead, or that they do not mention it"}]}. Use {"flags":[]} when everything is supported.`;

const flagsSchema = z.object({ flags: z.array(z.object({ story: z.number().int().min(1), claim: z.string().min(1), problem: z.string().min(1) })) });

export function formatForCheck(stories: CheckedStory[]): string {
  return stories.map((s, n) =>
    `STORY ${n + 1}: ${s.when ? `(event on ${s.when}) ` : ""}${s.text}\nSOURCES:\n${s.sources.map((i) => `- ${i.source}: ${i.title}. ${i.text}`).join("\n") || "- (none found)"}`,
  ).join("\n\n");
}

export function parseFlags(reply: string, stories: CheckedStory[]): Flag[] {
  const parsed = flagsSchema.safeParse(parseJson(reply));
  if (!parsed.success) throw new Error(`The JSON does not match {"flags":[...]}: ${parsed.error.message}`);
  return parsed.data.flags.map((f) => {
    const story = stories[f.story - 1];
    if (!story) throw new Error(`There is no story ${f.story}.`);
    return { story: story.h, claim: f.claim.trim(), problem: f.problem.trim() };
  });
}

/** `memory` is the digest of earlier issues the issue was written with (see memory.ts), or "". */
export async function checkFacts(cfg: LlmConfig, edition: EditionData, items: SourceItem[], memory = ""): Promise<Flag[]> {
  const stories = checkedStories(edition, items);
  const input = memory ? `${memory}\n\n${formatForCheck(stories)}` : formatForCheck(stories);
  const aiFlags = await ask(cfg, FACTCHECK_PROMPT, input, (r) => parseFlags(r, stories));
  return [...numberFlags(stories), ...aiFlags];
}
