// Checks in a real browser that the Errors type table's cells hold their widest figures at 1280px, at a mid width and on a phone.
// The jsdom tests cannot lay a page out; this can. It needs the demo server and the pinned Playwright:
//   cd web && npm ci && npm run build;  cd tools/demo && npm ci && uv run seed.py && uv run serve.py   (DEMO_PORT moves it)
//   node typefit.mjs        exits 1, naming the cell and the element, when a figure spills out of its cell or the table scrolls sideways
// The demo store's figures are modest, so the first row is given the widest ones the page can show (1,000,000 errors at 100.00%,
// a 100% share, 23h 59m lost, 100% not recovered, a ▲ +1,000% change) before the cells are measured.
// CHROMIUM=<path> uses that Chromium instead of Playwright's own.
import { chromium } from "playwright";

const PORT = Number(process.env.DEMO_PORT || 8799);
const BASE = `http://127.0.0.1:${PORT}`;
const WIDTHS = [1280, 1000, 390];

const b = await chromium.launch({ executablePath: process.env.CHROMIUM });
let failed = false;
try {
  for (const width of WIDTHS) {
    const page = await (await b.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" })).newPage();
    await page.goto(`${BASE}/errors?range=30`);
    await page.waitForSelector("#catBody tr[data-c]");
    const out = await page.evaluate(() => {
      const row = document.querySelector("#catBody tr[data-c]");
      const set = (sel, text) => { const el = row.querySelector(sel); if (el) el.textContent = text; };
      row.querySelector(".c-count").innerHTML = "1,<wbr>000,<wbr>000"; // as the page writes a count: breakable after each separator
      set(".c-rate", "100.00%"); set(".c-share > span", "100%");
      set(".c-lost .l1", "23h 59m"); set(".c-unrec", "100% not recovered"); set(".c-change .tt", "▲ +1,000%");
      const bad = [];
      for (const td of row.querySelectorAll('td, th[scope="row"]')) {
        const box = td.getBoundingClientRect();
        for (const el of td.querySelectorAll("*")) {
          // Screen-reader text is clipped to a pixel, and an SVG's shapes sit inside its own box.
          if (el.closest(".sr, svg *") || getComputedStyle(el).display === "none") continue;
          const r = el.getBoundingClientRect();
          if (r.width && (r.right > box.right + .5 || r.left < box.left - .5)) bad.push(`${td.className} .${el.getAttribute("class") || el.tagName}:${Math.round(r.left - box.left)}..${Math.round(r.right - box.left)}px of ${Math.round(box.width)}px`);
        }
      }
      const scroll = document.querySelector(".types .tscroll");
      if (scroll.scrollWidth > scroll.clientWidth + 1) bad.push(`the table scrolls sideways: ${scroll.scrollWidth}px in ${scroll.clientWidth}px`);
      return bad;
    });
    console.log(`${width}px: ${out.length ? "SPILLS\n  " + out.join("\n  ") : "ok"}`);
    failed ||= out.length > 0;
    await page.context().close();
  }
} finally {
  await b.close();
}
process.exit(failed ? 1 : 0);
