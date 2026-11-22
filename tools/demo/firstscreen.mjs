// Checks in a real browser that Context's tabs and first plotted mark are on the first screen at 1440 x 900, with every tip rule
// firing, before and after "Show N more" expands the strip; that Activity's work chart (its whole box, waited for until its
// first bar is drawn) and workbench tab list are, over 30 days (bars by day, with the zoom slider under them) and all time
// (bars by week); and that the first chart of Cost, Errors, Limits, the Judgments view and Live starts
// there, with its first plotted mark wholly on it: for Cost and Errors, ECharts' charts, the first bar drawn. The jsdom tests cannot lay a page out; this can. It runs locally, not in
// CI. It needs the demo server and the pinned Playwright:
//   cd web && npm ci && npm run build;  cd tools/demo && npm ci && uv run seed.py && uv run serve.py   (DEMO_PORT moves it)
//   node firstscreen.mjs        exits 1, naming what falls outside the window
// The demo store fires five rules; the context payload is answered with the sixth added, so the strip holds the most tips the rules give.
// CHROMIUM=<path> uses that Chromium instead of Playwright's own.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.DEMO_PORT || 8799);
const BASE = `http://127.0.0.1:${PORT}`;
const H = 900;
const RULES = ["large_start", "frequent_compactions", "near_limit", "large_results", "cache_breaks", "long_tier"];
const TITLES = {
  large_start: "Sessions start with a large context", frequent_compactions: "Sessions compact repeatedly", near_limit: "Sessions reach the limit of the window",
  large_results: "Tool results fill the context", cache_breaks: "The prompt cache breaks within sessions", long_tier: "Requests are priced on the long-prompt tier",
};

/** The other pages: the first chart of each, which must start on the first screen, and its first plotted mark (the first bar, the
 *  measured line), which must be wholly on it. Live's is its stream's first event, from the web tests' fixtures, so it does not
 *  depend on a replay; it has no plot.
 *  Cost's chart is ECharts' SVG, which names no element. Its bar segments are the filled paths directly under the svg's group:
 *  the grid lines there are unfilled, the hatch is filled with a url() pattern, the average lines sit in clipped groups of their
 *  own and the pattern's paths in <defs>. The bars come first in document order, before any nested group: the zoom slider,
 *  drawn after the average lines' groups, has filled paths of its own there, which `:not(g ~ path)` leaves out. */
const COST_BAR = '#spend .echart-plot svg > g > path:not([fill="none"]):not([fill^="url("]):not(g ~ path)';
/** Activity's work chart is ECharts' SVG too, with the same rule for its bars, two tracks and two marks more. The selected
 *  bucket's frame is a translucent path drawn before the bars, and the reading band one after them: `:not([fill-opacity])`
 *  leaves both out. The rate line sits in a clipped group of its own; its dots, drawn after it, are scaled symbols, which
 *  `:not([transform])` leaves out as well as `:not(g ~ path)` does. The slider comes after the rate line's group. */
const WORK_BAR = '#work .echart-plot svg > g > path:not([fill="none"]):not([fill^="url("]):not([fill-opacity]):not([transform]):not(g ~ path)';
/** Errors' rate chart is ECharts' SVG with the same rule for its bars, the rate track above them. The no-activity bands are
 *  translucent paths drawn before the bars, the selected bucket's frame one among them, the reading band one after them,
 *  and a segment dimmed by a selected type is translucent too: `:not([fill-opacity])` leaves them all out. The rate line's
 *  dots are drawn after the bars, outside any group, as one large arc each (" 0 1 1 "), which no bar segment has: its
 *  round corners are small arcs. The slider's hidden totals line is the first series but is drawn after the bars, in a
 *  group, with the bridge, the rate line and the slider: `:not(g ~ path)` leaves out what follows them. */
const ERRORS_BAR = '.chart-card .echart-plot svg > g > path:not([fill="none"]):not([fill^="url("]):not([fill-opacity]):not([d*=" 0 1 1 "]):not(g ~ path)';
const FIRST = [
  ["Cost's daily cost chart", "/cost?range=30", "#spend .echart", COST_BAR],
  ["Errors' rate chart", "/errors?range=30", ".chart-card", ERRORS_BAR],
  ["Limits' first open window chart", "/limits?range=30", ".lim-grid .lim-chart", ".lim-grid .lim-chart :is(.meas, .meas-one)"],
  ["the Judgments view's Outcomes ledger", "/usage?view=judgments&range=30", "#outcomes", "#outcomes .mixbar i"],
  ["Live's first stream event", "/live?session=s1", ".pg-live .stream .ev", null],
];
const FIX = new URL("../../web/src/__fixtures__/", import.meta.url).pathname;
/** A generated fixture's object: the JSON between `export default` and `satisfies`. */
const fixture = name => JSON.parse(readFileSync(FIX + name, "utf8").replace(/^[\s\S]*?export default /, "").replace(/\s*satisfies \w+;\s*$/, ""));
const live = fixture("live.ts"), liveSession = fixture("live-session.ts"), limits = fixture("limits.ts");

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
    await page.route(/\/api\/live(\?|$)/, route => route.fulfill({ json: { ...live, sessions: live.sessions.map((s, i) => (i ? s : { ...s, session_id: "s1" })) } }));
    // The synthetic store's seeded open windows age out, so Limits is answered from the fixture, as Live is.
    await page.route(/\/api\/limits(\?|$)/, route => route.fulfill({ json: limits }));
    await page.route(/\/api\/live\/session\?/, route => route.fulfill({ json: { ...liveSession, session_id: "s1" } }));
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
      await page.waitForSelector(WORK_BAR);
      const got = await page.evaluate(() => {
        const box = sel => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r ? { top: r.top, bottom: r.bottom } : null; };
        return { tabs: box("#workbench [role=tablist]"), mark: box("#work .echart") };
      });
      const v = verdict(got, `${scheme}, Activity over ${range === "0" ? "all time" : `${range} days`}`);
      console.log(v.line.replace("first plotted mark", "work chart"));
      failed ||= !v.ok;
    }
    // Every other page's first chart starts on the first screen, under the nav and the scope bar.
    for (const [what, path, sel, markSel] of FIRST) {
      await page.goto(BASE + path);
      await page.waitForSelector(sel);
      if (markSel) await page.waitForSelector(markSel, { state: "attached" });
      const { top, mark } = await page.evaluate(([sel, markSel]) => {
        const r = markSel && document.querySelector(markSel)?.getBoundingClientRect();
        return { top: document.querySelector(sel).getBoundingClientRect().top, mark: r ? { top: r.top, bottom: r.bottom } : null };
      }, [sel, markSel]);
      const ok = top >= 0 && top < H && (!markSel || (mark != null && mark.top >= 0 && mark.bottom <= H));
      const marked = markSel ? `, first plotted mark at ${mark ? `${Math.round(mark.top)}-${Math.round(mark.bottom)}px` : "missing"}` : "";
      console.log(`${scheme}, ${what}: starts at ${Math.round(top)}px${marked} of ${H}: ${ok ? "ok" : "OUTSIDE THE WINDOW"}`);
      failed ||= !ok;
    }
    await page.context().close();
  }
} finally {
  await b.close();
}
process.exit(failed ? 1 : 0);
