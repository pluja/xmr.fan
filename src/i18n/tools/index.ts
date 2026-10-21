import seo from "../seo";
import address from "./address";
import checksum from "./checksum";
import fee from "./fee";
import height from "./height";
import live from "./live";
import mining from "./mining";
import node from "./node";
import tx from "./tx";
import units from "./units";
import verify from "./verify";

export const STRING_MODULES = [live, fee, height, address, units, node, mining, verify, checksum, tx, seo] as const;

type Source = (typeof STRING_MODULES)[number];
export type ModuleKey = Source extends infer S ? (S extends { en: infer E } ? keyof E : never) : never;
