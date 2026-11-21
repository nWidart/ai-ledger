// Checks Live's layout in a real browser, which the jsdom tests cannot lay out: the stream wider than 798px at 1440 x 900,
// the rail holding 8 sessions without scrolling, the Full text warning moving nothing, and at 390 x 844 no horizontal page
// scroll with the first event on the first screen, the directory shown, and the pulse's readout inside the screen. On the
// Wall it pins two sessions and measures them. It runs locally, not in CI.
// It needs the demo server and the pinned Playwright:
//   cd web && npm ci && npm run build;  cd tools/demo && npm ci && uv run seed.py && uv run serve.py   (DEMO_PORT moves it)
//   node livefit.mjs        prints the figures, and exits 1 naming a check that fails
// The live list and sessions are answered from the web tests' fixtures (8 sessions), so the figures do not depend on a replay.
// CHROMIUM=<path> uses that Chromium instead of Playwright's own.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.DEMO_PORT || 8799);
const BASE = `http://127.0.0.1:${PORT}`;
const FIX = new URL("../../web/src/__fixtures__/", import.meta.url).pathname;
/** A generated fixture's object: the JSON between `export default` and `satisfies`. */
const fixture = name => JSON.parse(readFileSync(FIX + name, "utf8").replace(/^[\s\S]*?export default /, "").replace(/\s*satisfies \w+;\s*$/, ""));
const list = fixture("live.ts"), one = fixture("live-session.ts");
/** The active list, with or without query string; not /api/live/session or /api/live/events. */
const LIST = /\/api\/live(\?|$)/;
const base = list.sessions[0], kinds = ["wait", "you", "tool", "thinking", "thinking", "idle", "idle", "ended"];
list.sessions = kinds.map((kind, i) => ({ ...(list.sessions[i % list.sessions.length] ?? base), session_id: `s${i + 1}`,
  title: i % 3 ? `Session ${i + 1}: a title long enough to be cut in the rail` : null, project: ["atlas-api", "ledger-web", "pixel-studio"][i % 3],
  first_ts: new Date(Date.parse(base.first_ts) + i * 1000).toISOString(),
  state: { ...base.state, kind, tool: kind === "tool" || kind === "wait" ? "Bash" : null, inferred: kind === "wait" || kind === "thinking", long: false } }));

async function open(b, width, height, path) {
  const page = await (await b.newContext({ viewport: { width, height }, reducedMotion: "reduce" })).newPage();
  await page.route(LIST, route => route.fulfill({ json: list }));
  await page.route(/\/api\/live\/session\?/, route => {
    const id = new URL(route.request().url()).searchParams.get("id");
    return route.fulfill({ json: { ...one, session_id: id, project: list.sessions.find(s => s.session_id === id)?.project ?? one.project } });
  });
  await page.goto(BASE + path, { waitUntil: "load" });
  await page.locator(".stream .ev").first().waitFor();
  await page.waitForTimeout(400);
  return page;
}

const measure = page => page.evaluate(() => {
  const r = el => el && el.getBoundingClientRect(), stream = document.querySelector(".pg-live .main .stream, .pg-live .pin .stream");
  const rail = document.querySelector(".pg-live .rail"), ev = document.querySelector(".pg-live .stream .ev");
  const d = document.documentElement;
  return {
    stream: Math.round(r(stream).width), streamTop: Math.round(r(stream).top),
    // What the sessions need: the rail's children (heading, groups, footer) stacked, not scrollHeight, which is never less than
    // the room the rail has, so it would hide how much is to spare.
    railFits: rail ? rail.scrollHeight <= rail.clientHeight + 1 : null, railHeight: rail ? Math.round(r(rail).height) : null,
    railRoom: rail ? rail.clientHeight : null,
    railContent: rail ? Math.round([...rail.children].reduce((a, c) => a + c.getBoundingClientRect().height, 0)) : null,
    firstEvent: { top: Math.round(r(ev).top), bottom: Math.round(r(ev).bottom) },
    hscroll: d.scrollWidth > d.clientWidth, scrollWidth: d.scrollWidth, clientWidth: d.clientWidth,
  };
});

const b = await chromium.launch({ executablePath: process.env.CHROMIUM });
const fails = [];
try {
  const wide = await open(b, 1440, 900, "/live?session=s1");
  const w = await measure(wide);
  const spare = w.railRoom - w.railContent;
  console.log(`1440x900: stream ${w.stream}px wide, top at ${w.streamTop}px; rail ${w.railHeight}px high, 8 sessions in 5 groups take ${w.railContent}px of ${w.railRoom}px (${spare}px to spare): ${w.railFits ? "fit" : "SCROLL"}; first event at ${w.firstEvent.top}px`);
  if (!w.railFits) fails.push("the rail scrolls with 8 sessions at 1440 x 900");
  // A margin for a font that sets a little taller, a longer title or one more line in a footer.
  if (spare < 16) fails.push(`the rail has ${spare}px to spare with 8 sessions at 1440 x 900, under 16px`);
  // The width the stream had beside the agent panel, which this layout must beat (live-dashboard spec: Stream width).
  if (!(w.stream > 798)) fails.push(`the stream is ${w.stream}px wide at 1440 x 900, not wider than 798px`);
  await wide.getByRole("checkbox", { name: "Full text" }).check();
  await wide.waitForTimeout(600);
  const t = await measure(wide);
  console.log(`1440x900, Full text on: stream top at ${t.streamTop}px (moved ${t.streamTop - w.streamTop}px)`);
  if (t.streamTop !== w.streamTop) fails.push("the Full text warning moves the stream");

  const narrow = await open(b, 390, 844, "/live?session=s1");
  const n = await measure(narrow);
  console.log(`390x844: page ${n.scrollWidth}px wide in ${n.clientWidth}px (${n.hscroll ? "HORIZONTAL SCROLL" : "no horizontal scroll"}); first event at ${n.firstEvent.top}-${n.firstEvent.bottom}px of 844`);
  if (n.hscroll) fails.push("horizontal page scroll at 390 x 844");
  if (n.firstEvent.top < 0 || n.firstEvent.bottom > 844) fails.push("the first event is not on the first screen at 390 x 844");
  await narrow.getByRole("checkbox", { name: "Full text" }).check();
  await narrow.waitForTimeout(600);
  const nt = await measure(narrow);
  console.log(`390x844, Full text on: stream top at ${nt.streamTop}px (moved ${nt.streamTop - n.streamTop}px)`);
  if (nt.streamTop !== n.streamTop) fails.push("the Full text warning moves the stream at 390 x 844");
  // The directory stays on a phone, cut to the screen; the pulse's readout, opened by keyboard on its last minute, too.
  const cwd = await narrow.evaluate(() => { const r = document.querySelector(".pg-live .strip .cwd")?.getBoundingClientRect(); return r && { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) }; });
  console.log(`390x844: directory ${cwd ? `${cwd.width}px wide, ${cwd.left}-${cwd.right}px` : "MISSING"}`);
  if (!cwd || cwd.width < 40 || cwd.left < 0 || cwd.right > 390) fails.push("the directory is not shown within the screen at 390 x 844");
  await narrow.locator(".pg-live .strip .pulse .chart").focus();
  await narrow.keyboard.press("End");
  await narrow.waitForTimeout(200);
  const ro = await measure(narrow), box = await narrow.evaluate(() => { const r = document.querySelector(".pg-live .pulse .readout").getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), text: document.querySelector(".pg-live .pulse .readout").textContent }; });
  console.log(`390x844, pulse readout open: page ${ro.scrollWidth}px wide in ${ro.clientWidth}px (${ro.hscroll ? "HORIZONTAL SCROLL" : "no horizontal scroll"}); readout ${box.left}-${box.right}px, "${box.text}"`);
  if (!box.text) fails.push("End on the pulse opens no readout at 390 x 844");
  if (ro.hscroll || box.left < 0 || box.right > ro.clientWidth) fails.push("the pulse readout passes the screen's edge at 390 x 844");

  const wall = await (await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" })).newPage();
  await wall.route(LIST, route => route.fulfill({ json: list }));
  await wall.route(/\/api\/live\/session\?/, route => route.fulfill({ json: { ...one, session_id: new URL(route.request().url()).searchParams.get("id") } }));
  await wall.goto(BASE + "/live?view=wall&pin=s1,s2", { waitUntil: "load" });
  await wall.waitForTimeout(800);
  const pins = await wall.evaluate(() => [...document.querySelectorAll(".pg-live .pin .stream")].map(s => Math.round(s.getBoundingClientRect().width)));
  const hs = await wall.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(`1440x900 wall, 2 pins: pinned streams ${pins.length ? pins.join("px, ") + "px" : "none"} wide; ${hs ? "HORIZONTAL SCROLL" : "no horizontal scroll"}`);
} finally {
  await b.close();
}
if (fails.length) { console.error("FAILED: " + fails.join("; ")); process.exit(1); }
