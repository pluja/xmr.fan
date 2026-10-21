/* XMR prices from CoinGecko, fetched by the browser and kept for a few minutes. */
import { CURRENCIES, DEFAULT_CURRENCY, isCurrency, type Currency } from "./currency";
import type { Locale } from "../i18n/ui";

const CACHE_KEY = "xmrfan.prices";
const CHOICE_KEY = "xmrfan.currency";
const MAX_AGE_MS = 5 * 60_000;

export type Prices = Record<Currency, number>;

export async function getPrices(): Promise<Prices> {
  const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "null");
  if (cached && Date.now() - cached.at < MAX_AGE_MS) return cached.prices;
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=monero&vs_currencies=${CURRENCIES.join(",")}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`prices: ${res.status}`);
  const prices = (await res.json()).monero as Prices;
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), prices }));
  return prices;
}

export function chosenCurrency(lang: Locale): Currency {
  const saved = localStorage.getItem(CHOICE_KEY);
  return isCurrency(saved) ? saved : DEFAULT_CURRENCY[lang];
}

export const saveCurrency = (c: Currency) => localStorage.setItem(CHOICE_KEY, c);
