// Checks in a real browser that Context's first chart starts on the first screen at 1440 x 900, with every tip rule firing.
// The jsdom tests cannot lay a page out; this can. It needs the demo server and the pinned Playwright:
//   cd web && npm ci && npm run build;  cd tools/demo && npm ci && uv run seed.py && uv run serve.py   (DEMO_PORT moves it)
//   node firstscreen.mjs        exits 1, naming the overflow, when the chart starts below the fold
// The demo store fires five rules; the context payload is answered with the sixth added, so the strip holds the most tips the rules give.
// CHROMIUM=<path> uses that Chromium instead of Playwright's own.
import { chromium } from "playwright";

const PORT = Number(process.env.DEMO_PORT || 8799);
const BASE = `http://127.0.0.1:${PORT}`;
const RULES = ["large_start", "frequent_compactions", "near_limit", "large_results", "cache_breaks", "long_tier"];
const TITLES = {
  large_start: "Sessions start with a large context", frequent_compactions: "Sessions compact repeatedly", near_limit: "Sessions reach the limit of the window",
  large_results: "Tool results fill the context", cache_breaks: "The prompt cache breaks within sessions", long_tier: "Requests are priced on the long-prompt tier",
};

const b = await chromium.launch({ executablePath: process.env.CHROMIUM });
let failed = false;
try {
  for (const scheme of ["light", "dark"]) {
    const page = await (await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme, reducedMotion: "reduce" })).newPage();
    await page.route("**/api/context?*", async route => {
      const res = await route.fetch(), d = await res.json();
      const have = new Set(d.tips.map(t => t.id)), base = d.tips[0];
      for (const id of RULES) if (!have.has(id)) d.tips.push({ ...base, id, severity: "warn", title: TITLES[id] });
      await route.fulfill({ response: res, json: d });
    });
    await page.goto(`${BASE}/context?range=30`);
    await page.waitForSelector("#starting .rng-bar");
    const tips = await page.locator("#tips .tip-btn").count(), all = await page.evaluate(() => document.querySelectorAll("#tips .tip-btn").length);
    const top = await page.evaluate(() => document.querySelector("#starting table")?.getBoundingClientRect().top ?? Infinity);
    const tabs = await page.evaluate(() => document.querySelector("[role=tablist]")?.getBoundingClientRect().top ?? Infinity);
    const ok = top < 900 && tabs < 900;
    console.log(`${scheme}: ${tips} of ${RULES.length} tips shown${all < RULES.length ? " (the rest behind Show more)" : ""}; tabs at ${Math.round(tabs)}px, first chart at ${Math.round(top)}px of 900: ${ok ? "ok" : "BELOW THE FOLD"}`);
    failed ||= !ok;
    await page.context().close();
  }
} finally {
  await b.close();
}
process.exit(failed ? 1 : 0);
