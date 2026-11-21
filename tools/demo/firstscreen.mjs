// Checks in a real browser that Context's tabs and first plotted mark are on the first screen at 1440 x 900, with every tip rule
// firing, before and after "Show N more" expands the strip; and that Activity's work chart and workbench tab list are, over 30 days
// (bars by day) and all time (bars by week). The jsdom tests cannot lay a page out; this can. It runs locally, not in
// CI. It needs the demo server and the pinned Playwright:
//   cd web && npm ci && npm run build;  cd tools/demo && npm ci && uv run seed.py && uv run serve.py   (DEMO_PORT moves it)
//   node firstscreen.mjs        exits 1, naming what falls outside the window
// The demo store fires five rules; the context payload is answered with the sixth added, so the strip holds the most tips the rules give.
// CHROMIUM=<path> uses that Chromium instead of Playwright's own.
import { chromium } from "playwright";

const PORT = Number(process.env.DEMO_PORT || 8799);
const BASE = `http://127.0.0.1:${PORT}`;
const H = 900;
const RULES = ["large_start", "frequent_compactions", "near_limit", "large_results", "cache_breaks", "long_tier"];
const TITLES = {
  large_start: "Sessions start with a large context", frequent_compactions: "Sessions compact repeatedly", near_limit: "Sessions reach the limit of the window",
  large_results: "Tool results fill the context", cache_breaks: "The prompt cache breaks within sessions", long_tier: "Requests are priced on the long-prompt tier",
};

/** Where the tablist and the first plotted mark (the first range bar of Starting context) sit, in px from the window's top. */
const measure = page => page.evaluate(() => {
  const box = sel => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r ? { top: r.top, bottom: r.bottom } : null; };
  return { tabs: box("[role=tablist]"), mark: box("#starting .rng-bar") };
});
/** Whether both are wholly inside the window, and a line saying where they are. */
const verdict = ({ tabs, mark }, what) => {
  const inside = r => r != null && r.top >= 0 && r.bottom <= H;
  const ok = inside(tabs) && inside(mark);
  const at = r => (r ? `${Math.round(r.top)}-${Math.round(r.bottom)}px` : "missing");
  return { ok, line: `${what}: tabs at ${at(tabs)}, first plotted mark at ${at(mark)} of ${H}: ${ok ? "ok" : "OUTSIDE THE WINDOW"}` };
};

const b = await chromium.launch({ executablePath: process.env.CHROMIUM });
let failed = false;
try {
  for (const scheme of ["light", "dark"]) {
    const page = await (await b.newContext({ viewport: { width: 1440, height: H }, colorScheme: scheme, reducedMotion: "reduce" })).newPage();
    await page.route("**/api/context?*", async route => {
      const res = await route.fetch(), d = await res.json();
      const have = new Set(d.tips.map(t => t.id)), base = d.tips[0];
      for (const id of RULES) if (!have.has(id)) d.tips.push({ ...base, id, severity: "warn", title: TITLES[id] });
      await route.fulfill({ response: res, json: d });
    });
    await page.goto(`${BASE}/context?range=30`);
    await page.waitForSelector("#starting .rng-bar");
    const tips = await page.locator("#tips .tip-btn").count();
    const first = verdict(await measure(page), `${scheme}, ${tips} of ${RULES.length} tips shown`);
    console.log(first.line);
    failed ||= !first.ok;
    const more = page.locator("#tips .tip-more");
    if (await more.count()) {
      await more.click();
      const all = await page.locator("#tips .tip-btn").count();
      const expanded = verdict(await measure(page), `${scheme}, Show more expanded to ${all} tips`);
      console.log(expanded.line);
      failed ||= !expanded.ok;
    }
    // Activity's Overview: the work chart and the tab list.
    for (const range of ["30", "0"]) {
      await page.goto(`${BASE}/usage?range=${range}`);
      await page.waitForSelector("#work .bar-seg");
      const got = await page.evaluate(() => {
        const box = sel => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r ? { top: r.top, bottom: r.bottom } : null; };
        return { tabs: box("#workbench [role=tablist]"), mark: box("#work .chart") };
      });
      const v = verdict(got, `${scheme}, Activity over ${range === "0" ? "all time" : `${range} days`}`);
      console.log(v.line.replace("first plotted mark", "work chart"));
      failed ||= !v.ok;
    }
    await page.context().close();
  }
} finally {
  await b.close();
}
process.exit(failed ? 1 : 0);
