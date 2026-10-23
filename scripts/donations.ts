/* Checks that every donation address in src/data/donations.json still appears on its
   project's own page, so the roulette never shows an address a project has replaced.
     npm run donations:check [-- --write] [--notify]
   Pages that block automated requests can be confirmed through the project's OpenAlias
   DNS record instead (`openalias` in the data).
   --write stores today's date as `checked` for the addresses that were found, and marks the
   ones whose page no longer shows them as `missing`, which hides them from the roulette
   (so do addresses unconfirmed for STALE_DAYS). --notify reports anything that changed.
   Exits with an error if a page loads but no longer shows its address. */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { listed, STALE_DAYS } from "../src/lib/donations.ts";
import { notify } from "./notify.ts";

const FILE = "src/data/donations.json";
const UA = "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0";

interface Donation { id: string; name: string; category: string; address: string; source: string; checked: string; openalias?: string; missing?: boolean }
type Result = "found" | "missing" | "unreachable";

async function onPage(d: Donation): Promise<Result> {
  try {
    const res = await fetch(d.source, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return "unreachable";
    return (await res.text()).includes(d.address) ? "found" : "missing";
  } catch {
    return "unreachable";
  }
}

async function inOpenAlias(domain: string, address: string): Promise<boolean> {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=TXT`, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  const data = res?.ok ? await res.json() : null;
  return (data?.Answer ?? []).some((a: { data: string }) => a.data.includes(`recipient_address=${address}`));
}

async function check(d: Donation): Promise<Result> {
  const result = await onPage(d);
  if (result === "unreachable" && d.openalias && (await inOpenAlias(d.openalias, d.address))) return "found";
  return result;
}

const { values } = parseArgs({ options: { write: { type: "boolean", default: false }, notify: { type: "boolean", default: false } } });
const list: Donation[] = JSON.parse(readFileSync(FILE, "utf8"));
const results = await Promise.all(list.map(check));
const today = new Date().toISOString().slice(0, 10);
const MARK: Record<Result, string> = { found: "✓", missing: "✗", unreachable: "?" };

list.forEach((d, i) => console.log(`${MARK[results[i]]} ${d.name.padEnd(20)} ${results[i].padEnd(12)} ${d.source}`));
const missing = list.filter((_, i) => results[i] === "missing");
const unreachable = list.filter((_, i) => results[i] === "unreachable");
if (unreachable.length) console.log(`\n${unreachable.length} page(s) could not be loaded (bot protection or downtime): check them in a browser.`);
if (missing.length) console.log(`\n${missing.length} address(es) no longer on their page: update or remove them.`);

const updated = list.map((d, i): Donation => {
  if (results[i] === "found") { const { missing: _, ...rest } = d; return { ...rest, checked: today }; }
  if (results[i] === "missing") return { ...d, missing: true };
  return d;
});
if (values.write) {
  writeFileSync(FILE, JSON.stringify(updated, null, 2) + "\n");
  console.log(`\nUpdated the check date of ${results.filter((r) => r === "found").length} address(es).`);
}

if (values.notify) {
  const hidden = updated.filter((d, i) => listed(list[i]) && !listed(d)).map((d) => d.name);
  const back = updated.filter((d, i) => !listed(list[i]) && listed(d)).map((d) => d.name);
  // Unreachable pages are worth a look before their address goes stale and drops out.
  const soon = updated.filter((d) => listed(d) && !listed(d, new Date(Date.now() + 14 * 86_400_000))).map((d) => d.name);
  const lines = [
    hidden.length && `Hidden from the roulette: ${hidden.join(", ")}`,
    back.length && `Back in the roulette: ${back.join(", ")}`,
    soon.length && `Unconfirmed for nearly ${STALE_DAYS} days (check the page by hand): ${soon.join(", ")}`,
  ].filter(Boolean);
  if (lines.length) await notify({ title: "Donation addresses need a look", body: lines.join("\n\n"), tags: ["heart"], priority: hidden.length ? 4 : 3 });
}
process.exitCode = missing.length ? 1 : 0;
