// Checks Live's layout in a real browser, which the jsdom tests cannot lay out. At 1440 x 900, 1280 x 800 and 390 x 844:
// no rail entry's state tag is cut, the rail entries share one height and so do the Wall tiles, hovering each `?` in the
// strip moves none of its figures, wheeling the event list back to its foot turns Follow on again, and the Full text
// warning moves nothing and is gone after 7 s. On desktop the 10 min pulse is at least 200px wide; at 1440 x 900 the
// stream is wider than 798px and the rail holds the sessions without scrolling; at 390 x 844 the page has no horizontal
// scroll, the first event is on the first screen and the pulse's readout stays inside it. On the Wall it pins two
// sessions and measures them. It runs locally, not in CI.
// It needs the demo server and the pinned Playwright:
//   cd web && npm ci && npm run build;  cd tools/demo && npm ci && uv run seed.py && uv run serve.py   (DEMO_PORT moves it)
//   node livefit.mjs        prints the figures, and exits 1 naming a check that fails
// The live list and sessions are answered from the web tests' fixtures (12 sessions with real shapes: long titles, a long
// MCP tool, a 30-character branch), so the figures do not depend on a replay. Each session gets its own detail: its list
// entry over the Claude Code or Codex fixture, with that fixture's events repeated enough times for the stream to scroll.
// CHROMIUM=<path> uses that Chromium instead of Playwright's own.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.DEMO_PORT || 8799);
const BASE = `http://127.0.0.1:${PORT}`;
const FIX = new URL("../../web/src/__fixtures__/", import.meta.url).pathname;
/** A generated fixture's object: the JSON between `export default` and `satisfies`. */
const fixture = name => JSON.parse(readFileSync(FIX + name, "utf8").replace(/^[\s\S]*?export default /, "").replace(/\s*satisfies \w+;\s*$/, ""));
const list = fixture("live.ts"), claude = fixture("live-session.ts"), codex = fixture("live-session-codex.ts");
/** The active list, with or without query string; not /api/live/session or /api/live/events. */
const LIST = /\/api\/live(\?|$)/;
const shift = (ts, sec) => ts && new Date(Date.parse(ts) - sec * 1000).toISOString();
/** Session i's detail: its list entry over its source's fixture, the fixture's events copied 4 + i times, each copy a
 *  minute before the last, so no two sessions show the same stream. */
const details = new Map(list.sessions.map((entry, i) => {
  const base = entry.source === "codex" ? codex : claude;
  const events = Array.from({ length: 4 + i }, (_, j) => base.events.map(e => j === 0 ? e : {
    ...e, key: `${e.key}~${j}`, ...(e.id ? { id: `${e.id}~${j}` } : {}), ts: shift(e.ts, j * 60),
    ...(e.start ? { start: shift(e.start, j * 60) } : {}), ...(e.end ? { end: shift(e.end, j * 60) } : {}),
  })).reverse().flat();
  return [entry.session_id, { ...base, ...entry, events }];
}));
const answer = route => {
  const id = new URL(route.request().url()).searchParams.get("id");
  return route.fulfill({ json: details.get(id) ?? { ...claude, session_id: id } });
};

async function open(b, width, height, path, wait = ".stream .ev") {
  const page = await (await b.newContext({ viewport: { width, height }, reducedMotion: "reduce" })).newPage();
  await page.route(LIST, route => route.fulfill({ json: list }));
  await page.route(/\/api\/live\/session\?/, answer);
  await page.goto(BASE + path, { waitUntil: "load" });
  await page.locator(wait).first().waitFor();
  await page.waitForTimeout(400);
  return page;
}

const measure = page => page.evaluate(() => {
  const r = el => el && el.getBoundingClientRect(), stream = document.querySelector(".pg-live .main .stream, .pg-live .pin .stream");
  // The first event the stream's box shows: Follow scrolls the box to its newest rows.
  const rail = document.querySelector(".pg-live .rail"), ev = [...document.querySelectorAll(".pg-live .stream .ev")].find(e => r(e).bottom > r(stream).top);
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
/** The distinct rounded heights of the elements sel matches. */
const heights = (page, sel) => page.evaluate(s => [...new Set([...document.querySelectorAll(s)].map(e => Math.round(e.getBoundingClientRect().height)))], sel);
const rects = page => page.evaluate(() => [...document.querySelectorAll(".pg-live .strip b")].map(e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width].map(Math.round).join(","); }));
const follow = page => page.getByRole("checkbox", { name: "Follow" }).isChecked();

const b = await chromium.launch({ executablePath: process.env.CHROMIUM });
const fails = [], n = list.sessions.length;
try {
  for (const [width, height] of [[1440, 900], [1280, 800], [390, 844]]) {
    const at = `${width}x${height}`, phone = width < 721;
    const page = await open(b, width, height, "/live?session=s1");
    const m = await measure(page);
    console.log(`${at}: stream ${m.stream}px wide, top at ${m.streamTop}px; first event at ${m.firstEvent.top}-${m.firstEvent.bottom}px; page ${m.scrollWidth}px wide in ${m.clientWidth}px`);
    if (width === 1440) {
      const spare = m.railRoom - m.railContent;
      console.log(`${at}: rail ${m.railHeight}px high, ${n} sessions take ${m.railContent}px of ${m.railRoom}px (${spare}px to spare): ${m.railFits ? "fit" : "SCROLL"}`);
      // The spec asks for 8 sessions without scrolling; the list holds more, so the entries past the 8th may overflow.
      const entry = await page.evaluate(() => document.querySelector(".pg-live .rail button[data-session]")?.getBoundingClientRect().height ?? 0);
      if (-spare > Math.max(0, n - 8) * entry) fails.push(`the rail cannot hold 8 sessions without scrolling at ${at}`);
      // The width the stream had beside the agent panel, which this layout must beat (live-dashboard spec: Stream width).
      if (!(m.stream > 798)) fails.push(`the stream is ${m.stream}px wide at ${at}, not wider than 798px`);
    }
    if (phone) {
      if (m.hscroll) fails.push(`horizontal page scroll at ${at}`);
      if (m.firstEvent.top < 0 || m.firstEvent.bottom > height) fails.push(`the first event is not on the first screen at ${at}`);
    }

    // The rail: every state tag whole, every entry one height.
    const cut = await page.evaluate(() => [...document.querySelectorAll(".pg-live .rail .state")].filter(s => s.scrollWidth > s.clientWidth).map(s => s.textContent));
    const rail = await heights(page, ".pg-live .rail button[data-session]");
    console.log(`${at}: rail entries ${rail.join("px, ")}px high; ${cut.length ? `CUT state tags: ${cut.join(" | ")}` : "no state tag cut"}`);
    if (cut.length) fails.push(`${cut.length} rail state tags cut at ${at}`);
    if (rail.length !== 1) fails.push(`rail entries of ${rail.length} heights at ${at}`);

    // The strip: hovering a `?` opens its tip over the page, moving no figure; the pulse fills its column on desktop.
    const before = await rects(page), qs = page.locator(".pg-live .strip .tt");
    const moved = [];
    for (let i = 0; i < await qs.count(); i++) {
      await qs.nth(i).hover();
      await page.waitForTimeout(350);
      if ((await rects(page)).join(";") !== before.join(";")) moved.push(await qs.nth(i).getAttribute("aria-label") ?? `? ${i + 1}`);
      await page.mouse.move(0, 0);
      await page.waitForTimeout(250);
    }
    const pulse = await page.evaluate(() => Math.round(document.querySelector(".pg-live .strip .pulse")?.getBoundingClientRect().width ?? 0));
    console.log(`${at}: ${await qs.count()} strip ? hovered, ${moved.length ? `MOVED figures: ${moved.join(", ")}` : "nothing moved"}; pulse ${pulse}px wide`);
    if (moved.length) fails.push(`hovering ${moved.join(", ")} moves the strip at ${at}`);
    if (!phone && pulse < 200) fails.push(`the pulse is ${pulse}px wide at ${at}, under 200px`);

    // Follow: a wheel up turns it off; wheeling back to the foot turns it on.
    const box = page.locator(".pg-live .main .stream");
    const room = await box.evaluate(el => el.scrollHeight - el.clientHeight);
    if (room < 50) fails.push(`the event list does not scroll at ${at} (${room}px), so Follow cannot be checked`);
    else {
      const on = await follow(page);
      await box.hover();
      await page.mouse.wheel(0, -400);
      await page.waitForTimeout(300);
      const off = await follow(page);
      for (let i = 0; i < 20 && !(await follow(page)); i++) {
        await page.mouse.wheel(0, 600);
        await page.waitForTimeout(150);
      }
      const back = await follow(page);
      console.log(`${at}: Follow ${on ? "on" : "OFF"}, after a wheel up ${off ? "STILL ON" : "off"}, at the foot ${back ? "on" : "STILL OFF"}`);
      if (!on || off || !back) fails.push(`wheeling the event list to its foot does not turn Follow back on at ${at}`);
    }
    await page.mouse.move(0, 0);

    // Full text: its warning takes no room, and goes by itself.
    await page.getByRole("checkbox", { name: "Full text" }).check();
    await page.waitForTimeout(600);
    const t = await measure(page), shown = await page.locator(".pg-live .ft-warn").count();
    await page.waitForTimeout(7000);
    const left = await page.locator(".pg-live .ft-warn").count();
    console.log(`${at}, Full text on: warning ${shown ? "shown" : "NOT SHOWN"}, stream moved ${t.streamTop - m.streamTop}px; after 7 s ${left ? "STILL SHOWN" : "gone"}`);
    if (t.streamTop !== m.streamTop) fails.push(`the Full text warning moves the stream at ${at}`);
    if (!shown || left) fails.push(`the Full text warning is not gone 7 s after it shows at ${at}`);

    if (phone) {  // the pulse's readout, opened by keyboard on its last minute, stays on the screen
      await page.locator(".pg-live .strip .pulse .chart").focus();
      await page.keyboard.press("End");
      await page.waitForTimeout(200);
      const ro = await measure(page), r = await page.evaluate(() => { const el = document.querySelector(".pg-live .pulse .readout"), r = el.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), text: el.textContent }; });
      console.log(`${at}, pulse readout open: page ${ro.scrollWidth}px wide in ${ro.clientWidth}px; readout ${r.left}-${r.right}px, "${r.text}"`);
      if (!r.text) fails.push(`End on the pulse opens no readout at ${at}`);
      if (ro.hscroll || r.left < 0 || r.right > ro.clientWidth) fails.push(`the pulse readout passes the screen's edge at ${at}`);
    }

    // The Wall: every tile one height.
    const wall = await open(b, width, height, "/live?view=wall", ".pg-live .tile");
    const tiles = await heights(wall, ".pg-live .tile");
    console.log(`${at} wall: ${n} tiles ${tiles.join("px, ")}px high`);
    if (tiles.length !== 1) fails.push(`wall tiles of ${tiles.length} heights at ${at}`);
  }

  const wall = await open(b, 1440, 900, "/live?view=wall&pin=s1,s2", ".pg-live .pin .stream .ev");
  const pins = await wall.evaluate(() => [...document.querySelectorAll(".pg-live .pin .stream")].map(s => Math.round(s.getBoundingClientRect().width)));
  const hs = await wall.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(`1440x900 wall, 2 pins: pinned streams ${pins.length ? pins.join("px, ") + "px" : "none"} wide; ${hs ? "HORIZONTAL SCROLL" : "no horizontal scroll"}`);
} finally {
  await b.close();
}
if (fails.length) { console.error("FAILED: " + fails.join("; ")); process.exit(1); }
