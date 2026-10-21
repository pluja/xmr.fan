import { readStrings } from "../../i18n/format";
import { customNode, onNodeChange, onNodeUsed, setCustomNode } from "../../lib/node-client";
import { nodeLabel, normalizeNodeUrl } from "../../lib/nodes";

let bound = false;

function bindNodeSource(root: HTMLElement) {
  const t = readStrings(root);
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const form = $<HTMLFormElement>("[data-own]"), toggle = $("[data-own-toggle]"), input = form.elements.namedItem("node") as HTMLInputElement;
  onNodeUsed((node) => {
    $("[data-status]").textContent = t("live_from", { node: nodeLabel(node) });
    $("[data-dot]").className = "inline-block size-2 bg-ok";
  });
  toggle.addEventListener("click", () => {
    form.hidden = !form.hidden;
    toggle.setAttribute("aria-expanded", String(!form.hidden));
    input.value = customNode() ?? "";
    if (!form.hidden) input.focus();
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const url = normalizeNodeUrl(input.value);
    $("[data-own-message]").textContent = url ? "" : t("live_own_bad");
    if (!url) return;
    form.hidden = true;
    setCustomNode(url);
  });
  $("[data-own-reset]").addEventListener("click", () => { input.value = ""; form.hidden = true; setCustomNode(null); });
}

/** Reruns `load` on retry and whenever the user switches nodes. Errors show in the NodeSource bar. */
export function liveTask(load: () => Promise<void>) {
  const root = document.querySelector<HTMLElement>(".node-source");
  if (!root) return void load();
  if (!bound) { bindNodeSource(root); bound = true; }
  const error = root.querySelector<HTMLElement>("[data-error]")!;
  const run = async () => {
    error.hidden = true;
    try {
      await load();
    } catch (e) {
      console.warn(e);
      error.hidden = false;
      root.querySelector<HTMLElement>("[data-dot]")!.className = "inline-block size-2 bg-danger";
    }
  };
  root.querySelector("[data-retry]")!.addEventListener("click", run);
  onNodeChange(run);
  return run();
}
