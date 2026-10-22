/* Client side of Printer.astro. */
export type PrinterState = "idle" | "working" | "ok" | "bad" | "warn";

export function printer(root: HTMLElement) {
  const box = root.matches("[data-printer]") ? root : root.querySelector<HTMLElement>("[data-printer]")!;
  const status = box.querySelector<HTMLElement>("[data-printer-status]")!;
  const paper = box.querySelector<HTMLElement>("[data-printer-paper]")!;
  const idle = status.textContent ?? "";
  return {
    /** Shows a state; a result state feeds a fresh receipt out of the slot. */
    set(state: PrinterState, text?: string) {
      const printed = state === "ok" || state === "bad" || state === "warn";
      box.dataset.state = state;
      status.textContent = text ?? (state === "idle" ? idle : "");
      if (!printed) return;
      // Restart the feed and stamp animations for every new result.
      for (const el of [paper, ...box.querySelectorAll<HTMLElement>("[data-stamp]")]) {
        el.style.animation = "none";
        void el.offsetWidth;
        el.style.animation = "";
      }
    },
  };
}
