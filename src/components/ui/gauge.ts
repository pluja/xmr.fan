/** Lights a Gauge.astro dial up to `fraction` (0 to 1) and sets its readout. */
export function setGauge(root: HTMLElement, fraction: number, value: string, sub = "") {
  const total = Number(root.dataset.segments);
  const on = fraction > 0 ? Math.max(1, Math.round(Math.min(1, fraction) * total)) : 0;
  root.querySelectorAll<SVGRectElement>("[data-seg]").forEach((r) => r.toggleAttribute("data-on", Number(r.dataset.seg) < on));
  root.querySelector("[data-value]")!.textContent = value;
  root.querySelector("[data-sub]")!.textContent = sub;
}
