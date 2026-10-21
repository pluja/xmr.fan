// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";

export default defineConfig({
  site: "https://xmr.fan",
  trailingSlash: "ignore",
  // Behind a reverse proxy, Astro trusts X-Forwarded-For only for these hosts; the per-IP
  // rate limit on /api/node needs the visitor's address, not the proxy's.
  security: { allowedDomains: [{ hostname: "xmr.fan", protocol: "https" }, { hostname: "www.xmr.fan", protocol: "https" }] },
  build: { inlineStylesheets: "auto" },
  // Any Astro server adapter works here; Node runs on a plain VPS or in Docker.
  adapter: node({ mode: "standalone" }),
  vite: {
    plugins: [tailwindcss()],
    // Pre-bundle at startup; otherwise the dev server discovers them late and
    // serves "504 Outdated Optimize Dep", which silently breaks the tool scripts.
    optimizeDeps: { include: ["qrcode-generator", "@noble/hashes/sha3.js", "@noble/curves/ed25519.js", "@noble/curves/utils.js", "@noble/hashes/sha2.js"] },
  },
});
