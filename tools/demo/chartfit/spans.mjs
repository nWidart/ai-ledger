// The session sheet's "Tool calls by thread" on /usage?range=30&session=demo-spans: each tool call a span on one lane per
// thread, drawn by ECharts on the session timeline's own time axis, read by the section's own keys, pointer, tooltip, mark
// and live region (the wrapper reads nothing). Its own checks, each its own line; every case a check uses is first proved
// in the /api/session answer (the seed's demo-spans session), and what the store lacks is put in that answer:
// - the cases: 35 calls on the main thread, subagents 1 to 3 and one call not told apart; three calls at once at 1:30; a
//   failed call with no end; a failed short Edit; a 24.5-minute call through the one squeezed gap; two calls with no result;
//   the last call running past the axis's end; the readers find nothing on a page with no sheet;
// - layout: at 1440px, in a 375px window and at 1280px with 32px text, the sheet does not scroll sideways and the chart's
//   box lies inside the sheet (the page around a 375px window does not scroll sideways either);
// - the sorted centres of the timeline's tool-call ticks equal the sorted start centres of the chart's bars, ticks and rings
//   within 0.5px: at the 40rem sheet, after Wide and back, in a 343px box, at 32px text, at an open with the figures cached
//   (closed and opened again, and from another page), and as the sheet's scrollbar comes and goes (the data table opened
//   and every row shown);
// - the clipped bar runs past the plot's right edge into its right margin and ends in a point just before the box's edge, and the 24.5-minute bar ends where the gap does, across the
//   break; the failed call with no end is the red 2px tick, taller than its row, and its sentence says it failed;
// - at 16px and 32px text in a 343px box no lane label leaves the box or overlaps a bar or another label;
// - the pointer reads a bar with the mark on it within 1px, a tick drawn over a bar reads the tick, empty space nothing;
//   the hand over a span only; its tooltip never covers the bar it names;
// - Right, Left, Up, Down, Home and End read as decision 7 says, said again at an end, and the sheet does not scroll;
// - Escape: with a pointer's tooltip and the focus on another control of the sheet it ends the reading and the sheet stays,
//   a second closes the sheet; on the focused chart the same, and two quick ones too; with the command palette over a
//   pointer's reading, one Escape closes the palette and the sheet stays;
// - Enter and a click open the tool's sheet, the browser's Back returns to the session's; a touch tap reads and opens at
//   once;
// - the tooltip in a 343px box at 16px and 32px text, for the session's longest input and a 120-character input with a
//   60-character tool name: shown, wrapped, inside the box, and the chart's box keeps its width; the data table, opened
//   with every row, scrolls sideways in its own region and widens the sheet no more than the closed table does, that tool
//   name's cell is at least 8ch wide (at most 12 lines at 16px text), and no cell's text is cut;
// - loading: no chunk before a sheet opens; a blocked chunk leaves the line in place of the section and the rest of the
//   sheet; on Live the ECharts chunk loads once; the Models block's move as the section appears with the figures there;
// - colors: forced colors (system colors for the spans, rings, labels, key and the mark Highlight), dark (the mark against
//   the surface) and an OS flip with no reload; with motion on nothing animates;
// - newer figures keep the call read with the keys and say nothing.
import { chromium } from "playwright";
import { LOCALE, PHONE, W, line, sleep, until } from "./harness.mjs";
import { root32 } from "./checks.mjs";

const SID = "demo-spans", PATH = `/usage?range=30&session=${SID}`, ROOT = "dialog.sheet[open] .spans", DATA = /\/api\/session\?/;
const MARK = 3;

/** The section's in-page readers, as window.sp, run in every page before its scripts. Everything is read inside the open
 *  sheet: the chart's paths in #session-spans's svg (the break bands, the ⌇ marks and the spans: no other path is drawn
 *  there), the timeline's ticks in div.tl's svg (a successful call a 1px rect at half opacity, a failed one a 2px rect with
 *  rounded ends: nothing else of the timeline is either). Colors are "r,g,b", a system color by its resolved value. */
function spanReaders() {
  const q = s => document.querySelector(`dialog.sheet[open] ${s}`);
  const rect = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const a = (e, k) => e.getAttribute(k);
  const tri = c => (String(c).match(/[\d.]+/g) || []).slice(0, 3).map(n => Math.round(Number(n))).join(",");
  const probe = css => {
    const s = document.createElement("span");
    s.style.cssText = `position:absolute;forced-color-adjust:none;color:${css}`;
    document.body.append(s);
    const c = getComputedStyle(s).color;
    s.remove();
    return tri(c);
  };
  const col = c => (!c || c === "none" ? "none" : /^[a-z]+$/i.test(c) ? probe(c) : tri(c));
  const arc = d => /A[\d.]+ [\d.]+ 0 1 1 /.test(d);
  window.sp = {
    probe, tri,
    /** The chart's drawing: the break bands (tall 6px fills), the ⌇ marks (unfilled polylines), and the spans with their
     *  kind, their outer box (a stroke's half outside the geometry) and the centre of their start. */
    drawing() {
      const svg = q("#session-spans .echart-plot svg");
      const all = [...(svg?.querySelectorAll("path") ?? [])].map(e => {
        const d = a(e, "d") ?? "", stroke = (a(e, "stroke") ?? "none") === "none" ? null : col(a(e, "stroke"));
        return { d, fill: col(a(e, "fill")), stroke, sw: stroke ? Number(a(e, "stroke-width") ?? 1) : 0, n: (d.match(/[ML]/g) ?? []).length, ...rect(e) };
      });
      const bands = all.filter(p => p.h > 12 && !p.stroke), zig = all.filter(p => p.fill === "none" && !arc(p.d));
      const critical = probe("var(--critical)"), muted = probe("var(--text-muted)");
      const spans = all.filter(p => !bands.includes(p) && !zig.includes(p)).map(p => {
        // zrender writes a rect's sides as relative "l" segments; the clipped bar is the one polygon, absolute "L" ones.
        const kind = arc(p.d) ? "ring" : /L/.test(p.d) ? "clipped" : !p.stroke && p.w <= 2.5 && p.fill === critical ? "fail" : p.stroke ? "hollow" : p.w <= 1.5 && p.fill === muted ? "still" : "ok";
        const o = p.sw / 2, box = { l: p.l - o, t: p.t - o, r: p.r + o, b: p.b + o };
        const start = kind === "ring" || kind === "fail" ? (p.l + p.r) / 2 : box.l + .5;
        // A polygon's rightmost vertex: the clipped bar's point.
        const pts = [...p.d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(m => new DOMPoint(Number(m[1]), Number(m[2])).matrixTransform(svg.getScreenCTM()));
        const tip = pts.length ? pts.reduce((x, y) => (y.x > x.x ? y : x)) : null;
        return { kind, fill: p.fill, stroke: p.stroke, sw: p.sw, n: p.n, start, box, x: (box.l + box.r) / 2, y: (box.t + box.b) / 2, w: p.w, h: p.h, point: tip && { x: tip.x, y: tip.y } };
      });
      const texts = [...(svg?.querySelectorAll("text") ?? [])].map(e => ({ text: e.textContent, fill: col(a(e, "fill")), size: parseFloat(getComputedStyle(e).fontSize), ...rect(e) }));
      return { bands: bands.map(p => ({ fill: p.fill, ...p, d: undefined })), zig: zig.map(p => ({ stroke: p.stroke, l: p.l, r: p.r, t: p.t, b: p.b })), spans, texts };
    },
    /** The timeline's tool-call ticks, their centres; its strip's edges (the plot's); the x of each point of its context line. */
    timeline() {
      const svg = q("div.tl > svg");
      if (!svg) return null;
      const ticks = [...svg.querySelectorAll("rect[width='1'][opacity], rect[width='2'][rx='1']")].map(e => { const r = rect(e); return { x: (r.l + r.r) / 2, fail: a(e, "width") === "2" }; });
      const strip = svg.querySelector("rect[rx='4']"), line = [...svg.querySelectorAll("path")].find(e => a(e, "fill") === "none" && a(e, "stroke") === "var(--series-1)");
      const ctm = svg.getScreenCTM();
      const reqs = line ? [...a(line, "d").matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m => new DOMPoint(Number(m[1]), Number(m[2])).matrixTransform(ctm).x) : [];
      return { ticks, strip: strip ? rect(strip) : null, reqs, gaps: svg.querySelectorAll("rect[width='6']").length };
    },
    mark: () => {
      const m = q(".spans-mark :is(rect, circle)");
      return m ? { ring: m.tagName === "circle", stroke: tri(getComputedStyle(m).stroke), ...rect(m) } : null;
    },
    tip: () => {
      const t = q(".spans-box > .tip");
      if (!t || getComputedStyle(t).display === "none" || !t.getBoundingClientRect().width) return null;
      const rows = [...t.children].map(r => r.textContent), lines = [...t.children].map(r => {
        const g = document.createRange();
        g.selectNodeContents(r);
        return new Set([...g.getClientRects()].filter(c => c.width > 0).map(c => Math.round(c.top))).size;
      });
      return { rows, lines, spill: t.scrollWidth - t.clientWidth, ...rect(t) };
    },
    live: () => q(".spans-live")?.textContent ?? "",
    box: () => { const b = q(".spans-box"); return b ? rect(b) : null; },
    /** The section's box (div.spans) and the timeline's: their width as each measures it. */
    widths: () => ({ spans: q("div.spans")?.clientWidth ?? 0, tl: q("div.tl")?.clientWidth ?? 0 }),
    sheet: () => {
      const d = document.querySelector("dialog.sheet[open]");
      return d ? { open: true, scrollTop: d.scrollTop, sw: d.scrollWidth, cw: d.clientWidth, bar: d.offsetWidth - d.clientWidth - parseFloat(getComputedStyle(d).borderLeftWidth), title: d.querySelector("h2")?.textContent ?? "", ...rect(d) }
        : { open: false };
    },
    cursor: (x, y) => getComputedStyle(document.elementFromPoint(x, y)).cursor,
    /** The live region's sentences from now on (one observer per page): each new node it says, the same words said again
     *  too (the region renders each saying as a node of its own). Watched from the body, as the sheet comes and goes. */
    listen: () => {
      const now = () => document.querySelector("dialog.sheet[open] .spans-live")?.firstChild ?? null;
      window.__said = [];
      window.__last = now(); // what the region says already is not said from now on
      if (window.__listening) return;
      window.__listening = true;
      new MutationObserver(() => {
        const n = now();
        if (n !== window.__last && n?.textContent) window.__said.push(n.textContent);
        window.__last = n;
      }).observe(document.body, { childList: true, characterData: true, subtree: true });
    },
    /** Everything the chart draws in one string: what a frame of an animation would change. */
    signature: () => [...(q("#session-spans .echart-plot svg")?.querySelectorAll("path, text") ?? [])].map(e => [a(e, "d"), a(e, "transform"), a(e, "opacity"), a(e, "fill-opacity"), a(e, "x")].join(" ")).join("|"),
  };
}
/** An init script that keeps every distinct drawing, from the first frame on, as window.__drawings. */
function watchDrawings() {
  window.__drawings = [];
  const tick = () => {
    const s = window.sp?.drawing().spans.length ? window.sp.signature() : null;
    if (s && s !== window.__drawings.at(-1)) window.__drawings.push(s);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const px = n => Math.round(n * 100) / 100;
const tOf = c => Date.parse(c.start_ts || c.end_ts || "");
/** A call's thread as the layout ranks it: 0 the main thread, k subagent k, null not told apart. */
const sub = c => (!c.subagent ? 0 : Number.isInteger(c.lane) && c.lane >= 1 ? c.lane : null);
const on = c => (sub(c) === 0 ? "the main thread" : sub(c) == null ? "a subagent not told apart" : `subagent ${sub(c)}`);
/** The lanes top to bottom, each its calls in reading order (decision 7): by start (the end with no start), then id. */
function lanesOf(d) {
  const calls = d.calls.filter(c => !isNaN(tOf(c)));
  const ranks = [...new Set(calls.map(sub).filter(r => r > 0))].sort((a, b) => a - b);
  return [0, ...ranks, null].map(k => calls.filter(c => sub(c) === k).sort((a, b) => tOf(a) - tOf(b) || cmp(a.id, b.id))).filter(l => l.length);
}
/** The call a key reads from the call at (null: none), as decision 7 says. */
function step(lanes, at, key) {
  if (at == null) return key === "ArrowLeft" || key === "End" ? lanes[0].at(-1) : lanes[0][0];
  const li = lanes.findIndex(l => l.includes(at)), l = lanes[li], i = l.indexOf(at);
  if (key === "ArrowRight") return l[Math.min(i + 1, l.length - 1)];
  if (key === "ArrowLeft") return l[Math.max(i - 1, 0)];
  if (key === "Home") return l[0];
  if (key === "End") return l.at(-1);
  const to = lanes[key === "ArrowUp" ? li - 1 : li + 1];
  if (!to) return at;
  let best = to[0], e = Infinity;
  for (const c of to) { const x = Math.abs(tOf(c) - tOf(at)); if (x < e) { e = x; best = c; } }
  return best;
}
/** Whether a sentence names the call: its tool, thread, time and input. clocks: each call's time as the page writes it. */
const names = (c, text, clocks) => text.startsWith(`${c.tool ?? "Unknown tool"} on ${on(c)}, `) && text.includes(clocks[c.id]) && (!c.input || text.includes(`: ${c.input}.`));
/** The overlap of two boxes, in px², and as a share of the second's area. */
const overlap = (p, m) => {
  const w = Math.max(0, Math.min(p.r, m.r) - Math.max(p.l, m.l)), h = Math.max(0, Math.min(p.b, m.b) - Math.max(p.t, m.t));
  return { area: w * h, share: w * h / ((m.r - m.l) * (m.b - m.t)) };
};

export async function spans(h) {
  const base = await h.json(`/api/session?id=${SID}`);
  const CALLS = base.calls.filter(c => !isNaN(tOf(c))), N = CALLS.length, LANES = lanesOf(base), T0 = Date.parse(base.info.first_ts);
  const ev = (page, f, arg) => page.evaluate(f, arg);
  const byId = id => base.calls.find(c => c.id === id);
  const min = c => (Date.parse(c.start_ts) - T0) / 60e3;

  // ---------- the cases, in the answer ----------
  const times = [...base.requests.filter(r => !r.subagent && r.ts && r.context != null).map(r => Date.parse(r.ts)), ...CALLS.map(tOf), ...(base.compaction_ts ?? []).map(Date.parse)].sort((x, y) => x - y);
  const gaps = times.slice(1).map((t, k) => [times[k], t]).filter(([x, y]) => y - x > 20 * 60e3);
  const at130 = CALLS.filter(c => sub(c) === 0 && Math.abs(min(c) - 1.5) < 1e-9);
  const C = {
    test: at130.find(c => c.tool === "Bash" && c.is_error && c.input === "npm test" && c.end_ts),
    nodur: CALLS.find(c => c.is_error === true && c.start_ts && !c.end_ts && sub(c) === 0),
    edit: CALLS.find(c => c.tool === "Edit" && c.is_error === true && Date.parse(c.end_ts) - Date.parse(c.start_ts) <= 1000),
    e2e: CALLS.find(c => c.input === "npm run test:e2e"),
    apart: CALLS.find(c => sub(c) == null && !c.end_ts && c.is_error == null),
    dev: CALLS.find(c => sub(c) === 0 && c.input === "npm run dev" && !c.end_ts && c.is_error == null),
    build: CALLS.find(c => c.input === "npm run build"),
  };
  const agents = at130.filter(c => c.tool === "Agent");
  const keys = LANES.map(l => (sub(l[0]) === 0 ? "main" : sub(l[0]) == null ? "apart" : `sub-${sub(l[0])}`));
  const e2eGap = C.e2e && gaps.find(([x, y]) => x === Date.parse(C.e2e.start_ts) && y > Date.parse(C.e2e.end_ts));
  const cases = {
    "35 calls": N === 35 && base.calls.length === 35 && !base.calls_truncated,
    "lanes main, sub-1, sub-2, sub-3, apart": keys.join() === "main,sub-1,sub-2,sub-3,apart",
    "three at once at 1:30": at130.length === 3 && agents.length === 2 && !!C.test && min({ start_ts: C.test.end_ts }) > 7.5,
    "8:20 failed with no end": !!C.nodur && Math.abs(min(C.nodur) - 8 - 1 / 3) < 1e-9,
    "8:40 failed short Edit": !!C.edit && Math.abs(min(C.edit) - 8 - 2 / 3) < 1e-9,
    "10:00 to 34:30 through the one gap, to 40:10": gaps.length === 1 && !!e2eGap && Math.abs((e2eGap[1] - T0) / 60e3 - 40 - 1 / 6) < 1e-9 && Math.abs(min({ start_ts: C.e2e.end_ts }) - 34.5) < 1e-9,
    "48:55 not told apart, no result": !!C.apart && Math.abs(min(C.apart) - 48 - 55 / 60) < 1e-9,
    "52:00 main, no result": !!C.dev && Math.abs(min(C.dev) - 52) < 1e-9,
    "the last start, past the axis's end": !!C.build && tOf(C.build) === Math.max(...CALLS.map(tOf)) && Date.parse(C.build.end_ts) > times.at(-1),
  };
  const missing = Object.entries(cases).filter(([, ok]) => !ok).map(([k]) => k);
  if (!line(`the answer for ${SID} holds every case the checks use: ${Object.keys(cases).join("; ")}`, !missing.length, missing.length ? `missing: ${missing.join("; ")}` : `${N} calls on ${LANES.map(l => l.length).join(" + ")} by lane`))
    throw new Error("the demo-spans session lacks a case");
  const inputs = CALLS.map(c => c.input ?? "").sort((x, y) => y.length - x.length), LONGEST = CALLS.find(c => c.input === inputs[0]);
  const toolLen = Math.max(...CALLS.map(c => (c.tool ?? "").length));

  /** The sheet on path, with the session answer changed by answer, drawn: as many spans and timeline ticks as the answer
   *  has calls. */
  const open = (name, { answer = null, options = {}, init = null, path = PATH, want = null } = {}) => {
    const n = want ?? (answer ? answer(structuredClone(base)).calls.filter(c => !isNaN(tOf(c))).length : N);
    return h.open({ path, root: ROOT, setup: spanReaders, data: DATA, answer,
      ready: async p => {
        await p.waitForFunction(() => document.querySelector("dialog.sheet[open] #session-spans .echart-plot svg path"), null, { timeout: 15000 });
        await until(() => p.evaluate(() => window.sp.drawing().spans.length), k => k === n);
        await p.locator("#session-spans").scrollIntoViewIfNeeded();
      } }, `spans ${name}`, options, init);
  };
  const shot = (page, what) => h.shot(page, ROOT, `spans-${what}`);
  const state = page => ev(page, () => ({ tip: window.sp.tip(), mark: window.sp.mark(), live: window.sp.live(), box: window.sp.box(), sheet: window.sp.sheet(), url: location.search }));
  const clocksOf = page => ev(page, cs => Object.fromEntries(cs.map(([id, t]) => [id, new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })])),
    base.calls.map(c => [c.id, tOf(c)]));
  const away = page => page.mouse.move(2, 2);
  const chart = page => page.locator("#session-spans");
  const sessionOpen = s => s.sheet.open && new URLSearchParams(s.url).get("session") === SID && !new URLSearchParams(s.url).get("tool");
  /** The drawn span the mark sits on, within 1px on each edge (a ring: its centre), or null. */
  const marked = (s, dr) => {
    if (!s.mark) return null;
    const m = s.mark, inner = { l: m.l + MARK, t: m.t + MARK, r: m.r - MARK, b: m.b - MARK };
    const off = sp => (m.ring ? Math.hypot((m.l + m.r) / 2 - sp.x, (m.t + m.b) / 2 - sp.y)
      : Math.max(...["l", "t", "r", "b"].map(k => Math.abs(inner[k] - sp.box[k]))));
    const best = dr.spans.filter(sp => (sp.kind === "ring") === m.ring).map(sp => ({ sp, off: off(sp) })).sort((x, y) => x.off - y.off)[0];
    return best && best.off <= 1 ? best : null;
  };

  /** The alignment line: the timeline's ticks against the chart's starts, sorted, within 0.5px, every one of them drawn. */
  const aligned = async (page, what) => {
    const got = await until(() => ev(page, () => ({ tl: window.sp.timeline(), dr: window.sp.drawing(), w: window.sp.widths() })), g => {
      const t = g.tl?.ticks.map(x => x.x).sort((x, y) => x - y) ?? [], s = g.dr.spans.map(x => x.start).sort((x, y) => x - y);
      return t.length === N && s.length === N && t.every((x, k) => Math.abs(x - s[k]) <= .5);
    });
    const t = got.tl?.ticks.map(x => x.x).sort((x, y) => x - y) ?? [], s = got.dr.spans.map(x => x.start).sort((x, y) => x - y);
    const offs = t.map((x, k) => Math.abs(x - (s[k] ?? Infinity)));
    const worst = Math.max(0, ...offs), k = offs.indexOf(worst);
    return line(`${what}: the ${N} ticks of the timeline sit at the start centres of the chart's ${N} spans, sorted, within 0.5px`,
      t.length === N && s.length === N && worst <= .5,
      `${t.length} ticks, ${s.length} spans; the farthest ${px(worst)}px off${worst > .5 ? ` (tick ${k + 1}: ${px(t[k])} against ${px(s[k])})` : ""}; both boxes ${got.w.spans}px and ${got.w.tl}px wide`);
  };

  // ---------- the readers on a page with no sheet: nothing ----------
  {
    const page = await h.open({ path: "/usage?range=30", root: ROOT, setup: spanReaders, ready: p => p.waitForFunction(() => document.querySelector(".echart-plot svg path"), null, { timeout: 15000 }) }, "spans no sheet");
    await sleep(500);
    const got = await ev(page, () => ({ dr: window.sp.drawing(), tl: window.sp.timeline(), mark: window.sp.mark(), tip: window.sp.tip(), live: window.sp.live(), box: window.sp.box(), paths: document.querySelectorAll(".echart-plot svg path").length,
      chunks: performance.getEntriesByType("resource").filter(e => /\/SessionSpans-[^/]*\.js$/.test(e.name)).length }));
    line(`a page with no sheet (its own charts draw ${got.paths} paths): the readers find no span, tick, mark, tooltip or sentence`,
      got.paths > 0 && !got.dr.spans.length && !got.dr.bands.length && !got.tl && !got.mark && !got.tip && !got.live && !got.box,
      `${got.dr.spans.length} spans, ${got.dr.bands.length} bands, ${got.tl ? `${got.tl.ticks.length} ticks` : "no timeline"}, ${got.mark ? "a mark" : "no mark"}, ${got.tip ? "a tooltip" : "no tooltip"}`);
    // The sheet opens in the page, through the history the router listens to.
    line("a fresh page: no SessionSpans chunk is requested before a sheet opens", got.chunks === 0, `${got.chunks} requested`);
    await ev(page, p => { history.pushState(null, "", p); dispatchEvent(new PopStateEvent("popstate")); }, PATH);
    const n = await until(() => ev(page, () => window.sp.drawing().spans.length), k => k === N);
    const chunks = await ev(page, () => performance.getEntriesByType("resource").filter(e => /\/SessionSpans-[^/]*\.js$/.test(e.name)).length);
    line("…and opening the sheet requests it once and draws the chart", chunks === 1 && n === N, `${chunks} requested, ${n} spans`);
    await page.done();
  }

  // ---------- 1440px: the sheet, the alignment, the clipped bar, the break, the failure tick ----------
  {
    const page = await open("1440px");
    const g = await ev(page, () => ({ s: window.sp.sheet(), b: window.sp.box(), doc: document.documentElement.scrollWidth, w: innerWidth }));
    line(`${W}px: the sheet does not scroll sideways and the chart's box lies inside it`, g.s.sw <= g.s.cw && g.b.l >= g.s.l - .5 && g.b.r <= g.s.r + .5 && g.doc <= g.w,
      `sheet ${g.s.sw} of ${g.s.cw}px, box ${px(g.b.l - g.s.l)}..${px(g.b.r - g.s.l)} of ${px(g.s.w)}; the page ${g.doc} of ${g.w}px`);
    await aligned(page, "the 40rem sheet");
    await shot(page, "light");
    const { dr, tl, bx } = await ev(page, () => ({ dr: window.sp.drawing(), tl: window.sp.timeline(), bx: window.sp.box() }));
    // The clipped bar: the only polygon, five vertices, its point the rightmost vertex at its middle height, in the plot's
    // right margin (past the strip's right edge) and at most 2px before the box's. It starts where the axis ends (the last
    // start), so the layout draws it at its minimum length: a visible shape, not a sliver at the edge.
    const cl = dr.spans.filter(x => x.kind === "clipped");
    const c0 = cl[0], right = tl.strip.r;
    line("the call past the axis's end is one bar at least 6px long that ends in a point in the plot's right margin, inside the box",
      cl.length === 1 && c0.n === 5 && c0.w >= 5.5 && c0.point.x > right + 1 && c0.point.x <= bx.r - 1.5 && Math.abs(c0.point.y - c0.y) <= .5,
      c0 ? `${cl.length} clipped, ${px(c0.box.l - right)}..${px(c0.point.x - right)}px from the plot's edge (${px(c0.w)}px long), the box's edge at ${px(bx.r - right)}px, ${px(c0.point.y - c0.y)}px from its middle, ${c0.n} vertices` : "no clipped bar");
    // The 24.5-minute bar: where its gap ends, on the timeline's context line (the request at the gap's end); across the
    // chart's one break band and the timeline's one.
    const reqs = base.requests.filter(r => !r.subagent && r.ts && r.context != null), j = reqs.findIndex(r => Date.parse(r.ts) === e2eGap[1]);
    const xEnd = tl.reqs[j], band = dr.bands[0], e2e = dr.spans.find(x => x.kind === "ok" && band && x.box.l < band.l && x.box.r > band.r);
    line("the 24.5-minute bar ends where the squeezed gap ends, across the break", dr.bands.length === 1 && tl.gaps === 1 && j >= 0 && !!e2e && Math.abs(e2e.box.r - (xEnd + .5)) <= .5,
      e2e ? `${dr.bands.length} band, the bar ${px(e2e.box.l)}..${px(e2e.box.r)} over the band ${px(band.l)}..${px(band.r)}, the gap's end at ${px(xEnd)} (+0.5)` : `${dr.bands.length} bands, no bar across one`);
    // The failed call with no end: a 2px red tick, taller than its row; the short failed Edit is one too, later.
    const fails = dr.spans.filter(x => x.kind === "fail").sort((x, y) => x.start - y.start), clocks = await clocksOf(page);
    const tick = fails[0], row = dr.spans.filter(x => x.kind === "ok" && tick && Math.abs(x.box.b - tick.box.b) < .5);
    await away(page);
    if (tick) await page.mouse.move(tick.x, tick.y);
    const s = await until(() => state(page), x => !!x.tip);
    const words = s.live.slice(0, s.live.indexOf(`: ${C.nodur.input}`));
    line(`the failed call with no end (${clocks[C.nodur.id]}) is the red 2px tick, taller than its row, and its sentence says it failed`,
      fails.length === 2 && Math.abs(tick.w - 2) <= .1 && tick.h >= 9.9 && row.length > 0 && tick.box.t <= row[0].box.t - 1.9 && names(C.nodur, s.live, clocks) && words.endsWith(", failed"),
      tick ? `${fails.length} red ticks; ${px(tick.w)}x${px(tick.h)} in rgb(${tick.fill}), ${px(row[0] ? row[0].box.t - tick.box.t : NaN)}px above its row's bars; said "${s.live}"` : "no red tick");
    await page.done();
  }

  // ---------- the reading: pointer, mark, hand, tooltip, keys, Escape, Enter, click ----------
  {
    const page = await open("reading");
    const clocks = await clocksOf(page), dr = await ev(page, () => window.sp.drawing());
    await ev(page, () => window.sp.listen());
    // The pointer: the hollow test run, the failure tick, a ring.
    const pick = { hollow: dr.spans.find(x => x.kind === "hollow"), fail: dr.spans.filter(x => x.kind === "fail").sort((x, y) => x.start - y.start)[1], ring: dr.spans.filter(x => x.kind === "ring").sort((x, y) => x.y - y.y)[0] };
    const want = { hollow: C.test, fail: C.edit, ring: C.dev };
    const wrong = [];
    let worst = 0;
    for (const k of Object.keys(pick)) {
      await away(page);
      await page.mouse.move(pick[k].x, pick[k].y);
      const s = await until(() => state(page), x => x.tip && names(want[k], x.live, clocks) && marked(x, dr));
      const m = marked(s, dr);
      worst = Math.max(worst, m?.off ?? Infinity);
      if (!(s.tip && names(want[k], s.live, clocks) && m && m.sp.kind === pick[k].kind)) wrong.push(`${k}: said "${s.live}", mark ${m ? `on a ${m.sp.kind} ${px(m.off)}px off` : "on no span"}`);
    }
    line("the pointer over the hollow test run, the failed Edit's tick and a ring reads that call, the mark on its drawn span within 1px", !wrong.length,
      wrong.join("; ") || `the mark at most ${px(worst)}px off`);
    // Empty space: under the last lane, above the time labels, in the plot.
    const lastRow = Math.max(...dr.spans.map(x => x.box.b)), mid = (Math.min(...dr.spans.map(x => x.box.l)) + Math.max(...dr.spans.map(x => x.box.r))) / 2;
    const freeX = [...Array(40).keys()].map(i => mid + (i - 20) * 7).find(x => dr.spans.every(sp => x < sp.box.l - 8 || x > sp.box.r + 8));
    await page.mouse.move(freeX, lastRow + 2);
    await sleep(200);
    const empty = await state(page);
    const hand = await ev(page, ([x, y]) => window.sp.cursor(x, y), [freeX, lastRow + 2]);
    await page.mouse.move(pick.hollow.x, pick.hollow.y);
    await until(() => state(page), x => !!x.tip);
    const handOn = await ev(page, ([x, y]) => window.sp.cursor(x, y), [pick.hollow.x, pick.hollow.y]);
    line("the pointer in empty space reads nothing; the cursor is a hand over a span only", !empty.tip && !empty.mark && !empty.live && handOn === "pointer" && hand !== "pointer",
      `empty space: ${empty.tip ? "a tooltip" : "no tooltip"}, ${empty.mark ? "a mark" : "no mark"}, said "${empty.live}", cursor ${hand}; over the test run: ${handOn}`);

    // The tooltip over long bars, beside the pointer in their middle: never over the bar it names.
    const long = dr.spans.filter(x => x.kind === "ok" && x.box.r - x.box.l >= 12).sort((x, y) => (y.box.r - y.box.l) - (x.box.r - x.box.l)).slice(0, 4);
    const covers = [];
    for (const sp of long) {
      await away(page);
      await page.mouse.move(sp.x, sp.y);
      const s = await until(() => state(page), x => !!x.tip && !!x.mark);
      const c = CALLS.find(x => names(x, s.live, clocks));
      const o = s.tip && s.mark ? overlap(s.tip, s.mark) : { area: NaN, share: NaN };
      covers.push({ what: `${c ? `${c.tool} ${c.input.slice(0, 16)}` : "?"} (${px(sp.box.r - sp.box.l)}px)`, ...o });
    }
    line("the pointer's tooltip in the middle of the longest bars (the 24.5-minute run and the Agent calls) covers none of the mark around the bar it names",
      covers.length === 4 && covers.every(o => o.area <= .5), covers.map(o => `${o.what}: ${px(o.area)}px², ${Math.round(o.share * 100)}% of the mark`).join("; "));

    // The keys, on the focused chart: through the main thread, then down and up the lanes.
    await away(page);
    await until(() => state(page), x => !x.tip);
    await chart(page).focus();
    await ev(page, () => { window.__prevented = []; document.addEventListener("keydown", e => window.__prevented.push(e.defaultPrevented)); });
    const y0 = (await state(page)).sheet.scrollTop;
    const seq = [...LANES[0].map(() => "ArrowRight"), "ArrowRight", "ArrowLeft", "Home", "End", "ArrowDown", "ArrowDown", "ArrowDown", "ArrowDown", "ArrowDown", "ArrowUp", "ArrowUp", "Home", "ArrowRight", "ArrowUp", "End", "ArrowLeft"];
    let at = null;
    const bad = [];
    let said0 = 0;
    await ev(page, () => window.sp.listen());
    for (const key of seq) {
      const next = step(LANES, at, key), again = next === at;
      await page.keyboard.press(key);
      const s = await until(async () => ({ ...(await state(page)), said: await ev(page, () => window.__said.length) }),
        x => names(next, x.live, clocks) && marked(x, dr) && x.tip && x.said > said0);
      const said = s.said;
      if (!(names(next, s.live, clocks) && marked(s, dr) && s.tip) || said <= said0) bad.push(`${key} from ${at?.id ?? "none"}: want ${next.id}, said "${s.live.slice(0, 50)}", ${marked(s, dr) ? "marked" : "no mark"}${said <= said0 ? `, not said${again ? " again" : ""}` : ""}`);
      said0 = said;
      at = next;
    }
    const after = await state(page), prevented = await ev(page, () => window.__prevented);
    line(`keys: ${seq.length} presses of Right, Left, Home, End, Down and Up read as decision 7 says, each with the mark on its span and its tooltip, a key that cannot move says it again`,
      !bad.length, bad.slice(0, 3).join("; ") || `through the ${LANES[0].length} calls of the main thread and ${LANES.length} lanes`);
    line("keys: every one is prevented and the sheet does not scroll", prevented.length === seq.length && prevented.every(Boolean) && after.sheet.scrollTop === y0,
      `${prevented.filter(Boolean).length} of ${prevented.length} prevented; the sheet scrolled ${after.sheet.scrollTop - y0}px`);

    // Enter on the call read opens its tool's sheet, in place of the session's, as a row of its Tools table does: the
    // tool sheet offers no ← Back (that is for a session opened from a project or tool sheet), the browser's Back returns.
    await page.keyboard.press("Enter");
    const tool = await until(() => state(page), x => x.sheet.open && new URLSearchParams(x.url).get("tool") === at.tool);
    const arrow = await ev(page, () => !!document.querySelector("dialog.sheet[open] .sheet-back"));
    await page.goBack();
    const back = await until(() => state(page), sessionOpen);
    line(`Enter on ${at.tool} opens its tool's sheet in place of the session's, and the browser's Back returns to the session's`, new URLSearchParams(tool.url).get("tool") === at.tool && tool.sheet.open && sessionOpen(back),
      `${tool.url}, "${tool.sheet.title}", ${arrow ? "with" : "no"} ← Back; back: ${back.url}, "${back.sheet.title}"`);
    await until(() => ev(page, () => window.sp.drawing().spans.length), k => k === N);
    await chart(page).scrollIntoViewIfNeeded();
    const d2 = await ev(page, () => window.sp.drawing()), h2 = d2.spans.find(x => x.kind === "hollow");
    await page.mouse.click(h2.x, h2.y);
    const clicked = await until(() => state(page), x => new URLSearchParams(x.url).get("tool") === "Bash");
    await page.goBack();
    const back2 = await until(() => state(page), sessionOpen);
    line("a click on the test run opens Bash's sheet, and the browser's Back returns to the session's", new URLSearchParams(clicked.url).get("tool") === "Bash" && sessionOpen(back2), `${clicked.url}; back: ${back2.url}`);
    await page.done();
  }

  // ---------- a key's tooltip: above the call when the window has room, else below ----------
  {
    const page = await open("key tooltip");
    const clocks = await clocksOf(page), first = LANES[0][0];
    /** With top, the sheet scrolled so the chart's box is at the top of its visible area, under its sticky head; then the
     *  main thread's first call read by a key afresh. The focus moves with no scroll: the sheet's scroll-padding (80px, for
     *  the head) would move the box down again. */
    const readAt = async top => {
      if (top) await ev(page, () => {
        const d = document.querySelector("dialog.sheet[open]"), b = document.querySelector("dialog.sheet[open] .spans-box");
        d.scrollTop += b.getBoundingClientRect().top - d.querySelector(".sheet-head").getBoundingClientRect().bottom;
      });
      await ev(page, () => document.querySelector("dialog.sheet[open] #session-spans").focus({ preventScroll: true }));
      // Escape only with a reading open: with nothing read it closes the sheet.
      if ((await state(page)).tip) {
        await page.keyboard.press("Escape");
        await until(() => state(page), x => !x.tip);
      }
      await page.keyboard.press("ArrowRight");
      const s = await until(() => state(page), x => !!x.tip && !!x.mark && names(first, x.live, clocks));
      const more = await ev(page, () => {
        const r = document.querySelector("dialog.sheet[open] .spans .chart-table > button").getBoundingClientRect();
        const head = document.querySelector("dialog.sheet[open] .sheet-head").getBoundingClientRect();
        return { button: { l: r.left, t: r.top, r: r.right, b: r.bottom }, view: innerHeight, sheetTop: head.bottom };
      });
      return { ...s, ...more };
    };
    // The box fully in view where the sheet opens to it (its foot, the sheet's end below): room above the call.
    const mid = await readAt(false);
    const inView = mid.box.t >= 0 && mid.box.b <= mid.view;
    line(`a key's reading of the main thread's first call with the chart's box in view: the tooltip is shown above the call, inside the window, clear of the call's mark and of "Show data table"`,
      inView && !!mid.tip && mid.tip.b <= mid.mark.t + .5 && mid.tip.t >= 0 && mid.tip.b <= mid.view && overlap(mid.tip, mid.mark).area <= .5 && overlap(mid.tip, mid.button).area <= .5,
      mid.tip ? `box ${px(mid.box.t)}..${px(mid.box.b)} of ${mid.view}px; tooltip ${px(mid.tip.t)}..${px(mid.tip.b)} (${px(mid.tip.h)}px), the mark ${px(mid.mark.t)}..${px(mid.mark.b)}, the button at ${px(mid.button.t)}; overlaps ${px(overlap(mid.tip, mid.mark).area)} and ${px(overlap(mid.tip, mid.button).area)}px²` : "no tooltip");
    // The box at the very top of the sheet's visible area: no room above the call, the tooltip goes below it. The table
    // opened with every row and the sheet's folded blocks opened give the sheet the room below to scroll the box up there.
    await page.locator("dialog.sheet[open] .spans .chart-table > button").click();
    await page.getByRole("button", { name: /^Show all \d+ calls$/ }).click();
    await ev(page, () => document.querySelectorAll("dialog.sheet[open] details").forEach(d => { d.open = true; }));
    const top = await readAt(true);
    line("…and with the chart's box at the very top of the sheet's visible area, the tooltip goes below the call, clear of its mark, inside the window",
      !!top.tip && Math.abs(top.box.t - top.sheetTop) <= 2 && top.tip.t >= top.mark.b - .5 && top.tip.b <= top.view && overlap(top.tip, top.mark).area <= .5,
      top.tip ? `box top ${px(top.box.t)}, the sheet's sticky head ending at ${px(top.sheetTop)}; tooltip ${px(top.tip.t)}..${px(top.tip.b)}, the mark ${px(top.mark.t)}..${px(top.mark.b)}` : "no tooltip");
    await page.done();
  }

  // ---------- Escape in the sheet ----------
  {
    const page = await open("escape");
    const clocks = await clocksOf(page);
    // A pointer's tooltip, the focus on another control of the sheet.
    await page.locator("dialog.sheet[open] .spans .chart-table > button").focus();
    await chart(page).scrollIntoViewIfNeeded();
    let dr = await ev(page, () => window.sp.drawing());
    const hollow = () => dr.spans.find(x => x.kind === "hollow");
    await page.mouse.move(hollow().x, hollow().y);
    const shown = await until(() => state(page), x => !!x.tip && names(C.test, x.live, clocks));
    await page.keyboard.press("Escape");
    const one = await until(() => state(page), x => !x.tip && !x.mark);
    await sleep(300);
    const still = await state(page);
    await page.keyboard.press("Escape");
    const two = await until(() => state(page), x => !x.sheet.open);
    line("a pointer's tooltip with the focus on another control: Escape ends the reading and the sheet stays open; a second Escape closes it",
      !!shown.tip && !one.tip && !one.mark && sessionOpen(still) && !two.sheet.open,
      `${shown.tip ? "shown" : "never shown"}; one Escape: ${one.tip ? "tooltip" : "no tooltip"}, sheet ${still.sheet.open ? "open" : "CLOSED"}; two: sheet ${two.sheet.open ? "OPEN" : "closed"}`);
    // Opened again with the figures cached, in the same page (the history the router listens to), then the same keys.
    const reopen = async () => {
      await ev(page, p => { history.pushState(null, "", p); dispatchEvent(new PopStateEvent("popstate")); }, PATH);
      await until(() => ev(page, () => window.sp.drawing().spans.length), k => k === N);
      await chart(page).scrollIntoViewIfNeeded();
    };
    await reopen();
    await aligned(page, "opened again, the figures and the chunk cached");
    await chart(page).focus();
    await page.keyboard.press("ArrowRight");
    const keyed = await until(() => state(page), x => !!x.tip && names(LANES[0][0], x.live, clocks));
    await page.keyboard.press("Escape");
    const k1 = await until(() => state(page), x => !x.tip && !x.mark);
    await sleep(300);
    const k1b = await state(page);
    await page.keyboard.press("Escape");
    const k2 = await until(() => state(page), x => !x.sheet.open);
    line("a key's reading on the focused chart: Escape ends it and the sheet stays open; a second Escape closes it",
      !!keyed.tip && !k1.tip && !k1.live && sessionOpen(k1b) && !k2.sheet.open, `${keyed.tip ? "read" : "not read"}; one: sheet ${k1b.sheet.open ? "open" : "CLOSED"}; two: ${k2.sheet.open ? "OPEN" : "closed"}`);
    await reopen();
    await chart(page).focus();
    await page.keyboard.press("ArrowRight");
    const keyed2 = await until(() => state(page), x => !!x.tip);
    await ev(page, () => { window.__esc = []; addEventListener("keydown", e => { if (e.key === "Escape") window.__esc.push(e.defaultPrevented); }); });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    const quick = await until(() => state(page), x => !x.sheet.open), esc = await ev(page, () => window.__esc);
    line("two quick Escapes on a key's reading: the first ends it (prevented), the second closes the sheet", !!keyed2.tip && !quick.sheet.open && esc.join() === "true,false",
      `${keyed2.tip ? "read" : "not read"}; prevented ${JSON.stringify(esc)}; sheet ${quick.sheet.open ? "OPEN" : "closed"}`);
    // The command palette over a pointer's reading: one Escape closes the palette, and the sheet stays.
    await reopen();
    dr = await ev(page, () => window.sp.drawing());
    await page.mouse.move(hollow().x, hollow().y);
    const rest = await until(() => state(page), x => !!x.tip);
    const mac = await ev(page, () => /mac/i.test(navigator.userAgentData?.platform || navigator.platform));
    await page.keyboard.press(mac ? "Meta+k" : "Control+k");
    const pal = () => ev(page, () => !!document.querySelector("dialog.palette[open]"));
    const opened = await until(pal);
    await page.keyboard.press("Escape");
    const shut = await until(pal, x => !x);
    await sleep(300);
    const s = await state(page);
    line("the command palette over a pointer's reading: one Escape closes the palette, and the sheet stays open", !!rest.tip && opened && !shut && sessionOpen(s),
      `${rest.tip ? "read" : "not read"}; palette ${opened ? "opened" : "never opened"} by ${mac ? "Meta" : "Control"}+K, then ${shut ? "OPEN" : "closed"}; sheet ${s.sheet.open ? "open" : "CLOSED"}, the reading ${s.tip ? "kept" : "ended"}`);
    await page.done();
  }

  // ---------- the alignment: Wide both ways, opened from another page, the scrollbar ----------
  {
    const page = await open("wide");
    await page.locator("dialog.sheet[open] .sheet-wide").click();
    const wide = await until(() => ev(page, () => window.sp.sheet()), x => x.w > 700);
    await aligned(page, `the Wide sheet (${px(wide.w)}px)`);
    await shot(page, "wide");
    await page.locator("dialog.sheet[open] .sheet-wide").click();
    const narrow = await until(() => ev(page, () => window.sp.sheet()), x => x.w < 700);
    await aligned(page, `back from Wide (${px(narrow.w)}px)`);
    // From another page that fetched the session: the history the router listens to.
    await ev(page, () => { history.pushState(null, "", "/cost?range=30&session=demo-spans"); dispatchEvent(new PopStateEvent("popstate")); });
    await until(() => ev(page, () => location.pathname === "/cost" && window.sp.drawing().spans.length), k => k === N);
    await aligned(page, "opened on Cost with the figures cached");
    await page.done();
  }

  // ---------- a classic scrollbar: the sheet's comes and goes; the tooltip brings none ----------
  // The harness's browser hides scrollbars (Playwright's headless default), so they take no room: this block starts its
  // own, with them, for its pages only, and closes it before the next block. Run after the phone's pages, which find the
  // 343px box's window.
  const classicChecks = async () => {
    const b = await chromium.launch({ executablePath: process.env.CHROMIUM, ignoreDefaultArgs: ["--hide-scrollbars"] });
    const errors = [];
    const classic = async (name, { answer = null, width = W, init = null } = {}) => {
      const ctx = await b.newContext({ viewport: { width, height: 900 }, locale: LOCALE, colorScheme: "light", reducedMotion: "reduce" });
      const page = await ctx.newPage();
      page.on("pageerror", e => errors.push(`${name}: ${e.message}`));
      page.on("console", m => { if (m.type() === "error") errors.push(`${name}: ${m.text()}`); });
      await page.addInitScript(spanReaders);
      // On macOS the shell's scrollbars overlay the content even then; a styled one takes its room, as on Windows.
      await page.addInitScript(() => addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "dialog.sheet::-webkit-scrollbar { width: 15px } dialog.sheet::-webkit-scrollbar-thumb { background: #888 }";
        document.head.append(s);
      }));
      if (init) await page.addInitScript(init);
      if (answer) await page.route(DATA, r => h.answer(r, answer));
      await page.goto(`${h.BASE}${PATH}`);
      await page.waitForFunction(() => document.querySelector("dialog.sheet[open] #session-spans .echart-plot svg path"), null, { timeout: 15000 });
      await until(() => page.evaluate(() => window.sp.drawing().spans.length), k => k > 0);
      return { page, ctx };
    };
    try {
      {
        const { page, ctx } = await classic("scrollbar");
        const bar0 = (await ev(page, () => window.sp.sheet())).bar;
        // A window as tall as the sheet's content: no scrollbar; the data table opened with every row brings it; closed,
        // it goes.
        const tall = await ev(page, () => document.querySelector("dialog.sheet[open]").scrollHeight);
        await page.setViewportSize({ width: W, height: tall + 40 });
        const none = await until(() => ev(page, () => window.sp.sheet()), x => x.bar === 0);
        await aligned(page, `a classic ${bar0}px scrollbar, none in a ${tall + 40}px window (${none.bar}px)`);
        await page.locator("dialog.sheet[open] .spans .chart-table > button").click();
        await page.locator("dialog.sheet[open] .spans .chart-table button.linkish.small").click();
        const some = await until(() => ev(page, () => window.sp.sheet()), x => x.bar > 0);
        await aligned(page, `the scrollbar there (${some.bar}px), the data table open with every row`);
        await page.locator("dialog.sheet[open] .spans .chart-table > button").click();
        const gone = await until(() => ev(page, () => window.sp.sheet()), x => x.bar === 0);
        await aligned(page, `the scrollbar gone again (${gone.bar}px)`);
        line("a classic scrollbar takes room in the sheet, and comes and goes with the data table", bar0 > 0 && none.bar === 0 && some.bar > 0 && gone.bar === 0,
          `${bar0}px at 900px; ${none.bar}, ${some.bar}, ${gone.bar}px`);
        await ctx.close();
      }
      for (const big of [false, true]) {
        // The 343px box with the scrollbar there; then a window as tall as the sheet, where a tooltip that grew the sheet
        // would bring one in and narrow the chart.
        let { page, ctx } = await classic(`343px ${big ? 32 : 16}px`, { answer: bigAnswer, width: NARROW, init: big ? root32 : null });
        const w = (await ev(page, () => window.sp.widths())).spans;
        await ctx.close();
        ({ page, ctx } = await classic(`343px ${big ? 32 : 16}px`, { answer: bigAnswer, width: NARROW + 343 - w, init: big ? root32 : null }));
        const tall = await ev(page, () => document.querySelector("dialog.sheet[open]").scrollHeight);
        const got = [];
        for (const height of [900, tall + 40]) {
          await page.setViewportSize({ width: NARROW + 343 - w, height });
          await until(() => ev(page, () => window.sp.sheet()), x => (height === 900 ? x.bar > 0 : x.bar === 0));
          await chart(page).scrollIntoViewIfNeeded();
          const w0 = await ev(page, () => ({ ...window.sp.widths(), bar: window.sp.sheet().bar }));
          await chart(page).focus();
          await page.keyboard.press("Home");
          const s = await until(() => state(page), x => !!x.tip && x.live.startsWith(MCP));
          await sleep(200);
          const w1 = await ev(page, () => ({ ...window.sp.widths(), bar: window.sp.sheet().bar }));
          got.push({ height, s, w0, w1 });
          await page.keyboard.press("Escape");
        }
        line(`a ${got[0].w0.spans}px box at ${big ? 32 : 16}px text with a classic scrollbar, and in a window with none: the tooltip of the long tool name and input shows inside the box and brings in no scrollbar, the chart's box keeps its width`,
          got.every(g => g.s.tip && g.s.tip.l >= g.s.box.l - .5 && g.s.tip.r <= g.s.box.r + .5 && g.w1.spans === g.w0.spans && g.w1.bar === g.w0.bar) && got[0].w0.spans === 343,
          got.map(g => `${g.height}px window: scrollbar ${g.w0.bar} then ${g.w1.bar}px, box ${g.w0.spans} then ${g.w1.spans}px, ${g.s.tip ? `tooltip ${px(g.s.tip.l - g.s.box.l)}..${px(g.s.tip.r - g.s.box.l)}` : "no tooltip"}`).join("; "));
        await ctx.close();
      }
    } finally {
      await b.close();
    }
    line("the classic scrollbar's pages log no console error or page error", !errors.length, errors.slice(0, 3).join("; "));
  };

  // ---------- a phone: the window, the 343px box, 16px and 32px text ----------
  let NARROW = PHONE;
  {
    const page = await open("375px", { options: { viewport: { width: 375, height: 800 } } });
    const g = await ev(page, () => ({ s: window.sp.sheet(), b: window.sp.box(), w: window.sp.widths(), doc: document.documentElement.scrollWidth, win: innerWidth }));
    line("a 375px window: neither the page nor the sheet scrolls sideways, and the chart's box lies inside the sheet", g.s.sw <= g.s.cw && g.doc <= g.win && g.b.l >= g.s.l - .5 && g.b.r <= g.s.r + .5,
      `the page ${g.doc} of ${g.win}px, the sheet ${g.s.sw} of ${g.s.cw}px, the box ${px(g.b.l - g.s.l)}..${px(g.b.r - g.s.l)}`);
    // The window whose chart box is 343px wide.
    NARROW = 375 + 343 - g.w.spans;
    await page.done();
  }
  {
    const page = await open("1280px 32px", { options: { viewport: { width: 1280, height: 900 } }, init: root32 });
    const g = await ev(page, () => ({ s: window.sp.sheet(), b: window.sp.box(), doc: document.documentElement.scrollWidth, win: innerWidth }));
    line("1280px at 32px text: the sheet does not scroll sideways, and the chart's box lies inside it and the window", g.s.sw <= g.s.cw && g.b.l >= g.s.l - .5 && g.b.r <= g.s.r + .5 && g.b.r <= g.win,
      `the sheet ${g.s.sw} of ${g.s.cw}px, the box ${px(g.b.l)}..${px(g.b.r)} in ${px(g.s.l)}..${px(g.s.r)}; the page behind ${g.doc} of ${g.win}px (its nav, known)`);
    await aligned(page, "32px text at 1280px");
    await shot(page, "32px");
    await page.done();
  }
  // A 120-character input and a 60-character tool name, on the call read first; the store's longest are shorter.
  const BIG = "npm run test:e2e -- --project=chromium --grep @checkout --retries=2 --reporter=line --workers=4 --trace=retain-on-failure".slice(0, 120);
  const MCP = "mcp__browser-automation-server__browser_take_full_screenshot";
  const bigAnswer = d => { d.calls = d.calls.map(c => (c.id === LANES[0][0].id ? { ...c, tool: MCP, input: BIG } : c)); return d; };
  /** The open sheet's scroll width, client width, and the element reaching farthest right that the sheet scrolls to (none
   *  of its ancestors in the sheet clips it), named by its selector and its parent's, with its width. */
  const sheetFit = page => ev(page, () => {
    const d = document.querySelector("dialog.sheet[open]"), l = d.getBoundingClientRect().left;
    const name = e => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ""}${[...e.classList].map(c => `.${c}`).join("")}`;
    const clipped = e => { for (let a = e.parentElement; a && a !== d; a = a.parentElement) if (getComputedStyle(a).overflowX !== "visible") return true; return false; };
    let far = null;
    for (const e of d.querySelectorAll("*")) {
      const r = e.getBoundingClientRect();
      if ((!far || r.right > far.r) && !clipped(e)) far = { r: r.right, e, w: r.width };
    }
    return { sw: d.scrollWidth, cw: d.clientWidth, widest: far ? `${name(far.e.parentElement)} > ${name(far.e)} "${far.e.textContent.slice(0, 24)}", ${Math.round(far.w)}px wide to ${Math.round(far.r - l)}px` : "none" };
  });
  /** The same sheet in a 343px box without this section: its chunk's request blocked, the section shows its one line. */
  const bareSheet = async big => {
    const page = await h.open({ path: "/usage?range=30", root: ROOT, setup: spanReaders, ready: p => p.waitForFunction(() => document.querySelector(".echart-plot svg path"), null, { timeout: 15000 }) },
      `spans bare ${big ? 32 : 16}px`, { viewport: { width: NARROW, height: 900 } }, big ? root32 : null);
    await page.route(/\/SessionSpans-[^/]*\.js$/, r => r.abort("blockedbyclient"));
    await ev(page, p => { history.pushState(null, "", p); dispatchEvent(new PopStateEvent("popstate")); }, PATH);
    await until(() => ev(page, () => [...(document.querySelector("dialog.sheet[open]")?.querySelectorAll("p, div") ?? [])].some(e => e.textContent === "The tool-call chart could not be loaded. Reload the page to try again.")), x => x);
    const fit = await sheetFit(page);
    await page.done(e => /Failed to load resource|SessionSpans/.test(e));
    return fit;
  };
  for (const big of [false, true]) {
    const page = await open(`343px ${big ? 32 : 16}px`, { options: { viewport: { width: NARROW, height: 900 } }, init: big ? root32 : null });
    const what = `a ${(await ev(page, () => window.sp.widths())).spans}px box at ${big ? 32 : 16}px text`;
    await aligned(page, what);
    const { dr, b } = await ev(page, () => ({ dr: window.sp.drawing(), b: window.sp.box() }));
    // The lane labels: every text but the two times, which end the box. A label's em box: its width by its size, around
    // its middle (its line box holds the font's ascent and descent beyond the glyphs).
    const labels = dr.texts.filter(t => !/\d:\d\d/.test(t.text)).map(t => ({ ...t, t: (t.t + t.b - t.size) / 2, b: (t.t + t.b + t.size) / 2 }));
    const out = labels.filter(t => t.l < b.l - .5 || t.r > b.r + .5 || t.t < b.t - .5);
    const hit = labels.flatMap(t => [...dr.spans.filter(sp => sp.box.l < t.r && t.l < sp.box.r && sp.box.t < t.b && t.t < sp.box.b).map(() => `"${t.text}" on a span`),
      ...labels.filter(u => u !== t && u.l < t.r && t.l < u.r && u.t < t.b && t.t < u.b).map(u => `"${t.text}" on "${u.text}"`)]);
    line(`${what}: no lane label leaves the box or overlaps a span or another label`, labels.length === LANES.length && !out.length && !hit.length,
      [...out.map(t => `"${t.text}" out at ${px(t.l - b.l)}..${px(t.r - b.l)}`), ...hit].slice(0, 4).join("; ") || `${labels.map(t => `"${t.text}"`).join(", ")} at ${labels[0] ? px(labels[0].size) : "?"}px`);
    await shot(page, big ? "343px-32px" : "343px");
    // The tooltip for the store's longest input, by the pointer and by the keys: shown, inside the box, wrapped, and the
    // section's width kept.
    const clocks = await clocksOf(page), w0 = (await ev(page, () => window.sp.widths())).spans;
    await chart(page).focus();
    const k = LANES[0].indexOf(LONGEST);
    await page.keyboard.press("Home");
    for (let i = 0; i < k; i++) await page.keyboard.press("ArrowRight");
    const s = await until(() => state(page), x => !!x.tip && names(LONGEST, x.live, clocks));
    const w1 = (await ev(page, () => window.sp.widths())).spans;
    line(`${what}: the tooltip of the longest input (${LONGEST.input.length} characters, ${LONGEST.tool}; the longest tool name ${toolLen}) is shown, wrapped, inside the box`,
      !!s.tip && s.tip.l >= s.box.l - .5 && s.tip.r <= s.box.r + .5 && s.tip.spill <= 1 && s.tip.lines[1] > 1 && w1 === w0,
      s.tip ? `tooltip ${px(s.tip.l - s.box.l)}..${px(s.tip.r - s.box.l)} of ${px(s.box.w)}, the input on ${s.tip.lines[1]} lines; ${w1}px after` : "no tooltip");
    await page.keyboard.press("Escape");
    await page.done();
  }
  for (const big of [false, true]) {
    const page = await open(`343px ${big ? 32 : 16}px long names`, { answer: bigAnswer, options: { viewport: { width: NARROW, height: 900 } }, init: big ? root32 : null });
    const what = `a ${(await ev(page, () => window.sp.widths())).spans}px box at ${big ? 32 : 16}px text`;
    const w0 = (await ev(page, () => window.sp.widths())).spans, dr = await ev(page, () => window.sp.drawing());
    const first = dr.spans.filter(x => x.box.t < Math.min(...dr.spans.map(y => y.box.t)) + 3).sort((x, y) => x.start - y.start)[0];
    const got = [];
    await chart(page).focus();
    await page.keyboard.press("Home");
    got.push(await until(() => state(page), x => !!x.tip && x.live.startsWith(MCP)));
    await page.keyboard.press("Escape");
    await ev(page, () => document.activeElement?.blur());
    await page.mouse.move(first.x, first.y);
    got.push(await until(() => state(page), x => !!x.tip && x.live.startsWith(MCP)));
    const w1 = (await ev(page, () => window.sp.widths())).spans;
    line(`${what}: the tooltip of a ${BIG.length}-character input and a ${MCP.length}-character tool name, by a key and by the pointer, is shown, both wrapped, inside the box`,
      got.every(s => s.tip && s.tip.l >= s.box.l - .5 && s.tip.r <= s.box.r + .5 && s.tip.spill <= 1 && s.tip.lines[0] > 1 && s.tip.lines[1] > 1) && w1 === w0,
      got.map(s => (s.tip ? `${px(s.tip.l - s.box.l)}..${px(s.tip.r - s.box.l)} of ${px(s.box.w)}, the name on ${s.tip.lines[0]} lines and the input on ${s.tip.lines[1]}` : "no tooltip")).join("; ") + `; ${w1}px after`);
    // The data table, opened with every row: six columns do not fit 343px, so the table scrolls sideways in its own region
    // and the sheet's scroll width stays what it is with the table closed. The long tool name keeps its column at least
    // 8ch wide (at most 12 lines at 16px text), and no cell's text is cut.
    await away(page);
    const closed = await sheetFit(page);
    await page.locator("dialog.sheet[open] .spans .chart-table > button").click();
    await page.locator("dialog.sheet[open] .spans .chart-table button.linkish.small").click();
    const t = await until(() => ev(page, m => {
      const b = [...document.querySelectorAll("dialog.sheet[open] .spans table button.cellbtn")].find(x => x.textContent === m);
      if (!b) return null;
      const d = document.querySelector("dialog.sheet[open]"), table = b.closest("table"), r = table.closest("[role=region]"), td = b.closest("td");
      const ch = document.createElement("span");
      ch.style.cssText = "display:inline-block;width:8ch";
      td.append(ch);
      const eight = ch.getBoundingClientRect().width;
      ch.remove();
      const cells = [...table.querySelectorAll("th, td, .cellbtn")];
      const cut = cells.filter(e => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1 || getComputedStyle(e).textOverflow === "ellipsis" && e.scrollWidth > e.clientWidth);
      return { lines: window.chartfit.lines(b), w: td.getBoundingClientRect().width, eight, rows: table.tBodies[0].rows.length, sw: d.scrollWidth, cw: d.clientWidth,
        region: !!r && getComputedStyle(r).overflowX === "auto" && r.contains(table), tsw: r?.scrollWidth, tcw: r?.clientWidth, cells: cells.length, cut: cut.map(e => e.textContent.slice(0, 20)) };
    }, MCP), x => x && x.lines > 1 && x.rows > 20);
    const bare = await bareSheet(big);
    line(`${what}: the "Calls by duration" table opened with every row scrolls sideways in its own region, not the sheet; the ${MCP.length}-character tool name's cell is at least 8ch wide${big ? "" : " and wraps onto at most 12 lines"}; no cell's text is cut`,
      !!t && t.region && t.sw <= closed.sw && t.w >= t.eight - .5 && t.lines > 1 && (big || t.lines <= 12) && !t.cut.length,
      t ? `the sheet ${t.sw} of ${t.cw}px open, ${closed.sw} of ${closed.cw}px closed (widest ${closed.widest}), ${bare.sw} of ${bare.cw}px without the section (widest ${bare.widest}); the table ${t.tsw} of ${t.tcw}px in its region; the name on ${t.lines} lines in a ${px(t.w)}px cell (8ch ${px(t.eight)}px); ${t.cut.length} of ${t.cells} cells cut${t.cut.length ? `: ${t.cut.slice(0, 3).join(", ")}` : ""}` : "not in the table");
    await page.done();
  }

  await classicChecks();

  // ---------- a tick drawn over a bar: two calls more on a full main thread ----------
  {
    const tmpl = LANES[0][0];
    const extra = d => {
      d.calls = [...d.calls,
        { ...tmpl, id: "chartfit-bar", tool: "Bash", input: "sleep 240", start_ts: new Date(T0 + 2 * 60e3).toISOString(), end_ts: new Date(T0 + 6 * 60e3).toISOString(), is_error: false },
        { ...tmpl, id: "chartfit-tick", tool: "Read", input: "src/tick.ts", start_ts: new Date(T0 + 4 * 60e3).toISOString(), end_ts: new Date(T0 + 4 * 60e3).toISOString(), is_error: false }];
      return d;
    };
    const page = await open("a tick over a bar", { answer: extra });
    const dr = await ev(page, () => window.sp.drawing()), still = dr.spans.filter(x => x.kind === "still");
    const under = still[0] && dr.spans.find(x => x.kind === "ok" && x.box.l < still[0].x && x.box.r > still[0].x && Math.abs(x.box.t - still[0].box.t) < .5);
    const clocks = await clocksOf(page), notes = await ev(page, () => [...document.querySelectorAll("dialog.sheet[open] .spans-note")].map(p => p.textContent));
    if (still[0]) await page.mouse.move(still[0].x, still[0].y);
    const s = await until(() => state(page), x => !!x.tip);
    const tick = { ...tmpl, id: "chartfit-tick", tool: "Read", input: "src/tick.ts", start_ts: new Date(T0 + 4 * 60e3).toISOString() };
    clocks["chartfit-tick"] = await ev(page, t => new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }), T0 + 4 * 60e3);
    line("a call with no duration drawn over a bar on the main thread's last row: the pointer on it reads the tick, not the bar",
      still.length === 1 && !!under && names(tick, s.live, clocks) && notes.some(n => n.includes("on the main thread and is drawn over its last row")),
      `${still.length} tick, ${under ? "over a bar" : "on no bar"}; said "${s.live}"; notes ${JSON.stringify(notes)}`);
    await page.done();
  }

  // ---------- a touch tap reads the call and opens its tool at once ----------
  {
    const page = await open("touch", { options: { viewport: { width: NARROW, height: 900 }, hasTouch: true } });
    const dr = await ev(page, () => window.sp.drawing()), hollow = dr.spans.find(x => x.kind === "hollow"), clocks = await clocksOf(page);
    await ev(page, () => window.sp.listen());
    await page.touchscreen.tap(hollow.x, hollow.y);
    const s = await until(() => state(page), x => new URLSearchParams(x.url).get("tool") === "Bash");
    const said = await ev(page, () => window.__said);
    // The tap's mouse move reads the call and its click opens it in the same moment: the sentence may never be drawn.
    line("a touch tap on the test run opens Bash's sheet at once, in place of the session's (the accepted behaviour, as the other graphs)",
      new URLSearchParams(s.url).get("tool") === "Bash" && !new URLSearchParams(s.url).get("session") && s.sheet.open,
      `${s.url}; said before it ${said.length ? JSON.stringify(said.map(t => t.slice(0, 40))) : "nothing"}${said.some(t => names(C.test, t, clocks)) ? " (the test run)" : ""}`);
    await page.done();
  }

  // ---------- loading: a blocked chunk, Live's ECharts chunk, the move of what is under the section ----------
  {
    // The page first, with no sheet: the chunk is requested only once a sheet opens (above), then blocked.
    const page = await h.open({ path: "/usage?range=30", root: ROOT, setup: spanReaders, ready: p => p.waitForFunction(() => document.querySelector(".echart-plot svg path"), null, { timeout: 15000 }) }, "spans blocked chunk");
    await page.route(/\/SessionSpans-[^/]*\.js$/, r => r.abort("blockedbyclient"));
    await ev(page, p => { history.pushState(null, "", p); dispatchEvent(new PopStateEvent("popstate")); }, PATH);
    const got = await until(() => ev(page, () => {
      const d = document.querySelector("dialog.sheet[open]");
      return { line: [...d.querySelectorAll("p, div")].map(e => e.textContent).find(t => t === "The tool-call chart could not be loaded. Reload the page to try again.") ?? null,
        tl: !!d.querySelector("div.tl svg"), models: [...d.querySelectorAll("summary")].some(s => s.textContent.startsWith("Models")), spans: !!d.querySelector("#session-spans") };
    }), x => x.line);
    line("with the chunk's request blocked, the section says it could not be loaded, and the timeline and the Models block show", !!got.line && got.tl && got.models && !got.spans,
      `${got.line ? "the line shown" : "no line"}, timeline ${got.tl ? "shown" : "missing"}, Models ${got.models ? "shown" : "missing"}`);
    await page.done(e => /Failed to load resource|SessionSpans/.test(e));
  }
  {
    const echarts = () => performance.getEntriesByType("resource").filter(e => /\/echarts-[^/]*\.js$/.test(e.name)).map(e => e.encodedBodySize || e.transferSize);
    const page = await h.open({ path: "/live", root: ROOT, setup: spanReaders, ready: p => p.waitForFunction(() => document.querySelector("main h1, h1")) }, "spans live");
    await sleep(800);
    const before = await ev(page, echarts);
    // On Live a session's sheet is the URL's sheet key.
    const drawn = [];
    for (let i = 0; i < 2; i++) {
      await ev(page, p => { history.pushState(null, "", p); dispatchEvent(new PopStateEvent("popstate")); }, `/live?sheet=${SID}`);
      drawn.push(await until(() => ev(page, () => window.sp.drawing().spans.length), k => k === N));
      await page.keyboard.press("Escape");
      await until(() => ev(page, () => window.sp.sheet().open), o => !o);
    }
    const after = await ev(page, echarts);
    line("Live: opening the sheet twice loads the ECharts chunk once", before.length === 0 && after.length === 1 && drawn.every(k => k === N),
      `${before.length} before, ${after.length} after, ${after[0] ?? 0} bytes; ${drawn.join(" and ")} spans drawn`);
    await page.done();
  }
  {
    // The figures there before the chunk: its request held back 1s, the Models block's top watched on every frame.
    const watch = () => {
      window.__tops = [];
      const f = () => {
        const s = [...document.querySelectorAll("dialog.sheet[open] summary")].find(x => x.textContent.startsWith("Models"));
        if (s) { const t = Math.round(s.getBoundingClientRect().top + document.querySelector("dialog.sheet[open]").scrollTop); if (t !== window.__tops.at(-1)) window.__tops.push(t); }
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    };
    const page = await h.open({ path: "/usage?range=30", root: ROOT, setup: spanReaders, ready: p => p.waitForFunction(() => document.querySelector(".echart-plot svg path"), null, { timeout: 15000 }) }, "spans move", {}, watch);
    await page.route(/\/SessionSpans-[^/]*\.js$/, async r => { await sleep(1000); await r.continue().catch(() => {}); });
    await ev(page, p => { history.pushState(null, "", p); dispatchEvent(new PopStateEvent("popstate")); }, PATH);
    await until(() => ev(page, () => window.sp.drawing().spans.length), k => k === N);
    await sleep(300);
    const tops = await ev(page, () => window.__tops);
    line("the figures there before the chunk: the Models block moves once, as the section appears", tops.length === 2, `its top ${tops.join(" then ")}: ${tops.length === 2 ? `${tops[1] - tops[0]}px down` : `${tops.length} places`}`);
    await page.done();
  }

  // ---------- colors: forced colors, dark and an OS flip; motion ----------
  {
    const page = await open("forced colors", { options: { forcedColors: "active" } });
    await chart(page).focus();
    await page.keyboard.press("ArrowRight");
    await until(() => state(page), x => !!x.mark);
    const got = await ev(page, () => ({ dr: window.sp.drawing(), mark: window.sp.mark(), sys: Object.fromEntries(["CanvasText", "Canvas", "GrayText", "Highlight"].map(c => [c, window.sp.probe(c)])),
      keys: [...document.querySelectorAll("dialog.sheet[open] .spans-key i")].map(i => { const s = getComputedStyle(i); return { k: i.className, top: window.sp.tri(s.borderTopColor), left: window.sp.tri(s.borderLeftColor), width: s.borderTopWidth }; }) }));
    const { CanvasText: ct, Canvas: cv, GrayText: gt, Highlight: hl } = got.sys, sys = [ct, cv, gt, hl], u = xs => [...new Set(xs)].map(c => `rgb(${c})`).join(", ");
    const paints = got.dr.spans.flatMap(x => [x.fill, x.stroke].filter(c => c && c !== "none"));
    line("forced colors: the spans, the rings and the labels CanvasText (a failure's fill Canvas), the breaks GrayText", paints.length > 0 && paints.every(c => c === ct || c === cv)
      && got.dr.spans.filter(x => x.kind === "ring").every(x => x.stroke === ct) && got.dr.texts.every(t => t.fill === ct) && got.dr.bands.every(x => x.fill === gt) && got.dr.zig.every(x => x.stroke === gt),
      `CanvasText rgb(${ct}); spans ${u(paints)}; labels ${u(got.dr.texts.map(t => t.fill))}; bands ${u(got.dr.bands.map(x => x.fill))}, GrayText rgb(${gt})`);
    line("forced colors: the mark is Highlight, and the key's three swatches are system colors", got.mark?.stroke === hl && got.keys.length === 3 && got.keys.every(k => sys.includes(k.top) && sys.includes(k.left)),
      `mark rgb(${got.mark?.stroke}), Highlight rgb(${hl}); ${got.keys.map(k => `${k.k} rgb(${k.top})/rgb(${k.left})`).join(", ")}`);
    await shot(page, "forced-colors");
    await page.done();
  }
  {
    const page = await open("dark", { options: { colorScheme: "dark" } });
    await ev(page, () => { window.__kept = true; });
    const colors = () => ev(page, () => ({ bar: window.sp.drawing().spans.find(x => x.kind === "ok")?.fill, series: window.sp.probe("var(--series-1)"), mark: window.sp.mark(),
      surface: window.sp.tri(getComputedStyle(document.querySelector("dialog.sheet[open]")).backgroundColor) }));
    await chart(page).focus();
    await page.keyboard.press("ArrowRight");
    const dark = await until(colors, c => c.mark && c.bar === c.series);
    const contrast = (x, y) => {
      const lum = t => t.split(",").map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
      const [p, q] = [lum(x), lum(y)].sort((m, n) => n - m);
      return (p + .05) / (q + .05);
    };
    const cr = dark.mark ? contrast(dark.mark.stroke, dark.surface) : 0;
    line("dark: the bars in the dark --series-1, the mark against the sheet's surface at 3:1 or more", dark.bar === dark.series && cr >= 3,
      `bars rgb(${dark.bar}); mark rgb(${dark.mark?.stroke}) on rgb(${dark.surface}), ${cr.toFixed(1)}:1`);
    await shot(page, "dark");
    await page.emulateMedia({ colorScheme: "light" });
    const light = await until(colors, c => c.bar === c.series && c.bar !== dark.bar);
    await page.emulateMedia({ colorScheme: "dark" });
    const back = await until(colors, c => c.bar === dark.bar);
    const kept = await ev(page, () => window.__kept === true);
    line("an OS flip to light and back redraws the bars in each scheme's color, with no reload", light.bar !== dark.bar && light.bar === light.series && back.bar === dark.bar && kept,
      `dark rgb(${dark.bar}), light rgb(${light.bar}), dark rgb(${back.bar}); ${kept ? "no reload" : "RELOADED"}`);
    await page.done();
  }
  {
    const page = await open("motion", { options: { reducedMotion: "no-preference" }, init: watchDrawings });
    await sleep(1000);
    const first = await ev(page, () => window.__drawings.length);
    line("with motion on, the chart draws at once: one drawing, no frame between", first === 1, `${first} drawings`);
    await page.done();
  }

  // ---------- newer figures keep the call read with the keys, and say nothing ----------
  {
    const page = await open("newer figures");
    let change = null;
    await page.route(DATA, r => h.answer(r, d => (change ? change(d) : d)));
    await page.route(/\/api\/status/, r => h.answer(r, s => (change ? { ...s, last_change: "chartfit spans" } : s)));
    const clocks = await clocksOf(page);
    await chart(page).focus();
    await page.keyboard.press("ArrowRight");
    await until(() => state(page), x => !!x.tip && names(LANES[0][0], x.live, clocks));
    await ev(page, () => window.sp.listen());
    // The ring of the call not told apart is gone: its lane too; the call read is far from it.
    change = d => { d.calls = d.calls.filter(c => c.id !== C.apart.id); return d; };
    await ev(page, () => window.dispatchEvent(new Event("visibilitychange")));
    const n = await until(() => ev(page, () => window.sp.drawing().spans.length), k => k === N - 1);
    await sleep(400);
    const dr = await ev(page, () => window.sp.drawing()), s = await state(page), said = await ev(page, () => window.__said);
    line("newer figures (a window focus) keep the call read with the keys on its drawn span, and say nothing", n === N - 1 && !!s.tip && names(LANES[0][0], s.live, clocks) && !!marked(s, dr) && !said.length,
      `${n} spans; ${s.tip ? "tooltip" : "no tooltip"}, ${marked(s, dr) ? "the mark on its span" : "no mark on a span"}, said ${JSON.stringify(said)}`);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.done();
  }
}
