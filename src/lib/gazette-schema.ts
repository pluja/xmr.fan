/* Shape of a weekly Gazette edition. Used by the site (content collection)
   and by the generator (scripts/gazette), so both agree on one definition. */
import { z } from "astro/zod";

const sourceSchema = z.object({ src: z.string().min(1), url: z.url() });

export const storySchema = sourceSchema.extend({
  h: z.string().min(1),   // headline
  p: z.string().min(1),   // summary
  // src + url: the main source; `more`: other sources the story draws on.
  more: z.array(sourceSchema).optional(),
});

export const sectionsSchema = z.object({
  dev: z.array(storySchema),
  eco: z.array(storySchema),
  comm: z.array(storySchema),
  privacy: z.array(storySchema).default([]), // privacy and freedom tech beyond Monero
});

/** A longer piece on the week's most interesting story. */
export const featureSchema = sourceSchema.extend({
  h: z.string().min(1),
  dek: z.string().optional(),               // one-line standfirst under the headline
  body: z.array(z.string().min(1)).min(1),  // paragraphs
  more: z.array(sourceSchema).optional(),
});

/** Words people actually wrote, verbatim, with who said it and where. */
export const quoteSchema = z.object({
  text: z.string().min(1),
  who: z.string().min(1), // e.g. "@monero" or "r/Monero"
  url: z.url(),
  src: z.string().min(1),
});

/** Pixel-art illustration for the lead. `prompt` is the scene the image model drew. */
export const artSchema = z.object({
  file: z.string().optional(), // e.g. /news-art/2026-10-12.png, once drawn
  alt: z.string().min(1),
  prompt: z.string().min(1),
});

/** A dated event coming up after the week, e.g. a meeting or an upgrade. */
export const upcomingSchema = sourceSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().optional(), // e.g. "17:00 UTC"
  what: z.string().min(1),
  more: z.array(sourceSchema).optional(),
});

/** The part an AI model writes. */
export const editorialSchema = z.object({
  /** Two or three sentences on what the week was about; memory for later issues. */
  recap: z.string().optional(),
  lead: storySchema,
  art: artSchema.optional(),
  feature: featureSchema.optional(),
  quotes: z.array(quoteSchema).optional(),
  upcoming: z.array(upcomingSchema).optional(),
  sections: sectionsSchema,
});

const weekStatsSchema = z.object({
  hash: z.number(), // average hashrate, GH/s
  fee: z.number(),  // average fee paid per transaction, XMR
  txs: z.number(),  // average transactions per day
});

export const networkSchema = weekStatsSchema.extend({
  height: z.number(),
  prev: weekStatsSchema.optional(),           // the week before, for comparison
  history: z.array(weekStatsSchema).optional(), // the weeks before that, oldest first
  analysis: z.string().optional(),            // context the numbers alone don't give
});

const driverSchema = sourceSchema.extend({ text: z.string().min(1), more: z.array(sourceSchema).optional() });

/** XMR price over the week, in USD, from CoinGecko. */
export const marketSchema = z.object({
  open: z.number(),
  close: z.number(),
  high: z.number(),
  low: z.number(),
  change: z.number(),       // percent, open to close
  volume: z.number(),       // average 24h volume, USD
  volumeChange: z.number(), // percent vs the week before
  mcap: z.number(),
  btcChange: z.number(),    // Bitcoin's change over the same week, percent
  series: z.array(z.number()), // close every 4 hours, for the chart
  month: z.object({ change: z.number(), high: z.number(), low: z.number() }).optional(), // the 30 days to the week's end
  analysis: z.object({
    summary: z.string(), // context the numbers alone don't give; may be empty
    drivers: z.array(driverSchema), // what may have moved the price, with sources
    watch: z.array(z.string()).default([]), // older issues only; events now live in `upcoming`
  }).optional(),
});

export const podcastSchema = z.object({
  file: z.string(),     // URL path, e.g. /podcast/2026-10-12.mp3; the file lives in MEDIA_DIR
  duration: z.number(), // seconds
  bytes: z.number().optional(), // file size, for the feed's enclosure
  hosts: z.array(z.string()),
  transcript: z.array(z.object({ host: z.string(), text: z.string() })),
});

const textStory = z.object({ h: z.string(), p: z.string() });

/** One language's version of an issue's text. Links, sources and numbers stay in the English original. */
export const translationSchema = z.object({
  recap: z.string().optional(),
  lead: textStory,
  art: z.object({ alt: z.string() }).optional(),
  feature: z.object({ h: z.string(), dek: z.string().optional(), body: z.array(z.string()) }).optional(),
  quotes: z.array(z.object({ text: z.string() })).optional(), // shown under the original words
  upcoming: z.array(z.object({ what: z.string() })).optional(),
  sections: z.object({
    dev: z.array(textStory), eco: z.array(textStory), comm: z.array(textStory), privacy: z.array(textStory).default([]),
  }),
  price: z.object({ summary: z.string(), drivers: z.array(z.string()), watch: z.array(z.string()).optional() }).optional(),
});

export const editionSchema = editorialSchema.extend({
  no: z.number().int().positive(),
  /** Monday that starts the week the edition covers (UTC). */
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Drafts only show in development until someone approves them. */
  draft: z.boolean().default(false),
  sample: z.boolean().default(false),
  network: networkSchema.optional(),
  market: marketSchema.optional(),
  podcast: podcastSchema.optional(),
  /** Episodes in other languages, by locale code ("es"); `podcast` is English. */
  podcasts: z.record(z.string(), podcastSchema).optional(),
  /** `sources`: every outlet the pipeline read that week, with how many items it had. */
  generated: z.object({
    model: z.string(),
    at: z.string(),
    items: z.number(),
    sources: z.array(z.object({ name: z.string(), count: z.number().int() })).optional(),
  }).optional(),
  /** Translated text by locale code ("es", "ja", …). English is the edition itself. */
  translations: z.record(z.string(), translationSchema).optional(),
});

export type EditionData = z.infer<typeof editionSchema>;

export type TranslationData = z.infer<typeof translationSchema>;
