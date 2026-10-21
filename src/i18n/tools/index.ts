import seo from "../seo.ts";
import address from "./address.ts";
import beat from "./beat.ts";
import checksum from "./checksum.ts";
import donate from "./donate.ts";
import fee from "./fee.ts";
import height from "./height.ts";
import live from "./live.ts";
import liveNet from "./live-net.ts";
import mining from "./mining.ts";
import node from "./node.ts";
import tx from "./tx.ts";
import units from "./units.ts";
import verify from "./verify.ts";

export const STRING_MODULES = [live, fee, height, address, units, node, mining, verify, checksum, tx, donate, beat, liveNet, seo] as const;

type Source = (typeof STRING_MODULES)[number];
export type ModuleKey = Source extends infer S ? (S extends { en: infer E } ? keyof E : never) : never;
