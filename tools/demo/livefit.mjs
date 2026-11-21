// Checks Live's layout in a real browser, which the jsdom tests cannot lay out: the stream's width at 1440 x 900, the rail
// holding 8 sessions without scrolling, the Full text warning moving nothing, and at 390 x 844 no horizontal page scroll with
// the first event on the first screen. On the Wall it pins two sessions and measures them. It runs locally, not in CI.
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
    railFits: rail ? rail.scrollHeight <= rail.clientHeight + 1 : null, railHeight: rail ? Math.round(r(rail).height) : null,
    railContent: rail ? rail.scrollHeight : null,
    firstEvent: { top: Math.round(r(ev).top), bottom: Math.round(r(ev).bottom) },
    hscroll: d.scrollWidth > d.clientWidth, scrollWidth: d.scrollWidth, clientWidth: d.clientWidth,
  };
});

const b = await chromium.launch({ executablePath: process.env.CHROMIUM });
const fails = [];
try {
  const wide = await open(b, 1440, 900, "/live?session=s1");
  const w = await measure(wide);
  console.log(`1440x900: stream ${w.stream}px wide, top at ${w.streamTop}px; rail ${w.railHeight}px high, 8 sessions in 5 groups take ${w.railContent}px: ${w.railFits ? "fit" : "SCROLL"}; first event at ${w.firstEvent.top}px`);
  if (!w.railFits) fails.push("the rail scrolls with 8 sessions at 1440 x 900");
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
