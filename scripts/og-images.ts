/* Screenshots the social share cards from the dev server into public/og/<lang>/<page>.png.
     npm run dev, then: npm run og [-- --base http://localhost:4321] */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { LOCALES } from "../src/i18n/ui.ts";
import { TOOLS } from "../src/lib/tools.ts";

const base = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : "http://localhost:4321";
const pages = ["home", ...TOOLS.map((tool) => tool.slug)];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const lang of LOCALES) {
  mkdirSync(`public/og/${lang}`, { recursive: true });
  for (const name of pages) {
    const response = await page.goto(`${base}/og/${lang}/${name}`);
    if (!response?.ok()) throw new Error(`${lang}/${name}: HTTP ${response?.status()}`);
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; } astro-dev-toolbar { display: none !important; }" });
    await page.screenshot({ path: `public/og/${lang}/${name}.png`, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  }
  console.log(lang, pages.length);
}
await browser.close();
