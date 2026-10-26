/* Access to unpublished issues at /news/preview, for review before they go live.
   The key (GAZETTE_PREVIEW_KEY) comes from the form or ?key=, and is then remembered in a cookie. */
import type { AstroGlobal } from "astro";
import { createHash, timingSafeEqual } from "node:crypto";
import { isLocale } from "../i18n/ui.ts";

const COOKIE = "xmrfan_preview";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const equal = (a: string, b: string) => timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b)));

export type PreviewAccess = "open" | "locked" | "wrong";

/** null when previews are off (no key set) or the locale is bogus; a Response when the key was just accepted. */
export async function previewAccess(Astro: AstroGlobal): Promise<PreviewAccess | Response | null> {
  const key = process.env.GAZETTE_PREVIEW_KEY || "";
  const lang = Astro.params.lang;
  if (!key || (lang !== undefined && !isLocale(lang))) return null;

  Astro.response.headers.set("Cache-Control", "private, no-store");
  const form = Astro.request.method === "POST" ? await Astro.request.formData() : undefined;
  const given = String(form?.get("key") ?? Astro.url.searchParams.get("key") ?? "");
  if (given) {
    if (!equal(given, key)) return "wrong";
    // The cookie holds a digest, so the key itself never sits in the browser; rotating the key logs everyone out.
    Astro.cookies.set(COOKIE, digest(key), { path: "/", httpOnly: true, secure: true, sameSite: "lax", maxAge: 90 * 86_400 });
    return Astro.redirect(Astro.url.pathname, 303);
  }
  return equal(Astro.cookies.get(COOKIE)?.value ?? "", digest(key)) ? "open" : "locked";
}
