// Records scripted walkthroughs of the demo server as GIFs in docs/: PNG frames from Playwright, encoded by gifski.
// Each scene records twice: <scene>.gif in dark mode, <scene>-light.gif in light mode.
// Scenes in VIDEOS (tour) also get <scene>.mp4 / <scene>-light.mp4 from the same frames: H.264, 960px wide, no audio.
// That needs ffmpeg with libx264 on the PATH.
// node record.mjs [scene...]   (scenes: tour activity cost context project errors limits insights live; default all)
// live plays synthetic sessions with replay.py, so it needs uv.
// CHROMIUM=<path> uses that Chromium instead of Playwright's own. SCHEMES=light records only that scheme.
// live leaves its sessions in the store: seed it again before you record live a second time.
//
// node record.mjs shots [page...]   writes the docs site's screenshots (site/src/assets/shots/), not GIFs.
//   pages: activity cost context errors limits insights project live everywhere   (default all)
//   Per page: <page>-<panel>, each cropped to one panel, in dark mode and as <name>-light.png in light mode.
//   everywhere = the command palette and the context menu. tour-overview is the tour GIF's reduced-motion still
//   (the first screen of Activity, not the whole page). Only the panels a docs page shows are recorded; every PNG
//   is palette-quantized (sharp, from site/node_modules) to keep it small.
//
// node record.mjs quantize   re-encodes the PNGs already in site/src/assets/shots/ the same way, without recording.
//   Steps: `uv sync` once, `npm ci` here and in site/ (sharp), then this. shots seeds the demo store itself (seed.py), starts serve.py and stops it
//   at the end, and exits before any shot when port 8799 (or DEMO_PORT) already answers, so no shot comes from a store you run yourself.
//   serve.py opens only demo.duckdb, so a shot cannot show your transcripts. live plays replay.py sessions, last of all.
//   Shots are 1280px wide at device scale 1 (SCALE=2 doubles it), with reduced motion on so charts do not animate.
import { chromium } from "playwright";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, copyFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

// DEMO_PORT moves the demo server off 8799, when another checkout already serves its demo store there.
const PORT = Number(process.env.DEMO_PORT || 8799);
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = new URL("../../site/src/assets/shots/", import.meta.url).pathname;
const FPS = 12;
const VIDEOS = new Set(["tour"]); // scenes that also get an MP4
const DOCS = new URL("../../docs/", import.meta.url).pathname;
const HERE = new URL(".", import.meta.url).pathname;

// A visible cursor: headless Chromium draws none.
const CURSOR = () => {
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.style.cssText = "position:fixed;z-index:99999;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;" +
      "background:rgba(255,255,255,.85);border:2px solid #e8825a;pointer-events:none;transition:transform .12s;left:-50px;top:-50px";
    document.body.appendChild(c);
    addEventListener("mousemove", e => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", () => { c.style.transform = "scale(.6)"; }, true);
    addEventListener("mouseup", () => { c.style.transform = ""; }, true);
  });
};

async function record(name, scene, scheme) {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM });
  const page = await b.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
  await page.addInitScript(CURSOR);
  const dir = mkdtempSync(join(tmpdir(), `ai-ledger-${name}-`));
  const shots = [];
  let on = false;
  const loop = (async () => {
    while (!on) await new Promise(r => setTimeout(r, 20));
    while (on) {
      const t = Date.now();
      const path = `${dir}/raw-${shots.length}.png`;
      try { await page.screenshot({ path }); shots.push({ t, path }); } catch {}
      await new Promise(r => setTimeout(r, Math.max(0, 1000 / FPS - (Date.now() - t))));
    }
  })();
  const at = { x: 640, y: 400 };
  const h = {
    page,
    wait: ms => page.waitForTimeout(ms),
    async move(x, y) { await page.mouse.move(x, y, { steps: 14 }); at.x = x; at.y = y; },
    async click(locator, { dx = 0.5, dy = 0.5, pause = 900 } = {}) {
      const l = locator.first();
      await l.scrollIntoViewIfNeeded();
      const box = await l.boundingBox();
      await h.move(box.x + box.width * dx, box.y + box.height * dy);
      await h.wait(250);
      await page.mouse.down(); await page.mouse.up();
      await h.wait(pause);
    },
    async scroll(y, ms = 900) {
      await page.evaluate(([y, ms]) => new Promise(done => {
        const y0 = scrollY, t0 = performance.now();
        const step = t => { const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
          scrollTo(0, y0 + (y - y0) * e); k < 1 ? requestAnimationFrame(step) : done(); };
        requestAnimationFrame(step);
      }), [y, ms]);
      await h.wait(300);
    },
    async scrollTo(locator, offset = 80) {
      const y = await locator.first().evaluate((e, o) => e.getBoundingClientRect().top + scrollY - o, offset);
      await h.scroll(y);
    },
  };
  // Live keeps a stream open, so it never reaches networkidle; it passes "load".
  await scene(h, async (path, state = "networkidle") => { await page.goto(BASE + path); await page.waitForLoadState(state); on = true; });
  on = false;
  await loop;
  await b.close();
  // Resample to a fixed frame rate so the GIF plays at real speed; gifski merges repeated frames.
  const out = [];
  const t0 = shots[0].t, end = shots.at(-1).t;
  for (let i = 0, t = t0; t <= end; t += 1000 / FPS) {
    while (i + 1 < shots.length && shots[i + 1].t <= t) i++;
    const f = `${dir}/f-${String(out.length).padStart(5, "0")}.png`;
    copyFileSync(shots[i].path, f);
    out.push(f);
  }
  execFileSync("gifski", ["--fps", String(FPS), "--width", "960", "--quality", "80", "-o", `${DOCS}${name}${scheme === "light" ? "-light" : ""}.gif`, ...out], { stdio: "inherit" });
  if (VIDEOS.has(name)) {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", `${dir}/f-%05d.png`,
      "-vf", "scale=960:-2:flags=lanczos", "-c:v", "libx264", "-crf", "23", "-preset", "slow", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart", "-r", String(FPS), "-an", `${DOCS}${name}${scheme === "light" ? "-light" : ""}.mp4`], { stdio: "inherit" });
  }
  rmSync(dir, { recursive: true });
  console.log(`${name} (${scheme}): ${out.length} frames`);
}

const sel = (page, s, text) => page.locator(s, { hasText: text });
const btn = (page, name) => page.getByRole("button", { name, exact: true });

const SCENES = {
  async activity(h, start) {
    const { page } = h;
    await start("/usage?range=30");
    await h.wait(1500);
    await h.scrollTo(page.locator("#work"), 20);
    await h.click(btn(page, "Prompts"));
    const chart = page.locator("#work svg").first();
    await h.click(chart, { dx: 0.82, dy: 0.7, pause: 1200 });
    await h.scrollTo(page.locator("#d-sessions"));
    await h.click(page.locator("#d-sessions tr.pick"), { dx: 0.2, pause: 2600 });
    await page.keyboard.press("Escape"); await h.wait(600);
    await h.click(page.locator("#d-tools .drawer-toggle"), { dx: 0.05, pause: 600 });
    await h.click(sel(page, "#d-tools tr", "Edit"), { dx: 0.1, pause: 2600 });
    await page.keyboard.press("Escape"); await h.wait(800);
  },
  async cost(h, start) {
    const { page } = h;
    await start("/cost?range=30");
    await h.wait(1800);
    await h.click(btn(page, "90d"), { pause: 1500 });
    await h.click(btn(page, "30d"), { pause: 1200 });
    await h.scrollTo(page.locator("#spend"));
    await h.wait(1500);
    await h.scrollTo(page.locator("#projects"));
    await h.wait(1200);
    await h.click(sel(page, "#projects .cellbtn", "infra-scripts"), { pause: 2400 });
    await page.keyboard.press("Escape"); await h.wait(600);
    await h.click(page.locator("#d-top .drawer-toggle"), { dx: 0.05, pause: 600 });
    await h.scrollTo(page.locator("#d-top"));
    await h.wait(1500);
  },
  async context(h, start) {
    const { page } = h;
    await start("/context?range=30");
    await h.wait(2200);
    await h.scrollTo(page.locator("#tips"), 20);
    await h.wait(2000);
    await h.scrollTo(page.locator("#starting"), 20);
    await h.wait(1800);
    await h.scrollTo(page.locator("#growth"), 20);
    await h.click(btn(page, "Share of window"), { pause: 1500 });
    await h.click(page.locator("#growth .key.proj"), { pause: 1500 });
    await h.click(page.locator("#growth .key.proj"), { pause: 600 });
    await h.scrollTo(page.locator("#pressure"), 20);
    await h.click(page.locator("#pressure .band[aria-label*=\"272k\"]").nth(3), { pause: 1500 });
    const map = page.locator("#pressure rect.hit");
    await h.scrollTo(map, 120);
    const box = await map.first().boundingBox();
    for (const [x, y] of [[0.4, 0.6], [0.55, 0.35], [0.65, 0.15]]) { await h.move(box.x + box.width * x, box.y + box.height * y); await h.wait(500); }
    await h.click(map, { dx: 0.65, dy: 0.15, pause: 2400 });
    await page.keyboard.press("Escape"); await h.wait(600);
    await h.scrollTo(page.locator("#fills"), 20);
    await h.wait(1200);
    await h.click(btn(page, "By MCP server"), { pause: 1500 });
    await h.scrollTo(page.locator("#cost"), 20);
    await h.wait(2200);
  },
  async project(h, start) {
    const { page } = h;
    await start("/usage?range=30&project=atlas-api");
    await h.wait(1500);
    await h.click(page.locator(".filters-projectpage"), { pause: 2000 });
    await h.scrollTo(page.locator("#cost"), 20);
    await h.wait(1500);
    await h.scrollTo(page.locator("#sessions"), 20);
    await h.click(page.locator("#sessions tbody tr"), { dx: 0.15, pause: 2400 });
    await page.keyboard.press("Escape"); await h.wait(600);
    await h.scrollTo(page.locator("#context"), 20);
    await h.click(page.locator("#context summary"), { dx: 0.1, pause: 2500 });
    await h.scrollTo(page.locator("#insights"), 20);
    await h.wait(1500);
    await h.scrollTo(page.locator("#limits"), 20);
    await h.wait(1500);
  },
  async errors(h, start) {
    const { page } = h;
    await start("/errors?range=30");
    await h.wait(1800);
    await h.scrollTo(page.locator("#chartTitle"), 20);
    await h.click(page.locator("#legend button"), { pause: 1500 });
    await h.click(page.locator("#legend button"), { pause: 800 });
    await h.scrollTo(page.locator("#catBody"));
    await h.click(page.locator("#catBody tr, #catBody button"), { pause: 1500 });
    await h.scrollTo(page.locator("#detail"));
    await h.wait(2500);
  },
  async limits(h, start) {
    const { page } = h;
    await start("/limits?range=30");
    await h.wait(2200);
    const card = page.locator(".lim-grid svg").first();
    const box = await card.boundingBox();
    for (const k of [0.2, 0.5, 0.75, 0.95]) { await h.move(box.x + box.width * k, box.y + box.height * 0.5); await h.wait(500); }
    await h.scrollTo(page.locator("#unused"));
    await h.wait(1500);
    await h.click(page.locator("#history .drawer-toggle"), { dx: 0.05, pause: 600 });
    await h.scrollTo(page.locator("#history"));
    await h.wait(1500);
    await h.click(page.locator("#value .drawer-toggle"), { dx: 0.05, pause: 600 });
    await h.scrollTo(page.locator("#value"));
    await h.wait(2000);
  },
  async insights(h, start) {
    const { page } = h;
    await start("/insights?range=30");
    await h.wait(2200);
    await h.scrollTo(page.locator("#friction"), 20);
    await h.wait(1800);
    await h.scrollTo(page.locator("#outcomes"), 20);
    await h.wait(1500);
    await h.scrollTo(page.locator("#log"), 20);
    await h.click(page.getByLabel("Only sessions with friction"), { pause: 1500 });
    await h.click(page.locator("#log a[title*=\"Open session\"]"), { pause: 2600 });
    await page.keyboard.press("Escape"); await h.wait(800);
  },
  async live(h, start) {
    const { page } = h;
    const replay = project => spawn("uv", ["run", "replay.py", "--once", project], { cwd: HERE, stdio: "ignore" });
    const runs = [replay("ledger-web")];
    try {
      await h.wait(6000);
      runs.push(replay("atlas-api"));
      await h.wait(1500);
      await start("/live", "load");
      await h.wait(1500);
      await h.click(sel(page, ".rail li button", "Rate-limit"), { pause: 11500 });
      await h.click(sel(page, ".stream button", "npm test"), { pause: 3500 });
      await h.click(btn(page, "Wall"), { pause: 4500 });
      await h.click(page.getByRole("button", { name: "Open Rate-limit the orders endpoint" }), { pause: 7000 });
    } finally {
      for (const r of runs) r.kill();
    }
  },
  async tour(h, start) {
    const { page } = h;
    await start("/usage?range=30");
    await h.wait(1800);
    await h.scrollTo(page.locator("#work"), 20);
    await h.click(btn(page, "Prompts"), { pause: 1200 });
    await h.click(page.getByRole("link", { name: "Cost", exact: true }), { pause: 1800 });
    await h.click(btn(page, "90d"), { pause: 1500 });
    await h.scrollTo(page.locator("#spend"));
    await h.wait(1200);
    await h.click(page.getByRole("link", { name: "Context", exact: true }), { pause: 1800 });
    await h.scrollTo(page.locator("#growth"), 20);
    await h.wait(1500);
    await h.click(page.getByRole("link", { name: "Errors", exact: true }), { pause: 1800 });
    await h.scrollTo(page.locator("#chartTitle"), 20);
    await h.wait(1500);
    await h.click(page.getByRole("link", { name: "Limits", exact: true }), { pause: 300 });
    await page.locator(".lim-grid svg").first().waitFor(); await h.wait(2500);
    await h.scrollTo(page.locator("#history"));
    await h.wait(1500);
  },
};

// ---- shots: the docs site's screenshots ----

const SCALE = Number(process.env.SCALE ?? 1);
const MAX = 1200; // a panel taller than this (a long table) is cropped to its first 1200px
const listening = () => new Promise(done => {
  const s = connect(PORT, "127.0.0.1");
  s.once("connect", () => { s.destroy(); done(true); });
  s.once("error", () => done(false));
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Every PNG is palette-quantized in place: the demo UI has few colors, so 256 lose nothing the eye reads and the file shrinks several times over.
// sharp is a devDependency of site/ (Astro uses it too); load it here so the GIF scenes need no site/ install.
let sharp;
async function quantize(path) {
  try { sharp ??= createRequire(new URL("../../site/package.json", import.meta.url))("sharp"); }
  catch { throw new Error("sharp not found: run `npm ci` in site/ first"); }
  writeFileSync(path, await sharp(readFileSync(path)).png({ palette: true, quality: 90, effort: 10 }).toBuffer());
}
// A screenshot of a page or a locator, quantized: `target` is a Playwright page or locator.
const shoot = async (target, path, options = {}) => { await target.screenshot({ path, ...options }); await quantize(path); };

// [panel name, selector, { drawer: id of the drawer to open first, max: crop height }]
const D = (name, id) => [name, "#" + id, { drawer: id }];
const SHOT_PAGES = {
  activity: { url: "/usage?range=30", panels: [
    ["attention", "#attention"], ["vitals", "#vitals"], ["work", "#work"], ["hours", "#hours"]] },
  cost: { url: "/cost?range=30", panels: [
    ["overview", "#overview"], ["spend", "#spend"], ["projects", "#projects"], ["highlights", "#insights"],
    ["models", ".split > section.panel"]] },
  context: { url: "/context?range=30", panels: [
    ["tips", "#tips"], ["starting", "#starting"], ["growth", "#growth"], ["pressure", "#pressure"], ["fills", "#fills"], ["cost", "#cost"]] },
  errors: { url: "/errors?range=30", panels: [
    ["summary", "#kpis"], ["chart", ".chart-card"], ["types", ".card.types"], ["detail", "#detail"]] },
  limits: { url: "/limits?range=30", panels: [
    ["windows", ".lim-grid"], ["unused", "#unused"], D("history", "history")] },
  insights: { url: "/insights?range=30", panels: [
    ["vitals", "#vitals"], ["outcomes", "#outcomes"], ["friction", "#friction"], ["log", "#log"]] },
  project: { url: "/project?range=30&project=atlas-api", panels: [
    ["summary", "#summary"], ["cost", "#cost"], ["sessions", "#sessions"], ["errors", "#errors"], ["context", "#context"],
    ["insights", "#insights"], ["limits", "#limits"]] },
};

const suffix = scheme => scheme === "light" ? "-light" : "";
const shotPath = (name, scheme) => `${SHOTS}${name}${suffix(scheme)}.png`;
const newPage = async (b, scheme) => {
  const page = await (await b.newContext({
    viewport: { width: 1280, height: 800 }, colorScheme: scheme, reducedMotion: "reduce", deviceScaleFactor: SCALE,
  })).newPage();
  // The skip link sits off screen until focused; a whole-page capture would show it.
  await page.addInitScript(() => addEventListener("DOMContentLoaded", () => {
    const s = document.createElement("style"); s.textContent = ".skip{display:none!important}"; document.head.append(s);
  }));
  return page;
};
const settle = async (page, path, state = "networkidle") => {
  await page.goto(BASE + path); await page.waitForLoadState(state); await page.waitForTimeout(1800);
};

// One panel's pixels, cut from a capture of the whole page so a panel taller than the window shows in full. A panel taller than max is cropped from its top.
async function snap(page, path, locator, max = MAX) {
  const l = locator.first();
  await l.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0); await page.waitForTimeout(150);
  const box = await l.boundingBox(), y = await page.evaluate(() => scrollY);
  await shoot(page, path, { fullPage: true, clip: { x: box.x, y: box.y + y, width: box.width, height: Math.min(box.height, max) } });
}

async function openDrawer(page, id) {
  const toggle = page.locator(`#${id} .drawer-toggle`).first();
  if (await toggle.getAttribute("aria-expanded") !== "true") { await toggle.click(); await page.waitForTimeout(700); }
}

async function pageShots(b, key, scheme) {
  const spec = SHOT_PAGES[key], page = await newPage(b, scheme);
  await settle(page, spec.url);
  if (key === "activity") await shoot(page, shotPath("tour-overview", scheme)); // the tour GIF's still: the first screen
  for (const [name, selector, o = {}] of spec.panels) {
    if (o.drawer) await openDrawer(page, o.drawer);
    await snap(page, shotPath(`${key}-${name}`, scheme), page.locator(selector), o.max);
  }
  await page.context().close();
}

async function everywhereShots(b, scheme) {
  const page = await newPage(b, scheme);
  await settle(page, "/usage?range=30");
  await page.locator(".appnav-palette").click();
  await page.locator("dialog.palette[open]").waitFor();
  await page.keyboard.type("atlas", { delay: 40 });
  await page.waitForTimeout(1200);
  await shoot(page.locator("dialog.palette"), shotPath("everywhere-palette", scheme));
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  // The menu opens on a project row, to the right of the names: the shot holds the drawer and the menu, cropped together.
  await openDrawer(page, "d-projects");
  const row = page.locator("#d-projects tbody tr", { hasText: "atlas-api" }).first();
  await row.scrollIntoViewIfNeeded();
  await row.click({ button: "right", position: { x: 260, y: 12 } });
  const menu = page.locator(".menu-pop");
  await menu.waitFor(); await page.waitForTimeout(500);
  await page.mouse.move(0, 0); // the menu stays open; the pointer leaves the row so no hover tint hides the selection
  const [r, m] = [await page.locator("#d-projects").boundingBox(), await menu.boundingBox()], pad = 16;
  const x = Math.max(0, Math.min(r.x, m.x) - pad), y = Math.max(0, Math.min(r.y, m.y) - pad);
  await shoot(page, shotPath("everywhere-context-menu", scheme), { clip: {
    x, y, width: Math.min(1280, Math.max(r.x + r.width, m.x + m.width) + pad) - x, height: Math.min(800, Math.max(r.y + r.height, m.y + m.height) + pad) - y } });
  await page.context().close();
}

// Live reads state as it changes, so both schemes watch the same two replays and shoot at the same moment.
async function liveShots(b) {
  const schemes = ["dark", "light"], pages = await Promise.all(schemes.map(s => newPage(b, s)));
  const each = fn => Promise.all(pages.map((p, i) => fn(p, schemes[i])));
  const replay = project => spawn("uv", ["run", "replay.py", "--once", project], { cwd: HERE, stdio: "ignore" });
  const t0 = Date.now(), at = s => sleep(Math.max(0, t0 + s * 1000 - Date.now()));
  const runs = [replay("ledger-web")];
  try {
    await at(7); runs.push(replay("atlas-api"));
    await at(9); await each(p => settle(p, "/live", "load"));
    await each(p => p.locator(".rail li button", { hasText: "Rate-limit" }).first().click());
    await at(31); // atlas-api's first test run has failed and ledger-web is mid-way
    await each(async (p, s) => {
      await p.mouse.move(0, 0);
      for (const [name, sel] of [["rail", ".panel.rail"], ["stream", ".panel.main"], ["status", ".panel.head"]]) await snap(p, shotPath(`live-${name}`, s), p.locator(sel));
    });
    await at(50); // ledger-web is in a long shell call
    await each(async (p, s) => {
      await p.getByRole("button", { name: "Wall", exact: true }).click(); await p.waitForTimeout(800);
      await snap(p, shotPath("live-wall", s), p.locator(".walls"));
    });
  } finally { for (const r of runs) r.kill(); }
  await Promise.all(pages.map(p => p.context().close()));
}

async function shots(wanted) {
  const all = [...Object.keys(SHOT_PAGES), "everywhere", "live"]; // live last: its sessions stay in the store
  const bad = wanted.filter(p => !all.includes(p));
  if (bad.length) { console.error(`Unknown page: ${bad.join(", ")}. Pages: ${all.join(" ")}`); process.exit(1); }
  if (await listening()) { console.error(`Port ${PORT} already answers. Stop that server first: the shots must come from the demo store, which this script serves itself (or set DEMO_PORT).`); process.exit(1); }
  mkdirSync(SHOTS, { recursive: true });
  // Start from the seed: an earlier live run left its sessions in the store and in live/.
  execFileSync("uv", ["run", "seed.py"], { cwd: HERE, stdio: "inherit" });
  rmSync(join(HERE, "live"), { recursive: true, force: true });
  const server = spawn("uv", ["run", "serve.py"], { cwd: HERE, stdio: ["ignore", "pipe", "ignore"], detached: true });
  const stop = () => { try { process.kill(-server.pid); } catch {} };
  let exited = false; server.once("exit", () => { exited = true; });
  // serve.py prints "serving http://…" only after it has bound its port, so another server that took the port while
  // seed.py ran can never pass for the demo store: serve.py then exits without that line.
  let ready = false; server.stdout.on("data", d => { if (String(d).includes(`serving ${BASE}/`)) ready = true; });
  process.once("SIGINT", () => { stop(); process.exit(130); });
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM });
    for (let i = 0; !ready || !(await listening()); i++) {
      if (exited) throw new Error(`serve.py exited: if something else holds port ${PORT}, stop it; the shots must come from the demo store`);
      if (i > 240) throw new Error("serve.py did not start");
      await sleep(500);
    }
    for (const key of wanted.length ? all.filter(p => wanted.includes(p)) : all) {
      if (key === "live") await liveShots(b);
      else for (const scheme of ["dark", "light"]) await (key === "everywhere" ? everywhereShots(b, scheme) : pageShots(b, key, scheme));
      console.log(key);
    }
  } finally { await b?.close(); stop(); }
  console.log(`${readdirSync(SHOTS).filter(f => f.endsWith(".png")).length} PNGs in ${SHOTS}`);
}

async function requantize() {
  const files = readdirSync(SHOTS).filter(f => f.endsWith(".png"));
  for (const f of files) await quantize(SHOTS + f);
  console.log(`${files.length} PNGs re-encoded in ${SHOTS}`);
}

const [first, ...rest] = process.argv.slice(2);
if (first === "shots") await shots(rest);
else if (first === "quantize") await requantize();
else for (const name of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENES)) {
  for (const scheme of (process.env.SCHEMES ?? "dark,light").split(",")) await record(name, SCENES[name], scheme);
}
