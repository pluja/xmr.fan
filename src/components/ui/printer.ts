/* Client side of Printer.astro. */
export type PrinterState = "idle" | "working" | "ok" | "bad" | "warn";
const PRINTED: PrinterState[] = ["ok", "bad", "warn"];

export function printer(root: HTMLElement) {
  const box = root.matches("[data-printer]") ? root : root.querySelector<HTMLElement>("[data-printer]")!;
  const status = box.querySelector<HTMLElement>("[data-printer-status]")!;
  const paper = box.querySelector<HTMLElement>("[data-printer-paper]")!;
  const idle = status.textContent ?? "";
  let printed = false;
  return {
    /** Shows a state. A receipt feeds out when one first appears, or every time with `feed`. */
    set(state: PrinterState, text?: string, { feed = false } = {}) {
      const now = PRINTED.includes(state);
      box.dataset.state = state;
      status.textContent = text ?? (state === "idle" ? idle : "");
      if (now && (feed || !printed)) {
        for (const el of [paper, ...box.querySelectorAll<HTMLElement>("[data-stamp]")]) {
          el.style.animation = "none";
          void el.offsetWidth;
          el.style.animation = "";
        }
      }
      printed = now;
    },
    get printed() { return printed; },
  };
}
