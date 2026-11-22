// Context's charts, each from its descriptor: the shared checks of checks.mjs, then its own lines (echart-context,
// decision 17). Each chart has its own function, run in turn by context().
//
// The cache chart on /context?range=30&tab=cache: the bars of the tokens not read from the cache, the cache breaks by
// cause and the cache-hit ratio, three tracks on one frame. The demo store can leave a day of the 30 without a request,
// and a day without a bar draws no column for the readers: every view is answered with each of the last 30 days given a
// row where it had none, and each break cause on some day. Its own lines:
// - the bars are the two kinds' tokens and the breaks the three causes', in light and dark;
// - forced colors, with an empty day, a lone day and the cache reads on: each part keeps its fill in a CanvasText edge, the
//   cache-read edge is gone, the ratio line and its dots are CanvasText, every stroke is a system color;
// - 32px text: the box is 484px with the slider (392px at 16px), each track keeps 180, 48 and 44px;
// - one band from the top of the bars to the bottom of the ratio track, for the pointer in each track and each gap and for
//   Home, Right and End; the pointer over the day labels reads nothing; each day's ratio point sits over its bar's
//   middle, at its ratio, zoomed and not;
// - zoom: plus stops at 7 days; the three tracks show the same days by plus and by a real drag; the scales hold; "Show all
//   days" ends the legend row, and a Tab from it goes to the chart; the slider's faint trend follows the bars, not the
//   ratio; the URL, the requests and the data table stay; the slider shows from 14 days and not at 13; by week the words
//   name weeks;
// - an empty day: the keys and the pointer read it, the tooltip has its date in the head style of a day with data, then
//   "No request", the live region says its sentence once; nothing is drawn on it and the ratio line does not cross it; a
//   lone day has its dot;
// - "Cache reads": a third part with its 1px edge, the axis rescaled, the title "Prompt tokens", the toggle pressed; it
//   keeps the zoom and the pointer's reading;
// - the three titles end inside the plot at 1440px, in the PHONE window and at 32px text in both, after the web font's
//   redraw; the bars' title gives its long figure at 1440px; "Show all days" stays inside a 343px box;
// - Tab onto the chart draws its focus ring.
//
// The growth chart on /context?range=30&tab=growth and the weekly start chart on /context?range=30 draw no opaque bar, so
// lineReaders() fits the shared readers to them: their points are the growth chart's strip bars, and the weekly chart's
// line points and dots; a tooltip's head is named as the live sentence starts ("Turn 12:"), since "Turn 1" starts
// "Turn 12". Of the shared checks they run the forced colors (the growth chart's), the 32px text, the pointer and the keys,
// the edges and the labels at 1440px, in the PHONE window and at 32px text, Escape elsewhere and the refresh while
// reading; the legend's colors, the zoom, the backfill and the bars' growth do not apply. The growth chart's own lines:
// - in light and dark, each project line is its legend key's color and the median --text-primary;
// - forced colors: the median CanvasText on a Canvas halo, each project line in its color on a 4.5px Canvas halo, the
//   band a system color, every other stroke a system color, the tooltip's swatches drawn in their lines' colors;
// - the box 302px at 16px text and 364px at 32px, the curve 218px and the strip 22px; the strip's title ends inside the
//   plot at 1440px, in the PHONE window and at 32px text in both;
// - one band from the curve's top to the strip's bottom, for the pointer in the curve, the gap and the strip and for
//   Home, Right and End; each strip bar under its turn's point; the band's polygon at the 25th and 75th percentile at
//   three turns; the turn labels 1, the round turns and the last;
// - the tooltip: its rows, its 8px swatches in their lines' colors, no row for a project whose curve has ended, inside the
//   box at the last turn, also in the PHONE window;
// - "Share of window" with the chart focused: the reading ends, the dashed line at 80% with its label inside the plot,
//   the axis in percent; isolating a project with the chart focused: one line, 3px, the band in its color at .18, the
//   reading kept; a mouse click and the keyboard on a project button move the focus there, which ends the reading;
// - Tab onto the chart draws its focus ring; with motion on the strip grows and the lines draw in, with reduced motion
//   nothing moves.
// The weekly start chart's own lines:
// - in light and dark, the median is --text-primary and the band --text-secondary;
// - forced colors: the axis text CanvasText, the week read a Highlight band, the median CanvasText on a Canvas halo, the
//   band a system color, every stroke a system color;
// - the box 180px at 16px text and 216px at 32px, the plot 144px in both; the 30k line dashed at 30k with its label inside
//   the plot at both; at 32px text set after the page loaded, a key redraws inside the box;
// - with a payload of 9 weeks, the second of 2 sessions and the fourth and sixth empty: two band polygons and one span,
//   the median in three parts, a hollow and a solid dot; the keys and the pointer read an empty week, its tooltip says
//   "No session started", the live region says its sentence once; the week of 2 sessions rests on few sessions;
// - Shift+Tab onto the chart draws its focus ring; with motion on the line draws in, with reduced motion nothing moves.
import { LOCALE, PHONE, W, line, sleep, until } from "./harness.mjs";
import { chart, root32 } from "./checks.mjs";

const DATA = /\/api\/context(\?.*)?$/;
const DAY = 864e5;
const day = (k, long = false) => new Date(k + "T00:00:00Z").toLocaleDateString(LOCALE, { month: "short", day: "numeric", timeZone: "UTC", ...(long ? { year: "numeric" } : {}) });
const week = (k, long = false) => (long ? `Week of ${day(k, true)}` : day(k));
const plus = (k, n) => new Date(Date.parse(k + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
const span = (a, b) => { const out = []; for (let k = a; k <= b; k = plus(k, 1)) out.push(k); return out; };
const monday = k => plus(k, -((new Date(k + "T00:00:00Z").getUTCDay() + 6) % 7));
const mid = r => (r ? (r.l + r.r) / 2 : NaN);
const px = n => (Number.isFinite(n) ? `${n.toFixed(1)}px` : "none");
const corr = (xs, ys) => {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  const sxy = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0), sx = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0)), sy = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0));
  return sxy / (sx * sy);
};
/** Waits for the web font, and for the chart's redraw once it has loaded: the swap moves the chart and widens its texts. */
const settle = async page => {
  await page.evaluate(() => document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))));
  await sleep(150);
};

export async function context(h) {
  await cache(h);
  await growth(h);
  await weeks(h);
}

/** The cache chart's own readers, installed in every page before its scripts as window.cachefit, beside window.chartfit.
 *  This function runs in the page: it uses nothing from this module. The marks it tells apart are paths of ECharts' SVG:
 *  - the tracks, from the grid lines: the bars' lines at their ticks, then two each for the breaks and the ratio (their
 *    axes go in one step), top to bottom;
 *  - a part: a bar segment of chartfit.bars(), on the track that holds it;
 *  - the ratio line: stroked, unfilled, undashed paths on the ratio track, one subpath per run of days;
 *  - the cache-read edge: a closed, stroked, unfilled path on the bars' track;
 *  - the slider's faint trend: a half-opaque stroked path under the frame. */
function cacheReaders() {
  const R = ".cache-chart";
  const tri = c => (String(c).match(/[\d.]+/g) || []).slice(0, 3).map(n => Math.round(Number(n))).join(",");
  const rect = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const svg = () => document.querySelector(`${R} .echart-plot svg`);
  const top = () => [...(svg()?.querySelector(":scope > g")?.children ?? [])];
  const all = () => [...(svg()?.querySelectorAll("path") ?? [])].filter(e => !e.closest("clipPath, defs"));
  const at = (e, n) => e.getAttribute(n);
  const fill = e => at(e, "fill") ?? "none";
  const stroked = e => (at(e, "stroke") ?? "none") !== "none";
  const open = e => fill(e) === "none" && stroked(e) && at(e, "stroke-opacity") !== "0";
  const within = (r, tr) => r.t >= tr.t - 2 && r.b <= tr.b + 2;
  /** A path's subpaths, each as its points on the screen. */
  const subpaths = e => {
    const m = e.getScreenCTM(), p = svg().createSVGPoint();
    return (at(e, "d") ?? "").split("M").filter(s => s.trim()).map(s => [...`M${s}`.matchAll(/[ML](-?[\d.]+)[ ,](-?[\d.]+)/g)].map(([, x, y]) => {
      p.x = Number(x); p.y = Number(y);
      const q = p.matrixTransform(m);
      return { x: q.x, y: q.y };
    }));
  };
  const region = () => document.querySelector(`${R} .echart + .sr`);
  const tracks = () => {
    const g = window.chartfit.grid();
    if (!g) return null;
    const ys = [...new Set(top().filter(e => e.tagName === "path" && fill(e) === "none" && rect(e).h < 1 && rect(e).w > 0).map(e => Math.round(rect(e).t * 2) / 2))].sort((a, b) => a - b);
    const n = ys.length;
    if (n < 6) return { g, ys };
    return { g, ys, bars: { t: ys[0], b: ys[n - 5] }, breaks: { t: ys[n - 4], b: ys[n - 3] }, ratio: { t: ys[n - 2], b: ys[n - 1] } };
  };
  window.cachefit = {
    tracks,
    /** The parts on a track ("bars" or "breaks"). */
    parts: name => { const t = tracks(); return t?.[name] ? window.chartfit.bars().filter(b => within(b, t[name])) : []; },
    /** Each column of parts on a track, left first: its edges, centre and height, so its total. */
    columns(name) {
      const cols = new Map();
      for (const b of this.parts(name)) { const k = Math.round(b.l), c = cols.get(k) ?? { l: b.l, r: b.r, h: 0, t: b.t, b: b.b }; c.h += b.h; c.t = Math.min(c.t, b.t); c.b = Math.max(c.b, b.b); cols.set(k, c); }
      return [...cols.values()].sort((a, b) => a.l - b.l).map(c => ({ ...c, x: (c.l + c.r) / 2 }));
    },
    /** The ratio line: its strokes, each with its subpaths' points; not a grid line, flat across the plot. */
    ratio() {
      const t = tracks(), grid = e => rect(e).h < 1 && Math.abs(rect(e).w - (t.g.r - t.g.l)) < 1;
      return t?.ratio ? all().filter(e => open(e) && !at(e, "stroke-dasharray") && (at(e, "d") ?? "").includes("L") && within(rect(e), t.ratio) && !grid(e))
        .map(e => ({ stroke: tri(at(e, "stroke")), width: Number(at(e, "stroke-width") ?? 1), runs: subpaths(e) })) : [];
    },
    /** The dots on the ratio track. */
    dots() { const t = tracks(); return t?.ratio ? window.chartfit.dots().filter(d => within(d, t.ratio)) : []; },
    /** The closed, unfilled, stroked paths on the bars' track: the cache-read edge. */
    edges() {
      const t = tracks();
      return t?.bars ? all().filter(e => open(e) && /Z\s*$/i.test(at(e, "d") ?? "") && within(rect(e), t.bars))
        .map(e => ({ stroke: tri(at(e, "stroke")), width: Number(at(e, "stroke-width") ?? 1), ...rect(e) })) : [];
    },
    /** The slider's faint trend: its points on the screen, left first. */
    trend() {
      const g = window.chartfit.grid(), e = g && all().find(e => open(e) && at(e, "stroke-opacity") === "0.5" && rect(e).t > g.b);
      return e ? subpaths(e).flat().sort((a, b) => a.x - b.x) : [];
    },
    /** Every visible stroke the chart draws, by its color: how many, and one such mark. */
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
    /** The tooltip, open: its head's text and weight, its whole text, its rows. */
    tip() {
      const t = document.querySelector(`${R} .echart .tip`);
      if (!t || getComputedStyle(t).display === "none") return null;
      const head = t.querySelector(".head");
      return { head: head?.textContent ?? "", weight: head ? getComputedStyle(head).fontWeight : "", text: t.textContent, rows: t.querySelectorAll(".row").length, ...rect(t) };
    },
    /** The value labels left of the plot, top first. */
    values() { const g = window.chartfit.grid(); return g ? window.chartfit.texts().filter(x => x.r < g.l + 2).sort((a, b) => a.t - b.t).map(x => x.text) : []; },
    /** The track titles, by their starts. */
    titles: () => window.chartfit.texts().filter(x => /^(Tokens not read|Prompt tokens|Cache breaks|Cache-hit ratio)/.test(x.text)),
    rect: sel => { const e = document.querySelector(sel); return e ? rect(e) : null; },
    /** The live region's texts from now on, each noted when it differs from the last. */
    listen() {
      window.__heard = [];
      window.__last = region()?.textContent ?? "";
      if (window.__hearing) return;
      window.__hearing = true;
      new MutationObserver(() => {
        const text = region()?.textContent ?? "";
        if (text !== window.__last) { window.__last = text; window.__heard.push(text); }
      }).observe(document.body, { childList: true, characterData: true, subtree: true });
    },
    heard: () => window.__heard ?? [],
  };
}

async function cache(h) {
  const ROOT = ".cache-chart";
  const store = await h.json("/api/context?range=30");
  /** Each of the last 30 days given a row where it had none, and each break cause on some day. */
  const full = d => {
    const s = d.cost.series, have = new Map(s.rows.map(r => [r.day, r]));
    s.rows = span(plus(d.end, -29), d.end).map((k, i) => have.get(k) ?? { day: k, input: 40000 + 1000 * i, cache_write: 30000, cache_read: 600000, model_switch: 0, expired: 0, other: 0 });
    for (const [j, cause] of [[3, "model_switch"], [4, "expired"], [5, "other"]]) if (!s.rows.some(r => r[cause] > 0)) s.rows[j][cause] = 2;
    return d;
  };
  /** The days at these indexes of the 30 left with no request. */
  const quiet = (d, idx) => { const out = new Set(idx.map(i => plus(d.end, i - 29))); d.cost.series.rows = d.cost.series.rows.filter(r => !out.has(r.day)); return d; };
  /** Only the last n days have a request. */
  const last = (d, n) => { d.cost.series.rows = d.cost.series.rows.filter(r => r.day > plus(d.end, -n)); return d; };
  /** By week: 20 weeks to the current one, each a day's figures. */
  const weekly = d => {
    const rows = full(d).cost.series.rows, m0 = monday(d.end);
    d.cost.series = { bucket: "week", rows: Array.from({ length: 20 }, (_, i) => ({ ...rows[i % rows.length], day: plus(m0, -7 * (19 - i)) })) };
    return d;
  };
  const DAYS = full(structuredClone(store)).cost.series.rows.map(r => r.day);
  const kept = [["heading", "#costTitle"], ["caption", `${ROOT} .caption`]];
  const c = chart(h, {
    name: "context-cache", path: "/context?range=30&tab=cache", root: ROOT, points: DAYS, label: day, unit: { one: "day", many: "days" }, at: 9, // day 10
    data: DATA, setup: cacheReaders, answer: full, activates: false,
    // Today's uncached input up, so the bars change and day 10 does not.
    newer: (d, more) => { const r = d.cost.series.rows.at(-1); r.input += more * 1000; return d; },
    kept,
    fewer: (d, n) => { d.cost.series.rows = d.cost.series.rows.filter(r => r.day >= DAYS[n]); return d; },
  });
  const { N, I, named, centre, ev, drawn, away, box, state, onPoint, shownBy } = c;
  const probe = (page, css) => ev(page, css => window.chartfit.probe(css), css);
  const tracks = page => ev(page, () => window.cachefit.tracks());
  const spans = (s, t) => s.band && Math.abs(s.band.t - t.bars.t) <= 1.5 && Math.abs(s.band.b - t.ratio.b) <= 1.5;
  const heights = t => (t?.bars ? [t.bars.b - t.bars.t, t.breaks.b - t.breaks.t, t.ratio.b - t.ratio.t] : []);
  const tracksText = t => (t?.bars ? `bars ${t.bars.t}..${t.bars.b}px, breaks ${t.breaks.t}..${t.breaks.b}px, ratio ${t.ratio.t}..${t.ratio.b}px` : `grid lines at ${t?.ys?.join(", ")}`);
  const focusOn = page => ev(page, () => { const a = document.activeElement; return a?.id ? `#${a.id}` : a === document.body ? "body" : (a?.className || a?.tagName || "none"); });
  const toggle = page => page.locator(`${ROOT} .legend .toggle`);
  // Each day's cache-hit ratio, as the payload gives it, and the ratio track's low end, as cacheTracks.ts works them out.
  const RATIOS = full(structuredClone(store)).cost.series.rows.map(r => r.cache_read / (r.input + r.cache_read + r.cache_write));
  const FLOOR = Math.max(0, Math.min(.9, Math.floor(Math.min(...RATIOS, 1) * 10 + 1e-9) / 10));
  /** Each bar shown has one ratio point over its middle, at its day's ratio on the ratio track, within 1px; from: the
   *  index of the first day shown. */
  const overLine = async (page, what, from = 0) => {
    const got = await ev(page, () => ({ cols: window.cachefit.columns("bars").map(c => c.x), t: window.cachefit.tracks(),
      pts: [...window.cachefit.ratio().flatMap(l => l.runs.flat()), ...window.cachefit.dots().map(d => ({ x: d.x, y: d.y }))] }));
    const y = r => got.t.ratio.t + (1 - r) / (1 - FLOOR) * (got.t.ratio.b - got.t.ratio.t);
    let dx = 0, dy = 0, missing = 0;
    got.cols.forEach((x, k) => {
      const p = got.pts.find(p => Math.abs(p.x - x) <= 1);
      if (!p) { missing++; return; }
      dx = Math.max(dx, Math.abs(p.x - x));
      dy = Math.max(dy, Math.abs(p.y - y(RATIOS[from + k])));
    });
    line(`${what}: each day's ratio point sits over the middle of its bar, at its day's ratio, within 1px`, got.cols.length > 0 && got.pts.length === got.cols.length && !missing && dy <= 1,
      `${got.pts.length} ratio points over ${got.cols.length} bars from day ${from + 1}, ${missing} bars with none; the farthest ${dx.toFixed(2)}px off the bar's middle, ${dy.toFixed(2)}px off its ratio`);
  };
  /** The three tracks show the same days: as many bars as days shown, each break column and each ratio point over a bar. */
  const together = page => ev(page, () => {
    const bars = window.cachefit.columns("bars"), brk = window.cachefit.columns("breaks"), pts = window.cachefit.ratio().flatMap(l => l.runs.flat());
    const off = xs => (xs.length ? Math.max(...xs.map(x => Math.min(...bars.map(b => Math.abs(b.x - x))))) : 0);
    return { bars: bars.length, breaks: brk.length, ratio: pts.length, brkOff: off(brk.map(b => b.x)), ratioOff: off(pts.map(p => p.x)), first: bars[0]?.x, last: bars.at(-1)?.x,
      rl: Math.min(...pts.map(p => p.x)), rr: Math.max(...pts.map(p => p.x)) };
  });
  const togetherOk = (s, n) => s.bars === n && s.ratio === n && s.brkOff <= 1 && s.ratioOff <= 1;
  const togetherText = s => `${s.bars} bars ${px(s.first)}..${px(s.last)}, ${s.breaks} break columns (farthest ${s.brkOff.toFixed(2)}px off a bar), ${s.ratio} ratio points ${px(s.rl)}..${px(s.rr)} (farthest ${s.ratioOff.toFixed(2)}px off)`;
  /** The three titles inside the plot, their em box inside the chart's box. */
  const titleLine = async (page, what, want = null) => {
    await settle(page);
    const t = await ev(page, () => ({ titles: window.cachefit.titles(), g: window.chartfit.grid(), box: window.chartfit.box() }));
    const em = x => (x.t + x.b - x.size) / 2;
    const inside = t.titles.length === 3 && t.titles.every(x => x.l >= t.g.l - .5 && x.r <= t.g.r + .5 && em(x) >= t.box.t - .5);
    line(`${what}: the three track titles end inside the plot${want ? `, the bars' with its long figure` : ""}`, inside && (!want || want(t.titles)),
      `${t.titles.map(x => `"${x.text}" ${x.l.toFixed(1)}..${x.r.toFixed(1)}px`).join(", ") || "no title"}; plot ${t.g.l.toFixed(1)}..${t.g.r.toFixed(1)}px`);
  };

  await c.colors();
  await c.readColors();

  // The parts' colors by track, in light and dark: the bars two kinds, the breaks the three causes' tokens.
  {
    const page = await c.open("track colors");
    const got = [];
    for (const scheme of ["light", "dark"]) {
      await c.theme(page, scheme);
      const want = {};
      for (const k of ["--accent", "--series-1", "--cache-switch", "--cache-expired", "--text-muted"]) want[k] = await probe(page, `var(${k})`);
      const r = await until(() => ev(page, () => ({ bars: [...new Set(window.cachefit.parts("bars").map(b => b.fill))], breaks: [...new Set(window.cachefit.parts("breaks").map(b => b.fill))] })),
        r => r.bars.includes(want["--accent"]));
      got.push({ scheme, want, ...r });
    }
    const same = (a, b) => a.length === b.length && a.every(x => b.includes(x));
    line("the bars are --accent and --series-1, the breaks --cache-switch, --cache-expired and --text-muted, in light and in dark",
      got.every(x => same(x.bars, [x.want["--accent"], x.want["--series-1"]]) && same(x.breaks, [x.want["--cache-switch"], x.want["--cache-expired"], x.want["--text-muted"]])) && got[0].want["--cache-switch"] !== got[1].want["--cache-switch"],
      got.map(x => `${x.scheme}: bars ${x.bars.map(f => `rgb(${f})`).join(", ")}, breaks ${x.breaks.map(f => `rgb(${f})`).join(", ")}; tokens ${Object.entries(x.want).map(([k, v]) => `${k} rgb(${v})`).join(", ")}`).join("; "));
    await page.done();
  }

  await c.forcedColors();
  // Forced colors with an empty day, a lone day after it, and the cache reads on.
  const E = 12;
  {
    const page = await c.openOn({ answer: d => quiet(full(d), [E, E + 2]), points: N - 2 }, "forced colors, cache reads", { forcedColors: "active" });
    await toggle(page).click();
    const ct = await probe(page, "CanvasText"), track = await probe(page, "var(--track)");
    const got = await until(() => ev(page, () => ({ bars: window.chartfit.bars(), edges: window.cachefit.edges(), ratio: window.cachefit.ratio(), dots: window.cachefit.dots() })),
      r => r.bars.some(b => b.fill === track));
    const tri = s => (String(s).match(/[\d.]+/g) || []).slice(0, 3).map(n => Math.round(Number(n))).join(",");
    const fills = [...new Set(got.bars.map(b => b.fill))], stroke = [...new Set(got.bars.map(b => b.stroke))];
    line("forced colors: each part keeps its fill in a CanvasText edge, the cache reads' too", got.bars.length > 0 && fills.includes(track) && !fills.includes(ct) && stroke.length === 1 && tri(stroke[0]) === ct,
      `${got.bars.length} parts in ${fills.map(f => `rgb(${f})`).join(", ")}; edges ${stroke.map(s => `rgb(${tri(s)})`).join(", ")}; CanvasText rgb(${ct})`);
    line("forced colors, cache reads on: the cache-read edge is not drawn", got.edges.length === 0, `${got.edges.length} closed edges: ${got.edges.slice(0, 3).map(x => `rgb(${x.stroke}) ${Math.round(x.w)}x${Math.round(x.h)}`).join(", ")}`);
    // A dot is CanvasText in a ring of the page's color (Canvas), which sets it off the line.
    const ink = [...got.ratio.map(l => l.stroke), ...got.dots.map(x => x.fill)];
    line("forced colors: the ratio line, in its parts, and the lone day's dot are CanvasText", got.ratio.flatMap(l => l.runs).length >= 2 && got.dots.length === 1 && ink.every(x => x === ct),
      `${got.ratio.flatMap(l => l.runs).length} runs in ${got.ratio.map(l => `rgb(${l.stroke}) ${l.width}px`).join(", ")}; ${got.dots.length} dot(s) ${got.dots.map(x => `rgb(${x.fill}) in rgb(${x.stroke})`).join(", ")}`);
    const sys = { CanvasText: ct, GrayText: await probe(page, "GrayText"), Highlight: await probe(page, "Highlight"), Canvas: await probe(page, "Canvas") };
    const g = await ev(page, () => window.chartfit.grid());
    await page.mouse.move(centre(g, I), (g.t + g.b) / 2);
    await until(() => state(page), s => s.band);
    const sysName = Object.fromEntries(Object.entries(sys).map(([k, v]) => [v, k]));
    const strokes = await ev(page, () => window.cachefit.strokes()), odd = Object.keys(strokes).filter(k => !sysName[k]);
    line("forced colors: every stroke in the chart is CanvasText, GrayText, Highlight or Canvas", Object.keys(strokes).length > 0 && !odd.length,
      Object.entries(strokes).map(([k, x]) => `${sysName[k] ?? `NOT A SYSTEM COLOR rgb(${k})`} ${x.n}x, e.g. ${x.e}`).join("; "));
    await c.shot(page, "forced-colors-reads");
    await page.done();
  }

  await c.textSize();
  // 32px text: the box grows by the margins and gaps alone; the tracks keep their height; the titles stay in the plot.
  {
    const measure = async page => { await settle(page); return { t: await tracks(page), h: Math.round(await ev(page, () => window.chartfit.box().h)) }; };
    const p16 = await c.open("16px root, tracks");
    const at16 = await measure(p16);
    await titleLine(p16, "1440px", ts => ts.some(x => x.text.endsWith(" in this view") && /^Tokens not read from the cache · /.test(x.text)));
    await c.edges(p16, `a ${Math.round(await ev(p16, () => window.chartfit.box().w))}px box`);
    await c.labelsFit(p16, "1440px, 30 days", true);
    await p16.done();
    const p32 = await c.open("32px root, tracks", {}, root32);
    const at32 = await measure(p32);
    line("the box is 392px at 16px text and 484px at 32px, with the slider; the tracks keep 180, 48 and 44px", at16.h === 392 && at32.h === 484 && heights(at16.t).join() === "180,48,44" && heights(at32.t).join() === "180,48,44",
      `box ${at16.h}px, then ${at32.h}px; tracks ${heights(at16.t).join(", ") || tracksText(at16.t)}px, then ${heights(at32.t).join(", ") || tracksText(at32.t)}px`);
    await titleLine(p32, "32px root");
    const bw = await ev(p32, () => Math.round(window.chartfit.box().w));
    await c.edges(p32, `a ${bw}px box at 32px text`);
    await c.labelsFit(p32, `a ${bw}px box at 32px text`, true);
    await c.shot(p32, "text-32px");
    await p32.done();
  }

  // The reading: the pointer and the keys, one band over the three tracks, the zoom.
  {
    const page = await c.open("reading");
    await settle(page);
    await c.pointer(page);
    await c.keys(page);
    const t = await tracks(page);
    const where = [["in the bars", (t.bars.t + t.bars.b) / 2], ["in the gap under the bars", (t.bars.b + t.breaks.t) / 2], ["in the breaks", (t.breaks.t + t.breaks.b) / 2],
      ["in the gap under the breaks", (t.breaks.b + t.ratio.t) / 2], ["in the ratio track", (t.ratio.t + t.ratio.b) / 2]];
    await ev(page, () => document.activeElement?.blur());
    for (const [k, [what, y]] of where.entries()) {
      const i = I + 2 + k;
      await page.mouse.move(centre(t.g, i), y);
      const s = await until(() => state(page), s => onPoint(s, i, centre(t.g, i)).ok);
      const n = await ev(page, () => window.chartfit.bands());
      const at = onPoint(s, i, centre(t.g, i));
      line(`pointer ${what}: one band from the top of the bars to the bottom of the ratio, and the band, tooltip and readout name day ${i + 1}`, at.ok && n === 1 && spans(s, t),
        `${n} band, ${s.band ? `${Math.round(s.band.t)}..${Math.round(s.band.b)}px` : "none"} for ${tracksText(t)}; ${at.at}`);
    }
    const label = await ev(page, () => { const g = window.chartfit.grid(); return window.chartfit.texts().find(x => x.t >= g.b && x.l > g.l + 100); });
    await page.mouse.move((label.l + label.r) / 2, (label.t + label.b) / 2);
    await sleep(400);
    const off = await state(page);
    line(`the pointer over the day label "${label.text}" reads nothing`, !off.band && !off.tip, `${off.band ? "band drawn" : "no band"}, ${off.tip ? `tooltip "${off.tip.day}"` : "no tooltip"}`);
    await away(page);
    await box(page).focus();
    for (const [key, i] of [["Home", 0], ["ArrowRight", 1], ["End", N - 1]]) {
      await page.keyboard.press(key);
      const s = await until(() => state(page), s => onPoint(s, i, centre(s.grid, i)).ok);
      const n = await ev(page, () => window.chartfit.bands());
      const at = onPoint(s, i, centre(s.grid, i));
      line(`${key === "ArrowRight" ? "Right" : key}: one band over the three tracks, and the band, tooltip and readout name day ${i + 1}`, at.ok && n === 1 && spans(s, t), `${n} band; ${at.at}`);
    }
    await page.keyboard.press("Escape");
    await overLine(page, "1440px");

    await c.zoomKeys(page);
    // Plus down to the slider's least, around the day read: 7 days, said so; the tracks together, on the whole view's scales.
    const scales = await ev(page, () => ({ values: window.cachefit.values(), bars: window.cachefit.columns("bars").map(c => c.h), breaks: window.cachefit.columns("breaks").map(c => ({ x: c.x, h: c.h })), g: window.chartfit.grid() }));
    await ev(page, () => window.cachefit.listen());
    await c.read(page);
    for (let k = 0; k < 10; k++) await page.keyboard.press("+");
    const least = await until(() => drawn(page), n => n === 7);
    await sleep(300);
    const said = await ev(page, () => window.cachefit.heard().filter(t => t.startsWith("Showing")).at(-1) ?? "");
    line("plus stops at 7 days, and says so", least === 7 && / 7 of 30 days\.$/.test(said), `${least} days drawn; last said "${said}"`);
    const zs = await until(() => together(page), s => togetherOk(s, 7));
    line("zoomed by plus, the bars, the breaks and the ratio show the same 7 days", togetherOk(zs, 7), togetherText(zs));
    const w = shownBy(said);
    await overLine(page, "zoomed to 7 days", w?.from);
    const now = await ev(page, () => ({ values: window.cachefit.values(), bars: window.cachefit.columns("bars").map(c => c.h), breaks: window.cachefit.columns("breaks").map(c => ({ x: c.x, h: c.h })), g: window.chartfit.grid() }));
    // A break column's day, by where it is on the grid.
    const dayAt = (s, x, from, n) => from + Math.floor((x - s.g.l) / ((s.g.r - s.g.l) / n));
    const brk = s => new Map(s.breaks.map(b => [dayAt(s, b.x, s === scales ? 0 : w.from, s === scales ? N : 7), b.h]));
    const b0 = brk(scales), b1 = w ? brk(now) : new Map();
    const barsHeld = !!w && now.bars.every((v, k) => Math.abs(v - scales.bars[w.from + k]) <= .5);
    const brkHeld = !!w && [...b1].every(([i, v]) => Math.abs(v - (b0.get(i) ?? -99)) <= .5);
    line("zoomed, the three tracks keep the whole view's scales: the same value labels, each day's bar and breaks as tall", !!w && JSON.stringify(now.values) === JSON.stringify(scales.values) && barsHeld && brkHeld,
      `value labels ${now.values.join(" ")}, were ${scales.values.join(" ")}; bars ${barsHeld ? "as tall" : `${now.bars.map(v => v.toFixed(1)).join(" ")} for ${w ? scales.bars.slice(w.from, w.to + 1).map(v => v.toFixed(1)).join(" ") : "?"}`}; breaks ${brkHeld ? `as tall (${b1.size} columns)` : "CHANGED"}`);
    const lastKey = await ev(page, () => { const l = document.querySelector(".cache-chart .legend"); return { last: l?.lastElementChild?.className ?? "", text: l?.lastElementChild?.textContent ?? "" }; });
    line(`"Show all days" ends the legend row while zoomed`, lastKey.last.includes("show-all") && lastKey.text === "Show all days", `last in the row: ${lastKey.last || "nothing"} "${lastKey.text}"`);
    await c.shot(page, "zoomed-7");
    // A bare Tab from "Show all days" goes to the chart, the next control.
    await c.showAll(page).focus();
    await page.keyboard.press("Tab");
    const tabbed = await ev(page, () => document.activeElement === document.querySelector(".cache-chart .echart"));
    line(`a Tab from "Show all days" goes to the chart`, tabbed, `focus on ${await focusOn(page)}`);
    await page.keyboard.press("Escape");
    await c.showAll(page).click();
    await until(() => drawn(page), n => n === N);
    await c.slider(page);
    // A real drag of the right handle: the three tracks together.
    {
      await away(page);
      const hd = await ev(page, () => { const hs = window.chartfit.handles(); const r = hs.at(-1); return hs.length === 2 ? { x: (r.l + r.r) / 2, y: (r.t + r.b) / 2, w: r.r - hs[0].l } : null; });
      await page.mouse.move(hd.x, hd.y);
      await page.mouse.down();
      for (let k = 1; k <= 8; k++) { await page.mouse.move(hd.x - hd.w * .4 * k / 8, hd.y); await sleep(40); }
      await page.mouse.up();
      const n = await until(() => drawn(page), n => n < N);
      const ds = await until(() => together(page), s => togetherOk(s, n));
      line("dragged, the bars, the breaks and the ratio show the same days", n < N && togetherOk(ds, n), `${n} days drawn; ${togetherText(ds)}`);
      const dw = shownBy(await until(() => ev(page, () => window.chartfit.readout()), r => r.startsWith("Showing")));
      await overLine(page, `dragged to ${n} days`, dw?.from);
      await c.showAll(page).click();
      await until(() => drawn(page), n => n === N);
    }
    // The slider's faint trend is what the bars draw, not the ratio.
    {
      const tr = await ev(page, () => ({ trend: window.cachefit.trend(), totals: window.cachefit.columns("bars"), ratio: window.cachefit.ratio().flatMap(l => l.runs.flat()) }));
      const ty = tr.trend.map(p => -p.y);
      const byTotals = tr.trend.length === tr.totals.length ? corr(ty, tr.totals.map(x => x.h)) : NaN;
      const byRatio = tr.ratio.length === tr.trend.length ? corr(ty, tr.ratio.map(p => -p.y)) : NaN;
      line("the slider's faint trend follows the bars' totals, not the ratio line", byTotals >= .99 && !(byRatio >= byTotals - .01),
        `${tr.trend.length} trend points, ${tr.totals.length} bars: correlation ${byTotals.toFixed(3)} with the bars, ${Number.isFinite(byRatio) ? byRatio.toFixed(3) : "n/a"} with the ratio line's ${tr.ratio.length} points`);
    }
    await c.escapeElsewhere(page);
    await page.done();
  }

  // An empty day, and a lone day after the next: the keys and the pointer read it, nothing is drawn on it.
  {
    const page = await c.openOn({ answer: d => quiet(full(d), [E, E + 2]), points: N - 2 }, "an empty day");
    await settle(page);
    const t = await tracks(page), xE = centre(t.g, E);
    const sentence = `${day(DAYS[E], true)}: no request.`;
    await box(page).focus();
    await page.keyboard.press("Home");
    for (let k = 0; k < E - 1; k++) await page.keyboard.press("ArrowRight");
    const full1 = await until(() => ev(page, () => window.cachefit.tip()), x => x?.head === day(DAYS[E - 1], true));
    await ev(page, () => window.cachefit.listen());
    await page.keyboard.press("ArrowRight");
    const s = await until(() => state(page), s => s.band && Math.abs(mid(s.band) - xE) <= 1.5 && s.readout === sentence);
    const tip = await ev(page, () => window.cachefit.tip());
    await sleep(700);
    const heard = await ev(page, () => window.cachefit.heard());
    line(`Right from day ${E} reads the empty day ${E + 1}: the band on it over the three tracks, the tooltip "No request", the live region says "${sentence}" once`,
      !!s.band && Math.abs(mid(s.band) - xE) <= 1.5 && spans(s, t) && tip?.head === day(DAYS[E], true) && /No request$/.test(tip?.text ?? "") && heard.filter(x => x === sentence).length === 1 && heard.length === 1,
      `band at ${px(mid(s.band))}, day ${E + 1} at ${px(xE)}; tooltip "${tip?.text ?? "none"}"; said ${JSON.stringify(heard)}`);
    line("the empty day's tooltip has its date in the head style of a day with data, then one line, inside the window",
      !!tip && !!full1 && tip.weight === full1.weight && Number(tip.weight) >= 600 && tip.rows === 0 && full1.rows === 6 && tip.l >= 0 && tip.r <= W,
      tip && full1 ? `head "${tip.head}" weight ${tip.weight}, ${tip.rows} rows, ${Math.round(tip.w)}x${Math.round(tip.h)}px at ${Math.round(tip.l)}..${Math.round(tip.r)}px; day ${E}'s head weight ${full1.weight}, ${full1.rows} rows, ${Math.round(full1.w)}x${Math.round(full1.h)}px` : "no tooltip");
    await c.shot(page, "empty-day");
    await page.keyboard.press("Escape");
    await ev(page, () => document.activeElement?.blur());
    const byPointer = [];
    for (const [what, tr] of [["bars", t.bars], ["breaks", t.breaks], ["ratio", t.ratio]]) {
      await away(page);
      await page.mouse.move(xE, (tr.t + tr.b) / 2);
      const p = await until(() => state(page), s => s.band && Math.abs(mid(s.band) - xE) <= 1.5 && s.tip);
      const pt = await ev(page, () => window.cachefit.tip());
      byPointer.push({ what, ok: !!p.band && Math.abs(mid(p.band) - xE) <= 1.5 && spans(p, t) && /No request$/.test(pt?.text ?? "") && named(p.readout) === E, at: `${what}: band at ${px(mid(p.band))}, tooltip "${pt?.text ?? "none"}"` });
    }
    line(`the pointer over the empty day on each track: the band on it over the three tracks, the tooltip "No request"`, byPointer.every(x => x.ok), byPointer.map(x => x.at).join("; "));
    await away(page);
    const drawnOn = await ev(page, ([xE, half]) => ({
      parts: window.chartfit.bars().filter(b => Math.abs((b.l + b.r) / 2 - xE) < half).length,
      dots: window.cachefit.dots().filter(d => Math.abs(d.x - xE) < half).length,
      points: window.cachefit.ratio().flatMap(l => l.runs.flat()).filter(p => Math.abs(p.x - xE) < half).length,
      cross: window.cachefit.ratio().flatMap(l => l.runs).filter(r => r.some((p, i) => i && r[i - 1].x < xE && p.x > xE)).length,
      runs: window.cachefit.ratio().flatMap(l => l.runs).map(r => [Math.round(r[0].x), Math.round(r.at(-1).x)]),
    }), [xE, (t.g.r - t.g.l) / N / 2]);
    line(`nothing is drawn on the empty day: no part, no ratio point, no dot, and the ratio line does not cross it`, !drawnOn.parts && !drawnOn.dots && !drawnOn.points && !drawnOn.cross,
      `${drawnOn.parts} parts, ${drawnOn.points} ratio points, ${drawnOn.dots} dots, ${drawnOn.cross} runs across it; runs ${drawnOn.runs.map(r => r.join("..")).join(", ")}px; the day at ${px(xE)}`);
    const dot = await ev(page, () => window.cachefit.dots());
    line(`the lone day ${E + 2} between two empty days has its dot, over its bar`, dot.length === 1 && Math.abs(dot[0].x - centre(t.g, E + 1)) <= 1, `${dot.length} dot(s) at ${dot.map(d => px(d.x)).join(", ")}, day ${E + 2} at ${px(centre(t.g, E + 1))}`);
    await page.done();
  }

  // "Cache reads": the third part and its edge, the rescaled axis, the title, the toggle pressed; the zoom and the pointer's
  // reading kept.
  {
    const page = await c.open("cache reads");
    await settle(page);
    const look = () => ev(page, () => ({ values: window.cachefit.values(), title: window.cachefit.titles().find(x => /^(Tokens|Prompt)/.test(x.text))?.text ?? "", handles: window.chartfit.handles().map(x => Math.round(x.l)).join(","),
      n: window.chartfit.points().length, parts: window.cachefit.parts("bars"), edges: window.cachefit.edges(), caption: document.querySelector(".cache-chart .caption").textContent }));
    await box(page).focus();
    await page.keyboard.press("End");
    await page.keyboard.press("+");
    const zoomed = await until(() => drawn(page), n => n < N);
    await page.keyboard.press("Escape");
    // The focus leaves the chart first: a blur ends any reading, the pointer's too.
    await ev(page, () => document.activeElement?.blur());
    const before = await look();
    // The pointer reads a day shown; the toggle is pressed from the keyboard, the pointer at rest.
    const g = await ev(page, () => window.chartfit.grid()), at = N - 3, from = N - zoomed;
    const x = centre(g, at, from, N - 1);
    await page.mouse.move(x, g.t + 40);
    const r0 = await until(() => state(page), s => named(s.tip?.day ?? "") === at && s.band);
    await toggle(page).focus();
    await page.keyboard.press("Space");
    const track = await probe(page, "var(--track)"), muted = await probe(page, "var(--text-muted)");
    const after = await until(look, r => r.parts.some(p => p.fill === track));
    await sleep(300);
    const r1 = await state(page), pressed = await toggle(page).getAttribute("aria-pressed");
    const reads = after.parts.filter(p => p.fill === track);
    const framed = reads.filter(p => after.edges.some(e => e.stroke === muted && Math.abs(e.l - (p.l + .5)) <= 1 && Math.abs(e.r - (p.r - .5)) <= 1 && Math.abs(e.t - (p.t + .5)) <= 1 && Math.abs(e.b - (p.b - .5)) <= 1));
    line(`"Cache reads" adds a third part in --track on each bar shown, each in a 1px --text-muted edge`, reads.length === zoomed && framed.length === reads.length && after.edges.every(e => e.width === 1),
      `${reads.length} parts in rgb(${track}) for ${zoomed} days, ${framed.length} framed; ${after.edges.length} edges ${[...new Set(after.edges.map(e => `rgb(${e.stroke}) ${e.width}px`))].join(", ")}`);
    line(`"Cache reads" rescales the bars' axis, titles the track "Prompt tokens", is pressed, and drops the caption's sentence`,
      after.values[0] !== before.values[0] && after.title.startsWith("Prompt tokens") && pressed === "true" && /Cache reads are left out/.test(before.caption) && !/Cache reads are left out/.test(after.caption),
      `top label "${before.values[0]}", then "${after.values[0]}"; title "${before.title}", then "${after.title}"; aria-pressed ${pressed}`);
    line(`"Cache reads" keeps the zoom and the pointer's reading`, after.n === zoomed && after.handles === before.handles && named(r0.tip?.day ?? "") === at && named(r1.tip?.day ?? "") === at && !!r1.band && Math.abs(mid(r1.band) - mid(r0.band)) <= 1,
      `${after.n} days drawn, ${zoomed} before; handles at ${after.handles}px, ${before.handles}px before; tooltip "${r1.tip?.day ?? "none"}", band at ${px(mid(r1.band))}, ${px(mid(r0.band))} before`);
    await c.shot(page, "cache-reads-zoomed");
    await page.done();
  }

  // The zoom leaves the URL, the requests and the data table alone; the slider from 14 days, not at 13; by week.
  {
    const page = await c.open("zoom, data table");
    await page.locator(`${ROOT} .chart-table button`).click();
    const table = () => page.locator(`${ROOT} .chart-table`).textContent();
    const fixed = async () => ({ table: await table(), url: page.url(), requests: page.requests.length });
    const before = await fixed();
    await box(page).focus();
    await page.keyboard.press("+");
    await page.keyboard.press("+");
    const n = await until(() => drawn(page), n => n < N);
    const after = await fixed();
    line("zoomed, the data table lists every day as before, and the URL and the requests are unchanged", n < N && JSON.stringify(after) === JSON.stringify(before) && (before.table.match(/\d{4}/g) ?? []).length >= N,
      `${n} days drawn; table ${after.table === before.table ? "unchanged" : "CHANGED"}, URL ${after.url === before.url ? "unchanged" : after.url}, ${after.requests - before.requests} new requests`);
    await page.done();
    const got = [];
    for (const [what, k] of [["14 days", 14], ["13 days", 13]]) {
      const p = await c.openOn({ answer: d => last(full(d), k), points: k }, what);
      got.push({ what, k, ...await ev(p, () => ({ handles: window.chartfit.handles().length, h: Math.round(window.chartfit.box().h), label: document.querySelector(".cache-chart .echart").getAttribute("aria-label").includes("Plus and minus zoom.") })) });
      await p.done();
    }
    const ok = x => (x.k >= 14 ? x.handles === 2 && x.h === 392 && x.label : x.handles === 0 && x.h === 364 && !x.label);
    line("the slider shows from 14 days and not at 13, with the zoom keys in the label only then", got.every(ok), got.map(x => `${x.what}: ${x.handles} handles, box ${x.h}px, zoom keys in the label ${x.label}`).join("; "));
    const WEEKS = weekly(structuredClone(store)).cost.series.rows.map(r => r.day);
    const wk = chart(h, { name: "context-cache-weeks", path: "/context?range=0&tab=cache", root: ROOT, points: WEEKS, label: week, said: k => day(k), unit: { one: "week", many: "weeks" }, at: 3,
      data: DATA, setup: cacheReaders, answer: weekly, newer: d => d, kept });
    const pw = await wk.open("20 weeks");
    await wk.box(pw).focus();
    await pw.keyboard.press("End");
    await pw.keyboard.press("+");
    const words = await until(() => wk.ev(pw, () => window.chartfit.readout()), r => r.startsWith("Showing"));
    const m = /^Showing the weeks of (.+?) to (.+?), (\d+) of 20 weeks\.$/.exec(words);
    const all = await wk.showAll(pw).textContent().catch(() => "");
    line(`by week, plus says the weeks shown and "Show all weeks" shows`, !!m && m[2] === day(WEEKS.at(-1)) && Number(m[3]) < 20 && all === "Show all weeks", `"${words}"; button "${all}"`);
    await wk.shot(pw, "zoomed");
    await pw.done();
  }

  // The PHONE window: the shared edges and labels, the titles, "Show all days" inside the box.
  {
    const page = await c.open(`${PHONE}px window`, { viewport: { width: PHONE, height: 900 } });
    await settle(page);
    const bw = await ev(page, () => Math.round(window.chartfit.box().w));
    await titleLine(page, `a ${bw}px box`);
    await c.edges(page, `a ${bw}px box`);
    await c.labelsFit(page, `a ${bw}px box`, true);
    await c.shot(page, "narrow");
    await box(page).focus();
    await page.keyboard.press("+");
    await c.showAll(page).waitFor({ timeout: 4000 }).catch(() => {});
    const b = await ev(page, () => ({ btn: window.cachefit.rect(".cache-chart .show-all"), box: window.cachefit.rect(".cache-chart"), last: document.querySelector(".cache-chart .legend")?.lastElementChild?.className ?? "" }));
    line(`a ${bw}px box, zoomed: "Show all days" ends the legend row, inside the chart's box`, !!b.btn && b.last.includes("show-all") && b.btn.l >= b.box.l - .5 && b.btn.r <= b.box.r + .5,
      b.btn ? `button ${b.btn.l.toFixed(1)}..${b.btn.r.toFixed(1)}px, box ${b.box.l.toFixed(1)}..${b.box.r.toFixed(1)}px` : "no button");
    await c.shot(page, "narrow-zoomed");
    await page.done();
    const p32 = await c.open(`${PHONE}px window, 32px root`, { viewport: { width: PHONE, height: 900 } }, root32);
    await titleLine(p32, `a ${bw}px box at 32px text`);
    await c.labelsFit(p32, `a ${bw}px box at 32px text`, true);
    await c.shot(p32, "narrow-32px");
    await p32.done();
  }

  // The focus ring: Tab from the toggle onto the chart.
  {
    const page = await c.open("focus ring");
    await toggle(page).focus();
    await page.keyboard.press("Tab");
    const ring = await ev(page, () => { const e = document.activeElement, s = getComputedStyle(e); return { chart: e === document.querySelector(".cache-chart .echart"), visible: e.matches(":focus-visible"), style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: window.chartfit.tri(s.outlineColor) }; });
    line("Tab from the toggle onto the chart draws its focus ring", ring.chart && ring.visible && ring.style !== "none" && ring.width >= 2, `${ring.chart ? "the chart" : "not the chart"}, focus-visible ${ring.visible}, outline ${ring.style} ${ring.width}px rgb(${ring.color})`);
    await c.shot(page, "focus");
    await page.done();
  }

  await c.refresh();
  await c.refreshRead();
  await c.backfill();
  await c.motion();
  await c.motionOnce([
    ["a theme change", page => c.theme(page, "dark")],
    ["the cache reads", async page => { await toggle(page).click(); await sleep(300); }],
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

/** The readers of a chart of lines, the growth chart (R ".growth") or the weekly start chart (".start-trend"), installed in
 *  every page before its scripts as window.linefit, and the shared readers fitted to it. This function runs in the page: it
 *  uses nothing from this module. The marks it tells apart are paths of ECharts' SVG:
 *  - the plot: chartfit.grid(), the grid lines; on the growth chart the curve's track, the strip's has none;
 *  - a strip bar: a filled path under the curve's track, 12px wide at most, translucent;
 *  - a line: a stroked, unfilled, undashed path in a clipped group of its own; a halo is one 4px wide or more; the median
 *    is the last line drawn that is not a halo, the project lines the others;
 *  - the band: a filled translucent polygon, of 3 points or more; a lone week's span: a stroke 6px wide or more;
 *  - a threshold line: a dashed path.
 *  The shared readers' points become the strip bars on the growth chart, and the median's points and the dots on the
 *  weekly chart, each a 70% wide column; the tooltip's head ends in ":". */
function lineReaders(R) {
  const cf = window.chartfit, growth = R === ".growth";
  const tri = c => (String(c).match(/[\d.]+/g) || []).slice(0, 3).map(n => Math.round(Number(n))).join(",");
  const rect = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const svg = () => document.querySelector(`${R} .echart-plot svg`);
  const top = () => [...(svg()?.querySelector(":scope > g")?.children ?? [])];
  const at = (e, n) => e.getAttribute(n);
  const fill = e => at(e, "fill") ?? "none";
  const stroked = e => !["none", "transparent", null].includes(at(e, "stroke")) && at(e, "stroke-opacity") !== "0";
  const width = e => Number(at(e, "stroke-width") ?? 1);
  const solid = e => e.tagName === "path" && fill(e) !== "none" && !fill(e).startsWith("url(");
  /** A path's subpaths, each as its points on the screen. */
  const subpaths = e => {
    const m = e.getScreenCTM(), p = svg().createSVGPoint();
    return (at(e, "d") ?? "").split("M").filter(s => s.trim()).map(s => [...`M${s}`.matchAll(/[ML](-?[\d.]+)[ ,](-?[\d.]+)/g)].map(([, x, y]) => {
      p.x = Number(x); p.y = Number(y);
      const q = p.matrixTransform(m);
      return { x: q.x, y: q.y };
    }));
  };
  const strip = () => {
    const g = cf.grid();
    return g ? top().filter(e => solid(e) && rect(e).t >= g.b - .5 && rect(e).w > 0 && rect(e).w <= 12 && rect(e).h > 0) : [];
  };
  const lines = () => top().filter(e => e.tagName === "g").flatMap(g => [...g.children])
    .filter(e => e.tagName === "path" && fill(e) === "none" && stroked(e) && !at(e, "stroke-dasharray"))
    .map(e => { const runs = subpaths(e); return { stroke: tri(at(e, "stroke")), width: width(e), runs, first: runs[0]?.[0] ?? null, ...rect(e) }; });
  const thin = () => lines().filter(l => l.width < 4);
  const median = () => thin().at(-1) ?? null;
  /** The weekly chart's points: the median's vertices and the dots, left first, one per x. */
  const marks = () => {
    const ps = [...(median()?.runs.flat() ?? []), ...cf.dots().map(d => ({ x: d.x, y: d.y }))].sort((a, b) => a.x - b.x);
    return ps.filter((p, i) => !i || p.x - ps[i - 1].x > .5);
  };
  const region = () => document.querySelector(`${R} .echart + .sr`);
  if (growth) cf.bars = () => strip().map(e => ({ fill: tri(fill(e)), stroke: at(e, "stroke"), ...rect(e) }));
  else cf.bars = () => marks().map(p => ({ fill: "", stroke: null, l: p.x, r: p.x, t: p.y, b: p.y, w: 0, h: 0 }));
  cf.points = () => [...new Set(cf.bars().map(b => Math.round(b.l)))].sort((a, b) => a - b);
  cf.columns = () => {
    if (growth) return strip().map(rect).sort((a, b) => a.l - b.l).map(b => ({ l: b.l, r: b.r, x: (b.l + b.r) / 2 }));
    const ps = marks(), g = cf.grid(), gaps = ps.slice(1).map((p, i) => p.x - ps[i].x);
    const half = .35 * (gaps.length ? Math.min(...gaps) : g ? g.r - g.l : 0);
    return ps.map(p => ({ l: p.x - half, r: p.x + half, x: p.x }));
  };
  const tip0 = cf.tip;
  cf.tip = () => { const t = tip0(); return t && { ...t, day: `${t.day}:` }; };
  window.linefit = {
    /** The plot (the grid lines' extent), and the strip's track from its bars: the tallest is the track's top. */
    frame() {
      const g = cf.grid(), s = strip().map(rect);
      return { g, strip: s.length ? { t: Math.min(...s.map(b => b.t)), b: Math.max(...s.map(b => b.b)) } : null, box: cf.box() };
    },
    strip: () => strip().map(e => ({ fill: tri(fill(e)), stroke: stroked(e) ? tri(at(e, "stroke")) : "none", opacity: Number(at(e, "fill-opacity") ?? 1), x: (rect(e).l + rect(e).r) / 2, ...rect(e) }))
      .sort((a, b) => a.l - b.l),
    lines,
    median,
    projects: () => thin().slice(0, -1),
    halos: () => lines().filter(l => l.width >= 4),
    polygons: () => top().filter(e => solid(e) && (at(e, "fill-opacity") ?? at(e, "opacity")) != null && ((at(e, "d") ?? "").match(/L/g) ?? []).length >= 2 && !/[lA]/.test(at(e, "d") ?? ""))
      .map(e => ({ fill: tri(fill(e)), opacity: Number(at(e, "fill-opacity") ?? at(e, "opacity")), points: subpaths(e)[0] ?? [], ...rect(e) })),
    spans: () => top().filter(e => e.tagName === "path" && stroked(e) && width(e) >= 6).map(e => ({ stroke: tri(at(e, "stroke")), width: width(e), x: (rect(e).l + rect(e).r) / 2, ...rect(e) })),
    dashed: () => top().filter(e => e.tagName === "path" && at(e, "stroke-dasharray")).map(e => ({ stroke: tri(at(e, "stroke")), dash: at(e, "stroke-dasharray"), y: (rect(e).t + rect(e).b) / 2, ...rect(e) })),
    /** The value labels left of the plot, top first. */
    values() { const g = cf.grid(); return g ? cf.texts().filter(x => x.r < g.l + 2).sort((a, b) => a.t - b.t).map(x => x.text) : []; },
    /** The axis labels under the frame, left first. */
    under() {
      const f = this.frame(), y = f.strip ? f.strip.b : f.g?.b ?? 0;
      return cf.texts().filter(x => x.t >= y - .5).sort((a, b) => a.l - b.l);
    },
    /** The tooltip, open: its head (text, class, weight, color, size), its rows with their swatches, its other lines. */
    tip() {
      const t = document.querySelector(`${R} .echart .tip`);
      if (!t || getComputedStyle(t).display === "none") return null;
      const head = t.firstElementChild, hs = getComputedStyle(head);
      return {
        head: { text: head.textContent, cls: head.className, weight: hs.fontWeight, color: tri(hs.color), size: parseFloat(hs.fontSize) },
        rows: [...t.querySelectorAll(".row")].map(r => {
          const i = r.querySelector("i"), s = i && getComputedStyle(i);
          return { name: r.querySelector("span")?.textContent ?? "", value: r.querySelector("b")?.textContent ?? "", swatch: i ? { w: rect(i).w, h: rect(i).h, color: tri(s.backgroundColor), css: i.style.background } : null };
        }),
        notes: [...t.children].filter(e => e !== head && e.classList.contains("muted")).map(e => e.textContent),
        ...rect(t),
      };
    },
    /** The legend's project buttons: name, the key's inline color and its computed one, pressed. */
    legend: () => [...document.querySelectorAll(`${R} .legend button.key.proj`)].map(b => {
      const i = b.querySelector("i");
      return { name: b.textContent.split(" · ")[0], css: i.style.background, color: tri(getComputedStyle(i).backgroundColor), pressed: b.getAttribute("aria-pressed") === "true" };
    }),
    /** Every visible stroke the chart draws but the lines in these colors: by color, how many, and one such mark. */
    strokes(skip = []) {
      const s = svg(), box = s?.getBoundingClientRect(), out = {};
      for (const e of s ? s.querySelectorAll("path, text") : []) {
        if (e.closest("clipPath, defs") || !stroked(e)) continue;
        const k = tri(at(e, "stroke")), r = rect(e);
        if (e.tagName === "path" && e.parentElement.tagName === "g" && e.parentElement !== s.firstElementChild && width(e) < 4 && skip.includes(k)) continue;
        out[k] ??= { n: 0, e: `${e.tagName} at ${Math.round(r.l - box.left)},${Math.round(r.t - box.top)} ${Math.round(r.w)}x${Math.round(r.h)}` };
        out[k].n++;
      }
      return out;
    },
    /** What an entry animation moves, once the marks are drawn: the strip bars' heights and the clips' widths. */
    motion() {
      const s = svg();
      if (!s || (growth ? !strip().length : !median())) return null;
      const clips = [...s.querySelectorAll("clipPath path")].map(e => /l(-?[\d.]+) 0/.exec(at(e, "d") ?? "")?.[1] ?? "").join(",");
      return `${strip().map(e => Math.round(rect(e).h)).join(",")}|${clips}`;
    },
    /** The live region's texts from now on, each noted when it differs from the last. */
    listen() {
      window.__heard = [];
      window.__last = region()?.textContent ?? "";
      if (window.__hearing) return;
      window.__hearing = true;
      new MutationObserver(() => {
        const text = region()?.textContent ?? "";
        if (text !== window.__last) { window.__last = text; window.__heard.push(text); }
      }).observe(document.body, { childList: true, characterData: true, subtree: true });
    },
    heard: () => window.__heard ?? [],
  };
}

/** Notes window.linefit.motion() on every animation frame from the page's first, as window.__motion. */
const recordMotion = () => {
  window.__motion = [];
  const tick = () => {
    const v = window.linefit?.motion();
    if (v) window.__motion.push(v);
    if (window.__motion.length < 150) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
/** A value label as a number: "600k", "1.2M", "80%", "0". */
const valueOf = t => {
  const m = /^([\d.,]+)\s*([kMB%]?)$/.exec(t.trim());
  return m ? Number(m[1].replace(/,/g, "")) * { "": 1, k: 1e3, M: 1e6, B: 1e9, "%": .01 }[m[2]] : NaN;
};
/** Where the plot g draws v, with values the value labels, top first: the top grid line is the first label's value. */
const yOf = (g, values) => { const max = valueOf(values[0]); return v => g.b - v / max * (g.b - g.t); };
/** format.ts' niceStep. */
const niceStep = raw => { const p = 10 ** Math.floor(Math.log10(raw || 1)), n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
const sysColors = async (ev, page) => {
  const sys = {};
  for (const k of ["CanvasText", "Canvas", "GrayText", "Highlight", "HighlightText", "LinkText", "ButtonText", "ButtonFace", "ButtonBorder"]) sys[k] = await ev(page, c => window.chartfit.probe(c), k);
  // A color several system colors share is named by the first listed (CanvasText before ButtonBorder).
  return { sys, name: Object.fromEntries(Object.entries(sys).reverse().map(([k, v]) => [v, k])) };
};
/** The tooltip's head, as the report names it. */
const headText = t => (t ? `head "${t.head.text}" .${t.head.cls} weight ${t.head.weight} ${t.head.size}px rgb(${t.head.color})` : "no tooltip");
/** Focus ring: a Tab press (or Shift+Tab) from the control at sel lands on the chart under root and draws its outline. */
const ringLine = async (c, page, root, sel, key, what) => {
  await page.locator(sel).focus();
  await page.keyboard.press(key);
  const ring = await c.ev(page, root => { const e = document.activeElement, s = getComputedStyle(e); return { chart: e === document.querySelector(`${root} .echart`), visible: e.matches(":focus-visible"), style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: window.chartfit.tri(s.outlineColor) }; }, root);
  line(`${what} draws its focus ring`, ring.chart && ring.visible && ring.style !== "none" && ring.width >= 2, `${ring.chart ? "the chart" : "not the chart"}, focus-visible ${ring.visible}, outline ${ring.style} ${ring.width}px rgb(${ring.color})`);
};
/** With motion on, the first drawing moves (the strip grows, the lines draw in); with reduced motion nothing moves from
 *  the first frame drawn on. */
const motionLines = async (c, name, what) => {
  const frames = async options => {
    const page = await c.open(`motion ${options.reducedMotion}`, options, recordMotion);
    await sleep(1500);
    const fs = await c.ev(page, () => window.__motion);
    await page.done();
    return { n: fs.length, distinct: new Set(fs).size, first: fs[0] ?? "", last: fs.at(-1) ?? "" };
  };
  const on = await frames({ reducedMotion: "no-preference" }), off = await frames({ reducedMotion: "reduce" });
  line(`${name}: with motion on, the first drawing ${what}`, on.n > 0 && on.distinct > 1 && on.first !== on.last, `${on.n} frames drawn, ${on.distinct} distinct`);
  line(`${name}: with reduced motion, nothing moves from the first frame drawn on`, off.n > 0 && off.distinct === 1, `${off.n} frames drawn, ${off.distinct} distinct${off.distinct > 1 ? `: "${off.first.slice(0, 80)}" became "${off.last.slice(0, 80)}"` : ""}`);
};

async function growth(h) {
  const ROOT = ".growth";
  const store = await h.json("/api/context?range=30");
  const G = store.growth, CURVE = G.curve, TURNS = CURVE.map(p => String(p.turn));
  const c = chart(h, {
    name: "context-growth", path: "/context?range=30&tab=growth", root: ROOT, points: TURNS, label: (k, long = false) => (long ? `Turn ${k}:` : k),
    unit: { one: "turn", many: "turns" }, at: 11, // turn 12
    data: DATA, setup: { content: `(${lineReaders})(${JSON.stringify(ROOT)})` }, activates: false, zoom: false,
    // The last turn's sessions up: its strip bar changes, turn 12's words do not.
    newer: (d, more) => { d.growth.curve.at(-1).sessions += more / 10; return d; },
    kept: [],
  });
  const { N, I, centre, ev, state, onPoint, box, away } = c;
  const fit = page => ev(page, () => window.linefit.frame());
  const spans = (s, f) => s.band && f.strip && Math.abs(s.band.t - f.g.t) <= 1.5 && Math.abs(s.band.b - f.strip.b) <= 1.5;
  const frameText = f => (f.g ? `curve ${f.g.t.toFixed(1)}..${f.g.b.toFixed(1)}px, strip ${f.strip ? `${f.strip.t.toFixed(1)}..${f.strip.b.toFixed(1)}px` : "none"}` : "no plot");
  const PROJECTS = G.by_project_curves.filter(p => p.curve.length);
  /** The strip's title inside the plot, its em box inside the chart's box; with long, in its long form. */
  const titleLine = async (page, what, long = false) => {
    await settle(page);
    const t = await ev(page, () => ({ t: window.chartfit.texts().find(x => x.text.startsWith("Sessions still")), g: window.chartfit.grid(), box: window.chartfit.box() }));
    const em = t.t && (t.t.t + t.t.b - t.t.size) / 2;
    line(`${what}: the strip's title ends inside the plot${long ? ", with its long figure" : ""}`, !!t.t && t.t.l >= t.g.l - .5 && t.t.r <= t.g.r + .5 && em >= t.box.t - .5 && (!long || / at turn \d+ to .* at turn \d+$/.test(t.t.text)),
      t.t ? `"${t.t.text}" ${t.t.l.toFixed(1)}..${t.t.r.toFixed(1)}px, plot ${t.g.l.toFixed(1)}..${t.g.r.toFixed(1)}px` : "no title");
  };
  const clickIn = (page, sel, text) => ev(page, ([sel, text]) => [...document.querySelectorAll(sel)].find(b => b.textContent.startsWith(text)).click(), [sel, text]);

  // The colors, in light and dark: each project line is its key's color, the median --text-primary.
  {
    const page = await c.open("colors");
    const got = [];
    for (const scheme of ["light", "dark"]) {
      await c.theme(page, scheme);
      const ink = await ev(page, () => window.chartfit.probe("var(--text-primary)"));
      const r = await until(() => ev(page, () => ({ keys: window.linefit.legend(), lines: window.linefit.projects().map(l => l.stroke), median: window.linefit.median()?.stroke })), r => r.median === ink);
      got.push({ scheme, ink, ...r });
    }
    const ok = x => x.keys.length === PROJECTS.length && x.lines.length === x.keys.length && x.keys.every(k => x.lines.includes(k.color)) && x.median === x.ink;
    line("light and dark: each project line is its legend key's color, the median --text-primary, and the colors differ between them", got.every(ok) && got[0].keys[0]?.color !== got[1].keys[0]?.color,
      got.map(x => `${x.scheme}: keys ${x.keys.map(k => `${k.name} rgb(${k.color})`).join(", ")}; lines ${x.lines.map(s => `rgb(${s})`).join(", ")}; median rgb(${x.median}), --text-primary rgb(${x.ink})`).join("; "));
    await c.shot(page, "dark");
    await page.done();
  }

  await c.forcedColors();
  {
    const page = await c.open("forced colors, lines", { forcedColors: "active" });
    const { sys, name } = await sysColors(ev, page);
    const want = await ev(page, () => window.linefit.legend().map(k => ({ name: k.name, color: window.chartfit.probe(k.css) })));
    const got = await ev(page, () => ({ median: window.linefit.median(), projects: window.linefit.projects(), halos: window.linefit.halos(), polygons: window.linefit.polygons(), strip: window.linefit.strip() }));
    const near = (a, b) => a && b && Math.abs(a.x - b.x) <= .5 && Math.abs(a.y - b.y) <= .5;
    const haloed = got.projects.filter(p => got.halos.some(x => x.stroke === sys.Canvas && x.width === 4.5 && near(x.first, p.first)));
    line("forced colors: the median is CanvasText on a Canvas halo; each project line keeps its color, on a 4.5px Canvas halo",
      got.median?.stroke === sys.CanvasText && got.halos.some(x => x.stroke === sys.Canvas && near(x.first, got.median.first)) && got.projects.length === want.length && want.every(w => got.projects.some(p => p.stroke === w.color)) && haloed.length === got.projects.length,
      `median rgb(${got.median?.stroke}); projects ${got.projects.map(p => `rgb(${p.stroke}) ${p.width}px`).join(", ")} for keys ${want.map(w => `${w.name} rgb(${w.color})`).join(", ")}; ${haloed.length} on a halo; halos ${got.halos.map(x => `${name[x.stroke] ?? `rgb(${x.stroke})`} ${x.width}px`).join(", ")}`);
    line("forced colors: the band is a system color, at .1 or more", got.polygons.length === 1 && !!name[got.polygons[0].fill] && got.polygons[0].opacity >= .1,
      got.polygons.map(p => `${name[p.fill] ?? `NOT A SYSTEM COLOR rgb(${p.fill})`} at ${p.opacity}`).join(", ") + `; strip bars ${[...new Set(got.strip.map(b => `${name[b.fill] ?? `rgb(${b.fill})`} at ${b.opacity} in ${name[b.stroke] ?? b.stroke}`))].join(", ")}`);
    const g = await ev(page, () => window.chartfit.grid());
    await page.mouse.move(centre(g, I), (g.t + g.b) / 2);
    await until(() => state(page), s => s.band);
    const strokes = await ev(page, skip => window.linefit.strokes(skip), want.map(w => w.color)), odd = Object.keys(strokes).filter(k => !name[k]);
    line("forced colors: every stroke but the project lines is a system color", Object.keys(strokes).length > 0 && !odd.length,
      Object.entries(strokes).map(([k, x]) => `${name[k] ?? `NOT A SYSTEM COLOR rgb(${k})`} ${x.n}x, e.g. ${x.e}`).join("; "));
    // The tooltip's swatches name the project lines by the colors forced colors keeps: each is drawn, in its line's color.
    const tip = await until(() => ev(page, () => window.linefit.tip()), t => t?.rows.length > 3);
    const sw = tip?.rows.filter(r => r.swatch) ?? [];
    const shows = r => r.swatch.color !== sys.Canvas && (r.name === "Median" || want.some(w => w.name === r.name && w.color === r.swatch.color));
    line("forced colors: the tooltip's swatches are drawn, each project's in its line's color", sw.length > 1 && sw.every(shows),
      sw.map(r => `${r.name} ${name[r.swatch.color] ?? `rgb(${r.swatch.color})`}`).join(", ") || "no swatch");
    await c.shot(page, "forced-colors-read");
    await page.done();
  }

  await c.textSize();
  // The box and the tracks at 16px and 32px text, the strip's title, the edges and the labels.
  {
    const measure = async page => {
      await settle(page);
      const f = await fit(page);
      return { box: Math.round(f.box.h), curve: Math.round(f.g.b - f.g.t), strip: f.strip ? Math.round(f.strip.b - f.strip.t) : 0 };
    };
    const p16 = await c.open("16px root, tracks");
    const at16 = await measure(p16);
    await titleLine(p16, "growth, 1440px", true);
    await c.edges(p16, `growth, a ${await ev(p16, () => Math.round(window.chartfit.box().w))}px box`);
    await c.labelsFit(p16, "growth, 1440px", true);
    await p16.done();
    const p32 = await c.open("32px root, tracks", {}, root32);
    const at32 = await measure(p32);
    line("the box is 302px at 16px text and 364px at 32px; the curve keeps 218px and the strip 22px", at16.box === 302 && at32.box === 364 && at16.curve === 218 && at32.curve === 218 && at16.strip === 22 && at32.strip === 22,
      `box ${at16.box}px, then ${at32.box}px; curve ${at16.curve}px, then ${at32.curve}px; strip ${at16.strip}px, then ${at32.strip}px`);
    await titleLine(p32, "growth, 32px root");
    await c.edges(p32, "growth, 32px root");
    await c.labelsFit(p32, "growth, 32px root", true);
    await c.shot(p32, "text-32px");
    await p32.done();
    const pp = await c.open(`${PHONE}px window`, { viewport: { width: PHONE, height: 900 } });
    await settle(pp);
    const bw = await ev(pp, () => Math.round(window.chartfit.box().w));
    await titleLine(pp, `growth, a ${bw}px box`);
    await c.edges(pp, `growth, a ${bw}px box`);
    await c.labelsFit(pp, `growth, a ${bw}px box`, true);
    // The tooltip at the last turn stays inside the box.
    await pp.locator(ROOT).scrollIntoViewIfNeeded();
    const g = await ev(pp, () => window.chartfit.grid());
    await pp.mouse.move(centre(g, N - 1), (g.t + g.b) / 2);
    const s = await until(() => state(pp), s => s.tip && s.band);
    const b = await ev(pp, () => window.chartfit.box());
    line(`a ${bw}px box: the tooltip at the last turn is inside the chart's box`, !!s.tip && s.tip.l >= b.l - .5 && s.tip.r <= b.r + .5 && s.tip.t >= b.t - .5 && s.tip.b <= b.b + .5,
      s.tip ? `tooltip ${s.tip.l.toFixed(1)}..${s.tip.r.toFixed(1)} x ${s.tip.t.toFixed(1)}..${s.tip.b.toFixed(1)}px, box ${b.l.toFixed(1)}..${b.r.toFixed(1)} x ${b.t.toFixed(1)}..${b.b.toFixed(1)}px` : "no tooltip");
    await c.shot(pp, "narrow-tooltip");
    await away(pp);
    await c.shot(pp, "narrow");
    await pp.done();
    const pp32 = await c.open(`${PHONE}px window, 32px root`, { viewport: { width: PHONE, height: 900 } }, root32);
    await titleLine(pp32, `growth, a ${bw}px box at 32px text`);
    await c.labelsFit(pp32, `growth, a ${bw}px box at 32px text`, true);
    await c.shot(pp32, "narrow-32px");
    await pp32.done();
  }

  // The reading: the pointer and the keys, one band over both tracks; the strip under the points; the band's polygon; the
  // turn labels; the tooltip.
  {
    const page = await c.open("reading");
    await settle(page);
    await c.pointer(page);
    await c.keys(page);
    const kt = await ev(page, () => window.linefit.tip());
    const f = await fit(page);
    await ev(page, () => document.activeElement?.blur());
    const where = [["in the curve", (f.g.t + f.g.b) / 2], ["in the gap under the curve", (f.g.b + f.strip.t) / 2], ["in the strip", (f.strip.t + f.strip.b) / 2]];
    for (const [k, [what, y]] of where.entries()) {
      const i = I + 2 + k;
      await page.mouse.move(centre(f.g, i), y);
      const s = await until(() => state(page), s => onPoint(s, i, centre(f.g, i)).ok);
      const n = await ev(page, () => window.chartfit.bands()), at = onPoint(s, i, centre(f.g, i));
      line(`pointer ${what}: one band from the curve's top to the strip's bottom, and the band, tooltip and readout name turn ${i + 1}`, at.ok && n === 1 && spans(s, f),
        `${n} band, ${s.band ? `${s.band.t.toFixed(1)}..${s.band.b.toFixed(1)}px` : "none"} for ${frameText(f)}; ${at.at}`);
    }
    await away(page);
    await box(page).focus();
    for (const [key, i] of [["Home", 0], ["ArrowRight", 1], ["End", N - 1]]) {
      await page.keyboard.press(key);
      const s = await until(() => state(page), s => onPoint(s, i, centre(s.grid, i)).ok);
      const n = await ev(page, () => window.chartfit.bands()), at = onPoint(s, i, centre(s.grid, i));
      line(`${key === "ArrowRight" ? "Right" : key}: one band over both tracks, and the band, tooltip and readout name turn ${i + 1}`, at.ok && n === 1 && spans(s, f), `${n} band; ${at.at}`);
    }
    await page.keyboard.press("Escape");
    await away(page);
    // Each strip bar under its turn's point on the median.
    {
      const sp = await ev(page, () => ({ strip: window.linefit.strip().map(b => b.x), median: window.linefit.median()?.runs.flat().map(p => p.x) ?? [] }));
      const off = sp.strip.map((x, i) => Math.abs(x - (sp.median[i] ?? Infinity)));
      line("each strip bar sits under the middle of its turn's point on the median, within 1px", sp.strip.length === N && sp.median.length === N && off.every(d => d <= 1),
        `${sp.strip.length} strip bars, ${sp.median.length} points on the median; the farthest ${Math.max(...off).toFixed(2)}px off, at turn ${off.indexOf(Math.max(...off)) + 1}`);
    }
    // The band's polygon from the 25th to the 75th percentile at three turns.
    {
      const b = await ev(page, () => ({ g: window.chartfit.grid(), values: window.linefit.values(), polygons: window.linefit.polygons() }));
      const y = yOf(b.g, b.values), poly = b.polygons[0]?.points ?? [];
      const at = [0, Math.floor(N / 2), N - 1].map(i => {
        const hi = poly[i], lo = poly[2 * N - 1 - i];
        return { i, ok: !!hi && !!lo && Math.abs(hi.y - y(CURVE[i].p75)) <= 1.5 && Math.abs(lo.y - y(CURVE[i].p25)) <= 1.5 && Math.abs(hi.x - centre(b.g, i)) <= 1 && Math.abs(lo.x - centre(b.g, i)) <= 1,
          at: `turn ${i + 1}: ${hi && lo ? `${hi.y.toFixed(1)}..${lo.y.toFixed(1)}px for ${y(CURVE[i].p75).toFixed(1)}..${y(CURVE[i].p25).toFixed(1)}px` : "no point"}` };
      });
      line("the band's polygon runs from the 75th to the 25th percentile at turns 1, the middle one and the last, within 1.5px", b.polygons.length === 1 && poly.length === 2 * N && at.every(x => x.ok),
        `${b.polygons.length} polygon of ${poly.length} points, scale top "${b.values[0]}"; ${at.map(x => x.at).join("; ")}`);
    }
    // The turn labels: 1, the multiples of niceStep(turns / 6), and the last; one hidden at most, the round turn it would overlap.
    {
      const shown = await ev(page, () => window.linefit.under().filter(x => /^\d+$/.test(x.text)));
      const last = Math.max(CURVE.at(-1).turn, ...PROJECTS.map(p => p.curve.at(-1).turn), 2), step = niceStep(last / 6);
      const want = TURNS.filter(k => k === "1" || Number(k) % step === 0 || k === TURNS.at(-1)), got = shown.map(x => x.text);
      const missing = want.filter(k => !got.includes(k));
      const over = shown.some((a, i) => i && a.l < shown[i - 1].r);
      line(`the turn labels are 1, the multiples of ${step} and the last turn, none overlapping`, got.every(k => want.includes(k)) && got[0] === "1" && got.at(-1) === TURNS.at(-1) && !over && (missing.length === 0 || (missing.length === 1 && want.indexOf(missing[0]) === want.length - 2)),
        `drawn ${got.join(", ")}; wanted ${want.join(", ")}`);
    }
    // The tooltip: its rows, its swatches in their lines' colors, inside the box at the last turn.
    {
      const lines = await ev(page, () => ({ median: window.linefit.median()?.stroke, projects: window.linefit.projects().map(l => l.stroke), keys: window.linefit.legend() }));
      const wantRows = ["Median", "25th to 75th percentile", "Sessions", ...PROJECTS.filter(p => p.curve.some(q => q.turn === I + 1)).map(p => p.project ?? "(no project)")];
      const sw = kt?.rows.filter(r => r.swatch) ?? [];
      const colorOk = r => (r.name === "Median" ? r.swatch.color === lines.median : lines.keys.some(k => k.name === r.name && k.color === r.swatch.color) && lines.projects.includes(r.swatch.color));
      line(`the tooltip at turn ${I + 1}: the median, the percentiles, the sessions and each project with a point there, each swatch 8px in its line's color`,
        !!kt && JSON.stringify(kt.rows.map(r => r.name)) === JSON.stringify(wantRows) && sw.length === wantRows.length - 2 && sw.every(r => Math.abs(r.swatch.w - 8) <= .5 && Math.abs(r.swatch.h - 8) <= .5 && colorOk(r)),
        kt ? `${headText(kt)}; rows ${kt.rows.map(r => `${r.name}${r.swatch ? ` [${r.swatch.w}x${r.swatch.h} rgb(${r.swatch.color})]` : ""} ${r.value}`).join(", ")}` : "no tooltip");
      // A turn where some projects' curves have ended and others go on.
      const T = [...TURNS].reverse().map(Number).find(t => PROJECTS.some(p => p.curve.some(q => q.turn === t)) && PROJECTS.some(p => !p.curve.some(q => q.turn === t)));
      const ended = PROJECTS.filter(p => !p.curve.some(q => q.turn === T)).map(p => p.project), going = PROJECTS.filter(p => p.curve.some(q => q.turn === T)).map(p => p.project);
      const g = await ev(page, () => window.chartfit.grid());
      await page.mouse.move(centre(g, T - 1), (g.t + g.b) / 2);
      const s = await until(() => ev(page, () => window.linefit.tip()), t => t?.head.text === `Turn ${T}`);
      const names = s?.rows.slice(3).map(r => r.name) ?? [];
      line(`the tooltip at turn ${T} has rows for the ${going.length} projects whose curve goes on, none for the ${ended.length} whose curve has ended`, !!s && JSON.stringify(names) === JSON.stringify(going) && ended.length > 0,
        `rows ${names.join(", ") || "none"}; ended: ${ended.join(", ")}`);
      await page.mouse.move(centre(g, N - 1), (g.t + g.b) / 2);
      const e = await until(() => ev(page, () => window.linefit.tip()), t => t?.head.text === `Turn ${N}`);
      const b = await ev(page, () => window.chartfit.box());
      line("the tooltip at the last turn is inside the chart's box", !!e && e.l >= b.l - .5 && e.r <= b.r + .5 && e.t >= b.t - .5 && e.b <= b.b + .5,
        e ? `tooltip ${e.l.toFixed(1)}..${e.r.toFixed(1)} x ${e.t.toFixed(1)}..${e.b.toFixed(1)}px, box ${b.l.toFixed(1)}..${b.r.toFixed(1)} x ${b.t.toFixed(1)}..${b.b.toFixed(1)}px` : "no tooltip");
      await c.shot(page, "tooltip-last");
    }
    await c.escapeElsewhere(page);
    await page.done();
  }

  // "Share of window": the reading ends; the 80% line and its label; the axis in percent.
  {
    const page = await c.open("share of the window");
    await settle(page);
    await c.read(page);
    const s0 = await until(() => state(page), s => onPoint(s, I, centre(s.grid, I)).ok);
    // A click that leaves the focus on the chart: the measure alone ends the reading.
    await clickIn(page, `${ROOT} .growth-mode button`, "Share of window");
    const d = await until(() => ev(page, () => window.linefit.dashed()), d => d.length === 1);
    await sleep(300);
    const s1 = await state(page), focus = await ev(page, root => document.activeElement === document.querySelector(`${root} .echart`), ROOT);
    line(`"Share of window" with turn ${I + 1} read and the focus kept on the chart ends the reading`, onPoint(s0, I, centre(s0.grid, I)).ok && focus && !s1.band && !s1.tip,
      `before: ${onPoint(s0, I, centre(s0.grid, I)).at}; after: focus ${focus ? "on the chart" : "elsewhere"}, ${s1.band ? "band drawn" : "no band"}, ${s1.tip ? `tooltip "${s1.tip.day}"` : "no tooltip"}`);
    await settle(page);
    const b = await ev(page, () => ({ g: window.chartfit.grid(), values: window.linefit.values(), dashed: window.linefit.dashed(), label: window.chartfit.texts().find(x => x.text === "80% of the window") }));
    const y = yOf(b.g, b.values), em = b.label && (b.label.t + b.label.b - b.label.size) / 2;
    line(`share of the window: a dashed line at 80%, its label "80% of the window" inside the plot, the value labels in percent`,
      b.dashed.length === 1 && Math.abs(b.dashed[0].y - y(.8)) <= 1 && b.dashed[0].dash === "4,3" && !!b.label && b.label.l >= b.g.l - .5 && b.label.r <= b.g.r + .5 && em >= b.g.t - .5 && b.values.every(v => v.endsWith("%")),
      `line ${b.dashed.map(x => `${x.dash} at ${x.y.toFixed(1)}px`).join(", ")}, 80% at ${y(.8).toFixed(1)}px; label ${b.label ? `${b.label.l.toFixed(1)}..${b.label.r.toFixed(1)} x ${b.label.t.toFixed(1)}..${b.label.b.toFixed(1)}px` : "none"}, plot ${b.g.l.toFixed(1)}..${b.g.r.toFixed(1)} x ${b.g.t.toFixed(1)}..${b.g.b.toFixed(1)}px; values ${b.values.join(" ")}`);
    await c.shot(page, "share");
    await page.done();
  }

  // Isolating a project: with the focus kept on the chart, the reading stays; a mouse click and the keyboard move the focus.
  {
    const page = await c.open("isolation");
    await settle(page);
    const keys = await ev(page, () => window.linefit.legend());
    const p = keys.find(k => PROJECTS.find(q => (q.project ?? "(no project)") === k.name).curve.some(q => q.turn === I + 1));
    const before = await ev(page, () => window.linefit.projects().map(l => l.width));
    await c.read(page);
    await until(() => state(page), s => onPoint(s, I, centre(s.grid, I)).ok);
    await clickIn(page, `${ROOT} .legend button.key.proj`, p.name);
    const got = await until(() => ev(page, () => ({ projects: window.linefit.projects(), polygons: window.linefit.polygons(), tip: window.linefit.tip(), legend: window.linefit.legend() })), r => r.projects.length === 1);
    await sleep(300);
    const s = await state(page), at = onPoint(s, I, centre(s.grid, I));
    const row = got.tip?.rows.find(r => r.name === p.name);
    line(`isolating ${p.name}: its line alone, 3px (1.5px before), in its color; the band its color at .18`,
      before.length === keys.length && before.every(w => w === 1.5) && got.projects.length === 1 && got.projects[0].width === 3 && got.projects[0].stroke === p.color && got.polygons.length >= 1 && got.polygons.every(x => x.fill === p.color && x.opacity === .18),
      `before ${before.length} lines at ${[...new Set(before)].join(", ")}px; now ${got.projects.map(l => `rgb(${l.stroke}) ${l.width}px`).join(", ")} for rgb(${p.color}); band ${got.polygons.map(x => `rgb(${x.fill}) at ${x.opacity}`).join(", ")}`);
    line(`isolating with the focus kept on the chart keeps the reading on turn ${I + 1}, and its tooltip gives ${p.name}'s band`, at.ok && !!row && /\(.+ to .+\)$/.test(row.value) && got.tip.rows.length === 4,
      `${at.at}; rows ${got.tip?.rows.map(r => `${r.name} ${r.value}`).join(", ") ?? "none"}`);
    await c.shot(page, "isolated");
    // A mouse click on the button: the focus goes to it, and the reading ends.
    await page.locator(`${ROOT} .legend button.key.proj`, { hasText: p.name }).click();
    const back = await until(() => ev(page, () => window.linefit.projects().length), n => n === keys.length);
    const m = await state(page), mf = await ev(page, () => document.activeElement?.classList.contains("proj") ?? false);
    line(`a mouse click on ${p.name}'s pressed button shows every project, the focus on the button, the reading ended`, back === keys.length && mf && !m.band && !m.tip,
      `${back} project lines; focus ${mf ? "on the button" : "elsewhere"}; ${m.band ? "band drawn" : "no band"}, ${m.tip ? `tooltip "${m.tip.day}"` : "no tooltip"}`);
    // The keyboard: Shift+Tab from the chart reading a turn goes to the last project button, which ends the reading; Space isolates.
    await c.read(page);
    await until(() => state(page), s => onPoint(s, I, centre(s.grid, I)).ok);
    await page.keyboard.press("Shift+Tab");
    await sleep(300);
    const k = await state(page), kf = await ev(page, () => document.activeElement?.textContent.split(" · ")[0] ?? "");
    await page.keyboard.press("Space");
    const kd = await until(() => ev(page, () => ({ n: window.linefit.projects().length, pressed: window.linefit.legend().filter(k => k.pressed).map(k => k.name) })), r => r.n === 1);
    line(`by the keyboard: Shift+Tab from the chart to ${keys.at(-1).name}'s button ends the reading; Space isolates it`, kf === keys.at(-1).name && !k.band && !k.tip && kd.n === 1 && kd.pressed.join() === kf,
      `focus on "${kf}"; ${k.band ? "band drawn" : "no band"}, ${k.tip ? `tooltip "${k.tip.day}"` : "no tooltip"}; then ${kd.n} project line, pressed ${kd.pressed.join(", ") || "none"}`);
    await page.done();
  }

  {
    const page = await c.open("focus ring");
    await ringLine(c, page, ROOT, `${ROOT} .legend button.key.proj >> nth=-1`, "Tab", "Tab from the last project button onto the chart");
    await c.shot(page, "focus");
    await page.done();
  }
  await c.refreshRead();
  await motionLines(c, "growth", "grows the strip and draws the lines in");
}

async function weeks(h) {
  const ROOT = ".start-trend";
  const store = await h.json("/api/context?range=30");
  const TREND = store.starting.trend, WEEKS = TREND.map(w => w.week);
  const setup = { content: `(${lineReaders})(${JSON.stringify(ROOT)})` };
  const label = (k, long = false) => (long ? `Week of ${day(k)}:` : day(k));
  const c = chart(h, {
    name: "context-weeks", path: "/context?range=30", root: ROOT, points: WEEKS, label, unit: { one: "week", many: "weeks" }, at: 2, // week 3
    data: DATA, setup, activates: false, zoom: false,
    // The newest week's median up: its point moves, week 3's words do not.
    newer: (d, more) => { d.starting.trend.at(-1).median += more * 10; return d; },
    kept: [],
  });
  const { N, I, centre, ev, state, onPoint, box, away } = c;
  const plotH = page => ev(page, () => { const g = window.chartfit.grid(); return { plot: Math.round(g.b - g.t), box: Math.round(window.chartfit.box().h) }; });
  /** The 30k line dashed at 30k, its label "30k" inside the plot, over the line. */
  const largeLine = async (page, what) => {
    await settle(page);
    const b = await ev(page, () => ({ g: window.chartfit.grid(), values: window.linefit.values(), dashed: window.linefit.dashed(), label: window.chartfit.texts().find(x => x.text === "30k") }));
    const y = yOf(b.g, b.values), em = b.label && (b.label.t + b.label.b - b.label.size) / 2;
    line(`${what}: the 30k line is dashed at 30k, its label inside the plot`, b.dashed.length === 1 && b.dashed[0].dash === "4,3" && Math.abs(b.dashed[0].y - y(30000)) <= 1 && !!b.label && b.label.l >= b.g.l - .5 && b.label.r <= b.g.r + .5 && em >= b.g.t - .5,
      `line ${b.dashed.map(x => `${x.dash} at ${x.y.toFixed(1)}px`).join(", ") || "none"}, 30k at ${y(30000).toFixed(1)}px; label ${b.label ? `${b.label.l.toFixed(1)}..${b.label.r.toFixed(1)} x ${b.label.t.toFixed(1)}..${b.label.b.toFixed(1)}px` : "none"}, plot ${b.g.l.toFixed(1)}..${b.g.r.toFixed(1)} x ${b.g.t.toFixed(1)}..${b.g.b.toFixed(1)}px`);
  };

  // The colors, in light and dark: the median --text-primary, the band --text-secondary.
  {
    const page = await c.open("colors");
    const got = [];
    for (const scheme of ["light", "dark"]) {
      await c.theme(page, scheme);
      const want = await ev(page, () => ({ ink: window.chartfit.probe("var(--text-primary)"), band: window.chartfit.probe("var(--text-secondary)") }));
      const r = await until(() => ev(page, () => ({ median: window.linefit.median()?.stroke, band: window.linefit.polygons().map(p => p.fill) })), r => r.median === want.ink);
      got.push({ scheme, want, ...r });
    }
    line("light and dark: the median is --text-primary and the band --text-secondary, and both differ between them", got.every(x => x.median === x.want.ink && x.band.length >= 1 && x.band.every(f => f === x.want.band)) && got[0].want.ink !== got[1].want.ink,
      got.map(x => `${x.scheme}: median rgb(${x.median}), band ${x.band.map(f => `rgb(${f})`).join(", ")}; tokens rgb(${x.want.ink}), rgb(${x.want.band})`).join("; "));
    await c.shot(page, "dark");
    await page.done();
  }

  // Forced colors: the shared block counts bars, which this chart has none of.
  {
    const page = await c.open("forced colors", { forcedColors: "active" });
    const { sys, name } = await sysColors(ev, page);
    const g = await ev(page, () => window.chartfit.grid());
    await page.mouse.move(centre(g, I), (g.t + g.b) / 2);
    const got = await until(() => ev(page, () => ({ band: window.chartfit.band(), texts: window.chartfit.texts(), median: window.linefit.median(), halos: window.linefit.halos(), polygons: window.linefit.polygons(), dashed: window.linefit.dashed() })), r => r.band);
    const off = got.texts.filter(t => t.fill !== sys.CanvasText);
    line("forced colors: the axis text is CanvasText, the week read a band in Highlight", got.texts.length > 0 && !off.length && got.band?.fill === sys.Highlight,
      `${off.length ? off.map(t => `"${t.text}" rgb(${t.fill})`).join(", ") : `${got.texts.length} texts CanvasText`}; band ${got.band ? `${name[got.band.fill] ?? `rgb(${got.band.fill})`} at ${got.band.opacity}` : "none"}`);
    line("forced colors: the median is CanvasText on a Canvas halo, the band and the 30k line system colors",
      got.median?.stroke === sys.CanvasText && got.halos.some(x => x.stroke === sys.Canvas) && got.polygons.length >= 1 && got.polygons.every(p => name[p.fill] && p.opacity >= .1) && got.dashed.every(x => name[x.stroke]),
      `median ${name[got.median?.stroke] ?? `rgb(${got.median?.stroke})`}; halos ${got.halos.map(x => name[x.stroke] ?? `rgb(${x.stroke})`).join(", ")}; band ${got.polygons.map(p => `${name[p.fill] ?? `NOT A SYSTEM COLOR rgb(${p.fill})`} at ${p.opacity}`).join(", ")}; 30k line ${got.dashed.map(x => name[x.stroke] ?? `NOT A SYSTEM COLOR rgb(${x.stroke})`).join(", ") || "none"}`);
    const strokes = await ev(page, () => window.linefit.strokes()), odd = Object.keys(strokes).filter(k => !name[k]);
    line("forced colors: every stroke in the chart is a system color", Object.keys(strokes).length > 0 && !odd.length,
      Object.entries(strokes).map(([k, x]) => `${name[k] ?? `NOT A SYSTEM COLOR rgb(${k})`} ${x.n}x, e.g. ${x.e}`).join("; "));
    await c.shot(page, "forced-colors");
    await page.done();
  }

  await c.textSize();
  // The box and the plot at 16px and 32px text; the 30k line; the edges and the labels; 32px set after the load.
  {
    const p16 = await c.open("16px root, plot");
    await settle(p16);
    const at16 = await plotH(p16);
    await largeLine(p16, "weekly start, 1440px");
    await c.edges(p16, `weekly start, a ${await ev(p16, () => Math.round(window.chartfit.box().w))}px box`);
    await c.labelsFit(p16, "weekly start, 1440px", true);
    // The text doubles after the load: a key redraws the chart in the same box, laid out at the scale the box was.
    await ev(p16, () => { document.documentElement.style.fontSize = "32px"; });
    await box(p16).focus();
    await p16.keyboard.press("ArrowRight");
    await until(() => state(p16), s => s.band);
    await sleep(300);
    const late = await ev(p16, () => { const g = window.chartfit.grid(), b = window.chartfit.box(), ts = window.chartfit.texts(); return { g, b, out: ts.filter(t => t.l < b.l - .5 || t.r > b.r + .5 || t.t < b.t - .5 || t.b > b.b + .5).map(t => t.text), n: ts.length }; });
    line("32px text set after the load: Right redraws inside the 180px box, the plot 144px, every label inside the box", Math.round(late.b.h) === 180 && Math.round(late.g.b - late.g.t) === 144 && late.g.b <= late.b.b && late.n > 0 && !late.out.length,
      `box ${Math.round(late.b.h)}px, plot ${Math.round(late.g.b - late.g.t)}px ${late.g.t.toFixed(1)}..${late.g.b.toFixed(1)}px in ${late.b.t.toFixed(1)}..${late.b.b.toFixed(1)}px; ${late.out.length ? `cut: ${late.out.join(", ")}` : `${late.n} labels inside`}`);
    await c.shot(p16, "text-32px-late");
    await p16.done();
    const p32 = await c.open("32px root, plot", {}, root32);
    await settle(p32);
    const at32 = await plotH(p32);
    line("the plot is 144px at 16px text and at 32px; the box 180px, then 216px", at16.plot === 144 && at32.plot === 144 && at16.box === 180 && at32.box === 216,
      `plot ${at16.plot}px, then ${at32.plot}px; box ${at16.box}px, then ${at32.box}px`);
    await largeLine(p32, "weekly start, 32px root");
    await c.edges(p32, "weekly start, 32px root");
    await c.labelsFit(p32, "weekly start, 32px root", true);
    await c.shot(p32, "text-32px");
    await p32.done();
    const pp = await c.open(`${PHONE}px window`, { viewport: { width: PHONE, height: 900 } });
    await settle(pp);
    const bw = await ev(pp, () => Math.round(window.chartfit.box().w));
    await c.edges(pp, `weekly start, a ${bw}px box`);
    await c.labelsFit(pp, `weekly start, a ${bw}px box`, true);
    const kept = await ev(pp, () => window.linefit.under().map(x => x.text));
    line(`a ${bw}px box: the week labels ECharts keeps include the first and the newest`, kept[0] === day(WEEKS[0]) && kept.at(-1) === day(WEEKS.at(-1)), `${kept.join(", ")} of ${WEEKS.map(k => day(k)).join(", ")}`);
    await c.shot(pp, "narrow");
    await pp.done();
    const pp32 = await c.open(`${PHONE}px window, 32px root`, { viewport: { width: PHONE, height: 900 } }, root32);
    await settle(pp32);
    await c.labelsFit(pp32, `weekly start, a ${bw}px box at 32px text`, true);
    const kept32 = await ev(pp32, () => window.linefit.under().map(x => x.text));
    line(`a ${bw}px box at 32px text: the week labels ECharts keeps include the newest`, kept32.at(-1) === day(WEEKS.at(-1)), `${kept32.join(", ")}`);
    await c.shot(pp32, "narrow-32px");
    await pp32.done();
  }

  // The reading: the real pointer and the keys; the tooltip; Escape elsewhere.
  {
    const page = await c.open("reading");
    await settle(page);
    await c.pointer(page);
    await c.keys(page);
    const t = await ev(page, () => window.linefit.tip());
    line(`the tooltip at week ${I + 1}: the week, the median, the percentiles and the sessions`, !!t && t.head.text === `Week of ${day(WEEKS[I])}` && t.rows.map(r => r.name).join() === "Median,25th to 75th percentile,Sessions",
      `${headText(t)}; rows ${t?.rows.map(r => `${r.name} ${r.value}`).join(", ") ?? "none"}`);
    await page.keyboard.press("Escape");
    await c.escapeElsewhere(page);
    await page.done();
  }

  // A gap, a lone week and a week of 2 sessions: 9 weeks, the second of 2 sessions, the fourth and the sixth empty.
  {
    const FULL = [0, 1, 2, 4, 6, 7, 8], E = 3, last = WEEKS.at(-1);
    const SLOTS = Array.from({ length: 9 }, (_, k) => plus(last, -7 * (8 - k)));
    const gapped = d => {
      const t = d.starting.trend;
      d.starting.trend = FULL.map((k, j) => ({ ...t[j % t.length], week: SLOTS[k], sessions: k === 1 ? 2 : Math.max(9, t[j % t.length].sessions) }));
      return d;
    };
    const gc = chart(h, { name: "context-weeks-gaps", path: "/context?range=30", root: ROOT, points: SLOTS, label, unit: { one: "week", many: "weeks" }, at: 2, data: DATA, setup, answer: gapped, newer: d => d, kept: [] });
    const page = await gc.openOn({ points: FULL.length }, "gaps");
    await settle(page);
    const g = await ev(page, () => window.chartfit.grid());
    const got = await ev(page, () => ({ polygons: window.linefit.polygons(), spans: window.linefit.spans(), median: window.linefit.median(), dots: window.chartfit.dots() }));
    const xs = k => gc.centre(g, k);
    line("9 weeks with 2 empty: two band polygons and one span on the lone week", got.polygons.length === 2 && got.polygons.every(p => p.points.length === 6) && got.spans.length === 1 && Math.abs(got.spans[0].x - xs(4)) <= 1 && got.spans[0].width === 7,
      `${got.polygons.length} polygons of ${got.polygons.map(p => p.points.length).join(", ")} points; ${got.spans.length} span(s) ${got.spans.map(s => `${s.width}px at ${s.x.toFixed(1)}px`).join(", ")}, week 5 at ${xs(4).toFixed(1)}px`);
    const runs = got.median?.runs.map(r => r.length) ?? [];
    line("the median is in three parts, of 3, 1 and 3 weeks", runs.join() === "3,1,3", `parts of ${runs.join(", ") || "none"}`);
    const ink = await ev(page, () => window.chartfit.probe("var(--text-primary)"));
    const hollow = got.dots.find(d => Math.abs(d.x - xs(1)) <= 1), lone = got.dots.find(d => Math.abs(d.x - xs(4)) <= 1);
    line("the week of 2 sessions is a hollow dot, the lone week a solid one", got.dots.length === 2 && !!hollow && hollow.fill !== ink && hollow.stroke === ink && !!lone && lone.fill === ink,
      got.dots.map(d => `rgb(${d.fill}) in ${d.stroke === "none" ? "no ring" : `rgb(${d.stroke})`} at ${d.x.toFixed(1)}px`).join("; ") + `; weeks 2 and 5 at ${xs(1).toFixed(1)}, ${xs(4).toFixed(1)}px, ink rgb(${ink})`);
    const sentence = `Week of ${day(SLOTS[E])}: no session started.`;
    await box(page).focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    const few = await until(() => ev(page, () => window.linefit.tip()), t => t?.head.text === `Week of ${day(SLOTS[1])}`);
    line("the week of 2 sessions: its tooltip gives its 2 sessions and says it rests on few sessions", !!few && few.rows.find(r => r.name === "Sessions")?.value === "2" && few.notes.includes("Rests on few sessions"),
      few ? `rows ${few.rows.map(r => `${r.name} ${r.value}`).join(", ")}; ${few.notes.join("; ")}` : "no tooltip");
    await page.keyboard.press("ArrowRight");
    await until(() => ev(page, () => window.linefit.tip()), t => t?.head.text === `Week of ${day(SLOTS[2])}`);
    await ev(page, () => window.linefit.listen());
    await page.keyboard.press("ArrowRight");
    const s = await until(() => state(page), s => s.band && Math.abs(mid(s.band) - xs(E)) <= 1.5 && s.readout === sentence);
    const tip = await ev(page, () => window.linefit.tip());
    await sleep(700);
    const heard = await ev(page, () => window.linefit.heard());
    line(`Right from week ${E} reads the empty week ${E + 1}: the band on it, the tooltip "No session started", the live region says "${sentence}" once`,
      !!s.band && Math.abs(mid(s.band) - xs(E)) <= 1.5 && tip?.head.text === `Week of ${day(SLOTS[E])}` && tip.notes.join() === "No session started" && !tip.rows.length && heard.length === 1 && heard[0] === sentence,
      `band at ${px(mid(s.band))}, week ${E + 1} at ${px(xs(E))}; ${headText(tip)}, ${tip?.notes.join("; ") ?? ""}; said ${JSON.stringify(heard)}`);
    await gc.shot(page, "empty-week");
    await page.keyboard.press("Escape");
    await ev(page, () => document.activeElement?.blur());
    await away(page);
    await page.mouse.move(xs(E), (g.t + g.b) / 2);
    const p = await until(() => state(page), s => s.band && Math.abs(mid(s.band) - xs(E)) <= 1.5 && s.tip);
    const pt = await ev(page, () => window.linefit.tip());
    line(`the pointer over the empty week: the band on it, the tooltip "No session started", the readout its sentence`, !!p.band && Math.abs(mid(p.band) - xs(E)) <= 1.5 && pt?.notes.join() === "No session started" && p.readout === sentence,
      `band at ${px(mid(p.band))}; tooltip ${pt?.notes.join("; ") ?? "none"}; readout "${p.readout}"`);
    await page.done();
  }

  {
    const page = await c.open("focus ring");
    await ringLine(c, page, ROOT, `${ROOT} .chart-table button`, "Shift+Tab", "Shift+Tab from the data table's button onto the chart");
    await c.shot(page, "focus");
    await page.done();
  }
  await c.refreshRead();
  await motionLines(c, "weekly start", "draws the line in");
}
