/* Client side of AddressInput.astro. The textarea's own text is invisible; a copy behind it is what
   people see, so the start and end of a valid address can be highlighted. */
export const ADDRESS_START = 6;
export const ADDRESS_END = 7;

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** "888tNk…Davup3H" as HTML, with the compared ends in bold. */
export const shortAddressHtml = (address: string) =>
  `<b>${escape(address.slice(0, ADDRESS_START))}</b>…<b>${escape(address.slice(-ADDRESS_END))}</b>`;

export function addressInput(box: HTMLElement, onChange: () => void) {
  const field = box.querySelector("textarea")!;
  const mirror = box.querySelector<HTMLElement>("[data-mirror]")!;
  const paste = box.querySelector<HTMLButtonElement>("[data-paste]");
  let highlight = false;

  function paint() {
    const text = field.value, trimmed = text.trim();
    mirror.innerHTML = highlight && trimmed.length > ADDRESS_START + ADDRESS_END
      ? escape(text.slice(0, text.indexOf(trimmed))) + `<mark>${escape(trimmed.slice(0, ADDRESS_START))}</mark>${escape(trimmed.slice(ADDRESS_START, -ADDRESS_END))}<mark>${escape(trimmed.slice(-ADDRESS_END))}</mark>`
      : escape(text) + "\u200b";
  }

  field.addEventListener("input", paint);
  // Reading the clipboard needs a browser that allows it (not Firefox); otherwise the button stays hidden.
  if (paste) {
    paste.hidden = !navigator.clipboard?.readText;
    paste.addEventListener("click", async () => {
      try { field.value = (await navigator.clipboard.readText()).trim(); } catch { return; }
      paint();
      onChange();
      field.focus();
    });
  }
  paint();

  return {
    field,
    /** Border color, and whether the ends are highlighted. */
    show(state: "ok" | "error" | "") {
      box.dataset.state = state;
      highlight = state === "ok";
      paint();
    },
    set(value: string) { field.value = value; paint(); },
  };
}
