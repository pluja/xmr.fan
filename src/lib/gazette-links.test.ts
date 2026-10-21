import { test } from "node:test";
import assert from "node:assert/strict";
import { linkLabel, linksBySite } from "./gazette-links.ts";

test("collects cited links anywhere in an issue, once, grouped by site", () => {
  const issue = {
    lead: { h: "x", src: "GitHub", url: "https://github.com/a", more: [{ src: "Reddit", url: "https://www.reddit.com/r/Monero/1" }] },
    sections: { dev: [{ src: "GitHub", url: "https://github.com/b" }, { src: "GitHub", url: "https://github.com/a" }] },
    translations: { es: { lead: { src: "ignored", url: "https://example.com" } } },
  };
  assert.deepEqual(linksBySite(issue), [
    { site: "github.com", links: [{ src: "GitHub", url: "https://github.com/a" }, { src: "GitHub", url: "https://github.com/b" }] },
    { site: "reddit.com", links: [{ src: "Reddit", url: "https://www.reddit.com/r/Monero/1" }] },
  ]);
});

test("readable labels for cited links", () => {
  assert.equal(linkLabel("https://github.com/monero-project/monero/pull/11459"), "monero #11459");
  assert.equal(linkLabel("https://github.com/monero-project/monero-gui/releases/tag/v0.18.5.4"), "monero-gui v0.18.5.4");
  assert.equal(linkLabel("https://monero.observer/monero-tech-meeting-19-october-2026/"), "monero tech meeting 19 october 2026");
  assert.equal(linkLabel("https://x.com/GrapheneOS/status/2111396590464209281"), "GrapheneOS …09281");
  assert.equal(linkLabel("https://repo.getmonero.org/monero-project/ccs-proposals/-/merge_requests/708"), "MR !708");
});
