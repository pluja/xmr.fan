/* Checks every candidate node, so dead ones drop out of the site's lists and come back when they recover.
     npm run nodes:check [-- --write] [--notify]
   A node fails a check when it doesn't answer, isn't synced, or (for browser nodes) sends no CORS
   header. After NODE_FAILURE_LIMIT failures in a row it is left out (src/data/node-health.json).
   If most nodes fail at once, the problem is probably this machine's network, so nothing is recorded. */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { checkNode } from "../src/lib/server/node-check.ts";
import { BROWSER_NODE_CANDIDATES, NODE_FAILURE_LIMIT, WALLET_NODE_CANDIDATES, type NodeHealth } from "../src/lib/nodes.ts";
import { notify } from "./notify.ts";

const FILE = "src/data/node-health.json";
const { values } = parseArgs({ options: { write: { type: "boolean", default: false }, notify: { type: "boolean", default: false } } });

const before: Record<string, NodeHealth> = JSON.parse(readFileSync(FILE, "utf8"));
const checks = await Promise.all(WALLET_NODE_CANDIDATES.map((url) => checkNode(url)));
const today = new Date().toISOString().slice(0, 10);
const passed = checks.map((c) => c.ok && c.synced && (!BROWSER_NODE_CANDIDATES.includes(c.url) || c.cors));

checks.forEach((c, i) => console.log(`${passed[i] ? "✓" : "✗"} ${c.url.padEnd(42)} ${c.ok ? `${c.ms} ms${c.synced ? "" : ", behind"}${c.cors ? "" : ", no CORS"}` : c.error}`));

if (passed.filter(Boolean).length < checks.length / 2) {
  const message = `${passed.filter((p) => !p).length} of ${checks.length} nodes failed at once; nothing recorded (network trouble here?).`;
  console.warn(`\n${message}`);
  if (values.notify) await notify({ title: "Node check skipped", body: message, tags: ["warning"] });
  process.exit(0);
}

const after: Record<string, NodeHealth> = {};
checks.forEach((c, i) => {
  const prev = before[c.url] ?? { failures: 0 };
  after[c.url] = passed[i] ? { failures: 0, lastOk: today } : { ...prev, failures: prev.failures + 1 };
});
if (values.write) writeFileSync(FILE, JSON.stringify(after, null, 2) + "\n");

const down = (h?: NodeHealth) => (h?.failures ?? 0) >= NODE_FAILURE_LIMIT;
const dropped = checks.filter((c) => !down(before[c.url]) && down(after[c.url])).map((c) => c.url);
const back = checks.filter((c) => down(before[c.url]) && !down(after[c.url])).map((c) => c.url);
const browserLeft = BROWSER_NODE_CANDIDATES.filter((u) => !down(after[u])).length;
if (values.notify && (dropped.length || back.length || browserLeft < 2)) {
  await notify({
    title: "Node list changed",
    body: [
      dropped.length && `Left out after ${NODE_FAILURE_LIMIT} failed checks:\n${dropped.join("\n")}`,
      back.length && `Working again:\n${back.join("\n")}`,
      browserLeft < 2 && `Only ${browserLeft} browser node(s) left. Add more to BROWSER_NODE_CANDIDATES in src/lib/nodes.ts.`,
    ].filter(Boolean).join("\n\n"),
    tags: ["satellite"],
    priority: browserLeft < 2 ? 4 : 3,
  });
}
