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
/** A request the demo server dropped, by its failure, and the loads of a page tried before the run stops on it. */
const DROPPED = /net::ERR_(CONNECTION_RESET|SOCKET_NOT_CONNECTED)\b/, LOADS = 3;

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
  /** The requests the server dropped after their page's kept load: named when a check then stops the run. */
  const late = [];
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
      /** Answers a routed request with the server's JSON changed by f. A request the server drops (a connection reset, on a
       *  loaded machine) fails in the page, where the check of what the pages reported names it, instead of ending the run. */
      async answer(route, f) {
        let res;
        try { res = await route.fetch(); } catch { await route.abort("connectionreset").catch(() => {}); return; }
        await route.fulfill({ response: res, json: f(await res.json()) }).catch(() => {});
      },
      /** A page on path with the chart under root drawn (ready(page) resolves once it is), logging what the page reports
       *  under name. page.requests lists the /api/ requests it makes; page.done() records its reports and closes it.
       *  setup, when given, runs in the page before its scripts, before init; with answer, the chart's payload (the request
       *  data matches) is answer(payload). */
      async open({ path, root, ready, setup = null, data = null, answer = null }, name, options = {}, init = null) {
        // The demo server's listen queue is 5: on a loaded machine it drops connections, and a page whose script chunk or
        // /api/ request is dropped may never draw. So a load with a dropped request is thrown away and the page loaded
        // afresh, in a new context, up to LOADS times. This must never hide anything else: a discarded load's other console
        // errors, page errors and CSP violations are still reported, a drop on every load stops the run naming the page,
        // and a drop after the kept load is drawn (during the checks) is reported as before.
        for (let load = 1; ; load++) {
          const ctx = await b.newContext({ viewport: { width: W, height: H }, locale: LOCALE, colorScheme: "light", reducedMotion: "reduce", ...options });
          const page = await ctx.newPage();
          page.errors = [];
          page.requests = [];
          let dropped = null, kept = false, onDrop;
          const drop = new Promise((_, reject) => { onDrop = reject; });
          drop.catch(() => {});
          page.on("console", m => { if (m.type() === "error") page.errors.push(`console: ${m.text()} ${m.location().url}`); });
          page.on("pageerror", e => page.errors.push(`page error: ${e.message}`));
          page.on("request", r => { if (new URL(r.url()).pathname.startsWith("/api/")) page.requests.push(r.url()); });
          page.on("requestfailed", r => {
            if (!DROPPED.test(r.failure()?.errorText ?? "")) return;
            if (kept) return void late.push(`${name}: ${r.url()}`);
            if (dropped) return;
            dropped = r.url();
            onDrop(new Error(`dropped ${dropped}`));
          });
          await page.addInitScript(readers, root);
          if (setup) await page.addInitScript(setup);
          if (init) await page.addInitScript(init);
          if (answer) await page.route(data, route => h.answer(route, answer));
          /** Records what the page reported, under name, and closes it; except lets some reports go. */
          const close = async (except = () => false) => {
            // A refetch may still be on its way through a route: let it go, or its failed fetch ends the run.
            await page.unrouteAll({ behavior: "ignoreErrors" });
            const csp = await page.evaluate(() => window.__csp ?? []).catch(() => []);
            for (const v of csp) reported.push(`${name}: CSP ${v}`);
            for (const e of page.errors) if (!except(e)) reported.push(`${name}: ${e}`);
            await ctx.close();
          };
          page.done = () => close();
          try {
            const loading = (async () => { await page.goto(`${BASE}${path}`); await ready(page); })();
            loading.catch(() => {}); // after a drop it fails on the closed page, unheard
            await Promise.race([loading, drop]);
            if (!dropped) { kept = true; return page; }
          } catch (e) {
            if (!dropped) throw e;
          }
          // Only the drops of a discarded load go unreported: whatever else it logged still fails the run.
          await close(e => e.startsWith("console: Failed to load resource:") && DROPPED.test(e));
          if (load === LOADS) throw new Error(`${name}: the demo server kept dropping the connection on each of ${LOADS} loads of ${path}, last ${dropped}`);
          await sleep(500 * load);
        }
      },
      /** With SHOTS=<dir>, a screenshot of the element at root, as <dir>/<file>.png. */
      async shot(page, root, file) {
        if (!SHOTS) return;
        mkdirSync(SHOTS, { recursive: true });
        await page.locator(root).screenshot({ path: join(SHOTS, `${file}.png`) });
      },
    };
    for (const page of pages) await page(h);

    // A connection the server dropped while a page loaded is retried in open(); one dropped later, during the checks,
    // still fails here: rerun on a quieter machine.
    line("no CSP violation, console error or page error", !reported.length, reported.join("; "));
  } catch (e) {
    console.log(`chartfit stopped: ${e.message.split("\n")[0]}${late.length ? `; the demo server had dropped ${late.join(", ")}` : ""}`);
    failed = true;
  } finally {
    await b?.close();
    stop();
    rmSync(dir, { recursive: true, force: true });
  }
  process.exit(failed ? 1 : 0);
}
