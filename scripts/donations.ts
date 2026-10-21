/* Checks that every donation address in src/data/donations.json still appears on its
   project's own page, so the roulette never shows an address a project has replaced.
     npm run donations:check [-- --write]
   Pages that block automated requests can be confirmed through the project's OpenAlias
   DNS record instead (`openalias` in the data).
   --write stores today's date as `checked` for the addresses that were found.
   Exits with an error if a page loads but no longer shows its address. */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const FILE = "src/data/donations.json";
const UA = "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0";

interface Donation { id: string; name: string; category: string; address: string; source: string; checked: string; openalias?: string }
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

const { values } = parseArgs({ options: { write: { type: "boolean", default: false } } });
const list: Donation[] = JSON.parse(readFileSync(FILE, "utf8"));
const results = await Promise.all(list.map(check));
const today = new Date().toISOString().slice(0, 10);
const MARK: Record<Result, string> = { found: "✓", missing: "✗", unreachable: "?" };

list.forEach((d, i) => console.log(`${MARK[results[i]]} ${d.name.padEnd(20)} ${results[i].padEnd(12)} ${d.source}`));
const missing = list.filter((_, i) => results[i] === "missing");
const unreachable = list.filter((_, i) => results[i] === "unreachable");
if (unreachable.length) console.log(`\n${unreachable.length} page(s) could not be loaded (bot protection or downtime): check them in a browser.`);
if (missing.length) console.log(`\n${missing.length} address(es) no longer on their page: update or remove them.`);

if (values.write) {
  const updated = list.map((d, i) => (results[i] === "found" ? { ...d, checked: today } : d));
  writeFileSync(FILE, JSON.stringify(updated, null, 2) + "\n");
  console.log(`\nUpdated the check date of ${results.filter((r) => r === "found").length} address(es).`);
}
process.exitCode = missing.length ? 1 : 0;
