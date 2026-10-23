/* Monero's history for /timeline. Titles and text live in the i18n module, as tl_<id>_t and tl_<id>_b. */
import type { IconName } from "./pixel.ts";

export const TOPICS = ["privacy", "network", "mining", "community"] as const;
export type Topic = (typeof TOPICS)[number];

export interface Milestone {
  id: string;
  /** Year and month. */
  date: string;
  icon: IconName;
  topic: Topic;
  /** A network upgrade every node had to take. */
  fork?: { version: number; height: number };
  /** Minimum ring size from here on; "all" once every coin is in the ring. */
  ring?: number | "all";
  planned?: boolean;
}

export const MILESTONES: Milestone[] = [
  { id: "cryptonote", date: "2013-10", icon: "paper", topic: "privacy" },
  { id: "launch", date: "2014-04", icon: "star", topic: "community" },
  { id: "v2", date: "2016-03", icon: "hourglass", topic: "network", fork: { version: 2, height: 1_009_827 }, ring: 3 },
  { id: "ringct", date: "2017-01", icon: "shield", topic: "privacy", fork: { version: 4, height: 1_220_516 } },
  { id: "research", date: "2017-04", icon: "lens", topic: "privacy" },
  { id: "v6", date: "2017-09", icon: "shield", topic: "privacy", fork: { version: 6, height: 1_400_000 }, ring: 5 },
  { id: "v7", date: "2018-04", icon: "pickaxe", topic: "mining", fork: { version: 7, height: 1_546_000 }, ring: 7 },
  { id: "bulletproofs", date: "2018-10", icon: "tag", topic: "network", fork: { version: 8, height: 1_685_555 }, ring: 11 },
  { id: "randomx", date: "2019-11", icon: "pickaxe", topic: "mining", fork: { version: 12, height: 1_978_433 } },
  { id: "clsag", date: "2020-10", icon: "check", topic: "privacy", fork: { version: 13, height: 2_210_000 } },
  { id: "swaps", date: "2021-08", icon: "swap", topic: "community" },
  { id: "p2pool", date: "2021-10", icon: "node", topic: "mining" },
  { id: "tail", date: "2022-06", icon: "coin", topic: "network" },
  { id: "v15", date: "2022-08", icon: "shield", topic: "privacy", fork: { version: 15, height: 2_688_888 }, ring: 16 },
  { id: "flood", date: "2024-03", icon: "gauge", topic: "network" },
  { id: "fcmp", date: "", icon: "ring", topic: "privacy", ring: "all", planned: true },
];
