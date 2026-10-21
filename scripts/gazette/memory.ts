/* What the Times already covered: recent issues are the memory for the next one.
   Links cited before are dropped from new material; recaps and headlines let the
   model skip repeats and refer back to earlier stories. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { editionSchema, type EditionData } from "../../src/lib/gazette-schema.ts";
import type { SourceItem } from "./sources.ts";

const EDITIONS_DIR = "src/data/gazette";

/** Newest first. Sample issues are ignored. */
export function pastIssues(week: string, count = 4, dir = EDITIONS_DIR): EditionData[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => editionSchema.parse(JSON.parse(readFileSync(`${dir}/${f}`, "utf8"))))
    .filter((e) => !e.sample && e.week < week)
    .sort((a, b) => b.week.localeCompare(a.week))
    .slice(0, count);
}

export function citedUrls(e: EditionData): string[] {
  const stories = [e.lead, ...Object.values(e.sections).flat(), ...(e.feature ? [e.feature] : []), ...(e.market?.analysis?.drivers ?? [])];
  return [
    ...stories.flatMap((s) => [s.url, ...(s.more ?? []).map((m) => m.url)]),
    ...(e.quotes ?? []).map((q) => q.url),
  ];
}

export function dropCovered(items: SourceItem[], past: EditionData[]): { fresh: SourceItem[]; dropped: number } {
  const seen = new Set(past.flatMap(citedUrls));
  const fresh = items.filter((i) => !seen.has(i.url));
  return { fresh, dropped: items.length - fresh.length };
}

/** Empty when there is no history. */
export function formatMemory(past: EditionData[]): string {
  if (!past.length) return "";
  return "PREVIOUSLY IN THE TIMES (most recent first):\n" + past.map((e) => {
    const heads = [e.lead.h, ...(e.feature ? [e.feature.h] : []), ...Object.values(e.sections).flat().map((s) => s.h)];
    return `- No. ${e.no}, week of ${e.week}: ${e.recap ?? ""}\n  Headlines: ${heads.join(" | ")}`;
  }).join("\n");
}
