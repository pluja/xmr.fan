/* Review sponsorship requests sent from /sponsor.
     npm run sponsor:list                                  # pending requests
     npm run sponsor:approve -- <id> <week> [--usd 75] [--as <sponsor-id>]
   Before approving, check the payment in your wallet with the request's transaction ID
   and key (CLI: check_tx_key). The USD value defaults to the XMR amount at CoinGecko's
   price on the day the request arrived. --as merges with an existing sponsor (repeat
   sponsorships add up toward their tier); by default the id comes from the name. */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { slugify, sponsorSchema } from "../src/lib/sponsor-schema.ts";
import { weekStarting } from "./gazette/week.ts";

const DIR = process.env.SPONSOR_REQUESTS_DIR ?? "sponsor-requests";
const SPONSORS = "src/data/sponsors";
const { values, positionals } = parseArgs({ allowPositionals: true, options: { usd: { type: "string" }, as: { type: "string" } } });
const [command, id, week] = positionals;

const pending = () => (existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".json")).sort() : []);

/** XMR price in USD on a given day (CoinGecko daily history). */
async function xmrUsdOn(isoDate: string): Promise<number> {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  const res = await fetch(`https://api.coingecko.com/api/v3/coins/monero/history?date=${d}-${m}-${y}&localization=false`, { headers: { "User-Agent": "xmr.fan" } });
  if (!res.ok) throw new Error(`CoinGecko: ${res.status}; pass --usd instead`);
  const price = (await res.json()).market_data?.current_price?.usd;
  if (typeof price !== "number") throw new Error("CoinGecko returned no price; pass --usd instead");
  return price;
}

if (command === "list") {
  const files = pending();
  if (!files.length) console.log("No pending requests.");
  else console.log("Decline (and refund) gambling, illegal services, scams, token sales, adult content, weapons, drugs, malware, hate or misleading claims. See /sponsor#rules.");
  for (const f of files) {
    const r = JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"));
    console.log(`\n${r.id}  (received ${r.received.slice(0, 16)}, preferred week: ${r.week || "any"})`);
    console.log(`  ${r.name}: ${r.line}${r.url ? `  <${r.url}>` : ""}`);
    console.log(`  amount ${r.amount} XMR\n  txid ${r.txid}\n  key  ${r.txkey}${r.contact ? `\n  contact: ${r.contact}` : ""}`);
  }
} else if (command === "approve" && id && week) {
  const file = `${DIR}/${id}.json`;
  if (!existsSync(file)) throw new Error(`No request ${id} in ${DIR}/`);
  const r = JSON.parse(readFileSync(file, "utf8"));
  const w = weekStarting(week).id;
  const slug = values.as ?? slugify(r.name);
  const target = `${SPONSORS}/${w}-${slug}.json`;
  if (existsSync(target)) throw new Error(`${target} already exists.`);
  const usd = values.usd ? Number(values.usd) : Math.round(Number(r.amount) * (await xmrUsdOn(r.received)) * 100) / 100;
  const sponsor = sponsorSchema.parse({ week: w, sponsor: slug, name: r.name, line: r.line, ...(r.url ? { url: r.url } : {}), usd });
  mkdirSync(SPONSORS, { recursive: true });
  writeFileSync(target, JSON.stringify(sponsor, null, 2) + "\n");
  mkdirSync(`${DIR}/approved`, { recursive: true });
  renameSync(file, `${DIR}/approved/${id}.json`); // keep the payment proof on record
  console.log(`Approved: ${sponsor.name} (${slug}) for the week of ${w}, worth $${usd}. Rebuild and deploy to show it.`);
} else {
  console.log("Usage: npm run sponsor:list | npm run sponsor:approve -- <id> <week> [--usd N] [--as <sponsor-id>]");
  process.exit(1);
}
