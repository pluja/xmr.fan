/* Stops an automatic issue from going live, or lets it go again.
     npm run gazette:hold -- 2026-10-12            # hold it
     npm run gazette:hold -- 2026-10-12 --release  # publish at the next scheduled check */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { weekStarting } from "./week.ts";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { release: { type: "boolean", default: false } } });
const week = weekStarting(positionals[0] ?? "");
const marker = `.gazette/${week.id}.hold`;

if (values.release) {
  rmSync(marker, { force: true });
  console.log(`Released ${week.id}: it goes live at the next scheduled check.`);
} else {
  mkdirSync(".gazette", { recursive: true });
  if (!existsSync(marker)) writeFileSync(marker, new Date().toISOString());
  console.log(`Held ${week.id}. Edit src/data/gazette/${week.id}.json if needed, then: ops/hold.sh ${week.id} --release`);
}
