// Checks Cost's daily chart, drawn by ECharts, in a real browser: what the jsdom tests, mostly on a fake runtime, cannot see.
// It seeds its own demo store in a temporary directory (seed.py and serve.py copied there, so the store in this folder and
// any demo server already running are left alone), serves it on a free port of 127.0.0.1, opens /cost?range=30 in Chromium
// and stops the server when it ends, also on a failure. Each check prints a line; it exits 1 naming what fails:
// - a bar is drawn in the computed --proj-N color of its legend key, in light and after the theme toggle sets dark; with the
//   theme on System, an emulated OS dark flip changes the drawn colors with no reload; in light and dark the zoom slider's
//   two handles stand out from the panel, 3:1 at least;
// - under emulated forced colors the axis text is the resolved CanvasText, the band is the Highlight and the bars keep an edge;
// - at a 32px root font size no axis label leaves the box or overlaps another;
// - in the tokens Share view a kind under 1% of a day is drawn at least 1px tall;
// - a pointer move over day 10, and ten presses of Right, put the band over the day the tooltip and the readout name, the
//   tooltip beside it and left of it on the last day; after a zoom the band is over that day's place in the days shown;
// - a click and Enter open the sessions drawer for that day, and on a day with nothing in it neither does, and the reading stays;
// - the pointer is a hand over a day and not over the day labels;
// - plus and minus zoom, Ctrl+plus is left to the browser; dragging a slider handle changes the days drawn, not the heading,
//   the lede, the URL or the requests made; the live region says the days shown once, on release; "Show all days" resets
//   and returns focus to the chart;
// - the hint under the heading is one line at 1440px in every stacking and scale; a 7-day view has no slider, and back at
//   30 days the slider returns with every day shown;
// - the page logs no CSP violation, no console error and no page error.
// It runs locally, not in CI. It needs the build and the pinned Playwright:
//   uv sync;  cd web && npm ci && npm run build;  cd tools/demo && npm ci
//   node chartfit.mjs        SHOTS=<dir> also saves screenshots of the chart there; CHROMIUM=<path> uses that Chromium
import { chromium } from "playwright";
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const HERE = new URL(".", import.meta.url).pathname, ROOT = join(HERE, "../..");
const W = 1440, H = 900, LOCALE = "en-US";
const SHOTS = process.env.SHOTS;

/** A port nothing listens on, from the system. */
const freePort = () => new Promise((resolve, reject) => {
  const s = createServer().once("error", reject);
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

let failed = false;
const line = (what, ok, detail = "") => {
  console.log(`${what}: ${ok ? "ok" : "FAILS"}${detail ? ` (${detail})` : ""}`);
  failed ||= !ok;
  return ok;
};
/** Polls f until its value passes ok, for up to 4s, and gives its last value: what failed, when nothing passed. */
async function until(f, ok = Boolean) {
  for (const end = Date.now() + 4000; ; await sleep(50)) {
    const v = await f();
    if (ok(v) || Date.now() > end) return v;
  }
}

/** Installed in every page before its scripts: CSP violations, and the readers of the chart's drawing. ECharts' SVG names
 *  no element. The bar segments are the svg group's direct paths with a solid fill and no fill-opacity, down to the bottom
 *  grid line: the grid lines are unfilled, the hatch fills with a url() pattern, the band and the slider's filler are
 *  translucent, the average lines sit in groups and the slider's handles below the grid. */
function helpers() {
  window.__csp = [];
  addEventListener("securitypolicyviolation", e => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  const tri = c => (String(c).match(/[\d.]+/g) || []).slice(0, 3).map(n => Math.round(Number(n))).join(",");
  const rect = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const top = () => [...(document.querySelector("#spend .echart-plot svg")?.querySelector(":scope > g")?.children ?? [])];
  const fill = e => e.getAttribute("fill") ?? "none";
  const solid = e => e.tagName === "path" && fill(e) !== "none" && !fill(e).startsWith("url(");
  const grid = () => {
    const lines = top().filter(e => e.tagName === "path" && fill(e) === "none" && rect(e).h < 1 && rect(e).w > 0).map(rect);
    if (!lines.length) return null;
    return { l: Math.min(...lines.map(r => r.l)), r: Math.max(...lines.map(r => r.r)), t: Math.min(...lines.map(r => r.t)), b: Math.max(...lines.map(r => r.b)) };
  };
  const bars = () => {
    const g = grid();
    return g ? top().filter(e => solid(e) && !e.hasAttribute("fill-opacity") && rect(e).b <= g.b + 1 && rect(e).w > 0)
      .map(e => ({ fill: tri(fill(e)), stroke: e.getAttribute("stroke"), ...rect(e) })) : [];
  };
  window.chartfit = {
    tri, grid, bars,
    /** A CSS color as the browser computes it, kept from forced colors as the chart's probe is. */
    probe: css => {
      const s = document.createElement("span");
      s.style.cssText = `position:absolute;forced-color-adjust:none;color:${css}`;
      document.body.append(s);
      const c = getComputedStyle(s).color;
      s.remove();
      return tri(c);
    },
    keys: () => [...document.querySelectorAll("#spend .legend i:not(.line):not(.hatch)")]
      .map(i => ({ name: i.parentElement.textContent.trim(), css: i.style.background, color: tri(getComputedStyle(i).backgroundColor) })),
    /** The left edge of each day drawn, in order. */
    days: () => [...new Set(bars().map(b => Math.round(b.l)))].sort((a, b) => a - b),
    /** The cursor band: a translucent path as tall as the grid. */
    band: () => {
      const g = grid(), e = g && top().find(e => solid(e) && e.hasAttribute("fill-opacity") && rect(e).h >= (g.b - g.t) * .8 && rect(e).w < (g.r - g.l) / 2);
      return e ? { fill: tri(fill(e)), opacity: Number(e.getAttribute("fill-opacity")), ...rect(e) } : null;
    },
    /** The zoom slider's two handles, under the grid: solid paths narrower than 12px, left first. */
    handles: () => {
      const g = grid();
      return g ? top().filter(e => solid(e) && !e.hasAttribute("fill-opacity") && rect(e).t > g.b + 1 && rect(e).w < 12).map(e => ({ fill: tri(fill(e)), ...rect(e) })).sort((a, c) => a.l - c.l) : [];
    },
    /** The WCAG contrast ratio of two "r,g,b" colors. */
    contrast: (a, c) => {
      const lum = t => t.split(",").map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
      const [x, y] = [lum(a), lum(c)].sort((p, q) => q - p);
      return (x + .05) / (y + .05);
    },
    texts: () => top().filter(e => e.tagName === "text").map(e => ({ text: e.textContent, fill: tri(fill(e)), size: parseFloat(getComputedStyle(e).fontSize), ...rect(e) })),
    tip: () => {
      const t = document.querySelector("#spend .echart .tip");
      return t && getComputedStyle(t).display !== "none" ? { day: t.querySelector(".muted")?.textContent ?? "", ...rect(t) } : null;
    },
    readout: () => document.querySelector("#spend .echart + .sr")?.textContent ?? "",
    box: () => rect(document.querySelector("#spend .echart")),
    /** The live region's texts from now on. */
    listen: () => {
      window.__said = [];
      new MutationObserver(() => window.__said.push(document.querySelector("#spend .echart + .sr").textContent))
        .observe(document.querySelector("#spend .echart + .sr"), { childList: true, characterData: true, subtree: true });
    },
    /** How many lines an element's text wraps to. */
    lines: el => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return new Set([...r.getClientRects()].filter(c => c.width > 0).map(c => Math.round(c.top))).size;
    },
  };
}

// The demo store, seeded afresh outside the repo: its days end today, so the 30-day view is full.
const dir = mkdtempSync(join(tmpdir(), "ai-ledger-chartfit-"));
for (const f of ["seed.py", "serve.py"]) copyFileSync(join(HERE, f), join(dir, f));
const port = await freePort(), BASE = `http://127.0.0.1:${port}`;
let server, b;
const stop = () => { if (server) try { process.kill(-server.pid); } catch { /* gone */ } };
process.once("SIGINT", () => { stop(); rmSync(dir, { recursive: true, force: true }); process.exit(130); });
/** What the pages reported: CSP violations, console errors and page errors. */
const reported = [];
try {
  execFileSync("uv", ["run", "--project", ROOT, "python", "seed.py"], { cwd: dir, stdio: ["ignore", "ignore", "inherit"] });
  server = spawn("uv", ["run", "--project", ROOT, "python", "serve.py"], { cwd: dir, env: { ...process.env, DEMO_PORT: String(port) }, stdio: ["ignore", "pipe", "ignore"], detached: true });
  let ready = false, exited = false;
  server.stdout.on("data", d => { if (String(d).includes(`serving ${BASE}/`)) ready = true; });
  server.once("exit", () => { exited = true; });
  for (let i = 0; !ready; i++) {
    if (exited) throw new Error("serve.py exited before serving");
    if (i > 240) throw new Error("serve.py did not start");
    await sleep(250);
  }
  b = await chromium.launch({ executablePath: process.env.CHROMIUM });

  // The view's days, from the server, and the words the page uses for them.
  const usage = await (await fetch(`${BASE}/api/usage?range=30`)).json();
  const DAYS = [];
  for (let t = Date.parse(usage.start + "T00:00:00Z"); t <= Date.parse(usage.end + "T00:00:00Z"); t += 864e5) DAYS.push(new Date(t).toISOString().slice(0, 10));
  const label = (day, long = false) => new Date(day + "T00:00:00Z").toLocaleDateString(LOCALE, { month: "short", day: "numeric", timeZone: "UTC", ...(long ? { year: "numeric" } : {}) });
  const N = DAYS.length, I = 9; // day 10
  /** The day a text names, by its long label at the start: an index of DAYS, or -1. */
  const named = text => DAYS.findIndex(d => text.startsWith(label(d, true)));

  /** A page on /cost?range=30 with the chart drawn, logging what the page reports. */
  async function open(name, options = {}, init = null) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, locale: LOCALE, colorScheme: "light", reducedMotion: "reduce", ...options });
    const page = await ctx.newPage();
    page.errors = [];
    page.on("console", m => { if (m.type() === "error") page.errors.push(`console: ${m.text()} ${m.location().url}`); });
    page.on("pageerror", e => page.errors.push(`page error: ${e.message}`));
    await page.addInitScript(helpers);
    if (init) await page.addInitScript(init);
    page.done = async () => {
      for (const v of await page.evaluate(() => window.__csp)) reported.push(`${name}: CSP ${v}`);
      for (const e of page.errors) reported.push(`${name}: ${e}`);
      await ctx.close();
    };
    await page.goto(`${BASE}/cost?range=30`);
    await page.waitForFunction(n => window.chartfit.days().length === n, N);
    return page;
  }
  const ev = (page, f, arg) => page.evaluate(f, arg);
  const shot = async (page, name) => {
    if (!SHOTS) return;
    mkdirSync(SHOTS, { recursive: true });
    await page.locator("#spend").screenshot({ path: join(SHOTS, `cost-chart-${name}.png`) });
  };
  /** Where the chart draws day i when it shows days from..to: the middle of its band. */
  const centre = (g, i, from = 0, to = N - 1) => g.l + (i - from + .5) * (g.r - g.l) / (to - from + 1);
  /** The days shown, from the live region's zoom sentence ("Showing Oct 11 to Oct 20, 10 of 30 days."). */
  const shownBy = text => {
    const m = /^Showing (.+?) to (.+?), \d+ of \d+ days\.$/.exec(text);
    return m ? { from: DAYS.findIndex(d => label(d) === m[1]), to: DAYS.findIndex(d => label(d) === m[2]) } : null;
  };
  /** Whether every legend key's color is drawn, and the keys' colors. */
  const drawnKeys = page => ev(page, () => {
    const fills = new Set(window.chartfit.bars().map(b => b.fill));
    const keys = window.chartfit.keys();
    return { keys, ok: keys.length > 0 && keys.every(k => fills.has(k.color) && k.color === window.chartfit.probe(k.css)), fills: [...fills] };
  });
  const keyLine = k => k.keys.map(x => `${x.name} ${x.css} rgb(${x.color})`).join(", ");
  const theme = async (page, want) => {
    for (let i = 0; i < 3 && (await page.locator("#navTheme").getAttribute("aria-label")) !== `Theme: ${want}`; i++) await page.locator("#navTheme").click();
  };
  const away = page => page.mouse.move(2, H - 2);
  /** The slider's two handles stand out from the panel behind them: 3:1 at least, as a control's boundary must. */
  const handleLine = async (page, scheme) => {
    const h = await ev(page, () => {
      const panel = window.chartfit.tri(getComputedStyle(document.querySelector("#spend")).backgroundColor);
      return { panel, handles: window.chartfit.handles().map(x => ({ fill: x.fill, ratio: window.chartfit.contrast(x.fill, panel) })) };
    });
    line(`${scheme}: the slider's two handles stand out from the panel, 3:1 at least`, h.handles.length === 2 && h.handles.every(x => x.ratio >= 3),
      `${h.handles.map(x => `rgb(${x.fill}) ${x.ratio.toFixed(2)}:1`).join(", ") || "no handles"} on rgb(${h.panel})`);
  };

  // Colors: light, the toggle's dark, then System with the OS scheme flipped.
  {
    const page = await open("colors");
    await ev(page, () => { window.__kept = true; });
    await theme(page, "light");
    const light = await until(() => drawnKeys(page), k => k.ok);
    line("light: each legend key's color is drawn", light.ok, keyLine(light));
    await handleLine(page, "light");
    await shot(page, "light");
    // The first key's color tells the schemes apart: every --proj-N token differs between them.
    const like = want => k => k.ok && k.keys[0].color === want.keys[0].color;
    await theme(page, "dark");
    const dark = await until(() => drawnKeys(page), k => k.ok && k.keys[0].color !== light.keys[0].color);
    const dataTheme = await ev(page, () => document.documentElement.dataset.theme);
    line(`dark (data-theme="${dataTheme}"): each legend key's color is drawn, and differs from light`, dataTheme === "dark" && dark.ok && dark.keys[0].color !== light.keys[0].color, keyLine(dark));
    await handleLine(page, "dark");
    await shot(page, "dark");
    await theme(page, "system");
    const sysLight = await until(() => drawnKeys(page), like(light));
    await page.emulateMedia({ colorScheme: "dark" });
    const flipped = await until(() => drawnKeys(page), like(dark));
    await page.emulateMedia({ colorScheme: "light" });
    const back = await until(() => drawnKeys(page), like(light));
    const kept = await ev(page, () => window.__kept === true);
    line("System: an OS dark flip and back redraws in each scheme's colors, with no reload", like(light)(sysLight) && like(dark)(flipped) && like(light)(back) && kept,
    `light ${keyLine(sysLight)}; OS dark ${keyLine(flipped)}; ${kept ? "no reload" : "RELOADED"}`);
    await page.done();
  }

  // Forced colors: system colors for the text, the band and the bars' edges.
  {
    const page = await open("forced colors", { forcedColors: "active" });
    const g = await ev(page, () => window.chartfit.grid());
    await page.mouse.move(centre(g, I), (g.t + g.b) / 2);
    const got = await until(() => ev(page, () => ({ band: window.chartfit.band(), texts: window.chartfit.texts(), bars: window.chartfit.bars(),
      canvasText: window.chartfit.probe("CanvasText"), highlight: window.chartfit.probe("Highlight") })), r => r.band);
    const off = got.texts.filter(t => t.fill !== got.canvasText);
    line("forced colors: the axis text is CanvasText", got.texts.length > 0 && !off.length, `CanvasText rgb(${got.canvasText}); ${off.length ? off.map(t => `"${t.text}" rgb(${t.fill})`).join(", ") : `${got.texts.length} texts`}`);
    line("forced colors: the day read is a band in Highlight", got.band?.fill === got.highlight,
      got.band ? `band rgb(${got.band.fill}) at ${got.band.opacity}, Highlight rgb(${got.highlight})` : "no band");
    const edged = got.bars.filter(x => x.stroke && x.stroke !== "none");
    line("forced colors: every bar segment has an edge", got.bars.length > 0 && edged.length === got.bars.length,
      `${edged.length} of ${got.bars.length} stroked${edged[0] ? `, ${edged[0].stroke}` : ""}${edged.length < got.bars.length ? `; not: ${got.bars.filter(x => !edged.includes(x)).map(x => `rgb(${x.fill}) at ${Math.round(x.l)},${Math.round(x.t)} ${Math.round(x.w)}x${Math.round(x.h)}`).join(", ")}` : ""}`);
    await shot(page, "forced-colors");
    await page.done();
  }

  // 200% text: the axis labels stay in the box and apart.
  {
    // Set as soon as <html> exists, before the app reads the root font size.
    const page = await open("32px root", {}, () => {
      const set = () => { if (!document.documentElement) return false; document.documentElement.style.fontSize = "32px"; return true; };
      if (!set()) new MutationObserver((_, o) => { if (set()) o.disconnect(); }).observe(document, { childList: true });
    });
    const { texts, box, root, size } = await ev(page, () => ({ texts: window.chartfit.texts(), box: window.chartfit.box(), root: getComputedStyle(document.documentElement).fontSize,
      size: Math.max(...[...document.querySelectorAll("#spend .echart-plot svg text")].map(t => parseFloat(getComputedStyle(t).fontSize) || 0)) }));
    line("32px root: the axis labels are drawn at twice their size", root === "32px" && size >= 22, `root ${root}, labels ${size}px`);
    const out =texts.filter(t => t.l < box.l - .5 || t.r > box.r + .5 || t.t < box.t - .5 || t.b > box.b + .5);
    const over = [];
    // Labels overlap when their em boxes do. A text's box is its line box, taller than its glyphs: at 32px the line boxes
    // of "$0" and the first day's label meet where their glyphs are well apart.
    const em = t => ({ ...t, t: (t.t + t.b - t.size) / 2, b: (t.t + t.b + t.size) / 2 });
    const at = t => `${Math.round(t.l - box.l)}..${Math.round(t.r - box.l)} x ${Math.round(t.t - box.t)}..${Math.round(t.b - box.t)}px`;
    texts.map(em).forEach((a, i, all) => all.slice(i + 1).forEach(c => { if (a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b) over.push(`"${a.text}" at ${at(a)} and "${c.text}" at ${at(c)}`); }));
    line("32px root: no axis label leaves the box", texts.length > 0 && !out.length, out.map(t => `"${t.text}" at ${Math.round(t.l - box.l)}..${Math.round(t.r - box.l)}px, ${Math.round(t.t - box.t)}..${Math.round(t.b - box.t)}px of ${Math.round(box.w)}x${Math.round(box.h)}`).join("; ") || `${texts.length} labels`);
    line("32px root: no two labels overlap", !over.length, over.join("; "));
    await shot(page, "text-32px");
    await page.done();
  }

  // The reading: pointer, keys, tooltip, drawer, cursor, zoom.
  {
    const page = await open("reading");
    const requests = [];
    page.on("request", r => { if (new URL(r.url()).pathname.startsWith("/api/")) requests.push(r.url()); });
    const g = await ev(page, () => window.chartfit.grid());
    const state = () => ev(page, () => ({ band: window.chartfit.band(), tip: window.chartfit.tip(), readout: window.chartfit.readout(), grid: window.chartfit.grid() }));
    const drawnDays = () => ev(page, () => window.chartfit.days().length);
    /** Whether the band, the tooltip and the readout are on day i, drawn at x; a line saying where each is. */
    const onDay = (s, i, x) => {
      const bandAt = s.band ? (s.band.l + s.band.r) / 2 : NaN;
      const ok = s.band && Math.abs(bandAt - x) <= 1.5 && named(s.tip?.day ?? "") === i && named(s.readout) === i;
      return { ok, at: `band at ${Math.round(bandAt)}px (day ${i + 1} at ${Math.round(x)}px), tooltip "${s.tip?.day ?? "none"}", readout "${s.readout.split(":")[0]}"` };
    };
    // Beside the point read: right of it, or left of it near the box's right edge, and never over it.
    const beside = (s, x) => s.tip && (s.tip.l >= x + 4 || s.tip.r <= x - 4);

    await page.mouse.move(centre(g, I), (g.t + g.b) / 2);
    const moved = await until(state, s => onDay(s, I, centre(g, I)).ok);
    const pm = onDay(moved, I, centre(g, I));
    line(`pointer over day ${I + 1}: band, tooltip and readout name ${label(DAYS[I], true)}`, pm.ok, pm.at);
    line("pointer: the tooltip sits beside the band, to its right", beside(moved, centre(g, I)) && moved.tip.l > centre(g, I),
      moved.tip ? `tooltip ${Math.round(moved.tip.l)}..${Math.round(moved.tip.r)}px, point at ${Math.round(centre(g, I))}px` : "no tooltip");
    await shot(page, "tooltip");
    const hand = await ev(page, ([x, y]) => getComputedStyle(document.elementFromPoint(x, y)).cursor, [centre(g, I), (g.t + g.b) / 2]);
    const dayText = (await ev(page, () => window.chartfit.texts())).find(t => t.t >= g.b);
    await page.mouse.move((dayText.l + dayText.r) / 2, (dayText.t + dayText.b) / 2);
    await sleep(100);
    const notHand = await ev(page, ([x, y]) => getComputedStyle(document.elementFromPoint(x, y)).cursor, [(dayText.l + dayText.r) / 2, (dayText.t + dayText.b) / 2]);
    line("the pointer is a hand over a day, not over a day label", hand === "pointer" && notHand !== "pointer", `over day ${I + 1}: ${hand}; over "${dayText.text}": ${notHand}`);
    await page.mouse.move(centre(g, N - 1), (g.t + g.b) / 2);
    const last = await until(state, s => named(s.readout) === N - 1);
    line("pointer over the last day: the tooltip flips to the band's left, inside the window", beside(last, centre(g, N - 1)) && last.tip.r < centre(g, N - 1) && last.tip.l >= 0 && last.tip.r <= W,
      last.tip ? `tooltip ${Math.round(last.tip.l)}..${Math.round(last.tip.r)}px, point at ${Math.round(centre(g, N - 1))}px` : "no tooltip");

    await away(page);
    const box = page.locator("#spend .echart");
    await box.focus();
    for (let k = 0; k <= I; k++) await page.keyboard.press("ArrowRight");
    const keyed = await until(state, s => onDay(s, I, centre(s.grid, I)).ok);
    const km = onDay(keyed, I, centre(keyed.grid, I));
    line(`${I + 1} presses of Right: band, tooltip and readout name ${label(DAYS[I], true)}`, km.ok, km.at);
    line("keys: the tooltip sits beside the band", beside(keyed, centre(keyed.grid, I)),
      keyed.tip ? `tooltip ${Math.round(keyed.tip.l)}..${Math.round(keyed.tip.r)}px, point at ${Math.round(centre(keyed.grid, I))}px` : "no tooltip");

    // Enter and a click open the sessions drawer on that day.
    const drawer = () => ev(page, () => ({ open: document.querySelector("#d-top")?.hasAttribute("data-open"), chip: document.querySelector("#d-top .daychip span")?.textContent ?? "" }));
    const close = async () => {
      if ((await drawer()).open) await page.locator("#d-top .drawer-toggle").click();
      await ev(page, () => scrollTo(0, 0));
      await away(page);
    };
    await page.keyboard.press("Enter");
    const entered = await until(drawer, d => d.open && d.chip);
    line(`Enter on day ${I + 1} opens its sessions`, entered.open && entered.chip === `Active on ${label(DAYS[I], true)}`, `drawer ${entered.open ? "open" : "closed"}, "${entered.chip}"`);
    await close();
    const g2 = await ev(page, () => window.chartfit.grid());
    await page.mouse.click(centre(g2, I), (g2.t + g2.b) / 2);
    const clicked = await until(drawer, d => d.open && d.chip);
    line(`a click on day ${I + 1} opens its sessions`, clicked.open && clicked.chip === `Active on ${label(DAYS[I], true)}`, `drawer ${clicked.open ? "open" : "closed"}, "${clicked.chip}"`);
    await close();

    // The zoom keys: plus around the day read, minus back; Ctrl+plus is the browser's.
    await ev(page, () => window.chartfit.listen());
    await ev(page, () => document.activeElement?.blur());
    await box.focus();
    for (let k = 0; k <= I; k++) await page.keyboard.press("ArrowRight");
    await page.keyboard.press("+");
    const zoomed = await until(state, s => shownBy(s.readout) && s.band);
    const drawn = await ev(page, () => window.chartfit.days().length);
    const w = shownBy(zoomed.readout);
    const zm = w && onDay({ ...zoomed, readout: label(DAYS[I], true) }, I, centre(zoomed.grid, I, w.from, w.to));
    line("plus zooms around the day read, and the band stays on its pixels", !!w && drawn === w.to - w.from + 1 && drawn < N && zm.ok,
      w ? `${drawn} days drawn, ${label(DAYS[w.from])} to ${label(DAYS[w.to])}; ${zm.at}` : `live region "${zoomed.readout}"`);
    await shot(page, "zoomed");
    await page.keyboard.press("-");
    const all = await until(drawnDays, n => n === N);
    line("minus shows every day again", all === N, `${all} of ${N} days drawn`);
    await ev(page, () => addEventListener("keydown", e => { window.__prevented = e.defaultPrevented; }, { once: true }));
    await page.keyboard.press("Control+Equal");
    await sleep(200);
    const ctrl = await ev(page, () => ({ prevented: window.__prevented, days: window.chartfit.days().length }));
    line("Ctrl+plus is left to the browser", ctrl.prevented === false && ctrl.days === N, `default ${ctrl.prevented ? "prevented" : "kept"}, ${ctrl.days} days drawn`);

    // A real drag of the slider's right handle.
    await ev(page, () => document.activeElement?.blur());
    await away(page);
    const before = { heading: await page.locator("#chartTitle").textContent(), lede: await page.locator("#lede").textContent(), url: page.url(), requests: requests.length };
    const handle = await ev(page, () => {
      const hs = window.chartfit.handles(), r = hs.at(-1);
      return hs.length === 2 ? { x: (r.l + r.r) / 2, y: (r.t + r.b) / 2, slider: r.r - hs[0].l } : null;
    });
    if (!line("the zoom slider has handles under the plot", !!handle)) throw new Error("no slider handle to drag");
    await ev(page, () => { window.__said = []; });
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    for (let k = 1; k <= 12; k++) { await page.mouse.move(handle.x - handle.slider * .45 * k / 12, handle.y); await sleep(40); }
    await sleep(300);
    const whileDown = await ev(page, () => window.__said.filter(t => t.startsWith("Showing")));
    await page.mouse.up();
    await sleep(400);
    const after = { heading: await page.locator("#chartTitle").textContent(), lede: await page.locator("#lede").textContent(), url: page.url(), requests: requests.length };
    const dragged = await ev(page, () => ({ days: window.chartfit.days().length, said: window.__said.filter(t => t.startsWith("Showing")) }));
    line("dragging a slider handle changes the days drawn", dragged.days < N, `${dragged.days} of ${N} days drawn`);
    line("the drag leaves the heading, the lede, the URL and the requests alone", JSON.stringify(before) === JSON.stringify(after),
      Object.keys(before).filter(k => before[k] !== after[k]).map(k => `${k}: ${before[k]} became ${after[k]}`).join("; "));
    line("the live region says the days shown once, on release", whileDown.length === 0 && dragged.said.length === 1 && shownBy(dragged.said[0])?.to - shownBy(dragged.said[0])?.from + 1 === dragged.days,
      `${whileDown.length} while down, then ${JSON.stringify(dragged.said)}`);
    const showAll = page.locator("#spend .show-all");
    const shown = await showAll.isVisible();
    if (shown) await showAll.click();
    const reset = await until(drawnDays, n => n === N);
    const focus = await ev(page, () => ({ chart: document.activeElement === document.querySelector("#spend .echart"), button: !!document.querySelector("#spend .show-all") }));
    line('"Show all days" shows every day and returns focus to the chart', shown && reset === N && focus.chart && !focus.button,
      `${shown ? "shown" : "never shown"}, ${reset} days drawn, focus ${focus.chart ? "on the chart" : "elsewhere"}`);

    // The hint stays one line in every stacking and scale.
    const hints = [];
    for (const [ctl, name] of [["Project", "Cost by project"], ["Model", "Cost by model"], ["Agent", "Cost by agent"], ["Tokens", "Tokens, Volume"], ["Share", "Tokens, Share"]]) {
      await page.locator("#spend .chart-head button", { hasText: new RegExp(`^${ctl}$`) }).click();
      await sleep(150);
      hints.push([name, await ev(page, () => window.chartfit.lines(document.querySelector("#spend .chart-head .hint")))]);
    }
    line(`the hint is one line at ${W}px`, hints.every(([, n]) => n === 1), hints.map(([k, n]) => `${k} ${n}`).join(", "));

    // Share: a kind under 1% of a day is drawn at least 1px tall. The chart is on Share now.
    const kinds = await ev(page, () => window.chartfit.keys());
    const KEYS = { Input: "input", Output: "text_out", Thinking: "thinking", "Cache read": "cache_read", "Cache write 5m": "cache_5m", "Cache write 1h": "cache_1h" };
    const thin = [];
    usage.daily.forEach(r => {
      const v = { input: r.input, text_out: r.output - r.thinking, thinking: r.thinking, cache_read: r.cache_read, cache_5m: r.cache_5m, cache_1h: r.cache_1h };
      const sum = Object.values(v).reduce((s, n) => s + n, 0);
      for (const k of kinds) { const x = v[KEYS[k.name]] / sum; if (x > 0 && x < .01) thin.push({ day: r.day, kind: k, share: x }); }
    });
    const smallest = thin.sort((a, c) => a.share - c.share)[0];
    if (line("the store has a kind under 1% of a day", !!smallest)) {
      const g3 = await ev(page, () => window.chartfit.grid());
      const x = centre(g3, DAYS.indexOf(smallest.day));
      const seg = await until(() => ev(page, ([x, c]) => window.chartfit.bars().find(s => s.fill === c && s.l <= x && s.r >= x) ?? null, [x, smallest.kind.color]), s => s?.h >= .99);
      line(`Share: ${smallest.kind.name} on ${label(smallest.day, true)}, ${(smallest.share * 100).toFixed(2)}% of the day, is at least 1px tall`, seg && seg.h >= .99,
        seg ? `${seg.h.toFixed(2)}px` : "not drawn");
    }

    // A 7-day view has no slider; back at 30 days it has, and shows every day.
    await page.locator("#spend .chart-head button", { hasText: /^Cost$/ }).click();
    await until(drawnDays, n => n === N);
    await box.focus();
    await page.keyboard.press("+");
    // The box is 240px, and 28px taller with the slider under it (SLIDER_ROOM in costDaily.ts).
    const view = () => ev(page, () => ({ days: window.chartfit.days().length, h: window.chartfit.box().h, all: !!document.querySelector("#spend .show-all"),
      hint: document.querySelector("#spend .chart-head .hint").textContent }));
    await page.locator("#fRange button", { hasText: /^7d$/ }).click();
    const seven = await until(view, r => r.days === 7);
    line("7 days: no slider, and the hint says nothing of zoom", seven.days === 7 && seven.h === 240 && !/zoom/i.test(seven.hint), `${seven.days} days drawn, box ${seven.h}px`);
    await page.locator("#fRange button", { hasText: /^30d$/ }).click();
    const thirty = await until(view, r => r.days === N);
    line("back at 30 days: the slider again, with every day shown", thirty.days === N && thirty.h === 268 && !thirty.all, `${thirty.days} days drawn, box ${thirty.h}px`);
    await page.done();
  }

  // A day with nothing in it: neither a click nor Enter opens anything, and the reading stays.
  {
    const page = await open("empty day");
    await page.route(/\/api\/usage\?/, async route => {
      const res = await route.fetch(), d = await res.json(), day = DAYS[I];
      for (const k of ["daily", "daily_projects", "daily_models", "daily_sources"]) if (Array.isArray(d[k])) d[k] = d[k].filter(r => r.day !== day);
      await route.fulfill({ response: res, json: d });
    });
    await page.reload();
    await page.waitForFunction(n => window.chartfit.days().length === n, N - 1);
    const g = await ev(page, () => window.chartfit.grid());
    const drawer = () => ev(page, () => document.querySelector("#d-top")?.hasAttribute("data-open") ?? false);
    await page.mouse.click(centre(g, I), (g.t + g.b) / 2);
    await sleep(300);
    const click = { open: await drawer(), readout: await ev(page, () => window.chartfit.readout()), tip: await ev(page, () => window.chartfit.tip()) };
    line(`a click on an empty day ${I + 1} opens nothing, and the reading stays`, !click.open && named(click.readout) === I && named(click.tip?.day ?? "") === I,
      `drawer ${click.open ? "open" : "closed"}, readout "${click.readout}"`);
    await away(page);
    await ev(page, () => document.activeElement?.blur());
    await page.locator("#spend .echart").focus();
    for (let k = 0; k <= I; k++) await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await sleep(300);
    const enter = { open: await drawer(), readout: await ev(page, () => window.chartfit.readout()) };
    line(`Enter on an empty day ${I + 1} opens nothing, and the reading stays`, !enter.open && named(enter.readout) === I, `drawer ${enter.open ? "open" : "closed"}, readout "${enter.readout}"`);
    await page.done();
  }

  line("no CSP violation, console error or page error", !reported.length, reported.join("; "));
} catch (e) {
  console.log(`chartfit stopped: ${e.message.split("\n")[0]}`);
  failed = true;
} finally {
  await b?.close();
  stop();
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
