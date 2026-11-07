// Records scripted walkthroughs of the demo server as GIFs in docs/: PNG frames from Playwright, encoded by gifski.
// node record.mjs [scene...]   (scenes: tour activity cost errors limits insights; default all)
// CHROMIUM=<path> uses that Chromium instead of Playwright's own.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = "http://127.0.0.1:8799";
const FPS = 12;
const DOCS = new URL("../../docs/", import.meta.url).pathname;

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

async function record(name, scene) {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM });
  const page = await b.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" });
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
  await scene(h, async path => { await page.goto(BASE + path); await page.waitForLoadState("networkidle"); on = true; });
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
  execFileSync("gifski", ["--fps", String(FPS), "--width", "960", "--quality", "80", "-o", `${DOCS}${name}.gif`, ...out], { stdio: "inherit" });
  rmSync(dir, { recursive: true });
  console.log(`${name}: ${out.length} frames`);
}

const sel = (page, s, text) => page.locator(s, { hasText: text });
const btn = (page, name) => page.getByRole("button", { name, exact: true });

const SCENES = {
  async activity(h, start) {
    const { page } = h;
    await start("/usage#range=30");
    await h.wait(1500);
    await h.scrollTo(page.locator("#work"), 20);
    await h.click(btn(page, "Prompts"));
    const chart = page.locator("#work svg").first();
    await h.click(chart, { dx: 0.82, dy: 0.7, pause: 1200 });
    await h.scrollTo(page.locator("#d-sessions"));
    await h.click(page.locator("#d-sessions tr.pick"), { dx: 0.2, pause: 2600 });
    await page.keyboard.press("Escape"); await h.wait(600);
    await h.click(page.locator("#d-tools summary"), { dx: 0.05, pause: 600 });
    await h.click(sel(page, "#d-tools tr", "Edit"), { dx: 0.1, pause: 2600 });
    await page.keyboard.press("Escape"); await h.wait(800);
  },
  async cost(h, start) {
    const { page } = h;
    await start("/cost#range=30");
    await h.wait(1800);
    await h.click(btn(page, "90d"), { pause: 1500 });
    await h.click(btn(page, "30d"), { pause: 1200 });
    await h.click(sel(page, ".rowbtn", "infra-scripts"), { pause: 2400 });
    await page.keyboard.press("Escape"); await h.wait(600);
    await h.scrollTo(page.locator("#spend"));
    await h.wait(1500);
    await h.scrollTo(page.locator("#where"));
    await h.wait(1500);
    await h.click(page.locator("#d-top summary"), { dx: 0.05, pause: 600 });
    await h.scrollTo(page.locator("#d-top"));
    await h.wait(1500);
  },
  async errors(h, start) {
    const { page } = h;
    await start("/errors#range=30");
    await h.wait(1800);
    await h.scrollTo(page.locator("#chartTitle"), 20);
    await h.click(sel(page, "#legend button, #legend label, #legend span", "Wrong CLI flags"), { pause: 1500 });
    await h.click(sel(page, "#legend button, #legend label, #legend span", "Wrong CLI flags"), { pause: 800 });
    await h.scrollTo(page.locator("#catBody"));
    await h.click(page.locator("#catBody tr, #catBody button"), { pause: 1500 });
    await h.scrollTo(page.locator("#detail"));
    await h.wait(2500);
  },
  async limits(h, start) {
    const { page } = h;
    await start("/limits#range=30");
    await h.wait(2200);
    const card = page.locator(".lim-grid svg").first();
    const box = await card.boundingBox();
    for (const k of [0.2, 0.5, 0.75, 0.95]) { await h.move(box.x + box.width * k, box.y + box.height * 0.5); await h.wait(500); }
    await h.scrollTo(page.locator("#unused"));
    await h.wait(1500);
    await h.click(page.locator("#history summary"), { dx: 0.05, pause: 600 });
    await h.scrollTo(page.locator("#history"));
    await h.wait(1500);
    await h.click(page.locator("#value summary"), { dx: 0.05, pause: 600 });
    await h.scrollTo(page.locator("#value"));
    await h.wait(2000);
  },
  async insights(h, start) {
    const { page } = h;
    await start("/insights#range=30");
    await h.wait(2200);
    await h.scrollTo(page.locator("#friction"), 20);
    await h.wait(1800);
    await h.scrollTo(page.locator("#outcomes"), 20);
    await h.wait(1500);
    await h.scrollTo(page.locator("#log"), 20);
    await h.click(page.getByLabel("Only sessions with friction"), { pause: 1500 });
    await h.click(page.locator("#log a", { hasText: "Session" }).first(), { pause: 2600 });
    await page.keyboard.press("Escape"); await h.wait(800);
  },
  async tour(h, start) {
    const { page } = h;
    await start("/usage#range=30");
    await h.wait(1800);
    await h.scrollTo(page.locator("#work"), 20);
    await h.click(btn(page, "Prompts"), { pause: 1200 });
    await h.click(page.getByRole("link", { name: "Cost", exact: true }), { pause: 1800 });
    await h.click(btn(page, "90d"), { pause: 1500 });
    await h.scrollTo(page.locator("#spend"));
    await h.wait(1200);
    await h.click(page.getByRole("link", { name: "Errors", exact: true }), { pause: 1800 });
    await h.scrollTo(page.locator("#chartTitle"), 20);
    await h.wait(1500);
    await h.click(page.getByRole("link", { name: "Limits", exact: true }), { pause: 300 });
    await page.locator(".lim-grid svg").first().waitFor(); await h.wait(2500);
    await h.scrollTo(page.locator("#history"));
    await h.wait(1500);
  },
};

for (const name of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENES)) {
  await record(name, SCENES[name]);
}
