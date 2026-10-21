/* Approves a draft edition so it goes live:  npm run gazette:publish -- 2026-10-12 */
import { readFileSync, writeFileSync } from "node:fs";
import { editionSchema } from "../../src/lib/gazette-schema.ts";
import { weekStarting } from "./week.ts";

const id = process.argv[2];
if (!id) {
  console.error("Usage: npm run gazette:publish -- <week, e.g. 2026-10-12>");
  process.exit(1);
}
const file = `src/data/gazette/${weekStarting(id).id}.json`;
const edition = editionSchema.parse(JSON.parse(readFileSync(file, "utf8")));
if (!edition.draft) console.log(`${file} is already published.`);
else {
  writeFileSync(file, JSON.stringify({ ...edition, draft: false }, null, 2) + "\n");
  console.log(`Published No. ${edition.no} (${file}). Rebuild and deploy the site to show it.`);
}
