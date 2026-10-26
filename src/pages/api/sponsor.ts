/* Receives sponsorship requests from /sponsor and stores them for review, outside the
   site (SPONSOR_REQUESTS_DIR, default ./sponsor-requests). Nothing is published until
   someone approves it with `npm run sponsor:approve`. */
import type { APIRoute } from "astro";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { isLocale, localePath } from "../../i18n/ui";
import { requestSchema } from "../../lib/sponsor";

export const prerender = false;

const DIR = process.env.SPONSOR_REQUESTS_DIR || "sponsor-requests";
const MAX_PENDING = 200; // a simple brake against floods

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const lang = String(form.get("lang") ?? "en");
  const back = (query: string) => redirect(`${localePath(isLocale(lang) ? lang : "en", "/sponsor")}?${query}#form`, 303);

  // Bots fill every field; people never see this one.
  if (String(form.get("website") ?? "")) return back("sent=1");

  const fields = ["name", "line", "url", "week", "amount", "txid", "txkey", "contact", "accept"] as const;
  const parsed = requestSchema.safeParse(Object.fromEntries(fields.map((f) => [f, String(form.get(f) ?? "")])));
  if (!parsed.success) {
    const bad = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    return back(`error=${encodeURIComponent(bad.join(","))}`);
  }

  await mkdir(DIR, { recursive: true });
  if ((await readdir(DIR)).length >= MAX_PENDING) return back("error=busy");
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}`;
  await writeFile(`${DIR}/${id}.json`, JSON.stringify({ id, received: new Date().toISOString(), lang, ...parsed.data }, null, 2));
  return back("sent=1");
};
