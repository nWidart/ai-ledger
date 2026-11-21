// Checks in a real browser that no page keeps more than two bars stuck to the top, the nav and the scope bar, at 1440 x 900 and
// 390 x 844, on every page and Activity's Judgments view, once scrolled; that the scope bar sits right under the nav; that the
// narrow bar is one row and the page has no sideways scroll at 390 x 844; and that Errors' type header and example bar stick
// under both bars. A page bar is an element with position sticky or fixed, stuck at its top, at least 60% of the window wide:
// Errors' type header and example bar stay inside the detail pane, which is half the window at 1440. The jsdom tests cannot
// lay a page out; this can. It runs locally, not in CI. It needs the demo server and the pinned Playwright:
//   cd web && npm ci && npm run build;  cd tools/demo && npm ci && uv run seed.py && uv run serve.py   (DEMO_PORT moves it)
//   node sticky.mjs        prints a line per page and size, and exits 1 naming what fails
// CHROMIUM=<path> uses that Chromium instead of Playwright's own.
import { chromium } from "playwright";

const PORT = Number(process.env.DEMO_PORT || 8799);
const BASE = `http://127.0.0.1:${PORT}`;
const SIZES = [[1440, 900], [390, 844]];
const PAGES = ["/live", "/limits?range=30", "/usage?range=30", "/usage?view=judgments&range=30", "/cost?range=30", "/context?range=30", "/errors?range=30",
  "/project?project=atlas-api&range=30"];

/** The page bars stuck to the top after a scroll to y, and the two bars' boxes. */
const read = (page, y) => page.evaluate(y => {
  scrollTo(0, y);
  const bars = [...document.querySelectorAll("body *")].filter(el => {
    const cs = getComputedStyle(el);
    if (cs.position !== "sticky" && cs.position !== "fixed") return false;
    const r = el.getBoundingClientRect(), top = parseFloat(cs.top);
    if (!r.width || !r.height || r.bottom <= 0 || r.top >= innerHeight / 3 || Number.isNaN(top) || Math.abs(r.top - top) > 1) return false;
    return r.width >= innerWidth * .6;
  }).map(el => el.className || el.tagName);
  const box = s => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? { top: r.top, bottom: r.bottom } : null; };
  return { bars, nav: box(".appnav"), scope: box(".scopebar"), wide: document.documentElement.scrollWidth - innerWidth, scrolled: scrollY };
}, y);

const b = await chromium.launch({ executablePath: process.env.CHROMIUM });
let failed = false;
const fail = line => { console.log(line); failed = true; };
try {
  for (const [width, height] of SIZES) {
    const page = await (await b.newContext({ viewport: { width, height }, reducedMotion: "reduce" })).newPage();
    for (const path of PAGES) {
      await page.goto(BASE + path, { waitUntil: "load" });
      await page.locator("main#content").waitFor();
      await page.waitForTimeout(1500);
      for (const y of [400, 100000]) {
        const r = await read(page, y);
        const what = `${width}x${height} ${path} scrolled to ${Math.round(r.scrolled)}px`;
        const line = `${what}: ${r.bars.length} bars stuck (${r.bars.join(", ")})`;
        if (r.bars.length > 2) fail(`${line}: MORE THAN TWO`);
        else if (!r.scope || !r.nav || Math.abs(r.scope.top - r.nav.bottom) > 1) fail(`${line}: SCOPE BAR NOT UNDER THE NAV`);
        else if (width < 600 && r.scope.bottom - r.scope.top > r.nav.bottom - r.nav.top + 1) fail(`${line}: NARROW SCOPE BAR TALLER THAN THE NAV`);
        else if (r.wide > 0) fail(`${line}: ${r.wide}px OF SIDEWAYS SCROLL`);
        else console.log(`${line}: ok`);
      }
    }
    await page.context().close();
  }
  // Errors at 1440: the open type's header sticks under both bars, and its example bar under the header.
  const page = await (await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" })).newPage();
  await page.goto(`${BASE}/errors?range=30`, { waitUntil: "load" });
  await page.locator(".pg-errors .types .tbtn").first().click(); // the busiest type
  await page.locator("#detail .exbar").waitFor();
  const e = await page.evaluate(() => {
    const r = s => document.querySelector(s).getBoundingClientRect();
    // 200px past where the example bar starts to stick, under the bars and the type header.
    scrollTo(0, r("#detail .exbar").top + scrollY - r(".scopebar").bottom - r("#detail .dhead").height + 200);
    return { scope: r(".scopebar").bottom, dhead: r("#detail .dhead"), exbar: r("#detail .exbar").top, end: r("#detail").bottom };
  });
  const line = `1440x900 /errors: bars end at ${Math.round(e.scope)}px, type header at ${Math.round(e.dhead.top)}-${Math.round(e.dhead.bottom)}px, example bar at ${Math.round(e.exbar)}px`;
  if (e.end < 900) console.log(`${line}: the detail is too short to scroll it under the bars, not checked`);
  else if (Math.abs(e.dhead.top - e.scope) > 1 || Math.abs(e.exbar - e.dhead.bottom) > 1) fail(`${line}: NOT STACKED UNDER THE BARS`);
  else console.log(`${line}: ok`);
  await page.context().close();
} finally {
  await b.close();
}
process.exit(failed ? 1 : 0);
