// Checks in a real browser that no page keeps more than two bars stuck to the top, the nav and the scope bar, at 1440 x 900 and
// 390 x 844, on every page and Activity's Judgments view, once scrolled; that the scope bar sits right under the nav; that the
// narrow bar is one row and the page has no sideways scroll at 390 x 844, with a picked project and its Brief link both in sight;
// and that Errors' type header and example bar stick under both bars. A page bar is an element with position sticky or fixed, stuck at its top, at least 60% of the window wide:
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
      for (const y of [400, 1200, 100000]) {
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
  // At 390 with a project picked: the narrow bar shows the project and its Brief link beside the Filters button, both whole and
  // inside the window, on one row.
  const phone = await (await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" })).newPage();
  await phone.goto(`${BASE}/cost?project=atlas-api&range=30`, { waitUntil: "load" });
  await phone.locator(".scopebar .filters-brief").waitFor();
  const n = await phone.evaluate(() => {
    const r = s => { const e = document.querySelector(s); return e && { ...e.getBoundingClientRect().toJSON(), cut: e.scrollWidth > e.clientWidth }; };
    return { button: r(".scopebar-toggle"), chip: r(".scopebar-chip"), name: r(".scopebar-chip > span:last-child"), brief: r(".scopebar .filters-brief") };
  });
  const phoneLine = `390x844 /cost with atlas-api: Filters ${Math.round(n.button.left)}-${Math.round(n.button.right)}px, project ${n.chip ? `${Math.round(n.chip.left)}-${Math.round(n.chip.right)}px${n.name.cut ? " (cut)" : ""}` : "missing"}, Brief ${n.brief ? `${Math.round(n.brief.left)}-${Math.round(n.brief.right)}px` : "missing"}`;
  const row = n.chip && n.brief && [n.chip, n.brief].every(e => Math.abs(e.top + e.height / 2 - (n.button.top + n.button.height / 2)) < 4);
  if (!n.chip || !n.brief || n.name.cut || n.brief.right > 390 - 16 || n.chip.right > n.brief.left || !row) fail(`${phoneLine}: PROJECT OR BRIEF NOT WHOLLY IN SIGHT ON ONE ROW`);
  else console.log(`${phoneLine}: ok`);
  await phone.context().close();

  // Errors at 1440: the open type's header sticks under both bars, and its example bar under the header, at two depths into the
  // detail. A detail too short to scroll under the bars fails: the check would pass without looking.
  const page = await (await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" })).newPage();
  await page.goto(`${BASE}/errors?range=30`, { waitUntil: "load" });
  await page.locator(".pg-errors .types .tbtn").first().click(); // the busiest type
  await page.locator("#detail .exbar").waitFor();
  for (const past of [200, 600]) {
    const e = await page.evaluate(past => {
      const r = s => document.querySelector(s).getBoundingClientRect();
      // `past` px past where the example bar starts to stick, under the bars and the type header.
      scrollTo(0, r("#detail .exbar").top + scrollY - r(".scopebar").bottom - r("#detail .dhead").height + past);
      return { scope: r(".scopebar").bottom, dhead: r("#detail .dhead"), exbar: r("#detail .exbar"), end: r("#detail").bottom };
    }, past);
    const line = `1440x900 /errors, ${past}px into the detail: bars end at ${Math.round(e.scope)}px, type header at ${Math.round(e.dhead.top)}-${Math.round(e.dhead.bottom)}px, example bar at ${Math.round(e.exbar.top)}px, detail ends at ${Math.round(e.end)}px`;
    if (e.end < e.exbar.bottom + 100) fail(`${line}: THE DETAIL IS TOO SHORT TO CHECK`);
    else if (Math.abs(e.dhead.top - e.scope) > 1 || Math.abs(e.exbar.top - e.dhead.bottom) > 1) fail(`${line}: NOT STACKED UNDER THE BARS`);
    else console.log(`${line}: ok`);
  }
  await page.context().close();
} finally {
  await b.close();
}
process.exit(failed ? 1 : 0);
