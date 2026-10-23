import seo from "../seo.ts";
import address from "./address.ts";
import art from "./art.ts";
import beat from "./beat.ts";
import checksum from "./checksum.ts";
import donate from "./donate.ts";
import eli5 from "./eli5.ts";
import fee from "./fee.ts";
import height from "./height.ts";
import home from "./home.ts";
import live from "./live.ts";
import mempool from "./mempool.ts";
import liveNet from "./live-net.ts";
import mining from "./mining.ts";
import node from "./node.ts";
import pay from "./pay.ts";
import ring from "./ring.ts";
import timeline from "./timeline.ts";
import tx from "./tx.ts";
import units from "./units.ts";
import verify from "./verify.ts";

export const STRING_MODULES = [live, fee, height, address, units, node, mining, verify, checksum, tx, donate, beat, liveNet, eli5, mempool, ring, art, timeline, home, pay, seo] as const;

type Source = (typeof STRING_MODULES)[number];
export type ModuleKey = Source extends infer S ? (S extends { en: infer E } ? keyof E : never) : never;
