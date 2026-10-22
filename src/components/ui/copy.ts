/* Buttons with data-copy-from="<selector>" copy that element's text (or value), and briefly say so. */
export function bindCopyButtons(root: HTMLElement, copied: string) {
  for (const btn of root.querySelectorAll<HTMLButtonElement>("[data-copy-from]")) {
    const label = btn.querySelector("span") ?? btn;
    const idle = label.textContent;
    btn.addEventListener("click", async () => {
      const source = root.querySelector<HTMLElement>(btn.dataset.copyFrom!);
      const text = source instanceof HTMLInputElement || source instanceof HTMLTextAreaElement ? source.value : source?.textContent ?? "";
      try { await navigator.clipboard.writeText(text.trim()); } catch { return; }
      label.textContent = copied;
      setTimeout(() => (label.textContent = idle), 1400);
    });
  }
}
