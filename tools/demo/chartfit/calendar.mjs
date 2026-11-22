// Activity's calendar on /usage?range=30, by the Commits measure, its own checks: the calendar has no band, no x axis and no
// zoom, so none of checks.mjs' shared blocks fits it. The demo store holds 75 days, 11 weeks. Every page but one gets
// /api/calendar carried back over the 53 weeks (each day takes the figures of the store's day as many days back, modulo the
// store's span, and recording starts 53 weeks back), so every week has work and the calendar shows all the weeks that fit.
// The page "the store's own payload" gets the server's answer as it is, so the calendar shows 13 weeks. Every line but
// that page's is on the payload carried back. It checks:
// - at 1440px, 53 columns; in a 343px box, 26; at a 375px window the page does not scroll sideways, and at 1280px with a
//   32px root nothing of the calendar reaches past the window (the nav does there: its defect, not the calendar's);
// - the cells drawn are the readable days: every day of the weeks shown up to today;
// - with the store's own payload: a cell for each day from its first recorded one to today, none before; the hint says "last 13
//   weeks"; 13 columns laid out, measured from the Mon label (which ends 6px before the first column) to the newest cell,
//   by the pitch, since the cells drawn cannot show empty columns; the leading columns before the first recorded week hold
//   no cell; the first cell is in the model's column and row; the block starts at the 30px left margin; the month labels
//   name only months of the weeks shown; the key says "Recording starts" with the first day; the data table has 13 week
//   rows; Home reads the first recorded day and End today;
// - each cell is drawn in its step's key color, in light, in dark and after an OS flip with no reload; each shade has 1.3:1
//   with the next and the first with the empty cell, by the page's computed colors, in both themes;
// - forced colors: the steps are CanvasText squares whose sides grow with the step, an empty day is an unfilled square with
//   a GrayText edge, the labels are CanvasText, the frame and the ring Highlight; the key's swatches paint (by the pixels of
//   a screenshot): a filled square of 3, 5, 8 and 10px, the cells' proportions, and the empty one unfilled with an edge;
// - the weekday and month labels by their real widths, at 16px and 32px text, in a 343px box and on desktop: none
//   overlapping, none outside the box; at 32px they are twice as large and the desktop cells keep their size;
// - before the first payload the section shows its heading and "Loading the calendar…", and nothing above it moves when the
//   grid replaces the line;
// - a pointer move over a cell shows that day in the tooltip with the ring within 1px of the drawn cell; the gap beside and
//   under it reads the same day, the margin nothing; the cursor is a hand over a cell, not over the margin;
// - Right, Left, Down, Up, Home and End read the days of decision 6's table, the ring within 1px of each drawn cell; Up and
//   Down do not move the page;
// - a real click on a busy day inside the range: the calendar takes the focus, then the tab panel; the URL gets day= and
//   keeps the range; the tab list is in view, under the sticky bars; the status is in the calendar's live region; outside
//   the range the URL gets the range, then the day, the status names the range, and Back restores the earlier range;
// - in a 343px box the tooltip of a busy day outside the range is no wider than the box and inside it, its long sentence
//   wraps, its figures keep a line each, and the page does not scroll sideways;
// - a touch tap in a 343px box selects a day;
// - Escape with the focus on another control closes a tooltip the pointer opened, also an Escape the moment it shows (once
//   the observer marks that it saw the tooltip open and sent the Escape);
// - newer figures keep the day read with the keys, and say nothing; with motion on no cell animates, on the first drawing,
//   on newer figures or on a theme change;
// - after a filter change answered 500: "Could not load the calendar (…)." with Retry, and the kept calendar takes no pick;
//   while Retry runs it reads "Retrying…" and looks unavailable; its answer draws the new calendar with the focus on it.
import { inflateSync } from "node:zlib";
import { LOCALE, PHONE, line, sleep, until } from "./harness.mjs";
import { root32 } from "./checks.mjs";

const ROOT = "#calendar", BOX = `${ROOT} .echart`, DATA = /\/api\/calendar(\?|$)/;
const at = k => Date.parse(k + "T00:00:00Z");
const plus = (k, n) => new Date(at(k) + n * 864e5).toISOString().slice(0, 10);
const between = (a, b) => Math.round((at(b) - at(a)) / 864e5);
const monday = k => plus(k, -((new Date(at(k)).getUTCDay() + 6) % 7));
const span = (a, b) => { const out = []; for (let k = a; k <= b; k = plus(k, 1)) out.push(k); return out; };
/** "Nov 4, 2026", and "Wednesday, Nov 4, 2026", as the calendar words a day. */
const dayLong = k => new Date(at(k)).toLocaleDateString(LOCALE, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const dayName = k => `${new Date(at(k)).toLocaleDateString(LOCALE, { weekday: "long", timeZone: "UTC" })}, ${dayLong(k)}`;
const px = n => `${Math.round(n * 10) / 10}px`;

/** The store's days carried back over the 53 weeks: a day takes the figures of the store's day as many days back from today,
 *  modulo the store's span. Recording then starts with the payload's first Monday. */
const carried = d => {
  if (!d.first) return d;
  const L = between(d.first, d.end) + 1, have = new Map(d.days.map(r => [r.day, r]));
  const days = span(d.start, d.end).flatMap(k => {
    const r = have.get(plus(d.end, -(between(k, d.end) % L)));
    return r ? [{ ...r, day: k }] : [];
  });
  return { ...d, first: d.start, days };
};
/** The Commits measure, as the work chart's switch keeps it. */
const commits = () => { try { localStorage.setItem("claude-activity-metric", "commits"); } catch { /* storage off */ } };

/** The calendar's readers, as window.cal, for the calendar under #calendar. ECharts' SVG names no element: a cell is a
 *  square path, filled, or (an empty day under forced colors) unfilled with an edge under 1.5px; the selection's frame is
 *  unfilled with a line of 1.5px or more; the labels are its texts. The ring, the tooltip, the live region and the key are
 *  the component's HTML. This function runs in the page: it uses nothing from this module. */
function calReaders() {
  const R = "#calendar";
  const tri = c => (String(c).match(/[\d.]+/g) || []).slice(0, 3).map(n => Math.round(Number(n))).join(",");
  const rect = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const $ = s => document.querySelector(`${R} ${s}`);
  const shown = e => !!e && getComputedStyle(e).display !== "none";
  const paths = () => [...($(".echart-plot svg")?.querySelectorAll("path") ?? [])].map(e => ({
    fill: e.getAttribute("fill") ?? "none", stroke: e.getAttribute("stroke") ?? "none", width: Number(e.getAttribute("stroke-width") ?? 1),
    look: [e.getAttribute("opacity"), e.getAttribute("fill-opacity"), e.getAttribute("transform")].join(" "), ...rect(e) }));
  const square = p => p.w > 0 && Math.abs(p.w - p.h) < .5;
  window.cal = {
    cells: () => paths().filter(p => square(p) && (p.fill !== "none" || (p.stroke !== "none" && p.width < 1.5)))
      .map(p => ({ ...p, fill: p.fill === "none" ? "none" : tri(p.fill), stroke: p.stroke === "none" ? "none" : tri(p.stroke), x: (p.l + p.r) / 2, y: (p.t + p.b) / 2 })),
    frame: () => {
      const p = paths().find(p => p.fill === "none" && p.stroke !== "none" && p.width >= 1.5);
      return p ? { ...p, stroke: tri(p.stroke) } : null;
    },
    ring: () => { const e = $(".cal-box .cal-cursor"); return shown(e) ? { color: tri(getComputedStyle(e).outlineColor), ...rect(e) } : null; },
    tip: () => { const e = $(".cal-box .tip"); return shown(e) ? { day: e.querySelector(".muted")?.textContent ?? "", ...rect(e) } : null; },
    live: () => $(".cal-live")?.textContent ?? "",
    swatches: () => [...document.querySelectorAll(`${R} .legend .cal-sw`)].map(e => ({ shade: Number(e.dataset.shade), name: e.parentElement.textContent.trim(),
      color: tri(getComputedStyle(e).backgroundColor), ...rect(e) })),
    texts: () => [...($(".echart-plot svg")?.querySelectorAll("text") ?? [])].map(e => ({ text: e.textContent, fill: tri(e.getAttribute("fill")),
      size: parseFloat(getComputedStyle(e).fontSize), ...rect(e) })),
    box: () => { const e = $(".echart"); return e ? rect(e) : null; },
    /** The sticky bars' bottom: the nav and the scope bar under it. */
    bars: () => Math.max(...[...document.querySelectorAll(".appnav, .scopebar")].map(e => e.getBoundingClientRect().bottom)),
    /** The page's scroll width, the window's, and how far right the calendar's section or anything in it reaches. */
    sideways: () => ({ width: document.documentElement.scrollWidth, window: innerWidth,
      calendar: Math.max(...[...document.querySelectorAll(`${R}, ${R} *`)].map(e => e.getBoundingClientRect().right)) }),
  };
  // What the page focused, in order, by id.
  window.__focused = [];
  addEventListener("focusin", e => window.__focused.push(e.target.id || e.target.className || e.target.tagName), true);
}

/** What every page runs before its scripts: the measure, then the readers. Both run in the page, by their source. */
const SETUP = { content: `(${commits})(); (${calReaders})();` };

/** A PNG screenshot's pixels: 8-bit RGB or RGBA, not interlaced, as Chromium writes them. */
function png(buf) {
  let w = 0, h = 0, bpp = 4;
  const idat = [];
  for (let i = 8; i < buf.length;) {
    const len = buf.readUInt32BE(i), type = buf.toString("ascii", i + 4, i + 8), data = buf.subarray(i + 8, i + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bpp = data[9] === 6 ? 4 : 3; }
    if (type === "IDAT") idat.push(data);
    i += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      out[y * stride + x] = (row[x] + pred) & 255;
    }
  }
  return { w, h, at: (x, y) => [...out.subarray(y * stride + x * bpp, y * stride + x * bpp + 3)] };
}
const rgb = s => s.split(",").map(Number);
/** How much of a pixel is ink over the ground: 0 the ground's color, 1 the ink's. */
const share = (p, ink, ground) => {
  const d = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
  return Math.max(0, Math.min(1, d(p, ground) / d(ink, ground)));
};

/** The day each drawn cell stands for, by its centre: the newest column is today's week, the top row Monday. */
const placed = (cells, end) => {
  const uniq = v => [...new Set(v.map(n => Math.round(n * 2) / 2))].sort((a, b) => a - b);
  const xs = uniq(cells.map(c => c.x)), ys = uniq(cells.map(c => c.y));
  const pitch = Math.min(...[...xs.slice(1).map((x, i) => x - xs[i]), ...ys.slice(1).map((y, i) => y - ys[i])]);
  const last = xs.at(-1), top = ys[0];
  return { columns: xs.length, pitch, cells: cells.map(c => ({ ...c, day: plus(monday(end), -7 * Math.round((last - c.x) / pitch) + Math.round((c.y - top) / pitch)) })) };
};
/** The steps of the key, from its swatches' numbers: "1–2", "9+", "3". */
const stepsOf = swatches => swatches.filter(s => s.shade).map(s => {
  const m = /^([\d,]+)(?:(\+)|–([\d,]+))?$/.exec(s.name), n = v => Number(v.replace(/,/g, ""));
  return m ? { shade: s.shade, color: s.color, from: n(m[1]), to: m[2] ? Infinity : m[3] ? n(m[3]) : n(m[1]) } : { shade: s.shade, color: s.color, from: NaN, to: NaN };
});
const shadeOf = (steps, v) => (v > 0 ? steps.find(s => v >= s.from && v <= s.to)?.shade ?? -1 : 0);

/** Texts that leave the box, and pairs that overlap by their em boxes, as checks.mjs reads axis labels. */
const fitOf = (texts, box) => {
  const em = t => ({ ...t, t: (t.t + t.b - t.size) / 2, b: (t.t + t.b + t.size) / 2 });
  const where = t => `"${t.text}" ${Math.round(t.l - box.l)}..${Math.round(t.r - box.l)}x${Math.round(t.t - box.t)}..${Math.round(t.b - box.t)}px`;
  const out = texts.filter(t => t.l < box.l - .5 || t.r > box.r + .5 || t.t < box.t - .5 || t.b > box.b + .5).map(where);
  const over = [];
  texts.map(em).forEach((a, i, all) => all.slice(i + 1).forEach(c => { if (a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b) over.push(`${where(a)} and ${where(c)}`); }));
  return { out, over };
};

export async function calendar(h) {
  const own = await h.json("/api/calendar"), CAL = carried(own), END = CAL.end;
  const row = new Map(CAL.days.map(r => [r.day, r])), value = k => row.get(k)?.commits ?? 0;
  const busy = k => { const r = row.get(k); return !!r && (r.sessions || r.prompts || r.commits || r.failed_calls); };
  // The days read: a busy day with commits in the range (D1), one outside it that a 90-day range holds (D2).
  const D1 = span(plus(END, -20), plus(END, -8)).find(k => busy(k) && value(k) > 0);
  const D2 = span(plus(END, -70), plus(END, -40)).find(k => busy(k) && value(k) > 0);
  if (!D1 || !D2) throw new Error("calendar: the demo store has no day with commits to read");

  const ev = (page, f, arg) => page.evaluate(f, arg);
  const cells = page => ev(page, () => window.cal.cells());
  const where = async page => placed(await cells(page), END);
  const open = ({ path = "/usage?range=30", answer = carried, name, options = {}, init = null, ready = null }) => h.open({
    path, root: ROOT, setup: SETUP, data: DATA, answer,
    ready: ready ?? (async page => {
      await page.waitForFunction(() => window.cal.cells().length > 0);
      await page.locator(ROOT).scrollIntoViewIfNeeded();
    }),
  }, `calendar ${name}`, options, init);
  const shot = (page, what) => h.shot(page, ROOT, `calendar-${what}`);
  const theme = async (page, want) => {
    for (let i = 0; i < 3 && (await page.locator("#navTheme").getAttribute("aria-label")) !== `Theme: ${want}`; i++) await page.locator("#navTheme").click();
  };
  const cellOf = (got, k) => got.cells.find(c => c.day === k);
  /** Whether the ring is on the drawn cell of day k, within 1px on each edge. */
  const ringOn = (ring, c) => !!ring && !!c && Math.abs(ring.l - c.l) <= 1 && Math.abs(ring.t - c.t) <= 1 && Math.abs(ring.r - c.r) <= 1 && Math.abs(ring.b - c.b) <= 1;
  const reading = page => ev(page, () => ({ tip: window.cal.tip(), ring: window.cal.ring(), live: window.cal.live() }));
  const away = page => page.mouse.move(2, 898);

  // Layout: the columns, the readable days, the labels at 16px, at 1440px and in a 343px box.
  for (const [what, options, weeks] of [["at 1440px", {}, 53], ["in a 343px box", { viewport: { width: PHONE, height: 900 } }, 26]]) {
    const page = await open({ name: what, options });
    const got = await where(page), box = await ev(page, () => window.cal.box());
    line(`${what} (${Math.round(box.w)}px box): ${weeks} columns`, got.columns === weeks, `${got.columns} columns, pitch ${px(got.pitch)}`);
    const want = span(plus(monday(END), -7 * (weeks - 1)), END), days = got.cells.map(c => c.day);
    const extra = days.filter(k => !want.includes(k)), missing = want.filter(k => !days.includes(k));
    line(`${what}: the cells drawn are the readable days, Monday of the first week shown to today`, !extra.length && !missing.length && days.length === new Set(days).size,
      `${days.length} cells for ${want.length} days${extra.length ? `; not readable: ${extra.join(", ")}` : ""}${missing.length ? `; missing: ${missing.join(", ")}` : ""}`);
    const texts = await ev(page, () => window.cal.texts()), { out, over } = fitOf(texts, box);
    line(`${what}, 16px text: the weekday and month labels are inside the box and apart, by their real widths`, texts.length > 3 && !out.length && !over.length,
      [...out.map(x => `out: ${x}`), ...over.map(x => `overlap: ${x}`)].join("; ") || `${texts.length} labels: ${texts.map(t => t.text).join(" ")}`);
    await shot(page, what === "at 1440px" ? "light" : "343px");
    await page.done();
  }
  {
    const page = await open({ name: "the store's own payload", answer: null });
    const got = await where(page), days = got.cells.map(c => c.day), want = span(own.first, END);
    line(`the store's own payload: a cell for each day from the first recorded one, ${dayLong(own.first)}, to today, and none before`,
      days.length === want.length && want.every(k => days.includes(k)) && !days.some(k => k < own.first || k > END),
      `${days.length} cells for ${want.length} days, first ${days.sort()[0]}, last ${days.at(-1)}`);
    // The weeks of decision 2: from the first recorded day's week to this week, at least 13. The demo store's 11 weeks show 13,
    // so the leading columns hold no cell, and the cells do not tell how many columns there are: the block's start is read
    // from the Mon label, which ends 6px before the first column, and its end from the newest cell, which is in the last.
    const recorded = between(monday(own.first), monday(END)) / 7 + 1, weeks = Math.max(13, recorded);
    const from = plus(monday(END), -7 * (weeks - 1)), col = Math.floor(between(from, own.first) / 7), row = between(from, own.first) % 7;
    const { hint, legend, box, texts } = await ev(page, () => ({ hint: document.querySelector("#calendar p.hint")?.textContent ?? "",
      legend: [...document.querySelectorAll("#calendar .legend .key")].map(e => e.textContent), box: window.cal.box(), texts: window.cal.texts() }));
    line(`the store's own payload: the hint names the weeks shown, "last ${weeks} weeks"`, hint.includes(`, last ${weeks} weeks.`), `"${hint.split(".")[0]}."`);
    const mon = texts.find(t => t.text === "Mon"), cell = got.cells[0]?.w ?? NaN, gap = got.pitch - cell;
    const left = (mon?.r ?? NaN) + 6, newest = Math.max(...got.cells.map(c => c.r));
    const laid = (newest + gap - left) / got.pitch;
    line(`the store's own payload (${recorded} weeks recorded): ${weeks} columns laid out, by the box and the pitch`, Math.abs(laid - weeks) < .1,
      `${laid.toFixed(2)} columns of ${px(got.pitch)} from ${px(left - box.l)} to ${px(newest + gap - box.l)}; ${got.columns} of them drawn`);
    const early = got.cells.filter(c => c.l < left + col * got.pitch - .5);
    line(`the store's own payload: the ${col} leading columns, before the first recorded week, hold no cell`, !early.length,
      early.length ? `${early.length} cells there, first ${early[0].day}` : `none left of ${px(left + col * got.pitch - box.l)}`);
    const c0 = got.cells.find(c => c.day === own.first);
    const placedRight = !!c0 && Math.abs(c0.l - (left + col * got.pitch)) <= .5 && Math.abs(c0.t - (mon.t + mon.b) / 2 - row * got.pitch + cell / 2) <= 1;
    line(`the store's own payload: ${dayLong(own.first)} sits in column ${col + 1} of ${weeks}, row ${row + 1}, as the model gives`, placedRight,
      c0 ? `cell at ${px(c0.l - box.l)},${px(c0.t - box.t)}, column ${((c0.l - left) / got.pitch + 1).toFixed(2)}` : "no cell");
    line("the store's own payload: the block starts at the left margin, 30px from the box's left", Math.abs(left - box.l - 30) <= .5, `first column at ${px(left - box.l)}`);
    const names = new Set(Array.from({ length: weeks }, (_, i) => new Date(at(plus(from, 7 * i))).toLocaleDateString(LOCALE, { month: "short", timeZone: "UTC" })));
    const months = texts.filter(t => !["Mon", "Wed", "Fri"].includes(t.text)).map(t => t.text);
    line(`the store's own payload: the month labels name only months of the weeks shown (${[...names].join(", ")})`, months.length > 0 && months.every(n => names.has(n)),
      months.join(" ") || "no month label");
    const starts = `Recording starts ${dayLong(own.first)}`;
    line(`the store's own payload: the key says "${starts}"`, legend.includes(starts), legend.join(" | "));
    await page.locator(`${ROOT} .chart-table button`).click();
    const weekRows = await until(() => ev(page, () => document.querySelectorAll("#calendar .chart-table tbody tr").length), n => n > 0);
    line(`the store's own payload: the data table has ${weeks} week rows`, weekRows === weeks, `${weekRows} rows`);
    await page.locator(`${ROOT} .chart-table button`).click();
    await away(page);
    await page.locator(BOX).focus();
    const keyed = [];
    for (const [key, k] of [["Home", own.first], ["End", END]]) {
      await page.keyboard.press(key);
      const r = await until(() => reading(page), r => r.tip?.day === dayName(k) && ringOn(r.ring, cellOf(got, k)));
      keyed.push({ key, k, ok: r.tip?.day === dayName(k) && ringOn(r.ring, cellOf(got, k)), tip: r.tip?.day ?? "none" });
    }
    line(`the store's own payload: Home reads the first recorded day, ${dayLong(own.first)}, and End today`, keyed.every(x => x.ok),
      keyed.map(x => `${x.key}: "${x.tip}"`).join(", "));
    await page.done();
  }
  for (const [what, width] of [["a 375px window", 375], ["a 1280px window at 32px text", 1280]]) {
    const page = await open({ name: what, options: { viewport: { width, height: 900 } }, init: width === 1280 ? root32 : null });
    const s = await ev(page, () => window.cal.sideways());
    // At 1280px with 32px text the nav's right end (the refresh state and the theme button) passes the window: a defect of
    // the nav, not the calendar's, so the line there is the calendar's own reach.
    if (width === 375) line(`${what}: the page does not scroll sideways`, s.width <= s.window, `scroll width ${s.width}px in ${s.window}px; the calendar reaches ${px(s.calendar)}`);
    else line(`${what}: nothing of the calendar reaches past the window`, s.calendar <= s.window, `the calendar reaches ${px(s.calendar)} of ${s.window}px`);
    await page.done();
  }
  {
    let cell16 = null;
    for (const [what, options] of [["1440px", {}], ["a 343px box", { viewport: { width: PHONE, height: 900 } }]]) {
      if (!cell16) cell16 = await (async () => { const p = await open({ name: "16px cells" }); const c = (await cells(p))[0]; await p.done(); return c?.w ?? NaN; })();
      const page = await open({ name: `32px text, ${what}`, options, init: root32 });
      const { texts, box } = await ev(page, () => ({ texts: window.cal.texts(), box: window.cal.box() }));
      const { out, over } = fitOf(texts, box), size = Math.max(...texts.map(t => t.size));
      line(`32px text, ${what}: the labels are drawn at twice their size, inside the box and apart, by their real widths`, size === 22 && texts.length > 3 && !out.length && !over.length,
        [`labels ${size}px`, ...out.map(x => `out: ${x}`), ...over.map(x => `overlap: ${x}`)].join("; ") + (out.length || over.length ? "" : `, ${texts.length} labels: ${texts.map(t => t.text).join(" ")}`));
      if (what === "1440px") {
        const side = (await cells(page))[0]?.w ?? NaN;
        line("32px text, 1440px: the cells keep their size", Math.abs(side - cell16) < .5, `${px(side)} cells, ${px(cell16)} at 16px`);
        await shot(page, "text-32px");
      }
      await page.done();
    }
  }

  // Colors: each cell in its step's key color, in light, dark and an OS flip; the shades' contrast.
  {
    const page = await open({ name: "colors" });
    await ev(page, () => { window.__kept = true; });
    const colors = () => ev(page, () => ({ cells: window.cal.cells(), swatches: window.cal.swatches(),
      tokens: [1, 2, 3, 4].map(n => window.chartfit.probe(`var(--heat-${n})`)), grid: window.chartfit.probe("var(--grid)") }));
    /** Whether each cell is drawn in its step's swatch color (the empty one's for none), and each swatch's color is drawn. */
    const drawnRight = c => {
      const steps = stepsOf(c.swatches), empty = c.swatches.find(s => !s.shade);
      const got = placed(c.cells, END).cells, wrong = got.filter(x => {
        const s = shadeOf(steps, value(x.day));
        return x.fill !== (s ? steps.find(t => t.shade === s)?.color : empty?.color);
      });
      const fills = new Set(got.map(x => x.fill)), unseen = c.swatches.filter(s => !fills.has(s.color));
      const tokens = steps.every(s => s.color === c.tokens[s.shade - 1]) && empty?.color === c.grid;
      return { ok: got.length > 0 && steps.length > 0 && !wrong.length && !unseen.length && tokens, steps, empty,
        at: `${c.swatches.map(s => `${s.name} rgb(${s.color})`).join(", ")}${wrong.length ? `; ${wrong.length} cells off their step, first ${wrong[0].day} rgb(${wrong[0].fill})` : ""}`
          + `${unseen.length ? `; not drawn: ${unseen.map(s => s.name).join(", ")}` : ""}${tokens ? "" : "; a swatch is not its token's color"}` };
    };
    const contrast = (c, scheme) => ev(page, ({ tokens, grid }) => [
      ...tokens.slice(1).map((t, i) => [`--heat-${i + 1}:--heat-${i + 2}`, window.chartfit.contrast(tokens[i], t)]),
      ["--grid:--heat-1", window.chartfit.contrast(grid, tokens[0])]], c).then(r => line(
      `${scheme}: each shade has 1.3:1 with the next, and the first with the empty cell`, r.every(([, x]) => x >= 1.3), r.map(([k, x]) => `${k} ${x.toFixed(2)}`).join(", ")));
    await theme(page, "light");
    const light = await until(colors, c => drawnRight(c).ok), l = drawnRight(light);
    line("light: each cell is drawn in its step's key color, and each key swatch's color is drawn", l.ok, l.at);
    await contrast(light, "light");
    await theme(page, "dark");
    const dark = await until(colors, c => drawnRight(c).ok && c.tokens[0] !== light.tokens[0]), dk = drawnRight(dark);
    line("dark: each cell is drawn in its step's key color, each swatch's color is drawn, and differs from light", dk.ok && dark.tokens[0] !== light.tokens[0], dk.at);
    await contrast(dark, "dark");
    await shot(page, "dark");
    await theme(page, "system");
    const like = want => c => drawnRight(c).ok && c.tokens.join() === want.tokens.join();
    const sys = await until(colors, like(light));
    await page.emulateMedia({ colorScheme: "dark" });
    const flipped = await until(colors, like(dark));
    await page.emulateMedia({ colorScheme: "light" });
    const back = await until(colors, like(light)), kept = await ev(page, () => window.__kept === true);
    line("System: an OS dark flip and back redraws the cells in each scheme's colors, with no reload", like(light)(sys) && like(dark)(flipped) && like(light)(back) && kept,
      `OS dark --heat-1 rgb(${flipped.tokens[0]}), light rgb(${back.tokens[0]}); ${kept ? "no reload" : "RELOADED"}`);
    await page.done();
  }

  // Forced colors, with D1 selected.
  {
    const page = await open({ name: "forced colors", path: `/usage?range=30&day=${D1}`, options: { forcedColors: "active" } });
    const sys = await ev(page, () => Object.fromEntries(["CanvasText", "Canvas", "GrayText", "Highlight"].map(c => [c, window.chartfit.probe(c)])));
    const got = await where(page), swatches = await ev(page, () => window.cal.swatches()), steps = stepsOf(swatches);
    const sides = new Map();
    for (const c of got.cells) {
      const s = shadeOf(steps, value(c.day));
      if (s > 0) sides.set(s, [...(sides.get(s) ?? []), c]);
    }
    const bySide = [...sides].sort(([a], [b]) => a - b).map(([s, cs]) => ({ s, sides: [...new Set(cs.map(c => Math.round(c.w * 2) / 2))], ink: cs.every(c => c.fill === sys.CanvasText) }));
    line("forced colors: each step is a CanvasText square, one side per step, the sides growing with the step",
      bySide.length > 1 && bySide.every(x => x.ink && x.sides.length === 1) && bySide.every((x, i) => !i || x.sides[0] > bySide[i - 1].sides[0]),
      `${bySide.map(x => `step shade ${x.s}: ${x.sides.map(px).join("/")}${x.ink ? "" : " NOT CanvasText"}`).join(", ")}; CanvasText rgb(${sys.CanvasText})`);
    const empty = got.cells.filter(c => !value(c.day));
    line("forced colors: an empty day is an unfilled square with a GrayText edge", empty.length > 0 && empty.every(c => c.fill === "none" && c.stroke === sys.GrayText),
      `${empty.length} empty days${empty[0] ? `, fill ${empty[0].fill}, edge rgb(${empty[0].stroke}), GrayText rgb(${sys.GrayText})` : ""}`);
    const texts = await ev(page, () => window.cal.texts()), off = texts.filter(t => t.fill !== sys.CanvasText);
    line("forced colors: the labels are CanvasText", texts.length > 0 && !off.length, off.map(t => `"${t.text}" rgb(${t.fill})`).join(", ") || `${texts.length} labels`);
    const frame = await ev(page, () => window.cal.frame());
    line(`forced colors: the selected day's frame is Highlight`, frame?.stroke === sys.Highlight, frame ? `rgb(${frame.stroke}) ${frame.width}px, Highlight rgb(${sys.Highlight})` : "no frame");
    await page.locator(BOX).focus();
    await page.keyboard.press("End");
    const ring = await until(() => ev(page, () => window.cal.ring()), r => r);
    line("forced colors: the ring around the day read is Highlight", ring?.color === sys.Highlight, ring ? `rgb(${ring.color})` : "no ring");
    await page.keyboard.press("Escape");
    // The key's swatches, by the pixels of a screenshot: CanvasText squares of 3, 5, 8 and 10px for shades 1 to 4, the
    // cells' squares of a 10px cell, and the empty one unfilled, with a GrayText edge.
    const shots = [];
    for (const s of swatches) {
      const clip = { x: Math.floor(s.l) - 2, y: Math.floor(s.t) - 2, width: Math.ceil(s.w) + 4, height: Math.ceil(s.h) + 4 };
      const img = png(await page.screenshot({ clip }));
      const ground = rgb(sys.Canvas);
      let ink = 0, edge = 0, inner = 0;
      for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
        const p = img.at(x, y);
        ink += share(p, rgb(sys.CanvasText), ground);
        const g = share(p, rgb(sys.GrayText), ground);
        edge += g;
        if (x >= 5 && x < img.w - 5 && y >= 5 && y < img.h - 5) inner = Math.max(inner, g);
      }
      shots.push({ shade: s.shade, side: Math.sqrt(ink), edge, inner, box: `${px(s.w)}` });
    }
    const want = s => Math.max(3, Math.round(10 * s / 4));
    const bad = shots.filter(x => (x.shade ? Math.abs(x.side - want(x.shade)) > .75 : !(x.inner < .2 && x.edge >= 28)));
    line("forced colors: each key swatch paints a CanvasText square of its step's size (3, 5, 8, 10px), the empty one unfilled with an edge",
      shots.length > 1 && shots.some(x => !x.shade) && !bad.length,
      shots.map(x => (x.shade ? `shade ${x.shade}: ${px(x.side)} square of ${want(x.shade)}px` : `empty: edge ${x.edge.toFixed(0)}px of ink, inside ${x.inner.toFixed(2)}`)).join(", "));
    await shot(page, "forced-colors");
    await page.done();
  }

  // Before the first payload: the heading and the loading line; the grid replaces it with nothing above moving.
  {
    let release;
    const gate = new Promise(r => { release = r; });
    const page = await open({ name: "loading", answer: async j => { await gate; return carried(j); },
      ready: page => page.waitForFunction(() => document.querySelector("#calendar")?.textContent.includes("Loading the calendar…")) });
    const tops = () => ev(page, () => {
      const cal = document.querySelector("#calendar"), main = cal.parentElement, out = [];
      for (const e of main.children) { if (e === cal) break; out.push([e.id || e.className, Math.round((e.getBoundingClientRect().top + scrollY) * 2) / 2]); }
      return { heading: cal.querySelector("h2")?.textContent ?? "", line: cal.querySelector("p.empty")?.textContent ?? "", above: out, top: cal.getBoundingClientRect().top + scrollY };
    });
    // The page at rest first: the Sessions tab's list loads on its own, and moves the section when it does.
    let before = await tops();
    for (const end = Date.now() + 6000; Date.now() < end; await sleep(100)) {
      await sleep(600);
      const now = await tops();
      if (JSON.stringify(now) === JSON.stringify(before)) break;
      before = now;
    }
    line("before the first payload the section shows its heading and \"Loading the calendar…\"", before.heading === "Activity calendar" && before.line === "Loading the calendar…",
      `heading "${before.heading}", "${before.line}"`);
    release();
    await page.waitForFunction(() => window.cal.cells().length > 0);
    const after = await tops(), moved = after.above.filter(([k, t], i) => before.above[i]?.[0] !== k || Math.abs(before.above[i][1] - t) > .5);
    line("the grid replaces the loading line, and nothing above the section moves", !moved.length && Math.abs(after.top - before.top) <= .5,
      moved.map(([k, t]) => `${k} at ${t}px`).join(", ") || `${after.above.length} blocks above kept; the section at ${Math.round(after.top)}px`);
    await page.done();
  }

  // The pointer and the keys, at 1440px.
  {
    const page = await open({ name: "reading" });
    await away(page);
    const got = await where(page), c1 = cellOf(got, D1), gap = got.pitch - c1.w;
    const hover = async (x, y) => { await page.mouse.move(x, y); await sleep(80); return reading(page); };
    const onCell = await until(async () => { await page.mouse.move(c1.x, c1.y); return reading(page); }, r => r.tip?.day === dayName(D1) && ringOn(r.ring, c1));
    line(`pointer over ${dayLong(D1)}: the tooltip names it, the ring within 1px of its drawn cell`, onCell.tip?.day === dayName(D1) && ringOn(onCell.ring, c1),
      `tooltip "${onCell.tip?.day ?? "none"}"; ring ${onCell.ring ? `${px(onCell.ring.l)},${px(onCell.ring.t)} ${px(onCell.ring.w)}` : "none"}, cell ${px(c1.l)},${px(c1.t)} ${px(c1.w)}`);
    await shot(page, "tooltip");
    const hand = await ev(page, ([x, y]) => getComputedStyle(document.elementFromPoint(x, y)).cursor, [c1.x, c1.y]);
    const right = await hover(c1.r + gap / 2, c1.y), below = await hover(c1.x, c1.b + gap / 2);
    line(`the gap right of the cell and under it reads the same day`, right.tip?.day === dayName(D1) && below.tip?.day === dayName(D1),
      `${px(gap)} gap: right "${right.tip?.day ?? "none"}", under "${below.tip?.day ?? "none"}"`);
    const box = await ev(page, () => window.cal.box()), m = [box.l + 6, c1.y];
    const margin = await until(() => hover(...m), r => !r.tip && !r.ring);
    const notHand = await ev(page, ([x, y]) => getComputedStyle(document.elementFromPoint(x, y)).cursor, m);
    line("the margin left of the cells reads nothing", !margin.tip && !margin.ring, `tooltip ${margin.tip ? `"${margin.tip.day}"` : "none"}, ring ${margin.ring ? "drawn" : "none"}`);
    line("the cursor is a hand over a cell, not over the margin", hand === "pointer" && notHand !== "pointer", `over a cell: ${hand}; over the margin: ${notHand}`);

    // Decision 6's keys, from nothing read.
    await away(page);
    await page.locator(BOX).focus();
    const first = got.cells.map(c => c.day).sort()[0];
    const path = [["ArrowRight", first], ["ArrowRight", plus(first, 7)], ["ArrowDown", plus(first, 8)], ["ArrowUp", plus(first, 7)], ["ArrowLeft", first], ["ArrowLeft", first],
      ["End", END], ["ArrowRight", END], ["Home", first], ["Escape", null], ["ArrowLeft", END], ["ArrowUp", plus(END, -1)], ["Escape", null], ["ArrowUp", END], ["Escape", null], ["ArrowDown", first]];
    const wrong = [];
    for (const [key, k] of path) {
      await page.keyboard.press(key);
      const want = r => (k ? r.tip?.day === dayName(k) && r.live.startsWith(dayName(k)) && ringOn(r.ring, cellOf(got, k)) : !r.tip && !r.ring);
      const r = await until(() => reading(page), want);
      if (!want(r)) wrong.push(`${key}: want ${k ?? "nothing"}, tooltip "${r.tip?.day ?? "none"}", ring ${r.ring ? `${px(r.ring.l)},${px(r.ring.t)}` : "none"}, live "${r.live.split(":")[0]}"`);
    }
    line("Right, Left, Down, Up, Home, End and Escape read decision 6's days, the tooltip, the live region and the ring within 1px on each drawn cell",
      !wrong.length, wrong.join("; ") || path.map(([key, k]) => `${key.replace("Arrow", "")} ${k ?? "-"}`).join(", "));
    // Up and Down are the calendar's: the page under it does not scroll.
    await ev(page, () => { const c = document.querySelector("#calendar"); scrollTo(0, c.getBoundingClientRect().top + scrollY - 300); });
    const moves = [];
    for (const key of ["ArrowDown", "ArrowUp"]) {
      const y0 = await ev(page, () => { addEventListener("keydown", e => { window.__prevented = e.defaultPrevented; }, { once: true }); return scrollY; });
      await page.keyboard.press(key);
      await sleep(200);
      moves.push({ key, ...(await ev(page, y0 => ({ moved: scrollY - y0, prevented: window.__prevented }), y0)) });
    }
    line("Up and Down do not move the page", moves.every(x => x.prevented && x.moved === 0), moves.map(x => `${x.key.replace("Arrow", "")}: ${x.prevented ? "prevented" : "NOT PREVENTED"}, scrolled ${x.moved}px`).join("; "));

    // Escape with the focus on another control closes a tooltip the pointer opened.
    await page.keyboard.press("Escape");
    await ev(page, () => document.activeElement?.blur());
    await page.locator("#navTheme").focus();
    await page.locator(ROOT).scrollIntoViewIfNeeded();
    const c = cellOf(await where(page), D1);
    const opened = await until(async () => { await page.mouse.move(c.x, c.y); return reading(page); }, r => r.tip);
    await page.keyboard.press("Escape");
    const closed = await until(() => reading(page), r => !r.tip && !r.ring), focus = await ev(page, () => document.activeElement?.id ?? "");
    line("Escape with the focus on another control closes a tooltip the pointer opened, and leaves the focus there", !!opened.tip && !closed.tip && !closed.ring && focus === "navTheme",
      `${opened.tip ? "opened" : "never opened"}; after Escape ${closed.tip ? "tooltip open" : "no tooltip"}; focus on "#${focus}"`);
    // The same Escape the moment the tooltip shows: dispatched on the focused control by an observer of the tooltip, before
    // the page paints. On a loaded machine a key press can come that soon.
    await away(page);
    await until(() => reading(page), r => !r.tip);
    // The observer marks that it saw the tooltip open and sent the Escape: without the mark, no tooltip proves nothing.
    await ev(page, () => {
      window.__escaped = false;
      const tip = document.querySelector("#calendar .cal-box .tip");
      const o = new MutationObserver(() => {
        if (getComputedStyle(tip).display === "none") return;
        o.disconnect();
        window.__escaped = true;
        document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      });
      o.observe(tip, { attributes: true, attributeFilter: ["style"] });
    });
    await page.mouse.move(c.x, c.y);
    const shut = async () => ({ ...(await reading(page)), escaped: await ev(page, () => window.__escaped) });
    const soon = await until(shut, r => r.escaped && !r.tip && !r.ring);
    line("an Escape the moment the pointer's tooltip shows closes it", soon.escaped && !soon.tip && !soon.ring,
      `${soon.escaped ? "opened, Escape sent" : "NEVER OPENED, no Escape sent"}; ${soon.tip ? "tooltip open" : "no tooltip"}, ${soon.ring ? "ring drawn" : "no ring"}`);
    await page.done();
  }

  // A real click on a busy day inside the range, then outside it.
  {
    const page = await open({ name: "pick" });
    const c1 = cellOf(await where(page), D1);
    await ev(page, () => { window.__focused = []; });
    await page.mouse.click(c1.x, c1.y);
    const url = await until(() => new URL(page.url()), u => u.searchParams.get("day") === D1);
    const focus = await until(() => ev(page, () => document.activeElement?.id ?? ""), id => id === "wb-panel-sessions");
    await sleep(300);
    const after = await ev(page, () => {
      const t = document.querySelector("#workbench [role=tablist]").getBoundingClientRect();
      return { tabs: { t: t.top, b: t.bottom }, bars: window.cal.bars(), height: innerHeight, live: window.cal.live(), focused: window.__focused };
    });
    line(`a click on ${dayLong(D1)} writes day=, keeps the range, and puts the focus on the calendar, then on the tab panel`,
      url.searchParams.get("day") === D1 && url.searchParams.get("range") === "30" && focus === "wb-panel-sessions" && after.focused.indexOf("activity-calendar") > -1
        && after.focused.indexOf("activity-calendar") < after.focused.lastIndexOf("wb-panel-sessions"),
      `${url.search}; focus went to ${after.focused.join(", ")}`);
    line("after the pick the tab list is in view, under the sticky bars", after.tabs.t >= after.bars - .5 && after.tabs.b <= after.height,
      `tab list ${Math.round(after.tabs.t)}..${Math.round(after.tabs.b)}px, the bars end at ${Math.round(after.bars)}px, window ${after.height}px`);
    const status = `${dayLong(D1)} selected; the tabs show its figures.`;
    line("with the focus on the tab panel, the calendar's live region holds the status", after.live === status, `"${after.live}"`);

    // Outside the range: the range, then the day; Back restores the earlier range.
    await page.locator(ROOT).scrollIntoViewIfNeeded();
    const c2 = cellOf(await where(page), D2);
    await page.mouse.click(c2.x, c2.y);
    const wide = await until(() => new URL(page.url()), u => u.searchParams.get("day") === D2 && u.searchParams.get("range") === "90");
    const said = await until(() => ev(page, () => window.cal.live()), t => t.startsWith(dayLong(D2)));
    line(`a click on ${dayLong(D2)}, outside the range, writes the 90-day range and then the day, and the status names the range`,
      wide.searchParams.get("day") === D2 && wide.searchParams.get("range") === "90" && said === `${dayLong(D2)} selected; the range is now the last 90 days, and the tabs show its figures.`,
      `${wide.search}; "${said}"`);
    await page.goBack();
    const back = await until(() => new URL(page.url()), u => u.searchParams.get("range") === "30");
    line("Back restores the earlier range with its selection", back.searchParams.get("range") === "30" && back.searchParams.get("day") === D1, back.search);
    await page.done();
  }

  // In a 343px box, the tooltip of a busy day outside the range, the first one shown and the newest: no wider than the box,
  // inside it, its long sentence wrapped, the figures a line each, and the page not scrolling sideways.
  {
    const page = await open({ name: "tooltip in a 343px box", options: { viewport: { width: PHONE, height: 900 } } });
    const outside = (await where(page)).cells.filter(c => busy(c.day) && between(c.day, END) >= 30).sort((a, b) => (a.day < b.day ? -1 : 1));
    const found = [];
    for (const c of [outside[0], outside.at(-1)]) {
      const r = await until(async () => { await page.mouse.move(c.x, c.y); return reading(page); }, r => r.tip?.day === dayName(c.day));
      found.push({ day: c.day, open: r.tip?.day === dayName(c.day), ...(await ev(page, () => {
        const box = document.querySelector("#calendar .cal-box").getBoundingClientRect(), tip = document.querySelector("#calendar .cal-box .tip");
        const t = tip.getBoundingClientRect(), divs = [...tip.children], one = divs[0].getBoundingClientRect().height;
        const said = divs.find(e => e.textContent.startsWith("Outside")), lines = e => {
          const range = document.createRange();
          range.selectNodeContents(e);
          return new Set([...range.getClientRects()].map(x => Math.round(x.top))).size;
        };
        return { l: t.left - box.left, r: t.right - box.left, w: t.width, box: box.width, said: said ? lines(said) : 0,
          rows: divs.filter(e => e.classList.contains("row")).map(e => e.getBoundingClientRect().height <= one + .5),
          scroll: document.documentElement.scrollWidth, window: innerWidth };
      })) });
    }
    const ok = x => x.open && x.w <= x.box + .5 && x.l >= -.5 && x.r <= x.box + .5 && x.said > 1 && x.rows.length === 3 && x.rows.every(Boolean) && x.scroll <= x.window;
    line("in a 343px box the tooltip of a busy day outside the range is no wider than the box, inside it, its long sentence wrapped, the figures a line each, the page not scrolling sideways",
      found.length === 2 && found.every(ok), found.map(x => `${dayLong(x.day)}: ${x.open ? "" : "NOT OPEN, "}${px(x.w)} wide at ${px(x.l)}..${px(x.r)} of ${px(x.box)}, `
        + `the sentence on ${x.said} lines, ${x.rows.filter(Boolean).length} of ${x.rows.length} figure rows on one line, scroll width ${x.scroll}px in ${x.window}px`).join("; "));
    await page.done();
  }

  // A touch tap in a 343px box.
  {
    const page = await open({ name: "touch", options: { viewport: { width: PHONE, height: 900 }, hasTouch: true, isMobile: true } });
    const c1 = cellOf(await where(page), D1);
    await page.touchscreen.tap(c1.x, c1.y);
    const url = await until(() => new URL(page.url()), u => u.searchParams.get("day") === D1);
    line(`a touch tap on ${dayLong(D1)} in a 343px box selects it`, url.searchParams.get("day") === D1, url.search);
    await page.done();
  }

  // Newer figures: the day read with the keys stays, and nothing is said. The empty day E gets 1000 commits; the day read is
  // a week's first day in the first step, so no step change rewords it.
  {
    const page = await open({ name: "refresh while reading" });
    let more = 0;
    const got = await where(page), steps = stepsOf(await ev(page, () => window.cal.swatches()));
    const days = got.cells.map(c => c.day).sort(), first = days[0];
    const k = [...Array(53).keys()].find(n => shadeOf(steps, value(plus(first, 7 * n))) === steps[0].shade), R = plus(first, 7 * k);
    const E = days.find(d => d !== R && !value(d));
    await page.route(DATA, route => h.answer(route, j => {
      const d = carried(j);
      return more ? { ...d, days: [...d.days.filter(r => r.day !== E), { day: E, sessions: 1, prompts: 1, commits: more, calls: 0, failed_calls: 0 }].sort((a, b) => (a.day < b.day ? -1 : 1)) } : d;
    }));
    await page.route(/\/api\/status/, route => h.answer(route, s => (more ? { ...s, last_change: `chartfit ${more}` } : s)));
    await page.locator(BOX).focus();
    await page.keyboard.press("Home");
    for (let n = 0; n < k; n++) await page.keyboard.press("ArrowRight");
    const before = await until(() => reading(page), r => r.tip?.day === dayName(R));
    await ev(page, () => {
      window.__said = [];
      new MutationObserver(() => window.__said.push(window.cal.live())).observe(document.querySelector("#calendar .cal-live"), { childList: true, characterData: true, subtree: true });
    });
    more = 1000;
    await ev(page, () => window.dispatchEvent(new Event("visibilitychange")));
    const redrawn = await until(async () => cellOf(await where(page), E)?.fill, f => f && f !== cellOf(got, E).fill);
    await sleep(400);
    const now = await reading(page), heard = await ev(page, () => window.__said), c = cellOf(await where(page), R);
    line(`newer figures keep the day read with the keys, ${dayLong(R)}, and say nothing`,
      redrawn !== cellOf(got, E).fill && now.tip?.day === dayName(R) && ringOn(now.ring, c) && before.tip && !heard.length,
      `${dayLong(E)} ${redrawn !== cellOf(got, E).fill ? "redrawn" : "NOT REDRAWN"}; tooltip "${now.tip?.day ?? "none"}"; said ${JSON.stringify(heard)}`);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.done();
  }

  // Motion on: no cell animates, on the first drawing, on newer figures or on a theme change.
  {
    const watch = () => {
      window.__looks = new Set();
      const tick = () => {
        // Each cell's place in the box, not in the window, which scrolls.
        const c = window.cal?.cells() ?? [], b = window.cal?.box();
        if (c.length && b) window.__looks.add(JSON.stringify(c.map(x => [Math.round((x.l - b.l) * 2), Math.round((x.t - b.t) * 2), Math.round(x.w * 2), x.fill, x.look])));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const page = await open({ name: "motion", options: { reducedMotion: "no-preference" }, init: watch });
    await sleep(1500);
    const looks = () => ev(page, () => window.__looks.size);
    const firstDraw = await looks();
    let more = 0;
    await page.route(DATA, route => h.answer(route, j => {
      const d = carried(j);
      return more ? { ...d, days: d.days.map(r => (r.day === END ? { ...r, commits: r.commits + more } : r)) } : d;
    }));
    await page.route(/\/api\/status/, route => h.answer(route, s => (more ? { ...s, last_change: `chartfit ${more}` } : s)));
    more = 1000;
    await ev(page, () => window.dispatchEvent(new Event("visibilitychange")));
    const refreshed = await until(looks, n => n > firstDraw);
    await sleep(1000);
    const settled = await looks();
    await theme(page, "dark");
    await until(looks, n => n > settled);
    await sleep(1000);
    const themed = await looks();
    line("with motion on, no cell animates: one look on the first drawing, one more for newer figures, one more for a theme change",
      firstDraw === 1 && settled === 2 && themed === 3, `${firstDraw} look${firstDraw === 1 ? "" : "s"} drawn, then ${refreshed}/${settled} after newer figures, ${themed} after dark`);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.done();
  }

  // The failure path: a filter change answered 500, then Retry answered 200.
  {
    const page = await open({ name: "failure" });
    const codex = carried(await h.json("/api/calendar?source=codex"));
    let mode = "fail", release;
    const gate = new Promise(r => { release = r; });
    await page.route(DATA, route => (mode === "fail" ? route.fulfill({ status: 500, contentType: "application/json", body: "{\"error\":\"chartfit\"}" })
      : h.answer(route, async j => { await gate; return carried(j); })));
    const kept = (await cells(page)).length;
    await page.locator("#fSource button", { hasText: "Codex" }).click();
    const alert = page.locator(`${ROOT} [role=alert]`);
    await page.waitForFunction(() => document.querySelector("#calendar [role=alert]")?.textContent.startsWith("Could not load the calendar ("), null, { timeout: 15000 }).catch(() => {});
    const failed = await alert.textContent().catch(() => ""), retry = page.locator(`${ROOT} button`, { hasText: /^Retry/ });
    const still = (await cells(page)).length;
    line("a filter change answered 500: \"Could not load the calendar (…).\" with Retry, over the calendar kept",
      /^Could not load the calendar \(.+\)\. Still showing the calendar of the earlier filters; it cannot be selected\.$/.test(failed) && await retry.isVisible() && still === kept,
      `"${failed}"; ${still} of ${kept} cells kept`);
    const c1 = cellOf(await where(page), D1);
    await page.mouse.click(c1.x, c1.y);
    await sleep(400);
    line("the kept calendar cannot be picked", !new URL(page.url()).searchParams.get("day"), new URL(page.url()).search);
    await away(page);
    await retry.hover();
    const idle = await retry.evaluate(e => { const s = getComputedStyle(e); return { cursor: s.cursor, opacity: s.opacity, color: s.color, underline: s.textDecorationLine }; });
    mode = "hold";
    await retry.click();
    await until(() => retry.textContent(), t => t === "Retrying…");
    const busy = await retry.evaluate(e => { const s = getComputedStyle(e); return { text: e.textContent, disabled: e.getAttribute("aria-disabled"), cursor: s.cursor, opacity: s.opacity, color: s.color, underline: s.textDecorationLine }; });
    await shot(page, "retrying");
    line("while Retry runs it reads \"Retrying…\" and looks unavailable: no hand, no underline under the pointer, dimmed",
      busy.text === "Retrying…" && busy.disabled === "true" && busy.cursor !== "pointer" && busy.underline === "none" && (Number(busy.opacity) < 1 || busy.color !== idle.color),
      `idle: ${idle.cursor}, ${idle.underline}, opacity ${idle.opacity}, ${idle.color}; retrying: ${busy.cursor}, ${busy.underline}, opacity ${busy.opacity}, ${busy.color}`);
    release();
    await page.waitForFunction(() => !document.querySelector("#calendar [role=alert]"));
    const want = span(codex.first && codex.first > plus(monday(END), -7 * 52) ? codex.first : plus(monday(END), -7 * 52), END).length;
    const now = await until(() => ev(page, () => ({ cells: window.cal.cells().length, focus: document.activeElement?.id ?? "" })), r => r.cells === (codex.first ? want : 0) && r.focus === "activity-calendar");
    line("Retry answered: the calendar of the new filters is drawn, with the focus on it", now.cells === (codex.first ? want : 0) && now.focus === "activity-calendar",
      `${now.cells} cells for ${codex.first ? want : 0} Codex days; focus on "#${now.focus}"`);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    // The 500 the check answered, which the browser logs.
    await page.done(e => e.startsWith("console: Failed to load resource: the server responded with a status of 500") && e.includes("/api/calendar"));
  }
}
