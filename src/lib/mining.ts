/* Expected mining income. Hashrates in H/s, rewards in piconero, times in seconds. */
import { BLOCK_SECONDS, PICO_PER_XMR } from "./nodes.ts";

export const networkHashrate = (difficulty: number) => difficulty / BLOCK_SECONDS;

export const xmrPerDay = (hashrate: number, difficulty: number, reward: number) => (hashrate * 86_400 * reward) / difficulty / PICO_PER_XMR;

/** Average time between finds for a target difficulty (a Monero block, or a P2Pool share). */
export const timeToFind = (hashrate: number, difficulty: number) => (hashrate > 0 ? difficulty / hashrate : Infinity);

export const powerCostPerDay = (watts: number, pricePerKwh: number) => (watts * 24 * pricePerKwh) / 1000;

export interface Sidechain { name: "main" | "mini" | "nano"; difficulty: number; blockTime: number; windowSize: number }

/** The biggest sidechain where you'd still average a share within one PPLNS window, so payouts come steadily. */
export function bestSidechain(hashrate: number, chains: Sidechain[]): Sidechain["name"] | undefined {
  const order: Sidechain["name"][] = ["main", "mini", "nano"];
  const fits = (c: Sidechain) => timeToFind(hashrate, c.difficulty) <= c.windowSize * c.blockTime;
  return order.map((n) => chains.find((c) => c.name === n)).find((c) => c && fits(c))?.name ?? (chains.length ? "nano" : undefined);
}
