import type { Locale } from "../i18n/ui";

export const CURRENCIES = ["usd", "eur", "gbp", "jpy", "brl", "rub", "chf", "cad", "aud", "mxn", "ars", "cny", "inr", "krw", "try", "pln", "czk", "sek", "uah", "btc"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Record<Locale, Currency> = { en: "usd", es: "eur", ru: "rub", fr: "eur", pt: "brl", ja: "jpy" };

export const isCurrency = (s: unknown): s is Currency => CURRENCIES.includes(s as Currency);

/** Tiny amounts keep enough significant digits to be meaningful. */
export function formatMoney(value: number, currency: Currency, lang: Locale): string {
  if (currency === "btc") return `${formatNumber(value, lang, value < 1 ? 8 : 4)} BTC`;
  const abs = Math.abs(value);
  const opts: Intl.NumberFormatOptions = abs > 0 && abs < 1
    ? { maximumSignificantDigits: 3 }
    : { minimumFractionDigits: abs >= 1000 ? 0 : 2, maximumFractionDigits: abs >= 1000 ? 0 : 2 };
  return new Intl.NumberFormat(lang, { style: "currency", currency: currency.toUpperCase(), ...opts }).format(value);
}

export const formatNumber = (value: number, lang: Locale, maxDigits = 2) =>
  new Intl.NumberFormat(lang, { maximumFractionDigits: maxDigits }).format(value);
