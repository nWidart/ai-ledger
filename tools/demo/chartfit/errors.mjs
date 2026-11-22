// Errors' rate chart on /errors?range=30: the error rate's track above the failed calls stacked by type, on one frame. The
// demo store leaves a day without errors (today, before its first session), and a day without a bar draws no column for
// the readers: every view here is answered with each of the last 30 days given a call and an error where it had none, so
// every day draws a bar. Its descriptor, the shared checks of checks.mjs, and its own:
// - the rate line is the text color in light and dark and CanvasText under forced colors; the bridge is dotted under it;
//   the "Under 50 calls" key's ring is the line's color, and CanvasText on Canvas under forced colors;
// - one band spans both tracks for the pointer in the rate track, in the gap and in the bars, and for Home and End; the
//   pointer over the bucket labels reads nothing; each rate point sits over its bar's centre;
// - a click, Enter and Space select a day: the URL, the chip by the type table, the type table, the frame over both
//   tracks; the tooltip and the reading stay on the day; the live region says "Selected …" once, and the same act again
//   "Selection cleared …" once; the chip and Back clear it and the chart says nothing; a click and the pointer leaving at
//   once; Escape ends the reading and keeps the selection, also with the focus elsewhere; Space never scrolls the page,
//   Shift+Space is the browser's;
// - zoom: plus stops at 7 days; both tracks move together by plus and by a real drag; "Show all days" ends the legend row;
//   the slider's faint trend follows the bars' totals, not the rate; the slider shows from 14 points and not at 13, a
//   folded stretch counting as one; the Week switch resets the zoom; a zoom over a fold counts every day it stands for;
//   zoomed away from the selected day no frame, back the frame;
// - a folded stretch: "//" on its band at the frame's foot, a click, Enter and Space decline with two sentences in turn;
// - a run of idle days is one band over both tracks, its label only where the text fits; cut by the zoom it starts at
//   the plot's left edge;
// - fix markers: a dashed line in --good on its day over both tracks, its label right of it, left of it at the right edge,
//   stacked on one day without overlap (also at 32px text), not drawn outside the zoom, left out where neither side has
//   room; with a type selected the other types' marks dim;
// - a type from the legend: the other layers dim, the line takes the type's color and title, the zoom stays; a type
//   closed by Back keeps the reading;
// - forced colors with a day selected: a Highlight frame with no tint, a Highlight band with no frame, the line, dots and
//   fix markers CanvasText, an idle band dashed with no fill, every stroke a system color, a dimmed segment keeps its edge;
// - the box: the svg as tall as the box at 320px, 348px and at 32px text, the pointer reading the bar it is over; both
//   tracks keep their height at 32px; the titles inside the plot, cut with "…" when wider at 343px and 32px; the value
//   labels fit 52px with counts up to "600,000" and two-decimal rates; the focus ring on the chart and on the message's box;
// - the message without failed calls: no zoom words, Space kept from scrolling; the mini chart shows when #chartView
//   scrolls away;
// - by week in a 343px box: the edges and labels of checks.mjs, a click on the newest week; at 32px text with the web
//   font held back until the chart has drawn, the default title ends inside the plot once it loads; about 98 weeks: the frame
//   stays visible and no wider than its band;
// - newer figures keep the reading, the zoom and the selection, and say nothing; the bars grow once.
import { LOCALE, PHONE, line, sleep, until } from "./harness.mjs";
import { chart, root32 } from "./checks.mjs";

const ROOT = ".chart-card";
const DATA = /\/api\/errors(\?.*)?$/;
const DAY = 864e5;
const day = (k, long = false) => new Date(k + "T00:00:00Z").toLocaleDateString(LOCALE, { month: "short", day: "numeric", timeZone: "UTC", ...(long ? { year: "numeric" } : {}) });
const week = (k, long = false) => (long ? `Week of ${day(k, true)}` : day(k));
const plus = (k, n) => new Date(Date.parse(k + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
const span = (a, b) => { const out = []; for (let k = a; k <= b; k = plus(k, 1)) out.push(k); return out; };
const monday = k => plus(k, -((new Date(k + "T00:00:00Z").getUTCDay() + 6) % 7));
/** model.ts's GAP_FOLD: a stretch of this many idle buckets or more folds into one point. */
const GAP_FOLD = 8;

/** The chart's points for a payload, as chartData() makes them (all projects and sources, subagents in, noise kept): from
 *  the first bucket with a call in the range to today, a day or a week each; a run of GAP_FOLD idle buckets or more is
 *  one point, { k, to }. */
function pointsOf(d, range, weekly = false) {
  const b = k => (weekly ? monday(k) : k);
  const start = range ? plus(d.today, -(range - 1)) : d.calls.reduce((m, c) => (!m || c[0] < m ? c[0] : m), "");
  const on = k => k >= start && k <= d.today;
  const from = d.calls.filter(c => on(c[0]) && c[2] > 0).reduce((m, c) => (!m || c[0] < m ? c[0] : m), "") || start;
  const busy = new Set([...d.calls.filter(c => c[2] > 0 && c[0] >= from && on(c[0])).map(c => b(c[0])), ...d.error_days.filter(r => r[3] > 0 && r[0] >= from && on(r[0])).map(r => b(r[0]))]);
  const keys = [...new Set(span(from, d.today).map(b))];
  const out = [];
  for (let i = 0; i < keys.length;) {
    let j = i;
    while (j < keys.length && !busy.has(keys[j])) j++;
    if (j - i >= GAP_FOLD) { out.push({ k: keys[i], to: keys[j - 1] }); i = j; } else { for (const k of keys.slice(i, Math.max(j, i + 1))) out.push({ k }); i = Math.max(j, i + 1); }
  }
  return out;
}
/** Each of the last 30 days given tool calls and failed calls where it had none, so each draws a bar. */
const full = d => {
  const calls = new Set(d.calls.filter(r => r[2] > 0).map(r => r[0])), errs = new Set(d.error_days.filter(r => r[3] > 0).map(r => r[0]));
  for (const k of span(plus(d.today, -29), d.today)) {
    if (!calls.has(k)) d.calls.push([k, "atlas-api", 60, 0, "claude"]);
    if (!errs.has(k)) d.error_days.push([k, "atlas-api", "tests", 2, 0, "claude"]);
  }
  return d;
};
/** The days at these indexes of the last 30 left with no call and no error. */
const quiet = (d, idx) => {
  const out = new Set(idx.map(i => plus(d.today, i - 29)));
  d.calls = d.calls.filter(r => !out.has(r[0]));
  d.error_days = d.error_days.filter(r => !out.has(r[0]));
  return d;
};
/** The applied fixes, by type id and index of the last 30 days. */
const fixed = (d, at) => { d.fixes = Object.fromEntries(Object.entries(at).map(([c, i]) => [c, plus(d.today, i - 29)])); return d; };
/** A long name for the top type, as a user's own category could have. */
const LONG = "Bash exit code other than zero from a long command line";
/** model.ts's shortLabel: a type's name cut at 26 characters, as the chart's titles and fix labels name it. */
const shortLabel = s => (s.length > 26 ? s.slice(0, 25) + "…" : s);
const renamed = d => { d.categories = d.categories.map(c => (c.id === "tests" ? { ...c, label: LONG } : c)); return d; };
/** The store's calls and errors copied back by 11 weeks, n times: all time by week then reaches about 11 more weeks a copy. */
const older = (d, n) => {
  const back = k => r => [plus(r[0], -77 * k), ...r.slice(1)];
  for (let k = 1; k <= n; k++) { d.calls = [...d.calls, ...d.calls.filter(r => r[0] > plus(d.today, -77)).map(back(k))]; d.error_days = [...d.error_days, ...d.error_days.filter(r => r[0] > plus(d.today, -77)).map(back(k))]; }
  return d;
};

const CLEARED = "Selection cleared: the table and detail cover the whole range.";
const FOLDED = ["A stretch without tool calls cannot be selected.", "This stretch has no tool calls to select."];
const STATUS = /^(Selected |Selection cleared: |A stretch without tool calls|This stretch has no tool calls)/;
const selectedSay = k => `Selected ${day(k, true)}: the table and detail show only its errors.`;

/** Errors' own readers, installed in every page before its scripts as window.errfit, beside window.chartfit. This function
 *  runs in the page: it uses nothing from this module. The marks it tells apart are all paths of ECharts' SVG:
 *  - the reading band: translucent, unstroked, as tall as the frame; a no-activity band is that too, at fill-opacity .75,
 *    and under forced colors unfilled with a dashed (3 2) frame;
 *  - the selection: framed with no dash, as tall as the frame, tinted or unfilled;
 *  - a fix marker: a vertical line dashed 4 3 over the frame's height, and a text starting "✓ ";
 *  - the rate line and its dotted bridge: stroked, unfilled paths in clipped groups of their own, solid and 1 4;
 *  - the slider's faint trend: a half-opaque stroked path in a group under the frame. */
function errReaders() {
  const tri = c => (String(c).match(/[\d.]+/g) || []).slice(0, 3).map(n => Math.round(Number(n))).join(",");
  const rect = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const svg = () => document.querySelector(".chart-card .echart-plot svg");
  const top = () => [...(svg()?.querySelector(":scope > g")?.children ?? [])];
  const at = (e, n) => e.getAttribute(n);
  const fill = e => at(e, "fill") ?? "none";
  const stroked = e => (at(e, "stroke") ?? "none") !== "none";
  const grid = () => window.chartfit.grid();
  const tall = (e, g) => e.tagName === "path" && rect(e).h >= (g.b - g.t) * .8;
  const narrow = (e, g) => rect(e).w < (g.r - g.l) / 2;
  const isIdle = e => (at(e, "fill-opacity") === "0.75" && !stroked(e)) || (fill(e) === "none" && stroked(e) && /^3,\s*2/.test(at(e, "stroke-dasharray") ?? ""));
  /** A path's points on the screen. */
  const vertices = e => {
    const m = e.getScreenCTM(), p = svg().createSVGPoint();
    return [...(at(e, "d") ?? "").matchAll(/[ML](-?[\d.]+)[ ,](-?[\d.]+)/g)].map(([, x, y]) => {
      p.x = Number(x); p.y = Number(y);
      const s = p.matrixTransform(m);
      return { x: s.x, y: s.y };
    });
  };
  const lines = () => top().filter(e => e.tagName === "g").flatMap(x => [...x.children])
    .filter(e => e.tagName === "path" && fill(e) === "none" && stroked(e) && at(e, "stroke-opacity") !== "0");
  const region = () => document.querySelector(".chart-card .echart + .sr");
  window.errfit = {
    vertices,
    /** The tracks, from the grid lines: the rate track from the top line to the one by its "0%" label, the bars below. */
    tracks() {
      const g = grid();
      if (!g) return null;
      const ys = [...new Set(top().filter(e => e.tagName === "path" && fill(e) === "none" && rect(e).h < 1 && rect(e).w > 0).map(e => Math.round(rect(e).t * 2) / 2))].sort((a, b) => a - b);
      const zero = window.chartfit.texts().find(t => /^0(\.0+)?%$/.test(t.text));
      const zy = zero ? (zero.t + zero.b) / 2 : NaN;
      const rb = ys.reduce((best, y) => (Math.abs(y - zy) < Math.abs(best - zy) ? y : best), ys[0]);
      const below = ys.filter(y => y > rb + .5);
      return { g, rate: { t: ys[0], b: rb }, bars: { t: below[0], b: ys.at(-1) }, lines: ys };
    },
    /** The reading band: not a no-activity band. */
    band() {
      const g = grid(), e = g && top().find(e => tall(e, g) && narrow(e, g) && fill(e) !== "none" && at(e, "fill-opacity") != null && !stroked(e) && !isIdle(e));
      return e ? { fill: tri(fill(e)), ...rect(e) } : null;
    },
    /** How many reading bands are drawn. */
    bands() { const g = grid(); return g ? top().filter(e => tall(e, g) && narrow(e, g) && fill(e) !== "none" && at(e, "fill-opacity") != null && !stroked(e) && !isIdle(e)).length : 0; },
    /** The no-activity bands. */
    idle() {
      const g = grid();
      return g ? top().filter(e => tall(e, g) && isIdle(e)).map(e => ({ fill: fill(e) === "none" ? "none" : tri(fill(e)), stroke: stroked(e) ? tri(at(e, "stroke")) : "none", dash: at(e, "stroke-dasharray"), ...rect(e) })) : [];
    },
    /** The selection's frame: stroked with no dash, tinted or unfilled. */
    selection() {
      const g = grid(), all = g ? top().filter(e => tall(e, g) && narrow(e, g) && stroked(e) && !at(e, "stroke-dasharray") && (fill(e) === "none" || at(e, "fill-opacity") != null)) : [];
      const e = all[0];
      return e ? { n: all.length, fill: fill(e) === "none" ? "none" : tri(fill(e)), stroke: tri(at(e, "stroke")), width: Number(at(e, "stroke-width") ?? 1), ...rect(e) } : null;
    },
    /** The fix markers: their dashed lines and their labels. */
    fixes() {
      const g = grid();
      const ls = g ? top().filter(e => e.tagName === "path" && /^4,\s*3/.test(at(e, "stroke-dasharray") ?? "") && rect(e).w < 3 && tall(e, g)) : [];
      return {
        lines: ls.map(e => ({ x: (rect(e).l + rect(e).r) / 2, stroke: tri(at(e, "stroke")), so: Number(at(e, "stroke-opacity") ?? 1), sw: Number(at(e, "stroke-width") ?? 1), ...rect(e) })),
        labels: top().filter(e => e.tagName === "text" && e.textContent.startsWith("✓ ")).map(e => ({ text: e.textContent, fill: tri(fill(e)), fo: Number(at(e, "fill-opacity") ?? 1), size: parseFloat(getComputedStyle(e).fontSize), ...rect(e) })),
      };
    },
    /** The rate line (solid) and its bridge (dotted 1 4), with their points on the screen. */
    rate() {
      const ls = lines(), solid = ls.filter(e => !at(e, "stroke-dasharray")), bridge = ls.filter(e => /^1,\s*4/.test(at(e, "stroke-dasharray") ?? ""));
      const g = grid(), inFrame = e => g && rect(e).b <= g.b + 4;
      const one = e => ({ stroke: tri(at(e, "stroke")), width: Number(at(e, "stroke-width") ?? 1), points: vertices(e), ...rect(e) });
      return { solid: solid.filter(inFrame).map(one), bridge: bridge.filter(inFrame).map(one) };
    },
    /** The slider's faint trend: its points on the screen, left first. */
    trend() {
      const g = grid(), e = g && lines().find(e => at(e, "stroke-opacity") === "0.5" && rect(e).t > g.b);
      return e ? vertices(e).sort((a, b) => a.x - b.x) : [];
    },
    /** Each column of bars, left first: its centre and its height, so its total. */
    totals() {
      const cols = new Map();
      for (const b of window.chartfit.bars()) { const k = Math.round(b.l), c = cols.get(k) ?? { l: b.l, r: b.r, h: 0 }; c.h += b.h; cols.set(k, c); }
      return [...cols.values()].sort((a, b) => a.l - b.l).map(c => ({ x: (c.l + c.r) / 2, h: c.h }));
    },
    /** The segments a selected type dims: solid, at fill-opacity .2, with their stroke. */
    dimmed() {
      const g = grid();
      return g ? top().filter(e => e.tagName === "path" && fill(e) !== "none" && at(e, "fill-opacity") === "0.2" && rect(e).b <= g.b + 1 && rect(e).w > 3)
        .map(e => ({ fill: tri(fill(e)), stroke: stroked(e) ? tri(at(e, "stroke")) : "none", so: Number(at(e, "stroke-opacity") ?? 1), sw: Number(at(e, "stroke-width") ?? 0) })) : [];
    },
    /** Every visible stroke the chart draws, the slider's and the texts' halos included, by its color: how many, and one
     *  such mark's tag, place and size. */
    strokes() {
      const s = svg(), box = s?.getBoundingClientRect(), out = {};
      for (const e of s ? s.querySelectorAll("path, text") : []) {
        if (e.closest("clipPath, defs") || !stroked(e) || at(e, "stroke") === "transparent" || at(e, "stroke-opacity") === "0") continue;
        const k = tri(at(e, "stroke")), r = rect(e);
        out[k] ??= { n: 0, e: `${e.tagName} at ${Math.round(r.l - box.left)},${Math.round(r.t - box.top)} ${Math.round(r.w)}x${Math.round(r.h)}` };
        out[k].n++;
      }
      return out;
    },
    /** A text's width in the font of the chart's texts at a size, as the canvas measures it. */
    measure(text, size) {
      const t = svg()?.querySelector("text");
      const c = document.createElement("canvas").getContext("2d");
      c.font = `${size}px ${t ? getComputedStyle(t).fontFamily : "sans-serif"}`;
      return c.measureText(text).width;
    },
    /** The svg's box and the chart's box. */
    boxes() { const s = svg(), b = document.querySelector(".chart-card .echart"); return { svg: s ? rect(s) : null, box: b ? rect(b) : null }; },
    /** The live region's texts from now on, each with the time it came. The whole document is watched, so a region the
     *  page draws afresh (Back can mount the chart again) is still heard; a text is noted when it differs from the last. */
    listen() {
      window.__heard = [];
      window.__last = region()?.textContent ?? "";
      if (window.__hearing) return;
      window.__hearing = true;
      new MutationObserver(() => {
        const text = region()?.textContent ?? "";
        if (text !== window.__last) { window.__last = text; window.__heard.push({ t: performance.now(), text }); }
      }).observe(document.body, { childList: true, characterData: true, subtree: true });
    },
    heard: () => window.__heard ?? [],
    region: () => region()?.textContent ?? "",
  };
}

export async function errors(h) {
  const store = await h.json("/api/errors");
  const today = store.today;
  const DAYS = pointsOf(full(structuredClone(store)), 30).map(p => p.k);
  const kept = [["heading", "#chartTitle"], ["hint", "#chartHint"]];
  const c = chart(h, {
    name: "errors", path: "/errors?range=30", root: ROOT, points: DAYS, label: day, unit: { one: "day", many: "days" }, at: 9, // day 10
    data: DATA, setup: errReaders, answer: full,
    // Today's failed calls up, in its first row, so the bars change and day 10 does not.
    newer: (d, more) => { const i = d.error_days.findIndex(r => r[0] === d.today && r[3] > 0); d.error_days[i] = [...d.error_days[i].slice(0, 3), d.error_days[i][3] + more, ...d.error_days[i].slice(4)]; return d; },
    kept,
  });
  const { N, I, named, centre, ev, drawn, away, box, state, onPoint } = c;
  const probe = (page, css) => ev(page, css => window.chartfit.probe(css), css);
  const tracks = page => ev(page, () => window.errfit.tracks());
  const spans = (s, t) => s.band && Math.abs(s.band.t - t.rate.t) <= 1.5 && Math.abs(s.band.b - t.bars.b) <= 1.5;
  const focus = page => ev(page, () => { const a = document.activeElement; return a?.id ? `#${a.id}` : a === document.body ? "body" : (a?.className || a?.tagName || "none"); });
  /** The status sentences heard, once the first is: a second one coming a moment later counts. */
  const statuses = page => ev(page, re => window.errfit.heard().map(x => x.text).filter(t => new RegExp(re).test(t)), STATUS.source);
  const heard = async page => { await until(() => statuses(page), x => x.length); await sleep(700); return statuses(page); };
  const sel = page => ev(page, () => ({ frame: window.errfit.selection(), chip: document.querySelector("#atClr")?.textContent.replace(/\s*✕\s*$/, "") ?? null,
    table: document.querySelector("#catBody")?.textContent ?? "", url: location.search }));
  const mine = page => ev(page, () => ({ band: window.errfit.band(), tip: window.chartfit.tip(), readout: window.chartfit.readout(), grid: window.chartfit.grid() }));
  /** Whether the band and the tooltip are on point i at x, the live region holding a status or not; a line saying where. */
  const stays = (s, i, x) => ({ ok: !!s.band && Math.abs(mid(s.band) - x) <= 1.5 && named(s.tip?.day ?? "") === i, at: `band at ${px(mid(s.band))} (point ${i + 1} at ${px(x)}), tooltip "${s.tip?.day ?? "none"}"` });
  const mid = r => (r ? (r.l + r.r) / 2 : NaN);
  const px = n => (Number.isFinite(n) ? `${Math.round(n)}px` : "none");
  /** Whether the rate line spans the bars drawn: both tracks show the same days. */
  const lineSpan = page => ev(page, () => {
    const cs = window.errfit.totals().map(c => c.x), ls = window.errfit.rate().solid;
    return { first: cs[0], last: cs.at(-1), bars: cs.length, line: ls[0] ? { l: ls[0].points[0].x, r: ls.at(-1).points.at(-1).x } : null, lines: ls.length };
  });
  const together = s => s.line && Math.abs(s.line.l - s.first) <= 1.5 && Math.abs(s.line.r - s.last) <= 1.5;
  const spanText = s => (s.line ? `rate line ${Math.round(s.line.l)}..${Math.round(s.line.r)}px, bars' centres ${Math.round(s.first)}..${Math.round(s.last)}px, ${s.bars} bars` : "no rate line");
  /** Each rate point over its bar's centre, within 1px: the points of the solid line and the dots against the columns. */
  const overBars = page => ev(page, () => {
    const cols = window.errfit.totals(), r = window.errfit.rate(), pts = [...r.solid.flatMap(l => l.points), ...window.chartfit.dots().map(d => ({ x: d.x }))];
    const off = pts.map(p => Math.min(...cols.map(c => Math.abs(c.x - p.x))));
    return { n: pts.length, cols: cols.length, worst: off.length ? Math.max(...off) : Infinity };
  });
  const overLine = (what, o) => line(`${what}: each rate point sits over its bar's centre, within 1px`, o.n > 0 && o.worst <= 1, `${o.n} rate points over ${o.cols} columns, the farthest ${o.worst.toFixed(2)}px off`);
  /** The svg as tall as the box, and the pointer on a bar's column reading that day. */
  const fills = async (page, what, want, k, first = 0) => {
    // The chart first draws while the page's web font loads; its swap moves the chart (27px up on /errors?range=7), so
    // the chart is measured once the fonts are in.
    await ev(page, () => document.fonts.ready.then(() => true));
    const b = await ev(page, () => window.errfit.boxes());
    let cols = await ev(page, () => window.chartfit.columns()), g = await ev(page, () => window.chartfit.grid());
    // A pointer that lands on a chart drawn a moment ago can go unheard: it moves again, a pixel up, up to three times,
    // on the chart where it is then.
    const ok = s => named(s.readout) === first + k && Math.abs(mid(s.band) - cols[k].x) <= 1;
    let s;
    for (let n = 0; n < 3 && !(s && ok(s)); n++) {
      if (n) [cols, g] = [await ev(page, () => window.chartfit.columns()), await ev(page, () => window.chartfit.grid())];
      await page.mouse.move(cols[k].x, g.b - 4 - n);
      s = await until(() => mine(page), ok);
    }
    const under = ok(s) ? "" : await ev(page, ([x, y]) => { const e = document.elementFromPoint(x, y); return `; under the pointer ${e?.tagName.toLowerCase()}${e?.id ? `#${e.id}` : ""}${e?.className?.baseVal ?? e?.className ? `.${String(e.className?.baseVal ?? e.className).split(" ")[0]}` : ""} in ${e?.closest("[id]")?.id ?? "none"}`; }, [cols[k].x, g.b - 6]);
    line(`${what}: the svg is as tall as the ${want}px box, and the pointer on day ${k + 1}'s bar reads it`, Math.abs(b.svg.h - b.box.h) <= .5 && Math.round(b.box.h) === want && ok(s),
      `svg ${b.svg.h.toFixed(1)}px, box ${b.box.h.toFixed(1)}px; readout "${s.readout.split(":")[0]}", band at ${px(mid(s.band))}, bar at ${px(cols[k].x)}${under}`);
    await away(page);
  };

  await c.colors();
  await c.readColors();

  // The rate line's color, the bridge, the hollow key's ring, in light and dark.
  {
    const page = await c.open("rate line colors");
    const got = [];
    for (const scheme of ["light", "dark"]) {
      await c.theme(page, scheme);
      const want = await until(() => probe(page, "var(--text-primary)"), v => scheme === "light" || v !== got[0]?.want);
      const r = await until(() => ev(page, () => window.errfit.rate()), r => r.solid[0]?.stroke === want);
      const ring = await ev(page, () => { const e = document.querySelector(".chart-card #legend .sw.low"); return e ? window.chartfit.tri(getComputedStyle(e).borderTopColor) : null; });
      got.push({ scheme, want, line: r.solid[0]?.stroke, n: r.solid.length, bridge: r.bridge.length, ring });
    }
    line("the rate line is the text color in light and in dark, over one dotted bridge", got.every(x => x.n >= 1 && x.line === x.want && x.bridge === 1) && got[0].want !== got[1].want,
      got.map(x => `${x.scheme} rgb(${x.line}) in ${x.n} part(s), ${x.bridge} bridge, --text-primary rgb(${x.want})`).join("; "));
    line(`the "Under 50 calls" key's ring is the rate line's color in light and in dark`, got.every(x => x.ring === x.line), got.map(x => `${x.scheme} ring rgb(${x.ring}), line rgb(${x.line})`).join("; "));
    await page.done();
  }

  await c.forcedColors();
  // Forced colors with a day selected, a type selected, fixes and an idle run: the frame, the band, the line, the dots, the
  // markers, the idle band, the dimmed segments, the hollow key.
  {
    const J = I + 3, Q = 20;
    const answer = d => fixed(quiet(full(d), [Q, Q + 1]), { tests: 4, edit_nomatch: 24 });
    const page = await c.openOn({ path: `/errors?range=30&at=${DAYS[J]}`, answer, points: N - 2 }, "forced colors, selected", { forcedColors: "active" });
    const t = await tracks(page), hl = await probe(page, "Highlight"), ct = await probe(page, "CanvasText"), cv = await probe(page, "Canvas");
    await page.mouse.move(centre(t.g, I), (t.bars.t + t.bars.b) / 2);
    const got = await until(() => ev(page, () => ({ band: window.errfit.band(), frame: window.errfit.selection(), rate: window.errfit.rate(), dots: window.chartfit.dots(), fixes: window.errfit.fixes(), idle: window.errfit.idle() })), r => r.band);
    line("forced colors: the selected day is a Highlight frame, unfilled, over both tracks", got.frame?.stroke === hl && got.frame.fill === "none" && Math.abs(mid(got.frame) - centre(t.g, J)) <= 1.5 && got.frame.t <= t.rate.t + 2 && got.frame.b >= t.bars.b - 2,
      got.frame ? `stroke rgb(${got.frame.stroke}) ${got.frame.width}px, fill ${got.frame.fill}, ${Math.round(got.frame.t)}..${Math.round(got.frame.b)}px; Highlight rgb(${hl})` : "no frame");
    line("forced colors: the day read is a Highlight band with no frame", got.band?.fill === hl && Math.abs(mid(got.band) - centre(t.g, I)) <= 1.5, got.band ? `band rgb(${got.band.fill}) at ${px(mid(got.band))}` : "no band");
    const lineInk = [...got.rate.solid, ...got.rate.bridge].map(l => l.stroke), dotInk = got.dots.flatMap(x => [x.stroke, ...(x.fill === x.stroke ? [x.fill] : [])]).filter(x => x !== "none");
    const hollow = got.dots.filter(x => x.fill !== x.stroke && x.stroke !== "none");
    line("forced colors: the rate line, its bridge and its dots are CanvasText, a hollow dot Canvas inside", lineInk.length >= 2 && lineInk.every(x => x === ct) && dotInk.every(x => x === ct) && hollow.length > 0 && hollow.every(x => x.fill === cv),
      `lines ${lineInk.map(x => `rgb(${x})`).join(", ")}; ${got.dots.length} dots, ${hollow.length} hollow (${hollow.map(x => `rgb(${x.fill}) in rgb(${x.stroke})`).join(", ")}); CanvasText rgb(${ct}), Canvas rgb(${cv})`);
    line("forced colors: the fix markers' lines and labels are CanvasText", got.fixes.lines.length === 2 && got.fixes.labels.length === 2 && [...got.fixes.lines.map(x => x.stroke), ...got.fixes.labels.map(x => x.fill)].every(x => x === ct),
      `${got.fixes.lines.map(x => `line rgb(${x.stroke})`).join(", ")}; ${got.fixes.labels.map(x => `"${x.text}" rgb(${x.fill})`).join(", ")}`);
    line("forced colors: a no-activity band is a dashed frame with no fill", got.idle.length === 1 && got.idle[0].fill === "none" && !!got.idle[0].dash && got.idle[0].stroke !== "none",
      got.idle.map(x => `fill ${x.fill}, stroke rgb(${x.stroke}) dashed ${x.dash}, ${Math.round(x.w)}px wide`).join("; ") || "no idle band");
    const key = await ev(page, () => { const e = document.querySelector(".chart-card #legend .sw.low"); const s = e && getComputedStyle(e); return s ? { ring: window.chartfit.tri(s.borderTopColor), bg: window.chartfit.tri(s.backgroundColor) } : null; });
    line(`forced colors: the "Under 50 calls" key is a CanvasText ring on Canvas`, key?.ring === ct && key.bg === cv, key ? `ring rgb(${key.ring}) on rgb(${key.bg})` : "no key");
    // Every stroke in a system color the chart uses: CanvasText, GrayText (grid lines, the idle frame; Chromium's emulated
    // palette makes it a dark red, rgb(96,0,0)), Highlight and Canvas (the fix labels' halo).
    const sys = { CanvasText: ct, GrayText: await probe(page, "GrayText"), Highlight: hl, Canvas: cv };
    const sysName = Object.fromEntries(Object.entries(sys).map(([k, v]) => [v, k]));
    const strokes = await ev(page, () => window.errfit.strokes()), odd = Object.keys(strokes).filter(k => !sysName[k]);
    line("forced colors: every stroke in the chart is CanvasText, GrayText, Highlight or Canvas", Object.keys(strokes).length > 0 && !odd.length,
      Object.entries(strokes).map(([k, x]) => `${sysName[k] ?? `NOT A SYSTEM COLOR rgb(${k})`} ${x.n}x, e.g. ${x.e}`).join("; "));
    await c.shot(page, "forced-colors-selected");
    // A type selected: its segments dimmed keep their edge.
    await page.locator("#legend button").nth(1).click();
    const dim = await until(() => ev(page, () => window.errfit.dimmed()), x => x.length > 0);
    line("forced colors, a type selected: each dimmed segment keeps a visible edge", dim.length > 0 && dim.every(x => x.stroke !== "none" && x.so >= .99 && x.sw > 0),
      `${dim.length} dimmed segments; ${[...new Set(dim.map(x => `stroke ${x.stroke === "none" ? "none" : `rgb(${x.stroke})`} at ${x.so}, ${x.sw}px`))].join("; ")}`);
    await c.shot(page, "forced-colors-type");
    await page.done();
  }

  await c.textSize();
  // 32px text: the box grows, both tracks keep their height, the titles stay in the plot, the svg fills the box; two fixes
  // on one day stack; a fold's "//" stays clear of the labels.
  {
    const measure = async page => {
      const t = await tracks(page), b = await ev(page, () => window.errfit.boxes());
      const titles = await ev(page, () => window.chartfit.texts().filter(x => /% of tool calls$|^Failed calls per /.test(x.text) || x.text.endsWith("…")));
      return { t, box: b.box, svg: b.svg, titles };
    };
    const p16 = await c.open("16px root, tracks");
    const at16 = await measure(p16);
    await fills(p16, "16px root", 348, I);
    await p16.done();
    const p7 = await c.openOn({ path: "/errors?range=7", points: 7 }, "7 days");
    await fills(p7, "7 days, no slider", 320, 3, N - 7);
    await p7.done();
    const p32 = await c.open("32px root, tracks", {}, root32);
    const at32 = await measure(p32);
    const h = x => [x.t.rate.b - x.t.rate.t, x.t.bars.b - x.t.bars.t];
    line("32px root: the box grows and both tracks keep their height", at32.box.h > at16.box.h && h(at16).join() === "100,152" && h(at32).join() === h(at16).join(),
      `box ${Math.round(at16.box.h)}px, then ${Math.round(at32.box.h)}px; rate and bars tracks ${h(at16).join(" and ")}px, then ${h(at32).join(" and ")}px`);
    const inside = x => x.titles.length === 2 && x.titles.every(t => t.l >= x.t.g.l - .5 && t.r <= x.t.g.r + .5 && (t.t + t.b - t.size) / 2 >= x.box.t - .5);
    line("both track titles are drawn inside the plot and the box, at 16px and 32px", inside(at16) && inside(at32),
      [at16, at32].map(x => x.titles.map(t => `"${t.text}" ${Math.round(t.l)}..${Math.round(t.r)}px, em top ${((t.t + t.b - t.size) / 2 - x.box.t).toFixed(1)}px in the box; plot ${Math.round(x.t.g.l)}..${Math.round(x.t.g.r)}px`).join(", ")).join("; "));
    await fills(p32, "32px root", 416, I);
    await c.shot(p32, "text-32px");
    await p32.done();
    // Two fixes on the newest day, and a fold, at 32px.
    const answer = d => fixed(quiet(full(d), [5, 6, 7, 8, 9, 10, 11, 12, 13]), { edit_nomatch: 29, cmd_not_found: 29 });
    const pf = await c.openOn({ answer, points: N - 9 + 0 }, "32px root, two fixes, a fold", {}, root32);
    const f = await ev(pf, () => ({ fixes: window.errfit.fixes(), texts: window.chartfit.texts(), box: window.chartfit.box(), g: window.chartfit.grid() }));
    const em = t => ({ t: (t.t + t.b - t.size) / 2, b: (t.t + t.b + t.size) / 2 });
    const [a, b] = f.fixes.labels;
    const apart = f.fixes.labels.length < 2 || em(a).b <= em(b).t + .5 || em(b).b <= em(a).t + .5 || a.r <= b.l || b.r <= a.l;
    const inPlot = f.fixes.labels.every(x => x.l >= f.g.l - .5 && x.r <= f.g.r + .5);
    line("32px root: two fixes on the newest day draw two lines, their labels inside the plot, one under the other or left out", f.fixes.lines.length === 2 && apart && inPlot,
      `${f.fixes.lines.length} lines; ${f.fixes.labels.map(x => `"${x.text}" ${Math.round(x.l)}..${Math.round(x.r)}px x ${Math.round(em(x).t)}..${Math.round(em(x).b)}px`).join(", ") || "no labels"}; plot ${Math.round(f.g.l)}..${Math.round(f.g.r)}px`);
    const slash = f.texts.find(x => x.text === "//"), under = f.texts.filter(x => x !== slash && x.t >= f.g.b - 2);
    const clear = slash && under.every(x => x.r <= slash.l || x.l >= slash.r || em(x).t >= em(slash).b || em(x).b <= em(slash).t);
    line(`32px root: a fold's "//" is drawn, clear of the ${"day"} labels`, !!slash && clear,
      slash ? `"//" ${Math.round(slash.l)}..${Math.round(slash.r)}px x ${Math.round(em(slash).t)}..${Math.round(em(slash).b)}px; labels under the plot ${under.map(x => `"${x.text}" ${Math.round(x.l)}..${Math.round(x.r)}px x ${Math.round(em(x).t)}..${Math.round(em(x).b)}px`).filter((_, i) => i < 3).join(", ")}…` : "no //");
    await c.shot(pf, "text-32px-fixes-fold");
    await pf.done();
    // Twelve fixes on the newest day, at 32px: every line drawn, and only the label rows that end inside the plot.
    const twelve = Array.from({ length: 12 }, (_, k) => `fix${String(k + 1).padStart(2, "0")}`);
    const many = d => {
      d.categories = [...d.categories, ...twelve.map(id => ({ id, label: `Fixed ${id.slice(3)}`, why: "", fix: "", snippet: "" }))];
      return fixed(full(d), Object.fromEntries(twelve.map(id => [id, 29])));
    };
    const pm = await c.openOn({ answer: many }, "32px root, twelve fixes on one day", {}, root32);
    const m = await ev(pm, () => ({ fixes: window.errfit.fixes(), g: window.chartfit.grid() }));
    line("32px root: twelve fixes on the newest day draw twelve lines, no label passing the plot's bottom", m.fixes.lines.length === 12 && m.fixes.labels.length > 0 && m.fixes.labels.every(x => x.b <= m.g.b + .5),
      `${m.fixes.lines.length} lines, ${m.fixes.labels.length} labels, the lowest ending at ${Math.round(Math.max(...m.fixes.labels.map(x => x.b)))}px; plot bottom ${Math.round(m.g.b)}px`);
    await c.shot(pm, "text-32px-twelve-fixes");
    await pm.done();
  }

  // The reading: pointer, keys, both tracks, the zoom.
  {
    const page = await c.open("reading");
    await c.pointer(page);
    await c.keys(page);
    const t = await tracks(page);
    const where = [["in the rate track", (t.rate.t + t.rate.b) / 2], ["in the gap between the tracks", (t.rate.b + t.bars.t) / 2], ["in the bars", (t.bars.t + t.bars.b) / 2]];
    await ev(page, () => document.activeElement?.blur());
    for (const [k, [what, y]] of where.entries()) {
      const i = I + 2 + k;
      await page.mouse.move(centre(t.g, i), y);
      const s = await until(() => state(page), s => onPoint(s, i, centre(t.g, i)).ok);
      const n = await ev(page, () => window.chartfit.bands());
      const at = onPoint(s, i, centre(t.g, i));
      line(`pointer ${what}: one band over both tracks, and the band, tooltip and readout name day ${i + 1}`, at.ok && n === 1 && spans(s, t),
        `${n} band, ${s.band ? `${Math.round(s.band.t)}..${Math.round(s.band.b)}px` : "none"} for tracks ${t.rate.t}..${t.bars.b}px; ${at.at}`);
    }
    const label = await ev(page, () => { const g = window.chartfit.grid(); return window.chartfit.texts().find(x => x.t >= g.b && x.l > g.l + 100); });
    await page.mouse.move((label.l + label.r) / 2, (label.t + label.b) / 2);
    await sleep(400);
    const off = await state(page);
    line(`the pointer over the day label "${label.text}" reads nothing`, !off.band && !off.tip, `${off.band ? "band drawn" : "no band"}, ${off.tip ? `tooltip "${off.tip.day}"` : "no tooltip"}`);
    await away(page);
    for (const [key, i] of [["Home", 0], ["End", N - 1]]) {
      await box(page).focus();
      await page.keyboard.press(key);
      const s = await until(() => state(page), s => onPoint(s, i, centre(s.grid, i)).ok);
      const n = await ev(page, () => window.chartfit.bands());
      const at = onPoint(s, i, centre(s.grid, i));
      line(`${key}: one band over both tracks, and the band, tooltip and readout name day ${i + 1}`, at.ok && n === 1 && spans(s, t), `${n} band; ${at.at}`);
    }
    await page.keyboard.press("Escape");
    overLine("1440px", await overBars(page));

    await c.zoomKeys(page);
    // Plus down to the slider's least: 7 days, said so.
    await ev(page, () => window.errfit.listen());
    await c.read(page);
    for (let k = 0; k < 10; k++) await page.keyboard.press("+");
    const least = await until(() => drawn(page), n => n === 7);
    await sleep(300);
    const said = await ev(page, () => window.errfit.heard().map(x => x.text).filter(t => t.includes("Showing")).at(-1) ?? "");
    line("plus stops at 7 days, and says so", least === 7 && / 7 of 30 days\.$/.test(said), `${least} days drawn; last said "${said.replace(/^.*?(Showing)/, "$1")}"`);
    const zs = await until(() => lineSpan(page), together);
    line("zoomed by plus, the rate line spans the bars drawn: both tracks moved together", zs.bars === 7 && together(zs), spanText(zs));
    overLine("zoomed to 7 days", await overBars(page));
    const last = await ev(page, () => { const l = document.querySelector("#legend"); return { last: l?.lastElementChild?.className ?? "", text: l?.lastElementChild?.textContent ?? "" }; });
    line(`"Show all days" ends the legend row while zoomed`, last.last.includes("show-all") && last.text === "Show all days", `last in the row: ${last.last || "nothing"} "${last.text}"`);
    await c.shot(page, "zoomed-7");
    await page.keyboard.press("Escape");
    await c.showAll(page).click();
    await until(() => drawn(page), n => n === N);
    await c.slider(page);
    // A real drag of the right handle: both tracks again.
    {
      await away(page);
      const hd = await ev(page, () => { const hs = window.chartfit.handles(); const r = hs.at(-1); return hs.length === 2 ? { x: (r.l + r.r) / 2, y: (r.t + r.b) / 2, w: r.r - hs[0].l } : null; });
      await page.mouse.move(hd.x, hd.y);
      await page.mouse.down();
      for (let k = 1; k <= 8; k++) { await page.mouse.move(hd.x - hd.w * .4 * k / 8, hd.y); await sleep(40); }
      await page.mouse.up();
      const ds = await until(() => lineSpan(page), s => s.bars < N && together(s));
      line("dragged, the rate line spans the bars drawn: both tracks moved together", ds.bars < N && together(ds), spanText(ds));
      // Hard down to the least the slider holds.
      const h2 = await ev(page, () => { const hs = window.chartfit.handles(); return hs.length === 2 ? { l: (hs[0].l + hs[0].r) / 2, r: (hs[1].l + hs[1].r) / 2, y: (hs[1].t + hs[1].b) / 2 } : null; });
      await page.mouse.move(h2.l, h2.y);
      await page.mouse.down();
      for (let k = 1; k <= 10; k++) { await page.mouse.move(h2.l + (h2.r - h2.l) * k / 10, h2.y); await sleep(30); }
      await page.mouse.up();
      await sleep(400);
      const min = await drawn(page);
      line("a drag of the left handle onto the right one stops at 7 days", min === 7, `${min} days drawn`);
      await c.showAll(page).click();
      await until(() => drawn(page), n => n === N);
    }
    // The slider's faint trend is the failed calls per day, not the rate.
    {
      const tr = await ev(page, () => ({ trend: window.errfit.trend(), totals: window.errfit.totals(), rate: window.errfit.rate().solid.flatMap(l => l.points) }));
      const corr = (xs, ys) => {
        const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
        const sxy = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0), sx = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0)), sy = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0));
        return sxy / (sx * sy);
      };
      const ty = tr.trend.map(p => -p.y);
      const byTotals = tr.trend.length === tr.totals.length ? corr(ty, tr.totals.map(x => x.h)) : NaN;
      // The rate per day where it has one: the line's points, matched to the trend's by order.
      const rateY = tr.rate.length === tr.trend.length ? corr(ty, tr.rate.map(p => -p.y)) : NaN;
      line("the slider's faint trend follows the bars' totals, not the rate line", byTotals >= .99 && !(rateY >= byTotals - .01),
        `${tr.trend.length} trend points, ${tr.totals.length} columns: correlation ${byTotals.toFixed(3)} with the totals, ${Number.isFinite(rateY) ? rateY.toFixed(3) : "n/a"} with the rate line's ${tr.rate.length} points`);
    }
    // The Week switch shows every week, with no zoom.
    await box(page).focus();
    await page.keyboard.press("+");
    await until(() => drawn(page), n => n < N);
    await page.locator("#fGran button", { hasText: /^Week$/ }).click();
    const weeks = pointsOf(full(structuredClone(store)), 30, true).length;
    const reset = await until(() => ev(page, () => ({ n: window.chartfit.points().length, all: !!document.querySelector(".chart-card .show-all"), handles: window.chartfit.handles().length })), r => r.n === weeks);
    line("the Week switch shows every week and ends the zoom", reset.n === weeks && !reset.all, `${reset.n} of ${weeks} weeks drawn, "Show all" ${reset.all ? "still shown" : "gone"}, ${reset.handles} handles`);
    await page.done();
  }

  // The selection: a click, Enter and Space, the chip, Back, the pointer leaving, Escape, Space and the page.
  {
    const page = await c.open("selection");
    const t = await tracks(page);
    const J = I, K = I + 2;
    await ev(page, () => window.errfit.listen());
    const table0 = (await sel(page)).table;
    await page.mouse.click(centre(t.g, J), (t.bars.t + t.bars.b) / 2);
    const clicked = await until(() => sel(page), s => s.url.includes(`at=${DAYS[J]}`) && s.frame);
    const fJ = clicked.frame;
    line(`a click on day ${J + 1} selects it: the frame is drawn around it over both tracks, no wider than its band`, !!fJ && fJ.n === 1 && Math.abs(mid(fJ) - centre(t.g, J)) <= 1.5 && fJ.t <= t.rate.t + 2 && fJ.b >= t.bars.b - 2 && fJ.w <= (t.g.r - t.g.l) / N + 1,
      fJ ? `frame ${Math.round(fJ.l)}..${Math.round(fJ.r)}px x ${Math.round(fJ.t)}..${Math.round(fJ.b)}px, rgb(${fJ.stroke}) ${fJ.width}px; day ${J + 1} at ${px(centre(t.g, J))}` : `no frame; ${clicked.url}`);
    line("the chip names it and the type table narrows to it", clicked.chip === day(DAYS[J]) && clicked.table !== table0, `chip "${clicked.chip}", table ${clicked.table !== table0 ? "changed" : "UNCHANGED"}`);
    const s1 = await heard(page), r1 = stays(await mine(page), J, centre(t.g, J));
    line("the live region says the selected sentence once; the band and the tooltip stay on the day", s1.length === 1 && s1[0] === selectedSay(DAYS[J]) && r1.ok,
      `${JSON.stringify(s1)}; ${r1.at}`);
    await c.shot(page, "selected");
    await ev(page, () => window.errfit.listen());
    await page.mouse.click(centre(t.g, J), (t.bars.t + t.bars.b) / 2);
    const unclicked = await until(() => sel(page), s => !s.url.includes("at=") && !s.frame);
    const s2 = await heard(page);
    line(`a second click clears it and says so once`, !unclicked.frame && !unclicked.chip && s2.length === 1 && s2[0] === CLEARED, `${unclicked.url || "no selection"}; ${JSON.stringify(s2)}`);
    await away(page);

    // Enter, then Enter again; Space, then Space again.
    const readK = async () => {
      await box(page).focus();
      await page.keyboard.press("Home");
      for (let k = 0; k < K; k++) await page.keyboard.press("ArrowRight");
      await until(() => mine(page), r => named(r.readout) === K);
    };
    for (const key of ["Enter", "Space"]) {
      await readK();
      await ev(page, () => window.errfit.listen());
      await page.keyboard.press(key);
      const on = await until(() => sel(page), s => s.url.includes(`at=${DAYS[K]}`) && s.frame);
      const a = await heard(page), ra = await mine(page);
      await ev(page, () => window.errfit.listen());
      await page.keyboard.press(key);
      const offK = await until(() => sel(page), s => !s.url.includes("at="));
      const b = await heard(page), rb = await mine(page);
      line(`${key} on day ${K + 1} selects it and says so once, again clears it and says so once; the band and the tooltip stay on it`,
        !!on.frame && on.chip === day(DAYS[K]) && JSON.stringify(a) === JSON.stringify([selectedSay(DAYS[K])]) && !offK.frame && JSON.stringify(b) === JSON.stringify([CLEARED])
        && stays(ra, K, centre(t.g, K)).ok && stays(rb, K, centre(t.g, K)).ok,
        `chip "${on.chip}", said ${JSON.stringify(a)}, then ${JSON.stringify(b)}; selected: ${stays(ra, K, centre(t.g, K)).at}; cleared: ${stays(rb, K, centre(t.g, K)).at}; focus on ${await focus(page)}`);
    }
    // Space never scrolls the page: on the chart with a day read or not; Shift+Space is the browser's.
    {
      await ev(page, () => { scrollTo(0, 0); document.activeElement?.blur(); });
      const press = async key => {
        await ev(page, () => addEventListener("keydown", e => { window.__prevented = e.defaultPrevented; }, { once: true }));
        const y0 = await ev(page, () => scrollY);
        await page.keyboard.press(key);
        await sleep(300);
        return { prevented: await ev(page, () => window.__prevented), moved: (await ev(page, () => scrollY)) !== y0 };
      };
      await box(page).focus({ preventScroll: true });
      const idle = await press("Space");
      await page.keyboard.press("Escape");
      const shift = await press("Shift+Space");
      line("Space on the chart with nothing read is kept from scrolling the page; Shift+Space is left to the browser", idle.prevented && !idle.moved && shift.prevented === false,
        `Space ${idle.prevented ? "prevented" : "KEPT"}, page ${idle.moved ? "SCROLLED" : "still"}; Shift+Space ${shift.prevented ? "PREVENTED" : "kept"}`);
    }
    // The chip's clear, and Back: the chart says nothing and drops its sentence.
    for (const how of ["chip", "Back"]) {
      await readK();
      await page.keyboard.press("Enter");
      await until(() => ev(page, () => window.errfit.region()), r => r === selectedSay(DAYS[K]));
      await ev(page, () => window.errfit.listen());
      if (how === "chip") await page.locator("#atClr").click(); else await page.goBack();
      await until(() => sel(page), s => !s.url.includes("at="));
      await sleep(500);
      const out = { said: (await ev(page, () => window.errfit.heard().map(x => x.text))).filter(x => STATUS.test(x)), region: await ev(page, () => window.errfit.region()) };
      line(`cleared by ${how === "chip" ? "the chip by the type table" : "Back"}: the chart says nothing, and drops the sentence it held`, !out.said.length && !STATUS.test(out.region),
        `said ${JSON.stringify(out.said)}, region "${out.region.split(":")[0]}"`);
    }
    // A click, then the pointer leaving at once, 400ms or 1.5s later: the sentence must reach the region and stay there.
    {
      const got = [];
      for (const wait of [0, 400, 1500]) {
        await away(page);
        // Back may have scrolled the page: the chart is measured where it is now.
        await page.locator(ROOT).scrollIntoViewIfNeeded();
        const tk = await tracks(page);
        await ev(page, () => window.errfit.listen());
        await page.mouse.click(centre(tk.g, K), (tk.bars.t + tk.bars.b) / 2);
        if (wait) await sleep(wait);
        await page.mouse.move(2, 2);
        await until(() => sel(page), s => s.url.includes(`at=${DAYS[K]}`));
        await sleep(800);
        const log = await ev(page, () => window.errfit.heard());
        const i = log.findIndex(x => x.text === selectedSay(DAYS[K]));
        const kept = i < 0 ? 0 : (log[i + 1]?.t ?? performance.now()) - log[i].t;
        const now = await ev(page, () => window.errfit.region());
        const url = await ev(page, () => location.search);
        got.push({ wait, ok: url.includes(`at=${DAYS[K]}`) && log.filter(x => x.text === selectedSay(DAYS[K])).length === 1 && now === selectedSay(DAYS[K]),
          at: `left after ${wait}ms: ${url}, region ${JSON.stringify(log.map(x => x.text.split(":")[0]))}, the sentence held ${i < 0 ? "never" : `${Math.round(kept)}ms`}, now "${now.split(":")[0]}"` });
        if ((await sel(page)).chip) await page.locator("#atClr").click();
        await until(() => sel(page), s => !s.url.includes("at="));
      }
      line("a click, then the pointer leaving at once, 400ms or 1.5s later: the selected sentence is said once and the region still holds it", got.every(x => x.ok), got.map(x => x.at).join("; "));
    }
    // Escape ends the reading and keeps the selection.
    {
      await readK();
      await page.keyboard.press("Enter");
      await until(() => sel(page), s => s.url.includes(`at=${DAYS[K]}`) && s.frame);
      await page.keyboard.press("Escape");
      const esc = await until(() => ev(page, () => ({ band: window.errfit.band(), tip: window.chartfit.tip(), url: location.search, frame: window.errfit.selection() })), r => !r.band && !r.tip);
      await page.keyboard.press("Escape");
      await sleep(300);
      const twice = await sel(page);
      line("Escape ends the reading and never clears the selection, twice over", !esc.band && !esc.tip && esc.url.includes(`at=${DAYS[K]}`) && !!esc.frame && twice.url.includes(`at=${DAYS[K]}`) && !!twice.frame,
        `after Escape: ${esc.band ? "band" : "no band"}, ${esc.tip ? "tooltip" : "no tooltip"}, ${esc.url}; after a second: ${twice.url}, ${twice.frame ? "frame" : "NO FRAME"}`);
      // Escape with the focus on another control closes a tooltip the pointer opened; the selection stays.
      await ev(page, () => document.activeElement?.blur());
      await away(page);
      await page.locator("#navTheme").focus();
      await page.locator(ROOT).scrollIntoViewIfNeeded();
      const g = await ev(page, () => window.chartfit.grid());
      await page.mouse.move(centre(g, I), (g.t + g.b) / 2);
      const open = await until(() => state(page), s => s.tip);
      // The pointer at rest: once in four runs a pointer update still on its way reopened the tooltip after Escape.
      await sleep(300);
      await page.keyboard.press("Escape");
      const closed = await until(() => mine(page), s => !s.tip && !s.band);
      const after = await sel(page);
      line("Escape with the focus on another control closes a tooltip the pointer opened, and the selection stays", !!open.tip && !closed.tip && !closed.band && after.url.includes(`at=${DAYS[K]}`) && !!after.frame && (await focus(page)) === "#navTheme",
        `${open.tip ? "opened" : "never opened"}; after Escape ${closed.tip ? "tooltip open" : "no tooltip"}; ${after.url}, ${after.frame ? "frame" : "no frame"}; focus on ${await focus(page)}`);
      await away(page);
    }
    // Zoomed away from the selected day: no frame, the chip still names it; zoomed out the frame is back.
    {
      await box(page).focus();
      await page.keyboard.press("End");
      await page.keyboard.press("+");
      const out = await until(() => ev(page, () => ({ n: window.chartfit.points().length, frame: window.errfit.selection(), chip: document.querySelector("#atClr")?.textContent ?? "" })), r => r.n < N && !r.frame);
      await page.keyboard.press("-");
      const back = await until(() => ev(page, () => ({ n: window.chartfit.points().length, frame: window.errfit.selection() })), r => r.n === N && r.frame);
      line("zoomed away from the selected day: no frame, the chip still names it; zoomed out the frame is back", out.n < N && !out.frame && out.chip.startsWith(day(DAYS[K])) && !!back.frame && Math.abs(mid(back.frame) - centre(t.g, K)) <= 1.5,
        `${out.n} days drawn, ${out.frame ? "frame drawn" : "no frame"}, chip "${out.chip.replace(/\s*✕$/, "")}"; back to ${back.n} days, ${back.frame ? `frame at ${px(mid(back.frame))}` : "no frame"}`);
    }
    await page.done();
  }

  // A type from the legend: the other layers and the other types' fixes dim, the line takes the type's rate and color, the
  // zoom stays; Back closes it and the reading stays.
  {
    const answer = d => fixed(full(d), { tests: 20, edit_nomatch: 25 });
    const page = await c.openOn({ answer }, "a type selected");
    const before = await ev(page, () => ({ line: window.errfit.rate().solid[0]?.points.map(p => Math.round(p.y)).join() }));
    await box(page).focus();
    await page.keyboard.press("End");
    await page.keyboard.press("+");
    await until(() => drawn(page), n => n < N);
    // The window, by the slider's handles: a selected type dims the other layers, so the bars drawn are fewer.
    const handles = () => ev(page, () => window.chartfit.handles().map(x => Math.round(x.l)).join(","));
    const zoomed = await handles();
    await page.keyboard.press("Escape");
    const btn = page.locator("#legend button").nth(1);
    const cat = await btn.getAttribute("data-c"), name = (await btn.locator("span").textContent()) ?? "";
    await btn.click();
    const tc = await ev(page, () => window.chartfit.tri(getComputedStyle(document.querySelector("#legend button[aria-pressed=true] .sw")).backgroundColor));
    const got = await until(() => ev(page, () => ({ bars: window.chartfit.bars().map(b => b.fill), dim: window.errfit.dimmed().map(x => x.fill), rate: window.errfit.rate(), fixes: window.errfit.fixes(),
      title: window.chartfit.texts().find(x => x.text.endsWith("% of tool calls") || x.text.endsWith("…"))?.text ?? "", n: window.chartfit.points().length, all: !!document.querySelector(".chart-card .show-all"),
      ring: (e => (e ? window.chartfit.tri(getComputedStyle(e).borderTopColor) : null))(document.querySelector(".chart-card #legend .sw.low")) })), r => r.dim.length > 0 && r.rate.solid[0]?.stroke === tc);
    const opaque = [...new Set(got.bars)];
    line(`a type from the legend (${name}): its layer stays opaque and every other layer dims`, opaque.length === 1 && opaque[0] === tc && got.dim.length > 0 && got.dim.every(x => x !== tc),
      `opaque ${opaque.map(x => `rgb(${x})`).join(", ")}, ${got.dim.length} dimmed segments in ${[...new Set(got.dim)].length} colors; the type rgb(${tc})`);
    const short = shortLabel(name);
    const lineNow = got.rate.solid[0]?.points.map(p => Math.round(p.y)).join();
    line("the rate line takes the type's color, its rate and its title; the hollow key's ring follows", got.rate.solid[0]?.stroke === tc && lineNow !== before.line && got.title.startsWith(`${short} rate`) && (got.ring == null || got.ring === tc),
      `line rgb(${got.rate.solid[0]?.stroke}) ${lineNow !== before.line ? "redrawn" : "UNCHANGED"}, title "${got.title}", ring ${got.ring ? `rgb(${got.ring})` : "no key"}`);
    // Each label with the line nearest to it, 4px off its side.
    const fx = got.fixes, own = l => l.text === `✓ ${short}`;
    const pairs = fx.labels.map(l => ({ l, x: fx.lines.reduce((a, b) => (Math.min(Math.abs(b.x - l.l), Math.abs(b.x - l.r)) < Math.min(Math.abs(a.x - l.l), Math.abs(a.x - l.r)) ? b : a)) }));
    line("the other type's fix marker dims to 20%, the type's own stays", pairs.length === 2 && pairs.some(p => own(p.l)) && pairs.every(p => (own(p.l) ? p.l.fo === 1 && p.x.so === 1 : p.l.fo === .2 && p.x.so === .2)),
      pairs.map(p => `"${p.l.text}" at ${p.l.fo}, its line at ${Math.round(p.x.x)}px at ${p.x.so}`).join("; ") || "no fix marker");
    const kept = await handles();
    line("a type from the legend keeps the zoom", kept === zoomed && got.all, `handles at ${kept}px, ${zoomed}px before; "Show all days" ${got.all ? "shown" : "gone"}`);
    await c.shot(page, "type-selected");
    // Back closes the type while a day is read: the reading stays. The readout moves a frame before the band: wait for both.
    await box(page).focus();
    await page.keyboard.press("End");
    for (let k = 0; k < 2; k++) await page.keyboard.press("ArrowLeft");
    const r0 = await until(() => mine(page), r => named(r.readout) === N - 3 && named(r.tip?.day ?? "") === N - 3 && !!r.band);
    await sleep(300);
    const at0 = mid((await mine(page)).band);
    await page.goBack();
    const closed = await until(() => ev(page, () => ({ cat: new URLSearchParams(location.search).get("cat") })), r => !r.cat);
    await sleep(400);
    const r1 = await mine(page), back = await handles();
    line("a type closed by Back keeps the day read and the zoom", !closed.cat && named(r0.readout) === N - 3 && named(r1.readout) === N - 3 && named(r1.tip?.day ?? "") === N - 3 && Math.abs(mid(r1.band) - at0) <= 1 && back === zoomed,
      `${cat} closed: ${!closed.cat}; readout "${r1.readout.split(":")[0]}", tooltip "${r1.tip?.day ?? "none"}", band at ${px(mid(r1.band))} (was ${px(at0)}); handles at ${back}px, ${zoomed}px before`);
    await page.done();
  }

  // Fix markers: on day 5, on the newest day two of them, and one outside the zoom.
  {
    const answer = d => fixed(full(d), { tests: 4, edit_nomatch: 29, cmd_not_found: 29 });
    const page = await c.openOn({ answer }, "fix markers");
    const t = await tracks(page), good = await probe(page, "var(--good)"), goodText = await probe(page, "var(--good-text)");
    const f = await ev(page, () => window.errfit.fixes());
    const at = i => f.lines.filter(x => Math.abs(x.x - centre(t.g, i)) <= 1);
    const em = x => ({ t: (x.t + x.b - x.size) / 2, b: (x.t + x.b + x.size) / 2 });
    line("a fix marker is one dashed line in --good on its day, over both tracks", f.lines.length === 3 && at(4).length === 1 && at(N - 1).length === 2 && f.lines.every(x => x.stroke === good && Math.abs(x.t - t.rate.t) <= 1.5 && Math.abs(x.b - t.bars.b) <= 1.5),
      `${f.lines.map(x => `rgb(${x.stroke}) at ${x.x.toFixed(1)}px, ${Math.round(x.t)}..${Math.round(x.b)}px`).join("; ")}; --good rgb(${good}); days 5 and ${N} at ${centre(t.g, 4).toFixed(1)} and ${centre(t.g, N - 1).toFixed(1)}px; tracks ${t.rate.t}..${t.bars.b}px`);
    const five = f.labels.find(x => x.text.startsWith("✓ Tests")), newest = f.labels.filter(x => x !== five);
    line("its label sits right of its line; on the newest day left of it, inside the plot", !!five && five.l >= centre(t.g, 4) + 3 && newest.length === 2 && newest.every(x => x.r <= centre(t.g, N - 1) - 3 && x.l >= t.g.l) && f.labels.every(x => x.fill === goodText),
      `${f.labels.map(x => `"${x.text}" ${Math.round(x.l)}..${Math.round(x.r)}px rgb(${x.fill})`).join(", ")}; lines at ${Math.round(centre(t.g, 4))} and ${Math.round(centre(t.g, N - 1))}px; plot from ${Math.round(t.g.l)}px`);
    const [a, b] = newest;
    line("two fixes on one day: their labels sit one under the other, apart", !!b && (em(a).b <= em(b).t + .5 || em(b).b <= em(a).t + .5),
      newest.map(x => `"${x.text}" em ${em(x).t.toFixed(1)}..${em(x).b.toFixed(1)}px`).join(", "));
    await c.shot(page, "fixes");
    await box(page).focus();
    await page.keyboard.press("End");
    await page.keyboard.press("+");
    await until(() => drawn(page), n => n < N);
    await sleep(300);
    const z = await ev(page, () => ({ fixes: window.errfit.fixes(), n: window.chartfit.points().length }));
    line("zoomed to the newest days, the fix on day 5 is not drawn, the newest day's are", z.fixes.lines.length === 2 && z.fixes.labels.length === 2 && !z.fixes.labels.some(x => x.text.startsWith("✓ Tests")),
      `${z.n} days drawn; ${z.fixes.lines.length} lines, labels ${z.fixes.labels.map(x => `"${x.text}"`).join(", ")}`);
    await page.done();
  }

  // An idle run of three days: one band over both tracks, its label where it fits; at 343px none; cut by the zoom from the
  // plot's left edge. The readers' columns leave the idle days out.
  {
    const Q = 15, answer = d => quiet(full(d), [Q, Q + 1, Q + 2]);
    const idleLine = async (page, what) => {
      const g = await ev(page, () => window.chartfit.grid());
      const got = await ev(page, () => ({ idle: window.errfit.idle(), label: window.chartfit.texts().filter(x => x.text === "no activity"), size: Math.max(...window.chartfit.texts().map(x => x.size)) }));
      const need = await ev(page, s => window.errfit.measure("no activity", s), got.size);
      const b = got.idle[0], w = b ? b.w : 0, fits = need + 8 <= w;
      const ok = got.idle.length === 1 && Math.abs(b.l - (centre(g, Q) - (g.r - g.l) / N / 2)) <= 1.5 && Math.abs(b.r - (centre(g, Q + 2) + (g.r - g.l) / N / 2)) <= 1.5
        && Math.abs(b.t - g.t) <= 1.5 && Math.abs(b.b - g.b) <= 1.5 && (fits ? got.label.length === 1 && got.label[0].l >= b.l && got.label[0].r <= b.r : got.label.length === 0);
      line(`${what}: a run of 3 idle days is one band over both tracks, its "no activity" label inside it where the text fits, else left out`, ok,
        `the text needs ${Math.round(need + 8)}px of ${Math.round(w)}px: ${fits ? "drawn" : "left out"}; ${got.idle.length} band(s): ${got.idle.map(x => `${Math.round(x.l)}..${Math.round(x.r)}px x ${Math.round(x.t)}..${Math.round(x.b)}px`).join(", ")}; frame ${Math.round(g.t)}..${Math.round(g.b)}px; labels ${got.label.map(x => `${Math.round(x.l)}..${Math.round(x.r)}px`).join(", ") || "none"}`);
    };
    const page = await c.openOn({ answer, points: N - 3 }, "an idle run");
    await idleLine(page, "1440px");
    await c.shot(page, "idle");
    // Zoomed to 7 days from the end, then the reading moved left onto the run's second day: the window starts there.
    await box(page).focus();
    await page.keyboard.press("End");
    for (let k = 0; k < 10; k++) await page.keyboard.press("+");
    await until(() => ev(page, () => window.chartfit.readout()), r => / 7 of 30 days\./.test(r));
    for (let k = N - 1; k > Q + 1; k--) await page.keyboard.press("ArrowLeft");
    // The readout moves a frame before ECharts draws the window it brings: wait for the drawing.
    const cutOk = r => r.idle.length === 1 && Math.abs(r.idle[0].l - r.g.l) <= 1.5 && Math.abs(r.idle[0].r - (r.g.l + 2 * (r.g.r - r.g.l) / 7)) <= 1.5;
    const cut = await until(() => ev(page, () => ({ idle: window.errfit.idle(), g: window.chartfit.grid(), readout: window.chartfit.readout() })), r => r.readout.includes(day(DAYS[Q + 1], true)) && cutOk(r));
    const band = (cut.g.r - cut.g.l) / 7;
    line("cut by the zoom, the idle run starts at the plot's left edge and ends at its last day", cut.readout.includes(day(DAYS[Q + 1], true)) && cutOk(cut),
      `${cut.idle.map(x => `${x.l.toFixed(1)}..${x.r.toFixed(1)}px`).join(", ") || "no band"}; plot from ${cut.g.l.toFixed(1)}px, two days end at ${(cut.g.l + 2 * band).toFixed(1)}px; "${cut.readout.split(":")[0]}"`);
    await c.shot(page, "idle-cut");
    await page.done();
    const pp = await c.openOn({ answer, points: N - 3 }, "an idle run, 343px", { viewport: { width: PHONE, height: 900 } });
    await idleLine(pp, "a 343px box");
    await pp.done();
    const p32 = await c.openOn({ answer, points: N - 3 }, "an idle run, 32px", {}, root32);
    await idleLine(p32, "32px root");
    await p32.done();
  }

  // A folded stretch: its band and "//", the zoom's words over it, and a click, Enter and Space declining in turn.
  {
    const F = 5, gone = [5, 6, 7, 8, 9, 10, 11, 12, 13], answer = d => quiet(full(d), gone);
    const pts = pointsOf(answer(structuredClone(store)), 30), M = pts.length;
    const page = await c.openOn({ answer, points: M - 1 }, "a fold");
    const g = await ev(page, () => window.chartfit.grid());
    const fx = centre(g, F, 0, M - 1);
    const got = await ev(page, () => ({ idle: window.errfit.idle(), slash: window.chartfit.texts().filter(x => x.text === "//") }));
    const s = got.slash[0];
    line(`a folded stretch of ${gone.length} days is one point: its band and "//" centred on it, at the frame's foot`, M === N - gone.length + 1 && pts[F].to && got.idle.length === 1 && Math.abs(mid(got.idle[0]) - fx) <= 1.5 && got.slash.length === 1 && Math.abs(mid(s) - fx) <= 1.5 && Math.abs((s.t + s.b) / 2 - g.b) <= 2,
      `${M} points; band ${got.idle.map(x => `${Math.round(x.l)}..${Math.round(x.r)}px`).join(", ")}, "//" ${s ? `${Math.round(s.l)}..${Math.round(s.r)}px, middle ${Math.round((s.t + s.b) / 2)}px` : "none"}; point at ${Math.round(fx)}px, frame foot ${Math.round(g.b)}px`);
    await c.shot(page, "fold");
    await ev(page, () => window.errfit.listen());
    const said = [];
    await page.mouse.click(fx, g.t + (g.b - g.t) * .7);
    said.push(...await heard(page));
    await away(page);
    await box(page).focus();
    await page.keyboard.press("Home");
    for (let k = 0; k < F; k++) await page.keyboard.press("ArrowRight");
    for (const key of ["Enter", "Space"]) {
      await ev(page, () => window.errfit.listen());
      await page.keyboard.press(key);
      said.push(...await heard(page));
    }
    const url = await ev(page, () => location.search), r = stays(await mine(page), F, fx);
    line("a click, Enter and Space on the fold select nothing, each saying one sentence, the two in turn; the band and the tooltip stay", JSON.stringify(said) === JSON.stringify([FOLDED[0], FOLDED[1], FOLDED[0]]) && !url.includes("at=") && r.ok,
      `said ${JSON.stringify(said)}; ${url || "no selection"}; ${r.at}`);
    // Plus on the fold: the zoom's words count every day it stands for.
    await ev(page, () => window.errfit.listen());
    await page.keyboard.press("+");
    const words = await until(() => ev(page, () => window.errfit.heard().map(x => x.text).filter(t => t.includes("Showing")).at(-1) ?? ""), x => x);
    const m = /Showing (.+?) to (.+?), (\d+) of (\d+) days\./.exec(words);
    const all = span(plus(today, -29), today), key = l => all.find(k => day(k) === l);
    const n = m && key(m[1]) && key(m[2]) ? (Date.parse(key(m[2])) - Date.parse(key(m[1]))) / DAY + 1 : NaN;
    line("zoomed over the fold, the zoom's words count every day it stands for", !!m && Number(m[3]) === n && m[4] === "30" && Number(m[3]) > (await drawn(page)) + 1,
      `"${words.replace(/^.*?(Showing)/, "$1")}"; ${n} days from ${m?.[1]} to ${m?.[2]}; ${await drawn(page)} columns drawn`);
    await page.done();
  }

  // The slider from 14 points and not at 13: 14 days, then 13 (the calls before cut), then 30 days with a fold, as 14 and
  // as 13 points.
  {
    const cut = n => d => { const keep = new Set(span(plus(d.today, -(n - 1)), d.today)); d.calls = d.calls.filter(r => keep.has(r[0])); d.error_days = d.error_days.filter(r => keep.has(r[0])); return d; };
    const cases = [["14 days", "/errors?range=14", d => full(d), 14, 14], ["13 days", "/errors?range=14", d => cut(13)(full(d)), 13, 13],
      ["30 days, a fold of 17 as one: 14 points", "/errors?range=30", d => quiet(full(d), Array.from({ length: 17 }, (_, i) => i + 1)), 14, 13],
      ["30 days, a fold of 18 as one: 13 points", "/errors?range=30", d => quiet(full(d), Array.from({ length: 18 }, (_, i) => i + 1)), 13, 12]];
    const got = [];
    for (const [what, path, answer, points, cols] of cases) {
      const page = await c.openOn({ path, answer, points: cols }, what);
      got.push({ what, points, ...await ev(page, () => ({ handles: window.chartfit.handles().length, h: Math.round(window.chartfit.box().h),
        hint: document.querySelector("#chartHint").textContent.includes("Plus and minus zoom."), label: document.querySelector(".chart-card .echart").getAttribute("aria-label").includes("plus and minus") })) });
      await page.done();
    }
    const ok = x => (x.points >= 14 ? x.handles === 2 && x.h === 348 && x.hint && x.label : x.handles === 0 && x.h === 320 && !x.hint && !x.label);
    line("the slider shows from 14 points and not at 13, a fold counting as one, with the zoom words in the hint and the label only then", got.every(ok),
      got.map(x => `${x.what}: ${x.handles} handles, box ${x.h}px, zoom words in the hint ${x.hint}, in the label ${x.label}`).join("; "));
  }

  // The value labels against the 52px margin: a day of 450,000 failed calls, the most whose labels fit (up to "600,000";
  // from 571,429 the top label is "1,000,000", which the margin cuts: not handled, such counts do not occur), and rates
  // whose steepest is 0.12% (labels in hundredths).
  {
    const big = n => d => { const r = d.error_days.findIndex(x => x[0] === d.today && x[3] > 0); d.error_days[r] = [...d.error_days[r].slice(0, 3), n, 0, d.error_days[r][5]]; d.calls.push([d.today, "atlas-api", n * 10, 0, "claude"]); return d; };
    {
      const page = await c.openOn({ answer: d => big(450000)(full(d)) }, "a day of 450000 failed calls");
      const got = await ev(page, () => { const g = window.chartfit.grid(), b = window.chartfit.box(); return { labels: window.chartfit.texts().filter(x => x.r < g.l + 2 && !x.text.endsWith("%")), box: b }; });
      const cutOff = got.labels.filter(x => x.l < got.box.l - .5);
      line(`a day of 450,000 failed calls, the widest count labels that fit ("600,000"): every count label is inside the box`, got.labels.some(x => x.text === "600,000") && !cutOff.length,
        got.labels.map(x => `"${x.text}" ${(x.l - got.box.l).toFixed(1)}..${(x.r - got.box.l).toFixed(1)}px`).join(", "));
      await c.shot(page, "count-450000");
      await page.done();
    }
    const low = d => {
      const days = span(plus(d.today, -29), d.today), e = Object.fromEntries(days.map(k => [k, 0]));
      for (const r of d.error_days) if (r[0] in e) e[r[0]] += r[3];
      d.calls = [...d.calls.filter(r => !(r[0] in e)), ...days.map((k, i) => [k, "atlas-api", Math.round(e[k] / (i === 10 ? .0012 : .001)), 0, "claude"])];
      return d;
    };
    const page = await c.openOn({ answer: d => low(full(d)) }, "rates near 0.12%");
    const got = await ev(page, () => { const t = window.errfit.tracks(); return { labels: window.chartfit.texts().filter(x => x.text.endsWith("%") && x.r < t.g.l + 2).sort((a, b) => b.t - a.t).map(x => x.text), lines: t.lines, top: t.rate.t,
      n: [...document.querySelectorAll(".chart-card .echart-plot svg > g > path[fill=none]")].filter(e => { const r = e.getBoundingClientRect(); return r.height < 1 && r.width > 0 && Math.abs(r.top - t.rate.t) < 1; }).length }; });
    line("rates with the steepest at 0.12%: the labels read 0.00% 0.05% 0.10% 0.15%, and the top grid line is drawn once", got.labels.join(" ") === "0.00% 0.05% 0.10% 0.15%" && got.n === 1,
      `labels ${got.labels.join(" ")}; ${got.n} grid line(s) at the top`);
    await page.done();
  }

  // The focus ring on the chart; the message without failed calls; the mini chart.
  {
    const ring = page => ev(page, () => { const e = document.activeElement, s = getComputedStyle(e); return { id: e.id, visible: e.matches(":focus-visible"), style: s.outlineStyle, width: parseFloat(s.outlineWidth), offset: s.outlineOffset, color: window.chartfit.tri(s.outlineColor) }; });
    const page = await c.open("focus ring");
    await page.locator("#legend button").last().focus();
    await page.keyboard.press("Tab");
    const chartRing = await ring(page);
    line("Tab onto the chart draws its focus ring", chartRing.id === "chart" && chartRing.visible && chartRing.style !== "none" && chartRing.width >= 2,
      `#${chartRing.id}, focus-visible ${chartRing.visible}, outline ${chartRing.style} ${chartRing.width}px rgb(${chartRing.color}) offset ${chartRing.offset}`);
    await c.shot(page, "focus");
    await page.done();
    // No failed calls: the message in the chart's box, its words, Space, the ring.
    const none = d => { d.error_days = []; d.errors = []; d.incidents = []; return d; };
    const pm = await h.open({ path: "/errors?range=30", root: ROOT, setup: errReaders, data: DATA, answer: d => none(full(d)), ready: p => p.waitForSelector(".chart-card #chart .empty") }, "no failed calls");
    const msg = await ev(pm, () => { const b = document.querySelector("#chart"); return { text: b.textContent, label: b.getAttribute("aria-label"), hint: document.querySelector("#chartHint").textContent, svg: !!document.querySelector(".chart-card svg"), cls: b.className }; });
    line("no failed calls: the message replaces the drawing, and its label and hint say nothing of zoom", /^No failed tool calls in this range, out of [\d,]+\.$/.test(msg.text) && !msg.svg && !/plus and minus/i.test(msg.label + msg.hint),
      `"${msg.text}"; ${msg.svg ? "an svg drawn" : "no svg"}; label "${msg.label}"`);
    await pm.locator("#fGran button").last().focus();
    await pm.keyboard.press("Tab");
    const msgRing = await ring(pm);
    line("Tab onto the message's box draws the same focus ring as on the chart", msgRing.id === "chart" && msgRing.visible && msgRing.style === chartRing.style && msgRing.width === chartRing.width && msgRing.offset === chartRing.offset && msgRing.color === chartRing.color,
      `#${msgRing.id}, outline ${msgRing.style} ${msgRing.width}px rgb(${msgRing.color}) offset ${msgRing.offset}; on the chart offset ${chartRing.offset}`);
    await ev(pm, () => scrollTo(0, 0));
    await pm.locator("#chart").focus({ preventScroll: true });
    const y0 = await ev(pm, () => scrollY);
    await ev(pm, () => addEventListener("keydown", e => { window.__prevented = e.defaultPrevented; }, { once: true }));
    await pm.keyboard.press("Space");
    await sleep(300);
    const sp = { prevented: await ev(pm, () => window.__prevented), moved: (await ev(pm, () => scrollY)) !== y0 };
    await ev(pm, () => addEventListener("keydown", e => { window.__prevented = e.defaultPrevented; }, { once: true }));
    await pm.keyboard.press("Shift+Space");
    const shift = await ev(pm, () => window.__prevented);
    line("Space on the message's box is kept from scrolling the page; Shift+Space is left to the browser", sp.prevented && !sp.moved && shift === false,
      `Space ${sp.prevented ? "prevented" : "KEPT"}, page ${sp.moved ? "SCROLLED" : "still"}; Shift+Space ${shift ? "PREVENTED" : "kept"}`);
    await c.shot(pm, "message");
    await pm.done();
    // The mini rate chart in the open type's detail shows once #chartView scrolls away.
    // With a type open the other layers dim, so the readers' columns are fewer: drawn means its svg is there.
    const pd = await h.open({ path: "/errors?range=30&cat=tests", root: ROOT, setup: errReaders, data: DATA, answer: full, ready: p => p.waitForSelector(".chart-card .echart-plot svg") }, "mini chart");
    await ev(pd, () => scrollTo(0, 0));
    await pd.locator(ROOT).scrollIntoViewIfNeeded();
    const inView = await until(() => ev(pd, () => document.querySelector("#mini")?.hidden), x => x === true);
    await ev(pd, () => scrollBy(0, document.querySelector("#chartView").getBoundingClientRect().bottom + 10));
    const outOf = await until(() => ev(pd, () => ({ hidden: document.querySelector("#mini")?.hidden, view: Math.round(document.querySelector("#chartView").getBoundingClientRect().bottom) })), x => x.hidden === false);
    line("the mini rate chart shows once #chartView scrolls out of view, and not while it is in view", inView === true && outOf.hidden === false,
      `in view: mini ${inView ? "hidden" : "SHOWN"}; scrolled (chart view's bottom at ${outOf.view}px): mini ${outOf.hidden ? "HIDDEN" : "shown"}`);
    await pd.done();
  }

  // A phone's width, by week over 90 days (the long type renamed, its fix on the newest week): the edges and labels of
  // checks.mjs, a click on the newest week, its rate point, the title, the fix's label; at 32px text the title cut with
  // "…" and the fix's label left out.
  {
    const answer = d => fixed(renamed(full(d)), { tests: 29 });
    const WEEKS = pointsOf(answer(structuredClone(store)), 90, true).map(p => p.k);
    const weekly = { name: "errors-weeks", path: "/errors?range=90&gran=week", root: ROOT, unit: { one: "week", many: "weeks" }, at: 3,
      label: week, said: k => day(k), data: DATA, setup: errReaders, newer: d => d, kept, points: WEEKS, answer };
    const narrow = async (on, page, what, big) => {
      const cols = await on.edges(page, what);
      // The chip names a week as the page does: "Week of Nov 16".
      const newest = cols.at(-1), want = `Week of ${day(on.P.at(-1))}`, g = await ev(page, () => window.chartfit.grid());
      await page.mouse.click(newest.x, g.t + (g.b - g.t) * .75);
      const s = await until(() => sel(page), s => s.chip === want && s.frame);
      line(`${what}: a click on the newest week's bar selects it, its frame centred on the bar, within 1px`, s.chip === want && Math.abs(mid(s.frame) - newest.x) <= 1,
        `chip "${s.chip}", frame at ${s.frame ? mid(s.frame).toFixed(1) : "none"}px, bar at ${newest.x.toFixed(1)}px`);
      await on.shot(page, `${what.includes("32px") ? "weeks-32px" : "narrow"}-selected`);
      overLine(what, await overBars(page));
      if (s.chip) await page.locator("#atClr").click();
      await until(() => sel(page), s => !s.chip && !s.frame);
      await away(page);
      await on.labelsFit(page, what, true);
      // The long type selected from the legend: its title.
      await page.locator('#legend button[data-c="tests"]').click();
      await until(() => ev(page, () => window.chartfit.texts().some(x => x.text.startsWith("Bash exit"))), Boolean);
      await on.shot(page, `${what.includes("32px") ? "weeks-32px" : "narrow"}-type`);
      // Both titles: the rate track's names the long type; each starts at the plot's left edge, the frame's top over it.
      const t = await ev(page, () => ({ titles: window.chartfit.texts().filter(x => x.text.startsWith("Bash exit") || x.text.startsWith("Failed calls per")), g: window.chartfit.grid(), fixes: window.errfit.fixes() }));
      const rt = t.titles.find(x => x.text.startsWith("Bash exit"));
      line(`${what}: both track titles end inside the plot, the selected type's ${big ? "cut with \"…\"" : "in full or cut with \"…\""}`, t.titles.length === 2 && t.titles.every(x => x.l >= t.g.l - .5 && x.r <= t.g.r + .5) && (!big || rt?.text.endsWith("…")),
        `${t.titles.map(x => `"${x.text}" ${x.l.toFixed(1)}..${x.r.toFixed(1)}px`).join(", ") || "no title"}; plot ${t.g.l.toFixed(1)}..${t.g.r.toFixed(1)}px`);
      const fl = t.fixes.labels, need = await ev(page, ([text, size]) => window.errfit.measure(text, size), [`✓ ${shortLabel(LONG)}`, Math.max(...(await ev(page, () => window.chartfit.texts().map(x => x.size))))]);
      const room = Math.max(t.g.r - newest.x, newest.x - t.g.l) - 4;
      line(`${what}: the newest week's fix draws its line, and its label ${need <= room ? "inside the plot" : "is left out: it fits neither side"}`, t.fixes.lines.length === 1 && (need <= room ? fl.length === 1 && fl[0].l >= t.g.l - .5 && fl[0].r <= t.g.r + .5 : fl.length === 0),
        `${t.fixes.lines.length} line(s); ${fl.map(x => `"${x.text}" ${x.l.toFixed(1)}..${x.r.toFixed(1)}px`).join(", ") || "no label"}; the label needs ${Math.round(need)}px, ${Math.round(room)}px on the wider side; plot ${t.g.l.toFixed(1)}..${t.g.r.toFixed(1)}px`);
    };
    const phone = { viewport: { width: PHONE, height: 900 } };
    const wk = chart(h, weekly);
    const p = await wk.open(`${PHONE}px window, ${WEEKS.length} weeks`, phone);
    const bw = await ev(p, () => Math.round(window.chartfit.box().w));
    await wk.shot(p, "narrow");
    await narrow(wk, p, `a ${bw}px box, ${WEEKS.length} weeks`, false);
    await p.done();
    const p32 = await wk.open(`${PHONE}px window, ${WEEKS.length} weeks, 32px root`, phone, root32);
    const bw32 = await ev(p32, () => Math.round(window.chartfit.box().w));
    await wk.shot(p32, "narrow-32px");
    await narrow(wk, p32, `a ${bw32}px box at 32px text, ${WEEKS.length} weeks`, true);
    await p32.done();
    // The web font arriving after the first drawing: the chart, drawn and cut in the fallback font, is drawn again when
    // IBM Plex Sans has loaded, with no interaction. The font is held back until the chart has drawn: routing turns the
    // HTTP cache off, so the reload fetches it again.
    {
      const pf = await wk.open(`${PHONE}px window, ${WEEKS.length} weeks, 32px root, the font late`, phone, root32);
      let release;
      const held = new Promise(r => { release = r; });
      await pf.route(/fonts\.gstatic\.com/, async route => { await held; await route.continue().catch(() => {}); });
      await pf.reload();
      await until(() => drawn(pf), n => n > 0);
      const plex = () => ev(pf, () => [...document.fonts].some(f => f.family.includes("IBM Plex Sans") && f.weight === "500" && f.status === "loaded"));
      const early = await plex();
      release();
      await ev(pf, () => document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))));
      const title = () => ev(pf, () => ({ t: window.chartfit.texts().find(x => x.text.startsWith("Failed calls per")), g: window.chartfit.grid() }));
      const got = await until(title, x => x.t && x.t.r <= x.g.r + .5);
      const late = await plex();
      line(`a ${bw32}px box at 32px text, by week, the font loaded after the first drawing: the default title ends inside the plot, with no interaction`,
        !early && late && !!got.t && got.t.l >= got.g.l - .5 && got.t.r <= got.g.r + .5,
        `IBM Plex Sans 500 ${early ? "ALREADY LOADED" : "not loaded"} at the first drawing, ${late ? "loaded" : "NOT LOADED"} after; ${got.t ? `"${got.t.text}" ${got.t.l.toFixed(1)}..${got.t.r.toFixed(1)}px` : "no title"}; plot ${got.g.l.toFixed(1)}..${got.g.r.toFixed(1)}px`);
      await pf.done();
    }
  }

  // About 98 weeks in a 343px box: the selected week's frame stays visible and no wider than its band, as the fix line.
  {
    const answer = d => fixed(older(full(d), 8), { tests: 29 });
    const W98 = pointsOf(answer(structuredClone(store)), 0, true).map(p => p.k);
    const J = W98.length - 30;
    const wk = chart(h, { name: "errors-98", path: `/errors?range=0&gran=week&at=${W98[J]}`, root: ROOT, unit: { one: "week", many: "weeks" }, at: 3, label: week, said: k => day(k), data: DATA, setup: errReaders, newer: d => d, kept, points: W98, answer });
    const page = await wk.open(`${PHONE}px window, ${W98.length} weeks`, { viewport: { width: PHONE, height: 900 } });
    const got = await ev(page, () => ({ frame: window.errfit.selection(), g: window.chartfit.grid(), fixes: window.errfit.fixes().lines }));
    const band = (got.g.r - got.g.l) / W98.length;
    line(`${W98.length} weeks in a ${Math.round(got.g.r - got.g.l)}px plot: the selected week's frame is drawn, visible and no wider than its ${band.toFixed(1)}px band; the fix line no wider either`,
      !!got.frame && got.frame.w > 0 && got.frame.width > 0 && got.frame.w <= band + .5 && Math.abs(mid(got.frame) - centre(got.g, J, 0, W98.length - 1)) <= 1 && got.fixes.length === 1 && got.fixes[0].sw <= band + .01,
      got.frame ? `frame ${got.frame.w.toFixed(2)}px wide, stroke ${got.frame.width}px rgb(${got.frame.stroke}), at ${mid(got.frame).toFixed(1)}px for ${centre(got.g, J, 0, W98.length - 1).toFixed(1)}px; fix line ${got.fixes.map(x => `${x.sw}px`).join(", ") || "none"}` : "no frame");
    await wk.shot(page, "98-weeks");
    await page.done();
  }

  // 1440px at 30 days and 32px text in a 900px window: the shared edges and labels.
  {
    const page = await c.open("edges, 1440px");
    await c.edges(page, `a ${Math.round((await ev(page, () => window.chartfit.box().w)))}px box`);
    await c.labelsFit(page, "1440px, 30 days", true);
    await page.done();
    const p32 = await c.open("edges, 32px root", { viewport: { width: 900, height: 900 } }, root32);
    const bw = await ev(p32, () => Math.round(window.chartfit.box().w));
    await c.edges(p32, `a ${bw}px box at 32px text`);
    await c.labelsFit(p32, `a ${bw}px box at 32px text`, true);
    overLine(`a ${bw}px box at 32px text`, await overBars(p32));
    await p32.done();
  }

  await c.refresh();
  await c.refreshRead();
  // Newer figures keep the selection, and say nothing.
  {
    const J = I + 1;
    const page = await c.openOn({ path: `/errors?range=30&at=${DAYS[J]}` }, "refresh, selected");
    let more = 0;
    await c.newerOn(page, () => more);
    const bars = () => ev(page, () => JSON.stringify(window.chartfit.bars().map(r => [Math.round(r.l), Math.round(r.t), Math.round(r.h)])));
    const before = await bars();
    await ev(page, () => window.errfit.listen());
    more = 1000;
    await ev(page, () => window.dispatchEvent(new Event("visibilitychange")));
    const after = await until(bars, s => s !== before);
    await sleep(500);
    const s = await sel(page), g = await ev(page, () => window.chartfit.grid()), said = await ev(page, () => window.errfit.heard().map(x => x.text).filter(Boolean));
    line("newer figures keep the selected day, its frame and chip, and say nothing", after !== before && s.url.includes(`at=${DAYS[J]}`) && !!s.frame && Math.abs(mid(s.frame) - centre(g, J)) <= 1.5 && s.chip === day(DAYS[J]) && !said.length,
      `${after !== before ? "redrawn" : "NOT REDRAWN"}; frame ${s.frame ? "drawn" : "gone"}, chip "${s.chip}"; said ${JSON.stringify(said)}`);
    await page.done();
  }

  await c.motion();
  await c.motionOnce([
    ["a theme change", page => c.theme(page, "dark")],
    ["a type from the legend", async page => { await page.locator("#legend button").nth(1).click(); await sleep(300); }],
    ["a zoom out", async page => {
      await box(page).focus();
      await page.keyboard.press("+");
      await until(() => drawn(page), n => n < N);
      await page.keyboard.press("-");
      await until(() => drawn(page), n => n === N);
    }],
    ["a refresh", (page, refresh) => refresh()],
  ]);
  await c.reducedMotion();
}
