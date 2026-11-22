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
