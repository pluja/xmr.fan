# xmr.fan

**Tiny tools for XMR fans.** Free, private Monero tools that run in your browser, plus *The xmr.fan Times*, a weekly AI-drafted, human-approved Monero newsletter with a podcast.

No trackers, no accounts. Available in English, Spanish, Russian, French, Portuguese and Japanese.

## Tools

| URL | What it does |
|---|---|
| [`/uri`](https://xmr.fan/uri) | Payment link and pixel QR code, shareable payment cards, an embed and an HTTP API |
| [`/verify`](https://xmr.fan/verify) | Confirms a payment with its transaction key or an OutProof / InProof signature, and shows the amount |
| [`/tx`](https://xmr.fan/tx) | Tracks a transaction until it's spendable, with sound and system notifications |
| [`/address`](https://xmr.fan/address) | Checks an address, compares two addresses, makes integrated addresses, looks up and creates OpenAlias names |
| [`/units`](https://xmr.fan/units) | XMR, piconero and 20 currencies; the price on any past date |
| [`/fee`](https://xmr.fan/fee) | Live fees per priority and the mempool |
| [`/height`](https://xmr.fan/height) | Wallet restore height from a date, and when a block was mined |
| [`/checksum`](https://xmr.fan/checksum) | Checks a Monero download against the official hashes signed by binaryFate |
| [`/node`](https://xmr.fan/node) | Checks any node, and lists healthy public nodes |
| [`/mining`](https://xmr.fan/mining) | Mining income for your CPU, and which P2Pool chain fits you |
| [`/donate`](https://xmr.fan/donate) | Donation roulette: a random privacy, free software or Monero project to support |
| [`/fan`](https://xmr.fan/fan) | Fan card: a pixel avatar, rarity, class and stats from your nickname, to share |
| [`/news`](https://xmr.fan/news) | The xmr.fan Times |

### Privacy model

- Everything that involves keys, proofs, addresses or files is computed in the browser. Downloads are hashed locally; tx keys and proofs never leave the page.
- Live data comes straight from **public Monero nodes that allow browser requests** (`PUBLIC_NODES` in `src/lib/nodes.ts`), so only a transaction ID ever reaches a node. Users can switch to their own node from any live tool.
- Shareable links (payment cards, payment checks) keep their data after `#`, which browsers never send to a server.
- The server only does what browsers can't. Each endpoint is listed below.

## Quick start

Requires Node.js 22.9 or newer.

```sh
npm install
npm run dev      # http://localhost:4321 (rebuilds the content cache on start)
npm test         # unit tests, including real mainnet payment proofs and the signed hashes.txt
npm run check    # type check
npm run build    # dist/client (static) + dist/server (Node server)
```

## Deploying

Every page is prerendered except `/uri` (it also answers API calls) and `/api/*`. The built Node server serves both:

```sh
npm run build
HOST=0.0.0.0 PORT=4321 node dist/server/entry.mjs
```

Or with Docker:

```sh
docker build -t xmr.fan .
docker run -p 4321:4321 -v ./sponsor-requests:/app/sponsor-requests xmr.fan
```

Put it behind a reverse proxy for HTTPS. The proxy must send the visitor's address in `X-Forwarded-For` and replace any value the visitor sent, because the node checker's rate limit is per IP. Caddy does this by default:

```
xmr.fan {
  reverse_proxy localhost:4321
}
```

With nginx, use `proxy_set_header X-Forwarded-For $remote_addr;` plus `Host` and `X-Forwarded-Proto`. Astro only trusts these headers for the hosts in `security.allowedDomains` in `astro.config.mjs`; add yours there if you deploy under another domain.

The site URL is set in `astro.config.mjs` (`site`). The server code only uses web-standard APIs, so another Astro adapter can replace `@astrojs/node`. Environment variables are documented in [`.env.example`](.env.example); the scripts read `.env` automatically.

### Server endpoints

| Endpoint | Purpose |
|---|---|
| `/uri?…&raw`, `&rawqr` | Payment link API (below) |
| `/api/node?url=` | Checks one node from the server. Private and local addresses are refused on every connection (SSRF guard in `src/lib/server/node-check.ts`); rate limited per IP. |
| `/api/node?list` | Checks the suggested public nodes; cached 5 minutes |
| `/api/hashes` | getmonero.org's `hashes.txt`, served only if binaryFate's key (`src/data/keys/binaryfate.ts`) signed it; cached 1 hour |
| `/api/p2pool`, `/api/price-on` | Cached proxies for p2pool.observer and Bitfinex, which browsers can't call directly |
| `/api/sponsor` | Receives sponsorship requests (stored privately for review) |

## Payment link API

```sh
curl "https://xmr.fan/uri?address=44AFFq5k...&tx_amount=1.5&raw"     # the monero: URI as text
curl "https://xmr.fan/uri?address=44AFFq5k...&tx_amount=1.5&rawqr"   # the QR code as PNG
```

- Parameters: `address` (required), `tx_amount`, `tx_payment_id`, `recipient_name`, `tx_description`. Add `&style=plain` for a black-and-white QR without the logo.
- Invalid input returns `400` with one `field: message` line per problem, in the page's language (`/es/uri?raw` answers in Spanish).
- Without `raw` / `rawqr`, the same URL opens the tool with the form filled in.

**Payment cards.** The Share button makes `xmr.fan/uri#c=<code>`, a payment card drawn in the browser. The code packs the whole request (`src/lib/share.ts`). `?embed#c=<code>` is the card alone, for an `<iframe>`, and `c=<code>` also works as a query parameter for `raw`, `rawqr` and `embed`.

## The xmr.fan Times

A weekly issue every Monday, covering the previous week (Monday to Sunday, UTC).

1. **Sources:** GitHub (releases, merged PRs, meetings), getmonero.org, Monero Observer, Revuo, CCS, wallet and app blogs (Cake Wallet, Feather, Haveno), crypto outlets filtered to Monero, privacy news and blogs (GrapheneOS, EFF, Privacy Guides, 404 Media, The Record, Tor, Signal, Mullvad, IVPN, Proton, Tails, Qubes OS, Whonix, SimpleX, Session), Reddit and, with `NANO_GPT_API_KEY`, X. The list is `FEEDS` in `scripts/gazette/sources.ts`.
2. **Numbers:** network averages from public nodes; price, volume and a Bitcoin comparison from CoinGecko.
3. **AI, in three steps:** triage scores every item; the editorial writes the lead, a feature, quotes checked word for word, and the news; a short price note cites its sources. The model cites items by id and links come from the sources, so it can't invent URLs.
4. **Art and audio (optional):** pixel-art headline image (`scripts/gazette/art.ts`), and a two-host podcast voiced with text-to-speech and joined with ffmpeg.
5. **Review:** everything is a draft until a person approves it. Drafts show only in `npm run dev`.
6. **Transparency:** each issue records how many items every source had that week, and its page ends with a "What we read this week" list of the sources checked and every link cited.

```sh
npm run gazette                          # draft for the last complete week
npm run gazette -- --week 2026-10-12     # a specific week; --force to redo, --reuse-sources to rewrite
npm run gazette -- --week 2026-10-12 --only-price   # refresh numbers and the price note
npm run gazette -- --week 2026-10-12 --only-art     # redraw the headline art
npm run gazette:podcast -- 2026-10-12    # audio episode (needs ffmpeg)
npm run gazette:podcast -- 2026-10-12 --lang es   # the episode in Spanish (after translating)
npm run gazette:publish -- 2026-10-12    # approve the draft
npm run gazette:translate -- 2026-10-12  # translate the text (es, ru, fr, pt, ja); --lang es,ja
```

`.gazette/` keeps the sources, triage scores and podcast script of each issue for review. Rough cost per issue with nano-gpt: about $3 (X search, writing, art, 10 minutes of audio).

## Sponsorships

Pay what you want from $50, approved by hand. Sponsorships add up to lasting tiers on `/sponsors` (Fan, Big fan, Superfan, Legend; amounts are never shown).

1. Set your XMR address, the minimum and the tiers in `src/data/sponsorship.json`. Until the address is valid, `/sponsor` says sponsorships open soon.
2. Sponsors pay and send the form. Requests are stored in `sponsor-requests/` (`SPONSOR_REQUESTS_DIR`).
3. `npm run sponsor:list`, then check the payment with its transaction key (or on `/verify`).
4. `npm run sponsor:approve -- <id> <week> [--usd 75] [--as <sponsor-id>]`, then rebuild and deploy.

## Feeds and SEO

- **Feeds** (listed on `/feeds`): `/feed/news.xml` (the weekly issue) and `/feed/tools.xml` (new tools), also per language at `/<lang>/feed/…`. `/feed/podcast.xml` is the podcast with iTunes and Podcasting 2.0 tags, ready for Apple Podcasts and Podcast Index; languages with their own episodes get their own podcast feed (`/es/feed/podcast.xml`), and their news page plays them.
- **SEO:** each page has a search title and description in every language (`src/i18n/seo.ts`), canonical and hreflang links, Open Graph and Twitter cards, and JSON-LD (`src/lib/seo.ts`). `/sitemap.xml` lists every page in every language; `/robots.txt` keeps `/api/` and `/uri?…` out of the index.
- **Images:** `npm run brand` redraws the share image, the podcast cover and the app icons from the site's pixel art.

## Project layout

```
src/
  pages/[...lang]/      one file per page; the optional lang segment builds every language
  pages/api/            server endpoints
  components/           shared UI (ToolFrame, Field, TitleBar, CopyButton, Disclosure…)
  components/tools/     one component per tool
  components/live/      node source bar, custom node, currency picker
  components/gazette/   the newsletter
  lib/                  Monero logic and helpers, framework-free and unit tested
  lib/server/           server-only code (node checks, signed hash list)
  i18n/                 ui.ts (site strings), tools/*.ts (per-tool strings), seo.ts
  data/                 newsletter issues, sponsors, block height table, signing key
scripts/                newsletter pipeline, sponsor approval, data and image generators
```

## Contributing

**Add a tool**

1. Add it to `TOOLS` in `src/lib/tools.ts`. Its slug is its URL; `added` dates it for the feed.
2. Create `src/components/tools/<Name>.astro` and register it in `COMPONENTS` in `src/pages/[...lang]/[tool].astro`.
3. Put its strings in `src/i18n/tools/<tool>.ts` with `defineStrings` and list the module in `src/i18n/tools/index.ts`. TypeScript flags any language missing a key. Add its search title and description to `src/i18n/seo.ts`.
4. For live data, use `src/lib/node-client.ts`, `liveTask()` and the `NodeSource` bar from `src/components/live/`.

**Add a language:** add its code to `LOCALES` and a dictionary to `src/i18n/ui.ts`, then to each module in `src/i18n/`. Check that the pixel font covers its script (see the Russian override in `src/styles/global.css`).

**Donation roulette:** projects live in `src/data/donations.json`. Every address must be copied from the project's own donation page (`source`). `npm run donations:check` confirms each address still appears on its page (or in the project's OpenAlias record), and `-- --write` stores today's date as `checked`. Run it weekly, for example from cron, and fix or remove anything it reports.

**Maintenance:** run `npm run donations:check` weekly and `npm run heights` every few months, and prune `PUBLIC_NODES` and `WALLET_NODES` in `src/lib/nodes.ts` when nodes go away.
