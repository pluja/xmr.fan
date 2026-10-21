import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { editionSchema } from "./lib/gazette-schema.ts";
import { sponsorSchema } from "./lib/sponsor-schema.ts";

/* One JSON file per weekly edition, written by scripts/gazette. */
const gazette = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/data/gazette" }),
  schema: editionSchema,
});

const sponsors = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/data/sponsors" }),
  schema: sponsorSchema,
});

export const collections = { gazette, sponsors };
