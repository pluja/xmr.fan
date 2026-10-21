import type { Locale } from "../../i18n/ui";
import type { Currency } from "../../lib/currency";
import { chosenCurrency, saveCurrency } from "../../lib/price-client";

/** The current currency, and a callback whenever the user picks another one. */
export function currencyPicker(lang: Locale, onChange: (c: Currency) => void): () => Currency {
  const selects = [...document.querySelectorAll<HTMLSelectElement>("select[data-currency]")];
  let current = chosenCurrency(lang);
  for (const s of selects) {
    s.value = current;
    s.addEventListener("change", () => {
      current = s.value as Currency;
      saveCurrency(current);
      selects.forEach((o) => (o.value = current));
      onChange(current);
    });
  }
  return () => current;
}
