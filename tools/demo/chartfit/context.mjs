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
//
// The session map on /context?range=30 (#pressure .session-map) mounts the wrapper with no points: the wrapper reads
// nothing, so none of the shared checks apply. The map reads itself (its keys, pointer, ring, tooltip and live region on
// div.map-box), and mapReaders() reads its drawing. Every page's answer puts three sessions in Heavy and full, three
// compacted and one peak over its window; a session's pixel is read from the drawn axes (the x labels' anchors, log, and
// the y grid lines), never from the map's fit. Its own lines:
// - at 1440px, in the PHONE window, at 32px text in both, at a device pixel ratio of 2 and after a resize: every session's
//   dot at its pixel on the drawn axes within 1px, each compacted one ringed; the guides at 30k and 80%; each quadrant's
//   name inside its quadrant, wrapped where needed; the "80% of window" label inside the plot, on the side said; the x
//   labels at 1, 2 and 5 times a power of ten, none overlapping, the hidden ones said; both axis titles inside the box;
// - the box 320px at 16px text and 380px at 32px, the plot 260px in both;
// - the keys: Right from no reading reads the oldest session, the ring centred on its dot, the tooltip and the live region
//   naming it; Right through every session; Enter opens its sheet and closing it returns the focus to the map;
// - the pointer: on each dot's centre the ring is on that dot within 1px, also after the page scrolls, in the PHONE
//   window, at 32px text and at a device pixel ratio of 2; 11px off a lone dot reads it, 13px off nothing; a dot is read
//   from outside the plot (a known difference from the old chart, measured); the hand over a dot and over the plot, not
//   over the axis labels; a click opens the dot's sheet, the cursor and the focus around it said; the tooltip at the
//   plot's four outermost dots inside the window and the box from side to side, its bottom said;
// - a click in the top right away from any dot selects Heavy and full: its wash, the other dots at 20%, the bars above
//   counting its sessions, its list; a second click clears it; a quadrant selected by its button keeps the pointer's
//   reading on its session; Escape on another control closes the pointer's tooltip and keeps the quadrant; one Escape on
//   the map ends a key's reading and clears the quadrant;
// - newer figures with an older session added keep a key's reading on its session and say nothing; with 1,000 sessions
//   the first drawing and a quadrant's redraw are timed, printed, and each under 100ms, and newer figures that push the
//   session read off the map end the reading;
// - light and dark: the dots' edges the surface, the guides --text-muted, the ring --text-primary, the wash --surface-2,
//   the dots' colors changing with the theme; forced colors: each dot's edge and each compacted ring CanvasText, the
//   guides and the texts system colors, the selected quadrant a 2px Highlight frame with no fill over the grid lines and
//   under the dots, the ring around the dot read Highlight;
// - with motion on and with reduced motion the dots draw at once; Shift+Tab onto the map draws its focus ring.
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
  await sessionMap(h);
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
      got.push({ what, k, ...await ev(p, () => ({ handles: window.chartfit.handles().length, h: Math.round(window.chartfit.box().h), label: document.querySelector(".cache-chart .echart").getAttribute("aria-label").includes("and plus and minus to zoom.") })) });
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

/** The session map's readers, installed in every page before its scripts as window.mapfit. This function runs in the page:
 *  it uses nothing from this module. The marks it tells apart are ECharts' SVG elements under the map's box, in paint order:
 *  - a dot: a path drawn as one arc of radius 4; a compacted session's ring: one of radius 7.5;
 *  - the grid lines: stroked, unfilled, undashed paths; the y axis's are horizontal, the plot's top and bottom;
 *  - the guides: the dashed paths; the selected quadrant: the one other path wider and taller than 1px, filled, or framed
 *    2px wide under forced colors;
 *  - the texts, each line its own element: its anchor (its x and y through its transform), its halo (a stroke) and weight.
 *  Colors are "r,g,b", a system color named in an attribute probed to its "r,g,b". */
function mapReaders() {
  const R = "#pressure .session-map";
  const q = s => document.querySelector(`${R} ${s}`);
  const tri = c => (String(c).match(/[\d.]+/g) || []).slice(0, 3).map(n => Math.round(Number(n))).join(",");
  const col = c => (c && /^[a-z]+$/i.test(c) && !["none", "transparent"].includes(c) ? window.chartfit.probe(c) : tri(c));
  const rect = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 }; };
  const svg = () => q(".echart-plot svg");
  const a = (e, k) => e.getAttribute(k);
  const paths = () => [...(svg()?.querySelectorAll("path") ?? [])].filter(e => !e.closest("clipPath, defs"));
  const screen = (e, x, y) => new DOMPoint(x, y).matrixTransform(e.getScreenCTM());
  /** A circle's radius and its centre on the screen: the renderer writes it as an arc from its rightmost point. */
  const circle = e => {
    const m = /^M(-?[\d.]+) (-?[\d.]+)A([\d.]+) \3 0 1 1 /.exec(a(e, "d") ?? "");
    if (!m) return null;
    const r = Number(m[3]), p = screen(e, Number(m[1]) - r, Number(m[2]));
    return { r, x: p.x, y: p.y };
  };
  const stroked = e => !["none", "transparent", null].includes(a(e, "stroke")) && a(e, "stroke-opacity") !== "0";
  const filled = e => !["none", "transparent", null].includes(a(e, "fill"));
  const circles = r => paths().map((e, i) => ({ e, i, c: circle(e) })).filter(x => x.c && Math.abs(x.c.r - r) < .01);
  addEventListener("mousemove", e => { window.__moved = { x: e.clientX, y: e.clientY }; }, true);
  window.mapfit = {
    /** The plot, from the grid lines: the horizontal ones' extent; their colors; the last one's place in the paint order. */
    frame() {
      const lines = paths().map((e, i) => ({ e, i })).filter(({ e }) => !circle(e) && !filled(e) && stroked(e) && !a(e, "stroke-dasharray"))
        .map(({ e, i }) => ({ i, stroke: col(a(e, "stroke")), ...rect(e) })).filter(r => (r.h < 1 && r.w > 1) || (r.w < 1 && r.h > 1));
      const hz = lines.filter(r => r.h < 1);
      if (!hz.length) return null;
      return { l: Math.min(...hz.map(r => r.l)), r: Math.max(...hz.map(r => r.r)), t: Math.min(...hz.map(r => r.y)), b: Math.max(...hz.map(r => r.y)),
        strokes: [...new Set(lines.map(r => r.stroke))], last: Math.max(...lines.map(r => r.i)) };
    },
    dots: () => circles(4).map(({ e, i, c }) => ({ i, x: c.x, y: c.y, fill: col(a(e, "fill")), stroke: col(a(e, "stroke")), so: Number(a(e, "stroke-opacity") ?? 1) })),
    rings: () => circles(7.5).map(({ e, i, c }) => ({ i, x: c.x, y: c.y, stroke: col(a(e, "stroke")), so: Number(a(e, "stroke-opacity") ?? 1) })),
    guides: () => paths().map((e, i) => ({ e, i })).filter(({ e }) => a(e, "stroke-dasharray")).map(({ e, i }) => ({ i, dash: a(e, "stroke-dasharray"), stroke: col(a(e, "stroke")), ...rect(e) })),
    /** The selected quadrant's wash, or its frame under forced colors. */
    wash: () => paths().map((e, i) => ({ e, i })).filter(({ e }) => !circle(e) && !a(e, "stroke-dasharray") && rect(e).w > 1 && rect(e).h > 1 && (filled(e) || a(e, "stroke-width") === "2"))
      .map(({ e, i }) => ({ i, fill: filled(e) ? col(a(e, "fill")) : "none", stroke: stroked(e) ? col(a(e, "stroke")) : "none", width: Number(a(e, "stroke-width") ?? 0), ...rect(e) }))[0] ?? null,
    texts: () => [...(svg()?.querySelectorAll("text") ?? [])].map(e => {
      const p = screen(e, Number(a(e, "x") ?? 0), Number(a(e, "y") ?? 0)), cs = getComputedStyle(e);
      return { text: e.textContent, ax: p.x, ay: p.y, anchor: a(e, "text-anchor") ?? "start", fill: col(a(e, "fill")), halo: stroked(e) ? col(a(e, "stroke")) : null,
        size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight), ...rect(e) };
    }),
    /** The ring around the dot read: its centre, its radius and its stroke as computed. */
    mark: () => {
      const c = q(".map-mark circle");
      if (!c) return null;
      const cs = getComputedStyle(c);
      return { ...rect(c), r: Number(a(c, "r")), stroke: tri(cs.stroke), width: parseFloat(cs.strokeWidth) };
    },
    tip: () => {
      const t = q(".map-box > .tip");
      return t && getComputedStyle(t).display !== "none" && t.getBoundingClientRect().width ? { name: t.querySelector(".tname")?.textContent ?? "", ...rect(t) } : null;
    },
    live: () => q(".map-live")?.textContent ?? "",
    /** The chart's box, the origin of the map's pixels. */
    box: () => rect(q(".map-box .echart")),
    svgWidth: () => Number(a(svg(), "width")),
    hand: () => !!q(".map-box.hand"),
    cursor: (x, y) => { const e = document.elementFromPoint(x, y); return e ? `${getComputedStyle(e).cursor} on ${e.tagName.toLowerCase()}${typeof e.className === "string" && e.className ? `.${e.className.split(" ")[0]}` : ""}` : "nothing"; },
    quad: () => q(".quads button[aria-pressed=true]")?.dataset.quad ?? null,
    /** What the quadrant narrows: the note over the bars, the sessions the bars count, the list's items. */
    narrowed: () => ({
      note: document.querySelector("#pressure .quad-note")?.textContent ?? "",
      bars: [...document.querySelectorAll("#pressure .pressure .prow .pw")].reduce((s, e) => s + Number((/· ([\d,]+) session/.exec(e.textContent)?.[1] ?? "0").replace(/,/g, "")), 0),
      list: document.querySelectorAll(`${R} .qlist li`).length,
    }),
    /** The focused element: "map" for the map's box, else its id, tag and class. */
    focus: () => {
      const e = document.activeElement;
      if (!e || e === document.body) return "body";
      if (e === q(".map-box .echart")) return "map";
      return e.id ? `#${e.id}` : `${e.tagName.toLowerCase()}${typeof e.className === "string" && e.className ? `.${e.className.split(" ")[0]}` : ""}`;
    },
    sheet: () => { const d = document.querySelector("dialog.sheet[open]"); return { open: !!d, focus: !!d && d.contains(document.activeElement), session: new URLSearchParams(location.search).get("session") }; },
    /** The dots' places in the box, in one string: what an animation frame would change, and a scroll would not. */
    signature: () => { const b = q(".map-box .echart")?.getBoundingClientRect(); return b ? circles(4).map(({ c }) => `${(c.x - b.left).toFixed(1)},${(c.y - b.top).toFixed(1)}`).join(" ") : ""; },
    /** A text's width at px and a weight in the plot's font, as a canvas measures it. */
    measure: (text, px, weight = 600) => {
      const ctx = (window.__mapCtx ??= document.createElement("canvas").getContext("2d")), t = svg()?.querySelector("text");
      ctx.font = `${weight} ${px}px ${t ? getComputedStyle(t).fontFamily : getComputedStyle(document.body).fontFamily}`;
      return ctx.measureText(text).width;
    },
    /** The last pointer move's clientX and clientY, as the page got them. */
    moved: () => window.__moved ?? { x: NaN, y: NaN },
    /** The live region's sentences from now on. */
    listen: () => {
      window.__mapSaid = [];
      if (window.__mapListening) return;
      window.__mapListening = true;
      new MutationObserver(() => { const t = q(".map-live").textContent; if (t) window.__mapSaid.push(t); }).observe(q(".map-live"), { childList: true, characterData: true, subtree: true });
    },
    said: () => window.__mapSaid ?? [],
  };
}

/** An init script that keeps every distinct place of the dots, from the first frame on, as window.__dotDrawings. */
function watchDots() {
  window.__dotDrawings = [];
  const tick = () => {
    const s = window.mapfit?.signature();
    if (s && s !== window.__dotDrawings.at(-1)) window.__dotDrawings.push(s);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// The map's rules for the payload's sessions, as context.ts and mapDots.ts give them.
const START_LARGE = 30000, NEAR = .8;
const NAMES = { lean: "Lean", heavy: "Heavy start", full: "Grew full", both: "Heavy and full" };
/** The sessions on the map, oldest first. */
const mapRows = d => d.sessions_map.points.slice().sort((a, b) => (a.first_ts ?? "").localeCompare(b.first_ts ?? "") || a.session_id.localeCompare(b.session_id));
const sessName = p => p.title || `#${p.session_id.slice(0, 8)}`;
const quadOf = p => (p.start >= START_LARGE ? (p.peak / p.window >= NEAR ? "both" : "heavy") : (p.peak / p.window >= NEAR ? "full" : "lean"));
const roundDown = v => { const p = 10 ** Math.floor(Math.log10(v)); return p * [10, 5, 2, 1].find(m => m * p <= v * (1 + 1e-9)); };
const roundUp = v => { const p = 10 ** Math.floor(Math.log10(v)); return p * [1, 2, 5, 10].find(m => m * p >= v * (1 - 1e-9)); };
const startDomain = starts => {
  const a = roundDown(Math.max(1, Math.min(START_LARGE, ...starts))), b = roundUp(Math.max(START_LARGE, ...starts));
  return [a, b > a ? b : a * 10];
};
const startTicks = ([lo, hi]) => {
  const out = [];
  for (let p = 10 ** Math.floor(Math.log10(lo)); p <= hi * (1 + 1e-9); p *= 10)
    for (const m of [1, 2, 5]) if (m * p >= lo * (1 - 1e-9) && m * p <= hi * (1 + 1e-9)) out.push(m * p);
  return out;
};
/** A tick label as a number: "2k", "1M", "500". */
const tickValue = t => { const m = /^([\d.]+)([kMB]?)$/.exec(t); return m ? Number(m[1]) * { "": 1, k: 1e3, M: 1e6, B: 1e9 }[m[2]] : NaN; };
/** The dots' successive places (watchDots), each after the first as how many dots it had and how far they moved: a place
 *  in the box is read to a tenth of a pixel, so a box at a fractional place in the window can put a dot 0.1px off. */
const moves = ds => ds.slice(1).map((s, i) => {
  const a = ds[i].split(" ").map(p => p.split(",").map(Number)), b = s.split(" ").map(p => p.split(",").map(Number));
  const shift = b.map((p, k) => (a[k] ? Math.hypot(p[0] - a[k][0], p[1] - a[k][1]) : Infinity));
  return { n: b.length, was: a.length, moved: shift.filter(x => x > .25).length, most: Math.max(...shift) };
});
/** Whether the dots were drawn once: no later place has another count of dots or a dot more than 0.25px off; and the line. */
const once = ds => {
  const ms = moves(ds);
  return { ok: ds.length > 0 && ms.every(m => m.n === m.was && !m.moved), at: `${ds.length} distinct places of the dots${ms.length ? `: ${ms.map(m => `${m.was} dots, then ${m.n}, ${m.moved} moved more than 0.25px, the most by ${m.most.toFixed(2)}px`).join("; ")}` : ""}` };
};
const round125 = v => { const p = 10 ** Math.floor(Math.log10(v) + 1e-9), m = v / p; return [1, 2, 5].some(x => Math.abs(m - x) < 1e-6); };
const tickText = v => (v >= 1e6 ? `${v / 1e6}M` : v >= 1e3 ? `${v / 1e3}k` : String(v));
/** The WCAG contrast ratio of two "r,g,b" colors. */
const ratio = (a, c) => {
  const lum = t => t.split(",").map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
  const [x, y] = [lum(a), lum(c)].sort((p, q) => q - p);
  return (x + .05) / (y + .05);
};

/** The store's sessions with the map's cases: three in Heavy and full, three compacted, one peak over its window. */
const mapCases = d => {
  const ps = mapRows(d), n = ps.length, at = f => ps[Math.min(n - 1, Math.floor(n * f))];
  [.3, .5, .7].forEach((f, k) => { const p = at(f); p.start = 45000 + 7000 * k; p.peak = Math.round(p.window * (.86 + .04 * k)); });
  for (const f of [.2, .45, .65]) at(f).compactions = Math.max(1, at(f).compactions);
  at(.85).peak = Math.round(at(.85).window * 1.1);
  return d;
};
/** 1,000 sessions, a minute apart up to the store's newest, their starts and peaks spread over the plot; every ninth
 *  compacted, a third untitled. */
const thousand = d => {
  const base = d.sessions_map.points, end = Math.max(...base.map(p => Date.parse(p.first_ts ?? "") || 0), Date.now() - 864e5);
  const frac = x => x - Math.floor(x);
  d.sessions_map = { total: 1000, points: Array.from({ length: 1000 }, (_, k) => {
    const p = base[k % base.length];
    return { ...p, session_id: `m${String(k).padStart(4, "0")}-chartfit-map`, title: k % 3 ? `Map session ${k}` : null, first_ts: new Date(end - (999 - k) * 6e4).toISOString(),
      start: Math.round(2000 * 100 ** frac(k * .618034)), peak: Math.round(p.window * (.05 + frac(k * .371))), compactions: k % 9 ? 0 : 1 };
  }) };
  return d;
};

async function sessionMap(h) {
  const ROOT = "#pressure .session-map", PATH = "/context?range=30";
  const store = await h.json("/api/context?range=30");
  const ev = (page, f, arg) => page.evaluate(f, arg);
  const away = page => page.mouse.move(2, 2);
  const box = page => page.locator(`${ROOT} .map-box .echart`);
  const shot = (page, what) => h.shot(page, ROOT, `context-map-${what}`);
  const p1 = n => Math.round(n * 10) / 10;
  /** A page of the map with the payload answer(payload) (the map's cases by default), drawn once its dots are, the map
   *  scrolled into view. answer may close over a change made later: the status is answered too, so a window focus asks
   *  for the payload again, as a background ingest does. */
  const open = async (name, { answer = mapCases, path = PATH, options = {}, init = null, ready = null } = {}) => {
    const want = mapRows(answer(structuredClone(store))).length;
    let bump = 0;
    const page = await h.open({ path, root: ROOT, setup: mapReaders, data: DATA, answer,
      ready: ready ?? (async p => {
        await until(() => p.evaluate(() => window.mapfit.dots().length), n => n === want);
        await p.locator(`${ROOT} .map-box`).scrollIntoViewIfNeeded();
      }) }, `map ${name}`, options, init);
    page.newer = async () => {
      bump++;
      await page.route(/\/api\/status/, route => h.answer(route, s => ({ ...s, last_change: `chartfit map ${bump}` })));
      await ev(page, () => window.dispatchEvent(new Event("visibilitychange")));
    };
    return page;
  };
  const drawing = page => ev(page, () => ({ frame: window.mapfit.frame(), dots: window.mapfit.dots(), rings: window.mapfit.rings(), guides: window.mapfit.guides(),
    texts: window.mapfit.texts(), box: window.mapfit.box() }));
  const state = page => ev(page, () => ({ mark: window.mapfit.mark(), tip: window.mapfit.tip(), live: window.mapfit.live(), box: window.mapfit.box(), win: innerWidth }));

  /** Where the drawn axes put each session (rows, oldest first): x through the anchors of the two farthest x labels, log; y
   *  from the grid lines, 0 to 100%, a peak over the window at 100%. Null when fewer than two x labels are drawn. */
  const placesOf = (dr, rows) => {
    const f = dr.frame;
    const xs = f ? dr.texts.filter(t => !t.halo && t.ay > f.b + 1 && tickValue(t.text) > 0).sort((a, b) => tickValue(a.text) - tickValue(b.text)) : [];
    if (xs.length < 2) return null;
    const lo = xs[0], hi = xs.at(-1), [vl, vh] = [tickValue(lo.text), tickValue(hi.text)], low = startDomain(rows.map(r => r.start))[0];
    const x = v => lo.ax + (Math.log(Math.max(v, low)) - Math.log(vl)) / (Math.log(vh) - Math.log(vl)) * (hi.ax - lo.ax);
    const y = s => f.b - Math.min(1, s) * (f.b - f.t);
    return { x, y, xs, at: rows.map(r => ({ x: x(r.start), y: y(r.peak / r.window) })) };
  };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const nearest = (p, ds) => ds.reduce((m, d) => Math.min(m, dist(p, d)), Infinity);
  /** The ring's centre in px from the box's top left, or null. */
  const markIn = s => s.mark && { x: s.mark.x - s.box.l, y: s.mark.y - s.box.t };
  /** The window's pixel of p, in px from the box's top left, wherever the box is now. */
  const abs = async (page, p) => { const b = await ev(page, () => window.mapfit.box()); return { x: b.l + p.x, y: b.t + p.y }; };
  /** Moves the pointer to p (from the box's top left), off by dx, dy; gives the window's pixel. */
  const move = async (page, p, dx = 0, dy = 0) => { const a = await abs(page, { x: p.x + dx, y: p.y + dy }); await page.mouse.move(a.x, a.y); return a; };

  /** The reading of a page: its drawing, each session's pixel on the drawn axes, and the checks that use them. */
  async function reading(page, rows) {
    const dr = await drawing(page), pl = placesOf(dr, rows), B = dr.box, rel = p => ({ x: p.x - B.l, y: p.y - B.t });
    // In px from the box's top left: the page may scroll after the reading.
    const at = pl ? pl.at.map(rel) : rows.map(() => ({ x: NaN, y: NaN })), dots = dr.dots.map(rel);
    const frame = dr.frame && { l: dr.frame.l - B.l, r: dr.frame.r - B.l, t: dr.frame.t - B.t, b: dr.frame.b - B.t };
    /** Whether the reading is on session k: the ring centred within 1px on a drawn dot and on k's pixel, the tooltip and the
     *  live region naming k. */
    const on = (s, k) => {
      const m = markIn(s), off = m ? dist(m, at[k]) : Infinity, drawnOff = m ? nearest(m, dots) : Infinity;
      const ok = off <= 1 && drawnOff <= 1 && s.tip?.name === sessName(rows[k]) && s.live.startsWith(`${sessName(rows[k])}:`);
      return { ok, off, drawnOff, at: `session ${k + 1}: ring ${m ? `${p1(m.x)},${p1(m.y)}` : "none"} for ${p1(at[k].x)},${p1(at[k].y)} (${drawnOff.toFixed(2)}px from a drawn dot); tooltip "${s.tip?.name ?? "none"}"; said "${s.live.split(":")[0]}"` };
    };
    // After a session the reading missed, the next ones are looked at once: a reading that never shows must not take 4s each.
    let missing = false;
    const reach = async k => {
      const s = missing ? await sleep(120).then(() => state(page)) : await until(() => state(page), x => on(x, k).ok);
      missing ||= !on(s, k).ok;
      return s;
    };
    /** The drawn dots no other dot comes within 30px of, farthest from the plot's edges first. */
    const edge = d => Math.min(d.x - frame.l, frame.r - d.x, d.y - frame.t, frame.b - d.y);
    const alone = dots.filter(d => nearest(d, dots.filter(o => o !== d)) > 30).sort((a, b) => edge(b) - edge(a));
    /** The session whose pixel a drawn dot is on. */
    const sessionAt = d => at.findIndex(p => dist(p, d) <= 1);
    return { dr, pl, at, dots, frame, on, reach, alone, sessionAt };
  }

  /** The drawing's lines: the dots at their pixels, the rings, the guides, the names, the "80% of window" label, the x
   *  labels, the axis titles, no text out of the box or over another. */
  async function layout(page, rows, what) {
    const r = await reading(page, rows), { dr, pl } = r, f = dr.frame, at = pl?.at ?? rows.map(() => ({ x: NaN, y: NaN }));
    // The dots are drawn in the sessions' order, oldest first: the k-th drawn is session k's.
    const misses = at.map((p, k) => ({ k, e: dr.dots[k] ? dist(p, dr.dots[k]) : Infinity })).filter(x => !(x.e <= 1));
    line(`${what}: every session's dot sits at its start and peak share on the drawn axes, within 1px`, !!pl && dr.dots.length === rows.length && !misses.length,
      pl ? `${dr.dots.length} dots for ${rows.length} sessions; ${misses.length ? `${misses.length} off: ${misses.slice(0, 3).map(x => `session ${x.k + 1} drawn at ${p1(dr.dots[x.k]?.x - dr.box.l)},${p1(dr.dots[x.k]?.y - dr.box.t)} for ${p1(at[x.k].x - dr.box.l)},${p1(at[x.k].y - dr.box.t)}`).join(", ")}` : `the farthest ${Math.max(...at.map((p, k) => dist(p, dr.dots[k]))).toFixed(2)}px off`}` : "fewer than two x labels drawn");
    const comp = rows.map((p, k) => ({ p, k })).filter(x => x.p.compactions > 0), ringOff = comp.map(x => nearest(at[x.k], dr.rings));
    line(`${what}: each compacted session's dot has its ring, and no other dot one`, comp.length > 0 && dr.rings.length === comp.length && ringOff.every(e => e <= 1),
      `${dr.rings.length} rings for ${comp.length} compacted sessions, the farthest ${Math.max(0, ...ringOff).toFixed(2)}px off its dot`);
    const v = dr.guides.filter(g => g.w < 1 && g.h > 1), hz = dr.guides.filter(g => g.h < 1 && g.w > 1);
    const x30 = pl?.x(START_LARGE), y80 = pl?.y(NEAR);
    line(`${what}: the dashed guides sit at 30k and at 80%, across the plot`, !!pl && v.length === 1 && hz.length === 1 && dr.guides.every(g => g.dash === "5,4") && Math.abs(v[0].x - x30) <= 1 && Math.abs(hz[0].y - y80) <= 1
      && Math.abs(v[0].t - f.t) <= 1 && Math.abs(v[0].b - f.b) <= 1 && Math.abs(hz[0].l - f.l) <= 1 && Math.abs(hz[0].r - f.r) <= 1,
      `vertical ${v.map(g => `${g.dash} at ${p1(g.x - dr.box.l)}`).join(", ") || "none"} for ${p1(x30 - dr.box.l)}, horizontal ${hz.map(g => `${g.dash} at ${p1(g.y - dr.box.t)}`).join(", ") || "none"} for ${p1(y80 - dr.box.t)}`);
    // The quadrants, from the guides as drawn.
    const gx = v[0]?.x ?? NaN, gy = hz[0]?.y ?? NaN;
    const quads = { lean: { l: f.l, r: gx, t: gy, b: f.b }, heavy: { l: gx, r: f.r, t: gy, b: f.b }, full: { l: f.l, r: gx, t: f.t, b: gy }, both: { l: gx, r: f.r, t: f.t, b: gy } };
    const em = t => ({ l: t.l, r: t.r, t: t.y - t.size / 2, b: t.y + t.size / 2 });
    const inside = (t, q) => { const e = em(t); return e.l >= q.l - .5 && e.r <= q.r + .5 && e.t >= q.t - .5 && e.b <= q.b + .5; };
    // Each name's lines: the left names' and the right names' share an anchor; top to bottom, the upper name's then the lower's.
    const lines = dr.texts.filter(t => t.halo && t.weight >= 600), named = {};
    for (const [anchor, upper, lower] of [["start", "full", "lean"], ["end", "both", "heavy"]]) {
      const ls = lines.filter(t => t.anchor === anchor).sort((a, b) => a.ay - b.ay);
      // Either name may be left out: then the other has all the lines.
      for (let k = 0; ls.length && k <= ls.length; k++) {
        const up = ls.slice(0, k), down = ls.slice(k);
        if ((!up.length || up.map(t => t.text).join(" ") === NAMES[upper]) && (!down.length || down.map(t => t.text).join(" ") === NAMES[lower])) {
          if (up.length) named[upper] = up;
          if (down.length) named[lower] = down;
          break;
        }
      }
    }
    // A name is left out only where it cannot fit: its longest word, at 80% of the labels' size, wider than the room beside the
    // 30k line, or its words wrapped to that room at the labels' size taller than its quadrant.
    const s = await ev(page, () => parseFloat(getComputedStyle(document.documentElement).fontSize) / 16), size = 11 * s, room = {};
    const width = (t, px, weight) => ev(page, ([t, px, weight]) => window.mapfit.measure(t, px, weight), [t, px, weight]);
    for (const q of Object.keys(NAMES)) {
      const w = (q === "heavy" || q === "both" ? f.r - gx : gx - f.l) - 12, h = (q === "full" || q === "both" ? gy - f.t : f.b - gy) - 4 * s, wrapped = [];
      for (const word of NAMES[q].split(" ")) {
        const joined = wrapped.length ? `${wrapped.at(-1)} ${word}` : null;
        if (joined && await width(joined, size) <= w) wrapped[wrapped.length - 1] = joined;
        else wrapped.push(word);
      }
      const word = Math.max(...await Promise.all(NAMES[q].split(" ").map(x => width(x, size * .8))));
      room[q] = { w, h, word, lines: (await width(NAMES[q], size)) <= w ? 1 : wrapped.length };
    }
    const noRoom = q => room[q].word > room[q].w + .5 || room[q].lines * size * 1.15 > room[q].h + .5;
    const nameAt = q => named[q] ? `"${NAMES[q]}" in ${named[q].length} line${named[q].length > 1 ? "s" : ""} at ${p1(named[q][0].size)}px${named[q].every(t => inside(t, quads[q])) ? "" : ` OUT of its quadrant (${named[q].map(t => `${p1(t.l - dr.box.l)}..${p1(t.r - dr.box.l)} x ${p1(t.y - t.size / 2 - dr.box.t)}..${p1(t.y + t.size / 2 - dr.box.t)}`).join(", ")} for ${p1(quads[q].l - dr.box.l)}..${p1(quads[q].r - dr.box.l)} x ${p1(quads[q].t - dr.box.t)}..${p1(quads[q].b - dr.box.t)})`}`
      : `"${NAMES[q]}" not drawn: its longest word ${p1(room[q].word)}px at 80% for ${p1(room[q].w)}px of room, ${room[q].lines} line${room[q].lines > 1 ? "s" : ""} ${p1(room[q].lines * size * 1.15)}px tall for ${p1(room[q].h)}px`;
    line(`${what}: each quadrant's name is inside its quadrant, wrapped where it needs to be, and left out only where it cannot fit`,
      Object.keys(NAMES).every(q => (named[q] ? named[q].every(t => inside(t, quads[q])) : noRoom(q))) && lines.length === Object.values(named).flat().length,
      `${Object.keys(NAMES).map(nameAt).join("; ")}; ${lines.length} name lines drawn`);
    const near = dr.texts.find(t => t.text === "80% of window"), start = dr.texts.find(t => t.text === "30k start");
    const side = near ? (near.r <= gx + .5 ? "left" : near.l >= gx - .5 ? "right" : "ACROSS") : "none";
    // Left out only where it fits on neither side of the 30k line, 4px from it and 2px from the plot's edge.
    const nearW = await width("80% of window", size, 400), noSide = gx - 4 - nearW < f.l + 2 - .5 && gx + 4 + nearW > f.r - 2 + .5;
    // "30k start" starts right of its line; it may run on into the margin, the box's (the texts' line below).
    line(`${what}: the "80% of window" label is inside the plot under its line, beside the 30k line, or left out where neither side has room; "30k start" right of the line`,
      (near ? near.l >= f.l - .5 && near.r <= f.r + .5 && em(near).t >= gy - .5 && em(near).b <= f.b + .5 && side !== "ACROSS" : noSide) && !!start && start.l >= gx - .5,
      `${near ? `"80% of window" ${p1(near.l - dr.box.l)}..${p1(near.r - dr.box.l)}px, ${side} of the 30k line at ${p1(gx - dr.box.l)}` : `"80% of window" not drawn, ${p1(nearW)}px wide for ${p1(gx - 4 - f.l - 2)}px left of the 30k line and ${p1(f.r - 2 - gx - 4)}px right of it`}; "30k start" ${start ? `${p1(start.l - dr.box.l)}..${p1(start.r - dr.box.l)}px${start.r > f.r + .5 ? `, ${p1(start.r - f.r)}px past the plot` : ""}` : "none"}; plot ${p1(f.l - dr.box.l)}..${p1(f.r - dr.box.l)}px`);
    const ticks = startTicks(startDomain(rows.map(p => p.start))), xs = pl?.xs ?? [];
    const overlap = xs.some((t, k) => k && t.l < xs[k - 1].r);
    const hidden = ticks.filter(v => !xs.some(t => tickValue(t.text) === v));
    line(`${what}: the x labels are at 1, 2 and 5 times a power of ten, at their ticks, none overlapping`, xs.length >= 2 && xs.every(t => round125(tickValue(t.text)) && ticks.includes(tickValue(t.text)) && Math.abs(t.ax - pl.x(tickValue(t.text))) <= .5) && !overlap,
      `drawn ${xs.map(t => t.text).join(", ")}; hidden ${hidden.map(tickText).join(", ") || "none"}`);
    const titles = [dr.texts.find(t => /^Starting context/.test(t.text)), dr.texts.find(t => /^Peak share/.test(t.text))], b = dr.box;
    line(`${what}: both axis titles are drawn inside the box`, titles.every(t => t && t.l >= b.l - .5 && t.r <= b.r + .5 && t.t >= b.t - .5 && t.b <= b.b + .5),
      titles.map((t, k) => (t ? `"${t.text}" ${p1(t.l - b.l)}..${p1(t.r - b.l)} x ${p1(t.t - b.t)}..${p1(t.b - b.t)}` : `${k ? "y" : "x"} title not drawn`)).join("; ") + ` in ${p1(b.w)}x${p1(b.h)}`);
    // Texts out of the box or over one another, by their em boxes: a rotated title's is its size by its length.
    const box2 = t => (t.h > 2 * t.size ? { ...t, l: t.x - t.size / 2, r: t.x + t.size / 2 } : { ...t, ...em(t) });
    const ems = dr.texts.map(box2), out = ems.filter(t => t.l < b.l - .5 || t.r > b.r + .5 || t.t < b.t - .5 || t.b > b.b + .5), over = [];
    ems.forEach((p, k) => ems.slice(k + 1).forEach(c => { if (p.l < c.r - .5 && c.l < p.r - .5 && p.t < c.b - .5 && c.t < p.b - .5) over.push(`"${p.text}" and "${c.text}"`); }));
    line(`${what}: no text leaves the box or overlaps another`, ems.length > 0 && !out.length && !over.length,
      [...out.map(t => `out: "${t.text}"`), ...over.map(x => `overlap: ${x}`)].slice(0, 6).join("; ") || `${ems.length} texts`);
    return r;
  }

  /** The pointer on each drawn dot's centre (every step-th): the ring is on that dot within 1px, and the tooltip names the
   *  session at that pixel. */
  async function pointAll(page, r, rows, what, step = 1) {
    const bad = [], beside = [];
    let n = 0, worst = 0;
    // Chromium gives the page a mouse event's place in whole pixels, cut down: the map reads the session whose pixel is nearest
    // that place, which between two dots under 2px apart can be the other one. The ring must be on one of the nearest.
    const read = x => {
      if (!x.mark || !x.tip) return null;
      const m = markIn(x), seen = { x: x.moved.x - x.box.l, y: x.moved.y - x.box.t }, near = Math.min(...r.at.map(p => dist(p, seen)));
      const k = r.at.findIndex((p, i) => dist(p, m) <= 1 && dist(p, seen) <= near + .75 && x.tip.name === sessName(rows[i]));
      return { m, seen, k, drawnOff: nearest(m, r.dots) };
    };
    for (const [j, d] of r.dots.entries()) {
      if (j % step) continue;
      const a = await move(page, d);
      const x = await until(() => ev(page, () => ({ mark: window.mapfit.mark(), tip: window.mapfit.tip(), box: window.mapfit.box(), moved: window.mapfit.moved() })),
        x => Math.abs(x.moved.x - Math.floor(a.x)) < 1.01 && read(x)?.k >= 0 && read(x).drawnOff <= 1);
      const got = read(x);
      n++;
      if (got) worst = Math.max(worst, got.drawnOff);
      if (!got || got.k < 0 || !(got.drawnOff <= 1)) {
        const m = got?.m;
        bad.push(`dot ${j + 1} at ${p1(d.x)},${p1(d.y)}, the pointer at ${p1(a.x - x.box.l)},${p1(a.y - x.box.t)}, the page saw ${got ? `${p1(got.seen.x)},${p1(got.seen.y)}` : `${x.moved.x},${x.moved.y} in the window`}: ring ${m ? `${p1(m.x)},${p1(m.y)}` : "none"}, tooltip "${x.tip?.name ?? "none"}"`);
      } else if (dist(got.m, d) > 1) beside.push(`dot ${j + 1} at ${p1(d.x)},${p1(d.y)}: the page saw ${p1(got.seen.x)},${p1(got.seen.y)}, the ring on the dot at ${p1(got.m.x)},${p1(got.m.y)}`);
      if (bad.length > 3) break;
    }
    line(`${what}: the pointer on each dot's centre puts the ring on a drawn dot within 1px, the session's nearest the pointer the page saw, and the tooltip names it`, n > 0 && !bad.length,
      bad.join("; ") || `${n} dots of ${r.dots.length}, the ring at most ${worst.toFixed(2)}px off a drawn dot; ${beside.length ? `${beside.length} read a neighbour under 2px away, as the page saw the pointer in whole pixels: ${beside.slice(0, 2).join("; ")}` : "each read its own dot"}`);
  }

  /** The tooltip at the plot's leftmost, rightmost, topmost and bottommost dots, by the pointer: inside the window, and inside
   *  the box from side to side. Its bottom is said: tipAt places it from the pointer down, as the old chart did. */
  async function tipEdges(page, r, what) {
    const pick = [["leftmost", (a, b) => a.x - b.x], ["rightmost", (a, b) => b.x - a.x], ["topmost", (a, b) => a.y - b.y], ["bottommost", (a, b) => b.y - a.y]];
    const got = [];
    for (const [name, by] of pick) {
      const d = [...r.dots].sort(by)[0];
      await away(page);
      await move(page, d);
      const s = await until(() => state(page), s => s.tip && s.mark && dist(markIn(s), d) <= 1);
      got.push({ name, s, ok: !!s.tip && s.tip.l >= -.5 && s.tip.r <= s.win + .5, past: s.tip ? Math.max(0, s.box.l - s.tip.l, s.tip.r - s.box.r) : 0 });
    }
    const past = got.filter(x => x.past > .5);
    line(`${what}: the tooltip at the plot's leftmost, rightmost, topmost and bottommost dot is inside the window`, got.every(x => x.ok),
      got.map(({ name, s }) => (s.tip ? `${name} ${p1(s.tip.l - s.box.l)}..${p1(s.tip.r - s.box.l)} x ${p1(s.tip.t - s.box.t)}..${p1(s.tip.b - s.box.t)}` : `${name} no tooltip`)).join("; ")
        + ` of a ${p1(got[0]?.s.box.w ?? 0)}x${p1(got[0]?.s.box.h ?? 0)}px box; ${past.length ? `past the box's side at the ${past.map(x => `${x.name} by ${p1(x.past)}px`).join(", ")}` : "inside the box from side to side"}`);
  }

  const rows = mapRows(mapCases(structuredClone(store))), N = rows.length;
  const inQuad = q => rows.filter(p => quadOf(p) === q).length;
  /** The box's and the plot's heights and the box's width, in px. */
  const sizes = page => ev(page, () => { const f = window.mapfit.frame(), b = window.mapfit.box(); return { box: Math.round(b.h), plot: f ? Math.round(f.b - f.t) : 0, w: Math.round(b.w) }; });
  let size16;
  /** A pixel of the quadrant Heavy and full, from the box's top left, 14px from every dot and from its edges. */
  const topRight = r => {
    const f = r.frame, gx = r.pl.x(START_LARGE) - r.dr.box.l, gy = r.pl.y(NEAR) - r.dr.box.t;
    for (let x = f.r - 14; x > gx + 14; x -= 5) for (let y = f.t + 14; y < gy - 14; y += 5) if (nearest({ x, y }, r.dots) > 14) return { x, y };
    return null;
  };

  // ---------- 1440px: the layout, the keys, the pointer, the sheet, a scroll, the focus ring, a resize ----------
  {
    const page = await open("1440px", { init: watchDots });
    await settle(page);
    const size = size16 = await sizes(page);
    const r = await layout(page, rows, `${W}px, a ${size.w}px box`);
    await shot(page, "light");
    const dw = once(await ev(page, () => window.__dotDrawings));
    line("with reduced motion, the dots are drawn at once: one place for every dot from the first frame on", dw.ok, dw.at);

    // The keys: Right from no reading reads the oldest; then every session in turn.
    await away(page);
    await box(page).focus();
    await ev(page, () => window.mapfit.listen());
    await page.keyboard.press("ArrowRight");
    const first = r.on(await r.reach(0), 0);
    const s0 = await state(page);
    line("Right from no reading reads the oldest session: the ring centred on its dot, the tooltip and the live region naming it", first.ok && !!s0.mark && Math.abs(s0.mark.r - (rows[0].compactions ? 10.5 : 8)) < .01, first.at);
    await shot(page, "read");
    const wrong = [];
    let worst = 0;
    for (let k = 1; k < N; k++) {
      await page.keyboard.press("ArrowRight");
      const o = r.on(await r.reach(k), k);
      worst = Math.max(worst, o.off, o.drawnOff);
      if (!o.ok) wrong.push(o.at);
    }
    line(`Right steps through all ${N} sessions oldest to newest: the ring on each session's dot within 1px, the tooltip and the live region naming it`, first.ok && !wrong.length,
      wrong.slice(0, 3).join("; ") || `the ring at most ${worst.toFixed(2)}px off`);
    // Enter opens the session read; closing the sheet returns the focus to the map.
    const K = Math.min(5, N - 1);
    await page.keyboard.press("Home");
    for (let k = 0; k < K; k++) await page.keyboard.press("ArrowRight");
    await r.reach(K);
    await page.keyboard.press("Enter");
    const sh = await until(() => ev(page, () => window.mapfit.sheet()), x => x.open && x.focus && x.session === rows[K].session_id);
    await page.keyboard.press("Escape");
    const back = await until(() => ev(page, () => ({ ...window.mapfit.sheet(), focus: window.mapfit.focus() })), x => !x.open && x.focus === "map");
    const after = await state(page);
    line(`Enter on session ${K + 1} opens its sheet, which takes the focus; closing it returns the focus to the map`, sh.open && sh.focus && sh.session === rows[K].session_id && !back.open && back.focus === "map",
      `sheet ${sh.open ? `open on ${sh.session}` : "not open"}, focus ${sh.focus ? "in it" : "outside"}; after Escape ${back.open ? "still open" : "closed"}, focus on ${back.focus}, the reading ${after.mark ? "kept" : "ended"}`);
    await page.keyboard.press("Escape");
    await ev(page, () => document.activeElement?.blur());

    // The pointer: every dot; a lone dot's 12px; a dot from outside the plot; the hand; the tooltip at the edges.
    await pointAll(page, r, rows, `${W}px`);
    if (!r.alone.length) line("the map has a dot 30px from any other", false);
    const J = r.alone[0];
    if (J) {
      await away(page);
      const read = async (dx, dy) => { await move(page, J, dx, dy); await sleep(150); return state(page); };
      const c0 = await read(0, 0), c11 = await read(0, -11), c13 = await read(0, -13);
      const onJ = s => !!s.mark && dist(markIn(s), J) <= 1 && !!s.tip;
      line("pointer: on a lone dot and 11px off it the ring is on that dot; 13px off nothing is read", onJ(c0) && onJ(c11) && !c13.mark && !c13.tip,
        `centre ${onJ(c0) ? "read" : "not read"}, 11px ${onJ(c11) ? "read" : "not read"}, 13px ${c13.mark || c13.tip ? `read "${c13.tip?.name}"` : "nothing"}`);
      // The hand over a dot and over the plot away from any dot; not over an x label in the margin.
      const f = r.frame, x0 = r.pl?.xs[Math.floor((r.pl?.xs.length ?? 0) / 2)], label = x0 && { text: x0.text, x: x0.x - r.dr.box.l, y: x0.y - r.dr.box.t };
      let empty = null;
      for (let x = f.l + 10; !empty && x < f.r - 10; x += 7) for (let y = f.t + 10; !empty && y < f.b - 10; y += 7) if (nearest({ x, y }, r.dots) > 20) empty = { x, y };
      const cursorAt = async p => { const a = await move(page, p); await sleep(120); return ev(page, ([x, y]) => window.mapfit.cursor(x, y), [a.x, a.y]); };
      const hand = await cursorAt(J), plot = await cursorAt(empty), margin = await cursorAt(label);
      line("the pointer is a hand over a dot and over the plot away from any dot, and not over the x labels under it", hand.startsWith("pointer ") && plot.startsWith("pointer ") && !margin.startsWith("pointer "),
        `over a dot: ${hand}; over the plot at ${p1(empty.x)},${p1(empty.y)}: ${plot}; over "${label.text}": ${margin}`);
      // A dot read from outside the plot: the one nearest an edge, the pointer 11.5px from it past that edge.
      const edges = r.dots.map(d => ({ d, e: [["left", d.x - f.l], ["right", f.r - d.x], ["top", d.y - f.t], ["bottom", f.b - d.y]].sort((a, b) => a[1] - b[1])[0] })).sort((a, b) => a.e[1] - b.e[1]);
      const { d: E, e: [edge, gap] } = edges[0];
      const out = { left: { x: E.x - 11.5, y: E.y }, right: { x: E.x + 11.5, y: E.y }, top: { x: E.x, y: E.y - 11.5 }, bottom: { x: E.x, y: E.y + 11.5 } }[edge];
      await away(page);
      const ao = await move(page, out);
      const so = await until(() => state(page), s => s.mark);
      const past = 11.5 - Math.max(0, gap), curOut = await ev(page, ([x, y]) => window.mapfit.cursor(x, y), [ao.x, ao.y]);
      await page.mouse.click(ao.x, ao.y);
      const opened = await until(() => ev(page, () => window.mapfit.sheet()), x => x.open);
      line(`a known difference from the old chart: the pointer outside the plot's ${edge} edge reads the dot at that edge, from up to 12px, and a click there opens its sheet`, past > 0 && !!so.mark && dist(markIn(so), E) <= 1 && opened.open,
        `the pointer ${p1(past)}px past the edge, 11.5px from the dot ${p1(Math.max(0, gap))}px inside it: ${so.mark ? `ring on the dot ${dist(markIn(so), E).toFixed(2)}px off` : "nothing read"}, cursor ${curOut}; a click ${opened.open ? `opened ${opened.session}` : "opened nothing"}`);
      if (opened.open) { await page.keyboard.press("Escape"); await until(() => ev(page, () => window.mapfit.sheet()), x => !x.open); }
      await tipEdges(page, r, `${W}px`);
      // A click on the lone dot: its sheet; the cursor while it is open and after it closes; where the focus goes.
      await away(page);
      await ev(page, () => document.activeElement?.blur());
      const k = r.sessionAt(J), aj = await abs(page, J);
      await page.mouse.click(aj.x, aj.y);
      const cs = await until(() => ev(page, () => window.mapfit.sheet()), x => x.open && x.focus);
      const curOpen = await ev(page, ([x, y]) => `${window.mapfit.cursor(x, y)}, the box ${window.mapfit.hand() ? "with" : "without"} its hand`, [aj.x, aj.y]);
      await page.keyboard.press("Escape");
      const cb = await until(() => ev(page, () => ({ ...window.mapfit.sheet(), focus: window.mapfit.focus() })), x => !x.open);
      const curAfter = await ev(page, ([x, y]) => `${window.mapfit.cursor(x, y)}, the box ${window.mapfit.hand() ? "with" : "without"} its hand`, [aj.x, aj.y]);
      line("a click on a dot opens its sheet; after the sheet closes the focus is on the map", cs.open && k >= 0 && cs.session === rows[k].session_id && !cb.open && cb.focus === "map",
        `sheet ${cs.open ? `open on ${cs.session}` : "not open"} for ${k >= 0 ? rows[k].session_id : "no session"}; cursor while open ${curOpen}; after Escape focus on ${cb.focus}, cursor ${curAfter}`);
      await page.keyboard.press("Escape");
    }
    // Escape with the focus on another control closes a tooltip the pointer opened.
    if (J) {
      await ev(page, () => document.activeElement?.blur());
      await away(page);
      await page.locator("#navTheme").focus();
      await page.locator(`${ROOT} .map-box`).scrollIntoViewIfNeeded();
      await move(page, J);
      const shown = await until(() => state(page), s => s.tip);
      await page.keyboard.press("Escape");
      const gone = await until(() => state(page), s => !s.tip && !s.mark);
      const stays = await ev(page, () => window.mapfit.focus());
      line("Escape with the focus on another control closes the pointer's tooltip and ring, and leaves the focus there", !!shown.tip && !gone.tip && !gone.mark && stays === "#navTheme",
        `${shown.tip ? "opened" : "never opened"}; then ${gone.tip ? "tooltip open" : "no tooltip"}, ${gone.mark ? "ring" : "no ring"}, focus on ${stays}`);
    }

    // A scroll: the box moves in the window; the pointer still reads the dot under it.
    await away(page);
    const y0 = await ev(page, () => scrollY);
    await page.mouse.wheel(0, 60);
    let y1 = await until(() => ev(page, () => scrollY), y => y !== y0);
    if (y1 === y0) { await page.mouse.wheel(0, -60); y1 = await until(() => ev(page, () => scrollY), y => y !== y0); }
    // The dots are where they were in the box: the reading taken before the scroll still holds, from the box's new place.
    await pointAll(page, r, rows, `after the page scrolls ${y1 - y0}px`, Math.max(1, Math.ceil(N / 40)));

    // The focus ring: Shift+Tab from the first quadrant button onto the map.
    await page.locator(`${ROOT} .quads button >> nth=0`).focus();
    await page.keyboard.press("Shift+Tab");
    const ring = await ev(page, () => { const e = document.activeElement, s = getComputedStyle(e); return { map: window.mapfit.focus() === "map", visible: e.matches(":focus-visible"), style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: window.chartfit.tri(s.outlineColor) }; });
    line("Shift+Tab from the first quadrant button onto the map draws its focus ring", ring.map && ring.visible && ring.style !== "none" && ring.width >= 2, `${ring.map ? "the map" : "not the map"}, focus-visible ${ring.visible}, outline ${ring.style} ${ring.width}px rgb(${ring.color})`);
    await shot(page, "focus");
    await ev(page, () => document.activeElement?.blur());

    // A resize: each frame's drawing against its box, then the settled drawing.
    await ev(page, () => {
      window.__frames = [];
      window.__framing = true;
      const tick = () => {
        const f = window.mapfit.frame(), b = window.mapfit.box();
        window.__frames.push({ box: Math.round(b.w), svg: window.mapfit.svgWidth(), right: f ? Math.round((f.r - b.l) * 10) / 10 : null, first: window.mapfit.dots()[0]?.x - b.l });
        if (window.__framing) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.setViewportSize({ width: 900, height: 900 });
    await sleep(800);
    const fs = await ev(page, () => { window.__framing = false; return window.__frames; });
    const wrongFrames = fs.filter(x => x.svg !== x.box || x.right == null || Math.abs(x.right - (x.box - 16)) > 1);
    await page.locator(`${ROOT} .map-box`).scrollIntoViewIfNeeded();
    const rz = await layout(page, rows, "resized to a 900px window");
    const sz = await ev(page, () => ({ svg: window.mapfit.svgWidth(), box: Math.round(window.mapfit.box().w), right: window.mapfit.frame().r - window.mapfit.box().l }));
    line("after the resize settles, the drawing is the box's width and the plot ends 16px from its right", sz.svg === sz.box && Math.abs(sz.right - (sz.box - 16)) <= 1 && rz.dr.dots.length === N,
      `svg ${sz.svg}px in a ${sz.box}px box, the plot's right at ${p1(sz.right)}px; during the resize ${wrongFrames.length} of ${fs.length} frames drew in another width than the box's${wrongFrames.length ? `: ${wrongFrames.slice(0, 3).map(x => `svg ${x.svg}px, box ${x.box}px, plot's right ${x.right}px, first dot at ${p1(x.first)}px`).join("; ")}` : ""}`);
    await pointAll(page, rz, rows, "resized to a 900px window", Math.max(1, Math.ceil(N / 40)));
    await page.done();
  }

  // ---------- a quadrant: by a click on the plot, by its button with the pointer's reading, Escape; newer figures ----------
  {
    let change = null;
    const answer = d => (change ? change(mapCases(d)) : mapCases(d));
    const page = await open("quadrant", { answer });
    await settle(page);
    const r = await reading(page, rows), f = r.frame;
    const gx = r.pl.x(START_LARGE) - r.dr.box.l, gy = r.pl.y(NEAR) - r.dr.box.t, both = inQuad("both"), spot = topRight(r);
    const before = await ev(page, () => window.mapfit.narrowed());
    const look = () => ev(page, () => ({ quad: window.mapfit.quad(), wash: window.mapfit.wash(), dots: window.mapfit.dots(), rings: window.mapfit.rings(), box: window.mapfit.box(), ...window.mapfit.narrowed() }));
    const as = await abs(page, spot);
    await page.mouse.click(as.x, as.y);
    const sel = await until(look, x => x.quad === "both" && x.wash);
    // The k-th dot drawn is session k's, and the j-th ring the j-th compacted session's.
    const w = sel.wash && { l: sel.wash.l - sel.box.l, r: sel.wash.r - sel.box.l, t: sel.wash.t - sel.box.t, b: sel.wash.b - sel.box.t, fill: sel.wash.fill };
    const strong = sel.dots.map((d, k) => [d.so > .5, quadOf(rows[k]) === "both"]), comp = rows.filter(p => p.compactions > 0);
    const wrongDots = strong.filter(([a, b]) => a !== b).length, wrongRings = sel.rings.filter((x, j) => !comp[j] || (x.so > .5) !== (quadOf(comp[j]) === "both")).length;
    line("a click in the top right away from any dot selects Heavy and full: its wash fills that quadrant, the other dots and their rings at 20%",
      !!w && Math.abs(w.l - gx) <= 1 && Math.abs(w.r - f.r) <= 1 && Math.abs(w.t - f.t) <= 1 && Math.abs(w.b - gy) <= 1 && sel.dots.length === N && !wrongDots && sel.rings.length === comp.length && !wrongRings && sel.dots.every(d => d.so > .5 || Math.abs(d.so - .2) < .01),
      `wash ${w ? `${p1(w.l)}..${p1(w.r)} x ${p1(w.t)}..${p1(w.b)} in rgb(${w.fill})` : "none"} for ${p1(gx)}..${p1(f.r)} x ${p1(f.t)}..${p1(gy)}; ${sel.dots.filter(d => d.so > .5).length} dots at full strength for ${both} in the quadrant, ${wrongDots} dots and ${wrongRings} rings at the wrong strength`);
    line("Heavy and full selected: the bars above count its sessions alone, and its list shows", before.bars === N && sel.bars === both && sel.note.startsWith("Narrowed to Heavy and full:") && sel.list === Math.min(20, both),
      `bars count ${before.bars}, then ${sel.bars} for ${both} in the quadrant; note "${sel.note}"; ${sel.list} sessions listed`);
    await shot(page, "quadrant");
    // The screenshot may have scrolled the page: the same pixel of the box, from where the box is now.
    const again = await abs(page, spot);
    await page.mouse.click(again.x, again.y);
    const cleared = await until(look, x => !x.quad && !x.wash);
    line("a second click there clears the quadrant: no wash, no dot dimmed, the bars count every session", !cleared.quad && !cleared.wash && cleared.dots.every(d => d.so > .5) && cleared.bars === N && !cleared.note,
      `${cleared.quad ?? "no quadrant"}, ${cleared.wash ? "wash drawn" : "no wash"}, ${cleared.dots.filter(d => d.so < .5).length} dimmed, the bars count ${cleared.bars}`);

    // The pointer's reading kept through a quadrant selected by its button; Escape on another control keeps the quadrant.
    const J = r.alone[0];
    await ev(page, () => document.activeElement?.blur());
    await away(page);
    await move(page, J);
    const s1 = await until(() => state(page), s => s.mark && dist(markIn(s), J) <= 1 && s.tip);
    await page.locator(`${ROOT} .quads button[data-quad="both"]`).focus();
    await page.keyboard.press("Space");
    const s2 = await until(async () => ({ ...(await look()), ...(await state(page)) }), x => x.quad === "both" && x.wash);
    line("a quadrant selected by its button, the pointer at rest on a dot: the wash drawn, the others dimmed, the ring and the tooltip still on that session",
      !!s1.tip && !!s2.wash && s2.dots.filter(d => d.so < .5).length === N - both && !!s2.mark && dist(markIn(s2), J) <= 1 && s2.tip?.name === s1.tip.name,
      `before: "${s1.tip?.name ?? "none"}"; after: ${s2.wash ? "wash" : "no wash"}, ${s2.dots.filter(d => d.so < .5).length} dimmed, ring ${s2.mark ? `${dist(markIn(s2), J).toFixed(2)}px off` : "none"}, tooltip "${s2.tip?.name ?? "none"}"`);
    await shot(page, "quadrant-read");
    await page.locator("#navTheme").focus();
    await page.keyboard.press("Escape");
    const s3 = await until(async () => ({ ...(await look()), ...(await state(page)) }), x => !x.tip && !x.mark);
    line("Escape with the focus on another control closes the pointer's tooltip and keeps the quadrant", !!s2.tip && !s3.tip && !s3.mark && s3.quad === "both" && !!s3.wash,
      `the tooltip ${s2.tip ? "open" : "NOT open"} before; then ${s3.tip ? "tooltip open" : "no tooltip"}, ${s3.mark ? "ring" : "no ring"}; quadrant ${s3.quad ?? "cleared"}, ${s3.wash ? "wash drawn" : "no wash"}`);
    // One Escape on the map ends a key's reading and clears the quadrant.
    await box(page).focus();
    await page.keyboard.press("ArrowRight");
    const s4 = r.on(await r.reach(0), 0);
    await page.keyboard.press("Escape");
    const s5 = await until(async () => ({ ...(await look()), ...(await state(page)) }), x => !x.mark && !x.quad);
    line("one Escape on the map ends a key's reading and clears the quadrant", s4.ok && !s5.mark && !s5.tip && !s5.live && !s5.quad && !s5.wash && s5.bars === N,
      `before: ${s4.ok ? "the oldest read, Heavy and full selected" : s4.at}; then ${s5.mark ? "ring" : "no ring"}, ${s5.tip ? "tooltip" : "no tooltip"}, said "${s5.live}", quadrant ${s5.quad ?? "cleared"}, the bars count ${s5.bars}`);

    // Newer figures that add a session older than all: the indexes move, the reading stays on its session, nothing is said.
    const K = Math.min(7, N - 1);
    await page.keyboard.press("Home");
    for (let k = 0; k < K; k++) await page.keyboard.press("ArrowRight");
    await r.reach(K);
    await ev(page, () => window.mapfit.listen());
    const oldest = rows[0];
    change = d => { const p = d.sessions_map.points[0]; d.sessions_map.points.push({ ...p, session_id: "chartfit-map-older", title: "An older session", first_ts: new Date(Date.parse(oldest.first_ts) - 36e5).toISOString(), start: 12000, peak: Math.round(p.window * .4), compactions: 0 }); d.sessions_map.total++; return d; };
    await page.newer();
    await until(() => ev(page, () => window.mapfit.dots().length), n => n === N + 1);
    await sleep(400);
    const rows2 = mapRows(answer(structuredClone(store))), k2 = rows2.findIndex(p => p.session_id === rows[K].session_id);
    const r2 = await reading(page, rows2), kept = r2.on(await state(page), k2), said = await ev(page, () => window.mapfit.said());
    line(`newer figures with a session older than all: the key's reading stays on session ${K + 1}, now the ${k2 + 1}th, and nothing is said`, k2 === K + 1 && kept.ok && !said.length,
      `${kept.at}; said ${JSON.stringify(said)}`);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.done();
  }

  // ---------- the PHONE window, 32px text, a device pixel ratio of 2 ----------
  {
    const p32 = await open("32px root", { init: root32 });
    await settle(p32);
    const size = await sizes(p32);
    line("the plot is 260px at 16px text and at 32px; the box 320px, then 380px", size16.plot === 260 && size.plot === 260 && size16.box === 320 && size.box === 380,
      `plot ${size16.plot}px, then ${size.plot}px; box ${size16.box}px, then ${size.box}px`);
    const r32 = await layout(p32, rows, `${W}px at 32px text`);
    await pointAll(p32, r32, rows, `${W}px at 32px text`, Math.max(1, Math.ceil(N / 40)));
    await shot(p32, "32px");
    await p32.done();
    for (const [what, options, init] of [[`the ${PHONE}px window`, {}, null], [`the ${PHONE}px window at 32px text`, {}, root32], [`the ${PHONE}px window at a device pixel ratio of 2`, { deviceScaleFactor: 2 }, null]]) {
      const page = await open(what, { options: { viewport: { width: PHONE, height: 900 }, ...options }, init });
      await settle(page);
      const bw = await ev(page, () => Math.round(window.mapfit.box().w));
      const r = await layout(page, rows, `${what}, a ${bw}px box`);
      await pointAll(page, r, rows, `${what}, a ${bw}px box`, Math.max(1, Math.ceil(N / 40)));
      if (!init && !options.deviceScaleFactor) {
        await tipEdges(page, r, `${what}, a ${bw}px box`);
        await shot(page, "343px");
      }
      if (init) await shot(page, "343px-32px");
      await page.done();
    }
    // 1,000 sessions from 2k to 200k: seven x ticks, where a 343px box at 32px text has no room for all their labels.
    const big = mapRows(thousand(structuredClone(store)));
    const page = await open(`the ${PHONE}px window at 32px text, 1,000 sessions`, { answer: thousand, options: { viewport: { width: PHONE, height: 900 } }, init: root32 });
    await settle(page);
    const r = await layout(page, big, `the ${PHONE}px window at 32px text, 1,000 sessions`);
    await pointAll(page, r, big, `the ${PHONE}px window at 32px text, 1,000 sessions`, 25);
    await shot(page, "343px-32px-1000");
    await page.done();
  }

  // ---------- colors: light and dark; forced colors with a quadrant selected and a dot read ----------
  {
    const page = await open("colors");
    await settle(page);
    const theme = async want => { for (let i = 0; i < 3 && (await page.locator("#navTheme").getAttribute("aria-label")) !== `Theme: ${want}`; i++) await page.locator("#navTheme").click(); };
    const r = await reading(page, rows), spot = await abs(page, topRight(r));
    await page.mouse.click(spot.x, spot.y);
    const got = [];
    for (const scheme of ["light", "dark"]) {
      // The theme's button takes the focus, which ends the reading: the oldest session is read again after it.
      await theme(scheme);
      await box(page).focus();
      await page.keyboard.press("Home");
      const want = await ev(page, () => Object.fromEntries(["--surface-1", "--surface-2", "--text-muted", "--text-primary"].map(k => [k, window.chartfit.probe(`var(${k})`)])));
      const s = await until(() => ev(page, () => ({ dots: window.mapfit.dots(), guides: window.mapfit.guides(), wash: window.mapfit.wash(), mark: window.mapfit.mark() })), x => x.dots.every(d => d.stroke === want["--surface-1"]) && x.wash?.fill === want["--surface-2"] && x.mark);
      got.push({ scheme, want, s, fills: [...new Set(s.dots.map(d => d.fill))].sort() });
    }
    const ok = ({ want, s }) => s.dots.length === N && s.dots.every(d => d.stroke === want["--surface-1"]) && s.guides.length === 2 && s.guides.every(g => g.stroke === want["--text-muted"]) && s.wash?.fill === want["--surface-2"] && s.mark?.stroke === want["--text-primary"];
    line("light and dark: the dots' edges are the surface, the guides --text-muted, the wash --surface-2, the ring --text-primary; the dots' colors change with the theme",
      got.every(ok) && got[0].want["--surface-1"] !== got[1].want["--surface-1"] && got[0].fills.join() !== got[1].fills.join(),
      got.map(({ scheme, want, s, fills }) => `${scheme}: edges ${[...new Set(s.dots.map(d => `rgb(${d.stroke})`))].join(", ")} for rgb(${want["--surface-1"]}), guides ${[...new Set(s.guides.map(g => `rgb(${g.stroke})`))].join(", ")}, wash ${s.wash ? `rgb(${s.wash.fill})` : "none"}, ring ${s.mark ? `rgb(${s.mark.stroke})` : "none"}, ${fills.length} dot colors`).join("; "));
    await shot(page, "dark");
    await page.done();
  }
  {
    const page = await open("forced colors", { options: { forcedColors: "active" } });
    await settle(page);
    const r = await reading(page, rows), spot = await abs(page, topRight(r));
    await page.mouse.click(spot.x, spot.y);
    await box(page).focus();
    await page.keyboard.press("ArrowRight");
    const { sys, name } = await sysColors(ev, page);
    const got = await until(() => ev(page, () => ({ dots: window.mapfit.dots(), rings: window.mapfit.rings(), guides: window.mapfit.guides(), wash: window.mapfit.wash(), frame: window.mapfit.frame(), texts: window.mapfit.texts(), mark: window.mapfit.mark() })), x => x.wash && x.mark);
    const say = c => name[c] ?? `NOT A SYSTEM COLOR rgb(${c})`, uniq = xs => [...new Set(xs)].map(say).join(", ");
    const contrast = c => (c ? ratio(sys.Canvas, c) : 0);
    line("forced colors: each dot's edge and each compacted session's ring is CanvasText", got.dots.length === N && got.dots.every(d => d.stroke === sys.CanvasText) && got.rings.length > 0 && got.rings.every(x => x.stroke === sys.CanvasText),
      `edges ${uniq(got.dots.map(d => d.stroke))}; ${got.rings.length} rings ${uniq(got.rings.map(x => x.stroke))}; ${[...new Set(got.dots.map(d => d.fill))].length} dot colors kept`);
    line("forced colors: the guides, the grid lines and every text are system colors, each 3:1 on Canvas at least",
      got.guides.length === 2 && got.guides.every(g => name[g.stroke]) && got.frame.strokes.every(c => name[c]) && got.texts.every(t => name[t.fill] && (!t.halo || name[t.halo]))
        && [...got.guides.map(g => g.stroke), ...got.texts.map(t => t.fill)].every(c => contrast(c) >= 3),
      `guides ${uniq(got.guides.map(g => g.stroke))} (${contrast(got.guides[0]?.stroke).toFixed(1)}:1); grid ${uniq(got.frame.strokes)}; texts ${uniq(got.texts.map(t => t.fill))}, halos ${uniq(got.texts.filter(t => t.halo).map(t => t.halo))}`);
    const w = got.wash, dotsFrom = Math.min(...got.dots.map(d => d.i));
    line("forced colors: the selected quadrant is a 2px Highlight frame with no fill, drawn over the grid lines and under the dots",
      !!w && w.stroke === sys.Highlight && w.width === 2 && w.fill === "none" && w.i > got.frame.last && w.i < dotsFrom,
      w ? `frame ${say(w.stroke)} ${w.width}px, fill ${w.fill === "none" ? "none" : say(w.fill)}; painted ${w.i + 1}th, after the last grid line (${got.frame.last + 1}th) and before the first dot (${dotsFrom + 1}th)` : "no frame");
    line("forced colors: the ring around the dot read is Highlight", !!got.mark && got.mark.stroke === sys.Highlight, `ring ${got.mark ? say(got.mark.stroke) : "none"} ${got.mark?.width ?? 0}px`);
    await shot(page, "forced-colors");
    await page.done();
  }

  // ---------- motion on: the dots drawn at once ----------
  {
    const page = await open("motion on", { options: { reducedMotion: "no-preference" }, init: watchDots });
    await sleep(1200);
    const dw = once(await ev(page, () => window.__dotDrawings));
    line("with motion on, the dots are drawn at once: one place for every dot from the first frame on", dw.ok, dw.at);
    await page.done();
  }

  // ---------- 1,000 sessions: the first drawing and a quadrant's redraw, timed; the session read pushed off the map ----------
  {
    let change = null;
    const answer = d => (change ? change(thousand(d)) : thousand(d));
    const big = mapRows(thousand(structuredClone(store))), both = big.filter(p => quadOf(p) === "both").length;
    const page = await open("1,000 sessions", { answer, path: "/context?range=30&tab=growth",
      ready: async p => { await p.waitForFunction(() => document.querySelector(".growth .echart-plot svg path")); } });
    await settle(page);
    const first = await ev(page, () => new Promise(resolve => {
      const t0 = performance.now();
      let mount = null;
      const mo = new MutationObserver(() => {
        const now = performance.now();
        mount ??= document.querySelector("#pressure .session-map") ? now : null;
        if (window.mapfit.dots().length < 1000) return;
        mo.disconnect();
        requestAnimationFrame(() => resolve({ mount: mount - t0, drawn: now - t0, painted: performance.now() - t0 }));
      });
      mo.observe(document.body, { childList: true, subtree: true });
      document.querySelector("#ctab-overhead").click();
    }));
    line("1,000 sessions: the first drawing takes under 100ms", first.drawn < 100,
      `from the tab's click: the map mounted at ${first.mount.toFixed(1)}ms, its 1,000 dots in the SVG at ${first.drawn.toFixed(1)}ms, the next frame at ${first.painted.toFixed(1)}ms`);
    await page.locator(`${ROOT} .map-box`).scrollIntoViewIfNeeded();
    await settle(page);
    const redraw = await ev(page, want => new Promise(resolve => {
      let t0 = 0, done = false;
      const check = () => {
        if (done || window.mapfit.dots().filter(d => d.so < .5).length !== 1000 - want || !window.mapfit.wash()) return;
        done = true;
        const t = performance.now() - t0;
        requestAnimationFrame(() => resolve({ drawn: t, painted: performance.now() - t0 }));
      };
      const mo = new MutationObserver(check);
      mo.observe(document.querySelector("#pressure .session-map .echart-plot"), { childList: true, subtree: true, attributes: true });
      t0 = performance.now();
      document.querySelector('#pressure .session-map .quads button[data-quad="both"]').click();
      check();
    }), both);
    line("1,000 sessions: a quadrant's redraw takes under 100ms", redraw.drawn < 100,
      `from the button's click: ${1000 - both} dots dimmed and the wash drawn at ${redraw.drawn.toFixed(1)}ms, the next frame at ${redraw.painted.toFixed(1)}ms`);
    await shot(page, "1000");
    // The oldest session read, then newer figures that push it off the map: the reading ends, with nothing said.
    await page.locator(`${ROOT} .quads button[data-quad="both"]`).click();
    await box(page).focus();
    await page.keyboard.press("ArrowRight");
    const s0 = await until(() => state(page), s => s.tip?.name === sessName(big[0]));
    await ev(page, () => window.mapfit.listen());
    change = d => { const ps = d.sessions_map.points, last = ps.at(-1); ps.shift(); ps.push({ ...last, session_id: "chartfit-map-newest", title: "The newest session", first_ts: new Date(Date.parse(last.first_ts) + 6e4).toISOString() }); return d; };
    await page.newer();
    const s1 = await until(() => state(page), s => !s.tip && !s.mark);
    await sleep(400);
    const said = await ev(page, () => window.mapfit.said()), n = await ev(page, () => window.mapfit.dots().length);
    line("1,000 sessions: newer figures that push the session read off the map end the reading, with nothing said", !!s0.tip && !s1.tip && !s1.mark && !s1.live && !said.length && n === 1000,
      `${s0.tip ? `read "${s0.tip.name}"` : "not read"}; then ${n} dots, ${s1.tip ? `tooltip "${s1.tip.name}"` : "no tooltip"}, ${s1.mark ? "ring" : "no ring"}, live "${s1.live}", said ${JSON.stringify(said)}`);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.done();
  }
}
