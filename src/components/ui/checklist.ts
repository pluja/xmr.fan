/* A list of pass / warn / fail checks on a receipt: a colored mark, what was checked, and the detail. */
export type CheckTone = "ok" | "warn" | "bad";
export interface Check { tone: CheckTone; label: string; detail?: string }

const MARK: Record<CheckTone, [string, string]> = {
  ok: ["bg-ok", "M7 1h1v2H7zM6 2h1v2H6zM5 3h1v2H5zM4 4h1v2H4zM3 5h1v2H3zM2 4h1v2H2zM1 3h1v2H1zM0 2h1v2H0z"],
  warn: ["bg-flame", "M3 0h2v5H3zM3 6h2v2H3z"],
  bad: ["bg-danger", "M0 0h2v2H0zM6 0h2v2H6zM2 2h2v2H2zM4 2h2v2H4zM2 4h2v2H2zM4 4h2v2H4zM0 6h2v2H0zM6 6h2v2H6z"],
};
const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Fills a <ul> with check rows; returns how many passed. */
export function renderChecks(list: HTMLElement, checks: Check[]): number {
  list.innerHTML = checks.map(({ tone, label, detail }) => `<li class="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b-2 border-dotted border-slip-line py-2 last:border-0">
    <span class="grid size-5 shrink-0 place-items-center ${MARK[tone][0]} text-paper"><svg viewBox="0 0 8 8" width="11" height="11" aria-hidden="true" shape-rendering="crispEdges"><path d="${MARK[tone][1]}" fill="currentColor"/></svg></span>
    <span class="text-[0.9375rem] ${tone === "bad" ? "text-danger" : "text-ink"}">${escape(label)}</span>
    ${detail ? `<span class="basis-full pl-8 font-mono text-[0.8125rem] text-graphite sm:ml-auto sm:basis-auto sm:pl-0 sm:text-right">${escape(detail)}</span>` : ""}
  </li>`).join("");
  return checks.filter((c) => c.tone === "ok").length;
}
