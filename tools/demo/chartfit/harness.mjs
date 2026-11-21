// What every page of chartfit.mjs runs on: one demo store seeded afresh in a temporary directory (seed.py and serve.py
// copied there, so the store in tools/demo and any demo server already running are left alone), served on a free port of
// 127.0.0.1 and stopped by its process id when the run ends, also on a failure; one Chromium; the printed lines; and what
// the pages reported (CSP violations, console errors, page errors), checked once after every page ran.
import { chromium } from "playwright";
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { readers } from "./readers.mjs";

export { sleep };
const DEMO = new URL("..", import.meta.url).pathname, ROOT = join(DEMO, "../..");
export const W = 1440, H = 900, LOCALE = "en-US";
const SHOTS = process.env.SHOTS;

/** A port nothing listens on, from the system. */
const freePort = () => new Promise((resolve, reject) => {
  const s = createServer().once("error", reject);
  s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

let failed = false;
/** Prints one check's line, and gives whether it passed. */
export const line = (what, ok, detail = "") => {
  console.log(`${what}: ${ok ? "ok" : "FAILS"}${detail ? ` (${detail})` : ""}`);
  failed ||= !ok;
  return ok;
};
/** Polls f until its value passes ok, for up to 4s, and gives its last value: what failed, when nothing passed. */
export async function until(f, ok = Boolean) {
  for (const end = Date.now() + 4000; ; await sleep(50)) {
    const v = await f();
    if (ok(v) || Date.now() > end) return v;
  }
}

/** Seeds and serves the store, runs each page's checks with the harness h, then the check of what the pages reported;
 *  cleans up and exits 1 when a check failed or a page stopped the run. A page is an async function of h. */
export async function run(pages) {
  // The demo store, seeded afresh outside the repo: its days end today, so the 30-day view is full.
  const dir = mkdtempSync(join(tmpdir(), "ai-ledger-chartfit-"));
  for (const f of ["seed.py", "serve.py"]) copyFileSync(join(DEMO, f), join(dir, f));
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

    const h = {
      BASE,
      /** The server's JSON answer for a path. */
      json: async path => (await fetch(`${BASE}${path}`)).json(),
      /** A page on path with the chart under root drawn (ready(page) resolves once it is), logging what the page reports
       *  under name. page.requests lists the /api/ requests it makes; page.done() records its reports and closes it. */
      async open({ path, root, ready }, name, options = {}, init = null) {
        const ctx = await b.newContext({ viewport: { width: W, height: H }, locale: LOCALE, colorScheme: "light", reducedMotion: "reduce", ...options });
        const page = await ctx.newPage();
        page.errors = [];
        page.requests = [];
        page.on("console", m => { if (m.type() === "error") page.errors.push(`console: ${m.text()} ${m.location().url}`); });
        page.on("pageerror", e => page.errors.push(`page error: ${e.message}`));
        page.on("request", r => { if (new URL(r.url()).pathname.startsWith("/api/")) page.requests.push(r.url()); });
        await page.addInitScript(readers, root);
        if (init) await page.addInitScript(init);
        page.done = async () => {
          for (const v of await page.evaluate(() => window.__csp)) reported.push(`${name}: CSP ${v}`);
          for (const e of page.errors) reported.push(`${name}: ${e}`);
          await ctx.close();
        };
        await page.goto(`${BASE}${path}`);
        await ready(page);
        return page;
      },
      /** With SHOTS=<dir>, a screenshot of the element at root, as <dir>/<file>.png. */
      async shot(page, root, file) {
        if (!SHOTS) return;
        mkdirSync(SHOTS, { recursive: true });
        await page.locator(root).screenshot({ path: join(SHOTS, `${file}.png`) });
      },
    };
    for (const page of pages) await page(h);

    // Connection resets (net::ERR_CONNECTION_RESET) have been seen here when the machine is heavily loaded: the demo
    // server's listen queue is small. Rerun on a quiet machine first.
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
}
