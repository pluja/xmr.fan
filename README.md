# xmr.fan

**Tiny tools for XMR fans.** Free, private Monero tools that run in your browser, plus *The xmr.fan Times*, a weekly AI-drafted, human-approved Monero newsletter with a podcast.

Source code: [tig.cx/pluja/xmr.fan](https://tig.cx/pluja/xmr.fan), mirrored on [GitHub](https://github.com/pluja/xmr.fan). Issues and pull requests go to GitHub.

No trackers, no accounts. Available in English, Spanish, Russian, French, Portuguese and Japanese.

## Tools

| URL | What it does |
|---|---|
| [`/uri`](https://xmr.fan/uri) | Payment link and pixel QR code, shareable payment cards, an embed and an HTTP API |
| [`/badge`](https://xmr.fan/badge) | “Monero accepted” badges for sites and shops: PNG downloads and a self-contained embed code |
| [`/verify`](https://xmr.fan/verify) | Confirms a payment with its transaction key or an OutProof / InProof signature, and shows the amount |
| [`/tx`](https://xmr.fan/tx) | Tracks a transaction until it's spendable, with sound and system notifications |
| [`/address`](https://xmr.fan/address) | Checks an address, compares two addresses, makes integrated addresses, looks up and creates OpenAlias names |
| [`/units`](https://xmr.fan/units) | XMR, piconero and 20 currencies; the price on any past date |
| [`/fee`](https://xmr.fan/fee) | Live fees per priority and the mempool |
| [`/height`](https://xmr.fan/height) | Wallet restore height from a date, and when a block was mined |
| [`/checksum`](https://xmr.fan/checksum) | Checks a Monero download against the official hashes signed by binaryFate |
| [`/node`](https://xmr.fan/node) | Checks any node, and lists healthy public nodes |
| [`/mempool`](https://xmr.fan/mempool) | Mempool stress: live gauges for waiting transactions, fees paid, the oldest wait and recent block fullness |
| [`/mining`](https://xmr.fan/mining) | Mining income for your CPU, and which P2Pool chain fits you |
| [`/ring`](https://xmr.fan/ring) | Ring game: spot the real coin among decoys under 2015, today's and FCMP++ rules |
| [`/donate`](https://xmr.fan/donate) | Donation roulette: a random privacy, free software or Monero project to support |
| [`/timeline`](https://xmr.fan/timeline) | Monero timeline: milestones and network upgrades from CryptoNote to FCMP++ |
| [`/beat`](https://xmr.fan/beat) | Address beat: any Monero address as a looping chiptune with a pixel visualizer |
| [`/live`](https://xmr.fan/live) | Monero live: the mempool and new blocks as pixel art and calm background music |
| [`/eli5`](https://xmr.fan/eli5) | Monero ELI5: what Monero is, in eight short animated pictures |
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

Or with Docker Compose (`compose.yaml`), which is what the scheduled jobs redeploy. It expects a reverse proxy on an external Docker network called `caddy` (create one with `docker network create caddy`):

```sh
docker compose up -d --build
```

Put it behind a reverse proxy for HTTPS (`ops/Caddyfile` is the block for a Caddy container on the same network). The proxy must send the visitor's address in `X-Forwarded-For` and replace any value the visitor sent, because the node checker's rate limit is per IP. Caddy does this by default:

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
5. **Review:** every issue starts as a draft, shown only in `npm run dev`. On the server it publishes itself after a review window, unless it is held (see [Automation](#automation)).
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

`.gazette/` keeps the sources, triage scores and podcast script of each issue for review. Podcast audio goes to `MEDIA_DIR` (default `public/`) and stays out of git. Rough cost per issue with nano-gpt: about $3 (X search, writing, art, 10 minutes of audio), plus about $1–2 for each extra podcast language.

## Automation

On the server, systemd timers run `ops/job.sh`. It pulls, runs one job in the compose `jobs` container (Node and ffmpeg, so the host only needs Docker and git), commits the data the job changed, pushes, and redeploys with Docker Compose. Results and failures go to your phone through [ntfy](https://ntfy.sh) (`NOTIFY_URL`).

| Job | When (UTC) | What it does |
|---|---|---|
| `weekly` | Monday 05:00, retried 08:00 and 11:00 | Writes last week's issue, translates it, voices the podcast (`PODCAST_LANGS`, default `en,es`), then sends the headlines for review |
| `publish` | hourly | Publishes the issue `GAZETTE_REVIEW_HOURS` (default 12) after the review notification, unless it is held |
| `donations` | Sunday 08:00 | Checks every donation address against its project's page. Missing addresses, and those unconfirmed for 90 days, drop out of the roulette until they're found again. |
| `nodes` | daily 06:30 | Checks every public node. After 3 failed days a node leaves the lists, and it returns when it works again. |
| `heights` | 1st of the month | Refreshes the block height table |

To stop an issue during its review window, from the site's directory on the server:

```sh
ops/hold.sh 2026-10-19             # hold it; edit src/data/gazette/2026-10-19.json if needed
ops/hold.sh 2026-10-19 --release   # it goes live at the next hourly check
```

**Setup on a VPS** (with Docker, git, and a Caddy container on an external Docker network called `caddy`):

1. Clone the repository to `/opt/stacks/xmrfan` as a user that can run `docker`, using a deploy key that can push. Give the checkout a commit identity, for example `git config user.name "xmr.fan bot"` and `git config user.email bot@xmr.fan`.
2. Copy `.env.example` to `.env` and fill it in. Set `NOTIFY_URL` (the full topic URL, `https://ntfy.sh/<topic>`) and `MEDIA_DIR` (for example `/opt/stacks/xmrfan-media`) for the podcast audio; the site serves it from there.
3. Start the site with `docker compose up -d --build`, and add `ops/Caddyfile` to the Caddy config.
4. Install the timers. Set `User=` in `xmr-fan-job@.service` to the user from step 1.

   ```sh
   sudo cp ops/systemd/* /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now xmr-fan-weekly.timer xmr-fan-publish.timer xmr-fan-donations.timer xmr-fan-nodes.timer xmr-fan-heights.timer
   ```

5. Try a job by hand: `sudo systemctl start xmr-fan-job@nodes`, then `journalctl -u xmr-fan-job@nodes`.

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
- **Share cards:** every tool and the home page have their own card per language in `public/og/`. They're drawn as HTML (`src/pages/og/`, dev only); with `npm run dev` running, `npm run og` screenshots them again. Rerun it after changing a tool's name or description.

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

Open issues and pull requests on the [GitHub mirror](https://github.com/pluja/xmr.fan); the main repository on tig.cx is a single-user instance, and accepted changes land there first.

**Add a tool**

1. Add it to `TOOLS` in `src/lib/tools.ts`. Its slug is its URL; `added` dates it for the feed.
2. Create `src/components/tools/<Name>.astro` and register it in `COMPONENTS` in `src/pages/[...lang]/[tool].astro`.
3. Put its strings in `src/i18n/tools/<tool>.ts` with `defineStrings` and list the module in `src/i18n/tools/index.ts`. TypeScript flags any language missing a key. Add its search title and description to `src/i18n/seo.ts`.
4. For live data, use `src/lib/node-client.ts`, `liveTask()` and the `NodeSource` bar from `src/components/live/`.
5. Build the UI from `src/components/ui/`: `Step`, `AddressInput`, `Slip`, `StatTile`, `Button`, `TrustNote` and the class sets in `styles.ts`, all Tailwind. Set `dark: true` on the tool to use the wide dark frame.

**Add a language:** add its code to `LOCALES` and a dictionary to `src/i18n/ui.ts`, then to each module in `src/i18n/`. Check that the pixel font covers its script (see the Russian override in `src/styles/global.css`).

**Donation roulette:** projects live in `src/data/donations.json`. Every address must be copied from the project's own donation page (`source`). `npm run donations:check` confirms each address still appears on its page (or in the project's OpenAlias record). With `-- --write` it stores today's date as `checked` and marks vanished addresses `missing`, which hides them. The `donations` job does this weekly.

**Maintenance:** the jobs above keep the data fresh. By hand, only add nodes to the candidate lists in `src/lib/nodes.ts` when the `nodes` job reports that few are left, and rerun `npm run og` after changing a tool's name or description.
