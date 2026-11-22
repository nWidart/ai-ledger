// The Project page's "Sessions by cost and tool calls" on /project?project=atlas-api&range=30: one dot per session, drawn by
// ECharts, read by the graph's own keys, pointer, tooltip, mark and live region (the wrapper reads nothing). Its own checks,
// each its own line; what a case needs that the demo store lacks is put in the usage answer, and every count a check expects
// comes from that answer, never from the drawing:
// - layout: the block sits in the right column after Sessions at 1440px; no sideways page scroll at a 375px window; at a
//   1280px window with a 32px root nothing of the block reaches past the window; the hint's lines at 1440px;
// - the dots drawn are the answer's sessions with a known cost, filled for a commit and hollow without, each at its cost and
//   tool calls on the drawn axes within 1px (the axes read from their tick labels' anchors); the dashed guides sit at the
//   medians' pixels;
// - the axes at 16px and 32px text, in a 343px box and at 1440px, with a session at $0, one at 0 tool calls and one at four
//   digits: the cost labels in dollars, the zero lanes' "$0" and "0" both drawn, the four-digit tool calls inside the left
//   margin, no label overlapping another (a tool-call label beside the rotated name anywhere along it) or leaving the
//   box, both axis names drawn; the same with a session at 400,000 tool calls and one at $4,000, the axes' last labels
//   ("500,000" and "$5,000") drawn at 1440px;
// - names in a 343px box: a 300-character title with no space and a right-to-left one whole in the tooltip, beside the dot
//   and inside the box; a session with no title, start, project, branch or model reads "started –", with no "Invalid
//   Date", NaN or page error; the data table, open, with the long title does not make the page scroll sideways;
// - the corner names: each drawn one inside its quadrant, its 3px surface halo painted under its fill (paint-order), and the
//   list under the plot names all four with counts adding up to the dots;
// - the guides, the corner names and the list are gone with one or two sessions, and the "too few" line says so; the "newest
//   300 of N" line with more sessions in the totals than rows; sessions with no known cost left out and counted; with the
//   newest all unpriced and more in the totals, the block names the sample and the "newest" line no median; three sessions
//   at 0 tool calls: no corner name across a guide, all four in the list; a session at $1e-126: no page error, every dot
//   inside the plot, the cost axis in powers of ten, its tooltip "<$0.01";
// - Right, Left, Home and End read the dots cheapest to costliest; at each one the tooltip shows, beside the dot and inside
//   the box, and names its session (by title where the store has one), the mark sits on the drawn dot within 1px and the
//   live region names it; Up and Down leave the reading alone and are the page's;
// - the pointer reads the nearest dot within its 12px radius and nothing farther; over a pile the tooltip says how many
//   more and the keys reach each; over two dots at one cost each reads its own; the hand cursor over a dot only; the
//   tooltip at the cheapest and the costliest dot beside the dot and inside the box, at 1440px and in a 343px box;
// - Escape closes a pointer's tooltip the moment it shows and later, with the focus on another control, and a reading on
//   the focused plot;
// - Enter, a click and a touch tap (in the 343px box) open the dot's session sheet with the URL's view kept; the sheet takes
//   the focus; after it closes the focus is back on the plot, nothing was said, and Right goes on from the dot opened;
// - colors: dots in the project's color, filled and hollow, in light, in dark and after an OS flip with no reload; forced
//   colors: dots, guides and labels CanvasText, split lines GrayText, hollow dots Canvas, the mark Highlight;
// - nothing moves with motion on, on the first drawing and on newer figures; nor with reduced motion;
// - newer figures without the session read end the reading (no tooltip, mark or sentence, no page error); newer figures
//   that keep it keep the reading on its dot and say nothing.
import { PHONE, W, line, sleep, until } from "./harness.mjs";
import { root32 } from "./checks.mjs";

const PROJECT = "atlas-api", PATH = `/project?project=${PROJECT}&range=30`, ROOT = "#quadrant", PLOT = "#session-quadrant", DATA = /\/api\/usage\?/;
/** The window whose plot box is 343px wide: the Project page's panels take 16px more of a phone's window than the charts'
 *  pages do (a PHONE window gives a 359px box). */
const NARROW = PHONE - 16;

/** The quadrant's in-page readers, as window.quad, run in every page before its scripts. ECharts' SVG names nothing: the
 *  split lines are unfilled paths with no dash, the guides the dashed paths, the dots the paths drawn as one arc (a hollow
 *  one with a 1.5px ring), the corner names the texts with a halo (a stroke), the axis names the texts that say "log scale"
 *  and the tick labels the other texts. A text's anchor is its x and y through its transform: the tick's own pixel. Colors
 *  are given as drawn (a system color by its name) and as "r,g,b". */
function quadReaders() {
  const q = s => document.querySelector(`#quadrant ${s}`);
  const rect = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 }; };
  const kids = () => [...(q(".echart-plot svg")?.querySelector(":scope > g")?.children ?? [])];
  const a = (e, k) => e.getAttribute(k);
  const arc = e => e.tagName === "path" && /^M-?[\d.]+ -?[\d.]+A([\d.]+) \1 0 1 1 /.test(a(e, "d") ?? "");
  const tri = c => (String(c).match(/[\d.]+/g) || []).slice(0, 3).map(n => Math.round(Number(n))).join(",");
  /** A color as drawn: "r,g,b", or a system color's name as given. */
  const col = c => (c && /^[a-z]+$/i.test(c) && c !== "none" ? c : tri(c));
  window.quad = {
    /** The plot's frame, from the split lines, and their colors; null when none is drawn. */
    frame() {
      const ls = kids().filter(e => e.tagName === "path" && (a(e, "fill") ?? "none") === "none" && !a(e, "stroke-dasharray")).map(e => ({ ...rect(e), stroke: col(a(e, "stroke")) }));
      const v = ls.filter(r => r.h > 1 && r.w < 1), hz = ls.filter(r => r.w > 1 && r.h < 1);
      if (!v.length || !hz.length) return null;
      return { l: Math.min(...v.map(r => r.x)), r: Math.max(...v.map(r => r.x)), t: Math.min(...hz.map(r => r.y)), b: Math.max(...hz.map(r => r.y)), strokes: [...new Set(ls.map(r => r.stroke))] };
    },
    texts: () => kids().filter(e => e.tagName === "text").map(e => {
      const p = new DOMPoint(Number(a(e, "x") ?? 0), Number(a(e, "y") ?? 0)).matrixTransform(e.getScreenCTM());
      return { text: e.textContent, ax: p.x, ay: p.y, fill: col(a(e, "fill")), halo: a(e, "stroke") ? col(a(e, "stroke")) : null, haloWidth: Number(a(e, "stroke-width") ?? 1),
        paintOrder: a(e, "paint-order"), size: parseFloat(getComputedStyle(e).fontSize), ...rect(e) };
    }),
    dots: () => kids().filter(arc).map(e => ({ fill: col(a(e, "fill")), stroke: col(a(e, "stroke")), opacity: Number(a(e, "fill-opacity") ?? 1), hollow: a(e, "stroke-width") === "1.5", ...rect(e) })),
    guides: () => kids().filter(e => e.tagName === "path" && a(e, "stroke-dasharray")).map(e => ({ dash: a(e, "stroke-dasharray"), stroke: col(a(e, "stroke")), ...rect(e) })),
    /** Everything drawn in one string: what a frame of an animation would change. */
    signature: () => kids().map(e => [e.tagName, a(e, "d"), a(e, "transform"), a(e, "opacity"), a(e, "fill-opacity"), a(e, "x"), a(e, "y")].join(" ")).join("|"),
    /** The ring around the dot read: its centre and its stroke as computed. */
    mark: () => { const c = q(".quad-mark circle"); return c ? { stroke: tri(getComputedStyle(c).stroke), ...rect(c) } : null; },
    /** The tooltip, when it shows: displayed and with a size. */
    tip: () => {
      const t = q(".quad-box .tip");
      if (!t || getComputedStyle(t).display === "none" || !t.getBoundingClientRect().width) return null;
      // Text past the tooltip's border: its content wider than its box, or a line of the name wider than the name's box.
      const name = t.querySelector(".tname"), range = document.createRange();
      if (name) range.selectNodeContents(name);
      const spill = Math.max(t.scrollWidth - t.clientWidth, name ? Math.max(0, ...[...range.getClientRects()].map(c => c.right - name.getBoundingClientRect().right)) : 0);
      return { name: name?.textContent ?? "", more: t.querySelector(".muted")?.textContent ?? "", spill, ...rect(t) };
    },
    live: () => q(".quad-live")?.textContent ?? "",
    box: () => rect(q(".quad-box")),
    list: () => [...document.querySelectorAll("#quadrant .quad-list li")].map(li => li.textContent),
    notes: () => [...document.querySelectorAll("#quadrant .quad-note")].map(p => p.textContent),
    cursor: (x, y) => getComputedStyle(document.elementFromPoint(x, y)).cursor,
    /** A text's width in the plot's font at size px and weight 600, as a canvas measures it. */
    measure: (text, size) => {
      const ctx = (window.__ctx ??= document.createElement("canvas").getContext("2d"));
      const label = kids().find(e => e.tagName === "text");
      ctx.font = `600 ${size}px ${label ? getComputedStyle(label).fontFamily : getComputedStyle(document.body).fontFamily}`;
      return ctx.measureText(text).width;
    },
    /** The live region's sentences from now on. */
    listen: () => {
      window.__said = [];
      if (window.__listening) return;
      window.__listening = true;
      new MutationObserver(() => { const t = q(".quad-live").textContent; if (t) window.__said.push(t); }).observe(q(".quad-live"), { childList: true, characterData: true, subtree: true });
    },
  };
}
/** An init script that keeps every distinct drawing, from the first frame on, as window.__drawings. */
function watchDrawings() {
  window.__drawings = [];
  const tick = () => {
    const s = window.quad?.dots().length ? window.quad.signature() : null;
    if (s && s !== window.__drawings.at(-1)) window.__drawings.push(s);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** The answer's dots in reading order: the sessions with a known cost, cheapest first, then by tool calls, start and id. */
const dotsOf = d => d.sessions.filter(r => r.cost != null)
  .sort((a, b) => a.cost - b.cost || a.tool_calls - b.tool_calls || cmp(a.first_ts ?? "", b.first_ts ?? "") || cmp(a.session_id, b.session_id));
const median = xs => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const nameOf = r => r.title || `#${r.session_id.slice(0, 8)}`;
const value = t => Number(t.replace(/[$,]/g, ""));
const px = n => Math.round(n * 10) / 10;
/** The answer d with the sessions of the given ids changed by f. */
const edit = (d, ids, f) => { d.sessions = d.sessions.map(r => (ids.includes(r.session_id) ? f(r) : r)); return d; };

/** Where the drawn axes put a cost and a tool count: through the anchors of their two farthest positive tick labels, both
 *  axes log; a 0 at the zero label's anchor, or at the frame's edge when that label is hidden. Null when an axis has fewer
 *  than two positive labels. */
function axesOf(texts, frame) {
  if (!frame) return null;
  const ticks = texts.filter(t => !t.halo && !/log scale/.test(t.text));
  const xs = ticks.filter(t => t.ay > frame.b + 1), ys = ticks.filter(t => t.ax < frame.l - 1);
  const scale = (ls, k, edge) => {
    const pos = ls.filter(t => value(t.text) > 0).sort((a, b) => value(a.text) - value(b.text)), zero = ls.find(t => value(t.text) === 0);
    if (pos.length < 2) return null;
    const lo = pos[0], hi = pos.at(-1), [vl, vh] = [value(lo.text), value(hi.text)];
    return v => (v <= 0 ? (zero ? zero[k] : edge) : lo[k] + (Math.log(v) - Math.log(vl)) / (Math.log(vh) - Math.log(vl)) * (hi[k] - lo[k]));
  };
  const x = scale(xs, "ax", frame.l), y = scale(ys, "ay", frame.b);
  return x && y ? { x, y, xs, ys } : null;
}
/** The texts that leave the box, and the pairs whose em boxes overlap: a line's em box is its width by its size, a rotated
 *  name's its size by its length, so a tool-call label anywhere beside the rotated name meets it. */
function fitTexts(texts, box) {
  const em = t => (t.h > 2 * t.size ? { ...t, l: t.x - t.size / 2, r: t.x + t.size / 2 } : { ...t, t: t.y - t.size / 2, b: t.y + t.size / 2 });
  const at = t => `"${t.text}" ${Math.round(t.l - box.l)}..${Math.round(t.r - box.l)}x${Math.round(t.t - box.t)}..${Math.round(t.b - box.t)}`;
  const out = texts.filter(t => t.l < box.l - .5 || t.r > box.r + .5 || t.t < box.t - .5 || t.b > box.b + .5).map(at);
  const over = [], ems = texts.map(em);
  ems.forEach((a, i) => ems.slice(i + 1).forEach(c => { if (a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b) over.push(`${at(a)} and ${at(c)}`); }));
  return { out, over };
}

export async function quadrant(h) {
  const base = await h.json(`/api/usage?range=30&project=${PROJECT}`);
  const ROWS = dotsOf(base), N = ROWS.length;
  const ev = (page, f, arg) => page.evaluate(f, arg);
  /** The page, with the usage answer changed by answer, drawn once its axes are and as many dots as the answer has; the
   *  block scrolled into view. A page that draws fewer is kept: its lines say so. */
  const open = async (name, { answer = d => d, options = {}, init = null } = {}) => {
    const want = dotsOf(answer(structuredClone(base))).length;
    return h.open({ path: PATH, root: ROOT, setup: quadReaders, data: DATA, answer,
      ready: async p => {
        await p.waitForFunction(() => document.querySelector("#quadrant .echart-plot svg text") || document.querySelector("#quadrant .quad-box .empty"));
        await until(() => p.evaluate(() => window.quad.dots().length), n => n === want);
        await p.locator(ROOT).scrollIntoViewIfNeeded();
      } }, `quadrant ${name}`, options, init);
  };
  const shot = (page, what) => h.shot(page, ROOT, `quadrant-${what}`);
  const drawing = page => ev(page, () => ({ frame: window.quad.frame(), texts: window.quad.texts(), dots: window.quad.dots(), guides: window.quad.guides(), box: window.quad.box() }));
  const state = page => ev(page, () => ({ tip: window.quad.tip(), mark: window.quad.mark(), live: window.quad.live(), box: window.quad.box(), win: innerWidth }));
  const away = page => page.mouse.move(2, 2);
  const plot = page => page.locator(`${ROOT} ${PLOT}`);
  const theme = async (page, want) => {
    for (let i = 0; i < 3 && (await page.locator("#navTheme").getAttribute("aria-label")) !== `Theme: ${want}`; i++) await page.locator("#navTheme").click();
  };
  /** Answers the usage request with change(payload) applied, and the status with a new change when change is set, so a
   *  window focus (a visibilitychange) makes the page fetch it again, as a background ingest does. */
  const newerOn = async (page, change) => {
    const seen = [];
    await page.route(DATA, route => h.answer(route, d => (change() ? change()(d) : d)));
    await page.route(/\/api\/status/, route => h.answer(route, s => {
      const c = change();
      if (c && !seen.includes(c)) seen.push(c);
      return c ? { ...s, last_change: `chartfit quadrant ${seen.indexOf(c) + 1}` } : s;
    }));
  };

  /** Each answer dot at its pixel on the drawn axes, within 1px of a drawn dot of its kind (filled or hollow). */
  const placed = (dr, rows) => {
    const ax = axesOf(dr.texts, dr.frame);
    if (!ax) return { ax, misses: ["the axes have fewer than two positive labels"], worst: Infinity };
    let worst = 0;
    const misses = [];
    for (const r of rows) {
      const x = ax.x(r.cost), y = ax.y(r.tool_calls);
      const near = dr.dots.filter(d => d.hollow === !(r.commits > 0)).map(d => ({ d, e: Math.hypot(d.x - x, d.y - y) })).sort((p, q) => p.e - q.e)[0];
      const e = near?.e ?? Infinity;
      worst = Math.max(worst, e);
      if (e > 1) misses.push(`${nameOf(r)} ($${r.cost.toFixed(3)}, ${r.tool_calls} calls) at ${px(x - dr.box.l)},${px(y - dr.box.t)}: nearest ${near ? `${px(near.d.x - dr.box.l)},${px(near.d.y - dr.box.t)}` : "none"}`);
    }
    return { ax, misses, worst };
  };
  const placedLine = (dr, rows, what) => {
    const p = placed(dr, rows);
    line(`${what}: each session's dot sits at its cost and tool calls on the drawn axes, within 1px`, !p.misses.length && dr.dots.length === rows.length,
      p.misses.slice(0, 4).join("; ") || `${rows.length} dots, the farthest ${p.worst.toFixed(2)}px off`);
    return p;
  };
  /** The dots line: as many as the answer, filled and hollow as its commits say. */
  const counted = (dr, rows, what) => {
    const filled = rows.filter(r => r.commits > 0).length;
    const got = { all: dr.dots.length, hollow: dr.dots.filter(d => d.hollow).length };
    return line(`${what}: ${rows.length} dots drawn, ${filled} filled for a commit and ${rows.length - filled} hollow`,
      got.all === rows.length && got.hollow === rows.length - filled, `${got.all} drawn, ${got.all - got.hollow} filled, ${got.hollow} hollow`);
  };
  /** The tooltip shows beside the dot at x (never over it) and inside the box. */
  /** Beside the dot: clear of the mark's ring around it, on any side. */
  const beside = s => !!s.tip && !!s.mark && s.tip.spill <= 1 && (s.tip.l >= s.mark.r || s.tip.r <= s.mark.l || s.tip.t >= s.mark.b || s.tip.b <= s.mark.t);
  const besideIn = (s, x) => beside(s, x) && s.tip.l >= s.box.l - .5 && s.tip.r <= s.box.r + .5;
  /** Beside the dot and inside the window: a long name's tooltip may pass the box over a dot in the middle. */
  const besideWin = (s, x) => beside(s, x) && s.tip.l >= 0 && s.tip.r <= s.win;
  const tipAt = s => (s.tip ? `tooltip ${px(s.tip.l - s.box.l)}..${px(s.tip.r - s.box.l)} of ${px(s.box.w)}px${s.tip.spill > 1 ? `, its text ${px(s.tip.spill)}px past its border` : ""}` : "no tooltip");

  /** The reading of page, for the answer's rows (the dots in their order): the pixel of each on the drawn axes, in the box. */
  async function reading(page, rows) {
    const dr = await drawing(page), ax = axesOf(dr.texts, dr.frame);
    const rel = rows.map(r => (ax ? { x: ax.x(r.cost) - dr.box.l, y: ax.y(r.tool_calls) - dr.box.t } : { x: NaN, y: NaN }));
    const drawn = dr.dots.map(d => ({ x: d.x - dr.box.l, y: d.y - dr.box.t }));
    /** Whether the reading is on dot k: the mark on a drawn dot within 1px and at k's pixel, the tooltip and the live
     *  region naming k's session; a line part saying where each is. */
    const on = (s, k) => {
      const m = s.mark && { x: s.mark.x - s.box.l, y: s.mark.y - s.box.t };
      const drawnOff = m && drawn.length ? Math.min(...drawn.map(d => Math.hypot(d.x - m.x, d.y - m.y))) : Infinity;
      const off = m ? Math.hypot(m.x - rel[k].x, m.y - rel[k].y) : Infinity;
      const ok = drawnOff <= 1 && off <= 1 && s.tip?.name === nameOf(rows[k]) && s.live.startsWith(`${nameOf(rows[k])}, started`);
      return { ok, off, drawnOff, at: `dot ${k + 1}: mark ${m ? `${px(m.x)},${px(m.y)}` : "none"} for ${px(rel[k].x)},${px(rel[k].y)}, ${drawnOff.toFixed(2)}px from a drawn dot; tooltip "${s.tip?.name ?? "none"}"; said "${s.live.split(":")[0]}"` };
    };
    // After a dot the reading missed, the next ones are looked at once: a reading that never shows must not take 4s a dot.
    let missing = false;
    const reach = async k => {
      const s = missing ? await sleep(150).then(() => state(page)) : await until(() => state(page), x => on(x, k).ok);
      missing ||= !on(s, k).ok;
      return s;
    };
    /** Moves the pointer to dot k's pixel, off by dx, dy. */
    const point = async (k, dx = 0, dy = 0) => { const b = await ev(page, () => window.quad.box()); await page.mouse.move(b.l + rel[k].x + dx, b.t + rel[k].y + dy); };
    /** The dots no other dot comes within 30px of, farthest from the rest first; never the last. */
    const alone = rel.map((p, k) => ({ k, gap: Math.min(...rel.filter((_, j) => j !== k).map(o => Math.hypot(o.x - p.x, o.y - p.y))) }))
      .filter(x => x.gap > 30 && x.k < rows.length - 1 && dr.frame && rel[x.k].y > dr.frame.t - dr.box.t + 20).sort((a, b) => b.gap - a.gap).map(x => x.k);
    return { dr, ax, rel, on, reach, point, alone };
  }

  /** Opens dot k's sheet by act, checks the URL and the focus, closes it by close; then the focus is back on the plot, nothing
   *  was said, and Right reads dot k + 1. */
  async function opens(page, r, how, k, act, close, rows) {
    const sheet = () => ev(page, () => {
      const d = document.querySelector("dialog.sheet[open]");
      return { open: !!d, focus: !!d && d.contains(document.activeElement), url: location.search };
    });
    const backOn = () => ev(page, sel => document.activeElement === document.querySelector(sel), `${ROOT} ${PLOT}`);
    await ev(page, () => window.quad.listen());
    await act();
    const id = rows[k].session_id;
    const s = await until(sheet, x => x.open && x.focus && new URLSearchParams(x.url).get("session") === id);
    const q = new URLSearchParams(s.url), kept = q.get("project") === PROJECT && q.get("range") === "30";
    line(`${how} on dot ${k + 1} opens its session's sheet, the view kept in the URL, and the sheet takes the focus`, s.open && s.focus && q.get("session") === id && kept,
      `${s.open ? "open" : "closed"}, focus ${s.focus ? "in the sheet" : "outside"}, ${s.url}`);
    if (s.open) await close();
    const shut = await until(async () => ({ ...(await sheet()), back: await backOn() }), x => !x.open && x.back);
    const said = await ev(page, () => window.__said);
    await page.keyboard.press("ArrowRight");
    const next = r.on(await r.reach(k + 1), k + 1);
    line(`${how}: after the sheet closes the focus is on the plot, nothing was said, and Right reads dot ${k + 2}`, s.open && !shut.open && shut.back && !said.length && next.ok,
      `${shut.open ? "still open" : "closed"}, focus ${shut.back ? "on the plot" : "elsewhere"}, said ${JSON.stringify(said)}; ${next.at}`);
  }

  /** The corner names: each drawn one inside its quadrant, its halo the 3px surface painted under the fill; a name with room
   *  to spare (its width at 11px × s, measured, at most 80% of its quadrant's width less 12px × s: the plot sizes names by
   *  an estimate) is drawn; the list names all four with counts that add up to the dots. */
  async function names(page, dr, rows, what) {
    const s = await ev(page, () => parseFloat(getComputedStyle(document.documentElement).fontSize) / 16);
    const g = { x: dr.guides.find(x => x.w < 1)?.x, y: dr.guides.find(x => x.h < 1)?.y }, f = dr.frame;
    const named = dr.texts.filter(t => t.halo);
    const surface = await ev(page, () => window.chartfit.panel());
    const corner = n => {
      const left = n.startsWith("Cheap"), top = n.endsWith("much done");
      return { l: left ? f.l : g.x, r: left ? g.x : f.r, t: top ? f.t : g.y, b: top ? g.y : f.b };
    };
    const bad = named.filter(t => {
      const c = corner(t.text);
      return !(t.l >= c.l && t.r <= c.r && t.t >= c.t - 1 && t.b <= c.b + 1) || t.paintOrder !== "stroke" || t.haloWidth !== 3 || t.halo !== surface;
    });
    const all = ["Cheap, much done", "Costly, much done", "Cheap, little done", "Costly, little done"];
    const roomy = [];
    if (f && g.x != null) for (const n of all) if (await ev(page, ([t, px]) => window.quad.measure(t, px), [n, 11 * s]) <= .8 * (corner(n).r - corner(n).l - 12 * s)) roomy.push(n);
    const missing = roomy.filter(n => !named.some(t => t.text === n));
    line(`${what}: each corner name with room is drawn, inside its quadrant, its 3px surface halo painted under its fill`, !!f && g.x != null && !bad.length && !missing.length,
      `${named.length} drawn${named.length ? `: ${named.map(t => `"${t.text}"`).join(", ")}, halo rgb(${named[0].halo}) ${named[0].haloWidth}px, paint-order ${named[0].paintOrder}` : ""}, surface rgb(${surface}); ${roomy.length} with room${missing.length ? `; not drawn: ${missing.join(", ")}` : ""}${bad.length ? `; wrong: ${bad.map(t => t.text).join(", ")}` : ""}`);
    const list = await ev(page, () => window.quad.list());
    const sum = list.reduce((s, x) => s + value(x.replace(/^\D+/, "")), 0);
    const four = ["Cheap, much done", "Costly, much done", "Cheap, little done", "Costly, little done"].every((n, i) => list[i]?.startsWith(n));
    line(`${what}: the list under the plot names all four quadrants, counts adding up to the ${rows.length} dots`, list.length === 4 && four && sum === rows.length, list.join("; "));
  }
  /** The tick labels and the axis names: in the box, apart, the costs in dollars, the tool calls left of the plot; with
   *  zero, both lanes' labels drawn and a four-digit tool-call label; with zero "narrow", the cost lane's "$0" may give way
   *  to the label beside it, the lane being narrower than the two (what is drawn is said). */
  async function labels(dr, what, zero = false) {
    const box = dr.box, ticks = dr.texts.filter(t => !t.halo);
    const { out, over } = fitTexts(ticks, box);
    const ax = axesOf(dr.texts, dr.frame);
    const xs = ax?.xs ?? [], ys = ax?.ys ?? [];
    const dollars = xs.every(t => /^\$\d/.test(t.text)), outside = ys.filter(t => !(t.r <= dr.frame.l && t.l >= box.l - .5));
    const axisNames = ["Estimated cost (log scale)", "Tool calls (log scale)"].map(n => ticks.find(t => t.text === n));
    line(`${what}: no tick label or axis name leaves the box or overlaps another`, ticks.length > 2 && !out.length && !over.length,
      [...out.map(x => `out: ${x}`), ...over.map(x => `overlap: ${x}`)].join("; ") || `${ticks.length} texts in ${px(box.w)}x${px(box.h)}`);
    const lanes = !zero || ((zero === "narrow" || xs.some(t => t.text === "$0")) && ys.some(t => t.text === "0") && ys.some(t => t.text === "1,000"));
    const lane = zero === "narrow" ? ` and "0" are drawn (${xs.some(t => t.text === "$0") ? "\"$0\" too" : `"$0" gives way to "${xs[0]?.text}" in the narrow lane`}),` : zero ? " \"$0\" and \"0\" are drawn," : ",";
    line(`${what}: the cost labels are dollars${zero ? `, the lanes${lane}` : ","} the tool-call labels${zero ? " (to \"1,000\")" : ""} sit in the left margin, both axis names are drawn`,
      xs.length >= 2 && dollars && ys.length >= 2 && !outside.length && axisNames.every(Boolean) && lanes,
      `cost ${xs.map(t => t.text).join(" ")}; tool calls ${ys.map(t => `${t.text} at ${px(t.l - box.l)}..${px(t.r - box.l)}`).join(", ")} (plot from ${px(dr.frame.l - box.l)}); axis names ${axisNames.filter(Boolean).length} of 2`);
  }

  // ---------- 1440px: the place, the hint, the dots, the guides, the names and the labels ----------
  {
    const page = await open("1440px");
    const cols = await ev(page, () => [...document.querySelectorAll(".pg-project .cols > .col")].map(c => [...c.querySelectorAll(":scope > section")].map(s => s.id)));
    const right = cols[1] ?? [], at = right.indexOf("quadrant");
    line(`${W}px: the block sits in the right column, right after Sessions`, at > 0 && right[at - 1] === "sessions", cols.map(c => c.join(", ")).join(" | "));
    const hint = await ev(page, () => window.chartfit.lines(document.querySelector("#quadrant .quad > .hint")));
    line(`${W}px: the hint wraps to 2 lines at most in the block's column`, hint >= 1 && hint <= 2, `${hint} lines`);
    const dr = await drawing(page);
    counted(dr, ROWS, `${W}px`);
    const p = placedLine(dr, ROWS, `${W}px`);
    const mc = median(ROWS.map(r => r.cost)), mt = median(ROWS.map(r => r.tool_calls));
    const v = dr.guides.filter(g => g.w < 1 && g.h > 1), hz = dr.guides.filter(g => g.h < 1 && g.w > 1);
    const gx = p.ax?.x(mc), gy = p.ax?.y(mt);
    line(`${W}px: the dashed guides sit at the medians, $${mc.toFixed(2)} and ${mt} tool calls, within 1px`,
      v.length === 1 && hz.length === 1 && Math.abs(v[0].x - gx) <= 1 && Math.abs(hz[0].y - gy) <= 1 && dr.guides.every(g => g.dash === "5,4"),
      `vertical ${v.map(g => px(g.x - dr.box.l)).join(", ") || "none"} for ${px(gx - dr.box.l)}, horizontal ${hz.map(g => px(g.y - dr.box.t)).join(", ") || "none"} for ${px(gy - dr.box.t)}`);
    await names(page, dr, ROWS, `${W}px`);
    await labels(dr, `${W}px`);
    await shot(page, "light");
    await page.done();
  }

  // ---------- the reading at 1440px: keys, pointer, tooltip, mark, Escape and the sheet ----------
  {
    const page = await open("reading");
    await away(page);
    await plot(page).focus();
    await page.locator(ROOT).scrollIntoViewIfNeeded();
    const r = await reading(page, ROWS), { on, reach } = r;

    // Right through every dot, cheapest to costliest.
    const wrong = [], tips = [];
    let worst = 0;
    for (let k = 0; k < N; k++) {
      await page.keyboard.press("ArrowRight");
      const s = await reach(k), o = on(s, k);
      worst = Math.max(worst, o.off, o.drawnOff);
      if (!o.ok) wrong.push(o.at);
      if (!besideWin(s, s.mark?.x)) tips.push(`dot ${k + 1}: ${tipAt(s)}, mark at ${s.mark ? px(s.mark.x - s.box.l) : "none"}`);
    }
    line(`Right steps through all ${N} dots cheapest to costliest: the mark on each drawn dot within 1px, the tooltip and the live region naming its session`, !wrong.length,
      wrong.slice(0, 3).join("; ") || `the mark at most ${worst.toFixed(2)}px off`);
    line("keys: at every dot the tooltip shows, beside the dot and inside the window", !tips.length, tips.slice(0, 3).join("; ") || `${N} dots`);

    // The names: the title where the store has one, the short id where it has none. One request at a time: the demo
    // server's listen queue is short; a request it drops is asked again.
    const untitled = ROWS.filter(x => !x.title), store = [];
    for (const x of untitled) {
      let t;
      for (let tries = 0; t === undefined && tries < 3; tries++) t = await h.json(`/api/session?id=${encodeURIComponent(x.session_id)}`).then(d => ("title" in d ? d.title : `(${d.error})`), () => undefined);
      store.push(t === undefined ? "(not answered)" : t);
    }
    const missed = untitled.map((x, i) => [x, store[i]]).filter(([, t]) => t !== null).map(([x, t]) => `${x.session_id}: ${t}`);
    line(`every dot's tooltip names its session by its title, the cheapest too: ${N - untitled.length} of ${N}; the other ${untitled.length} have no title in the store`,
      !wrong.length && !missed.length, `cheapest "${nameOf(ROWS[0])}", "${nameOf(ROWS[1])}", "${nameOf(ROWS[2])}"; untitled ${untitled.map(x => x.session_id).join(", ")}${missed.length ? `; the store's /api/session says ${missed.join(", ")}` : ""}`);

    // Left, Home, End; Up and Down are the page's.
    await page.keyboard.press("ArrowLeft");
    const left = on(await reach(N - 2), N - 2);
    await page.keyboard.press("Home");
    const home = on(await reach(0), 0);
    await page.keyboard.press("End");
    const end = on(await reach(N - 1), N - 1);
    line("Left, Home and End read the dot before the last, the cheapest and the costliest", left.ok && home.ok && end.ok, [left, home, end].map(o => o.at).join("; "));
    await ev(page, () => { window.__prevented = []; addEventListener("keydown", e => window.__prevented.push(e.defaultPrevented)); });
    const before = await state(page), y0 = await ev(page, () => scrollY);
    await page.keyboard.press("ArrowDown");
    await sleep(300);
    const y1 = await ev(page, () => scrollY);
    await page.keyboard.press("ArrowUp");
    await sleep(300);
    const after = await state(page), y2 = await ev(page, () => scrollY), prevented = await ev(page, () => window.__prevented);
    const kept = on(after, N - 1);
    line("Up and Down leave the reading on its dot, and are left to the page", kept.ok && after.live === before.live && prevented.length === 2 && !prevented.some(Boolean),
      `${kept.ok ? "reading kept" : kept.at}; default ${prevented.some(Boolean) ? "PREVENTED" : "kept"}: the page scrolled ${px(y1 - y0)}px, then ${px(y2 - y1)}px`);
    const edgeKeys = [];
    await page.keyboard.press("Home");
    edgeKeys.push(await reach(0));
    await page.keyboard.press("End");
    edgeKeys.push(await reach(N - 1));
    line("keys: at the cheapest and the costliest dot the tooltip sits beside the dot, inside the box", edgeKeys.every(s => besideIn(s, s.mark?.x)),
      edgeKeys.map(s => `${tipAt(s)}, mark at ${s.mark ? px(s.mark.x - s.box.l) : "none"}`).join("; "));

    // Escape on the focused plot ends the reading End made, and the focus stays.
    const read = on(edgeKeys.at(-1), N - 1);
    await page.keyboard.press("Escape");
    const esc = await until(() => state(page), s => !s.tip && !s.mark && !s.live);
    const focus = await ev(page, sel => document.activeElement === document.querySelector(sel), `${ROOT} ${PLOT}`);
    line("Escape on the focused plot ends the reading on the costliest dot: no tooltip, mark or sentence, the focus kept", read.ok && !esc.tip && !esc.mark && !esc.live && focus,
      `before: ${read.ok ? "read" : read.at}; then ${esc.tip ? "tooltip" : "no tooltip"}, ${esc.mark ? "mark" : "no mark"}, said "${esc.live}", focus ${focus ? "on the plot" : "elsewhere"}`);

    // Enter on the dot read.
    const K = 5;
    await page.keyboard.press("Home");
    for (let k = 0; k < K; k++) await page.keyboard.press("ArrowRight");
    await reach(K);
    await opens(page, r, "Enter", K, () => page.keyboard.press("Enter"), () => page.keyboard.press("Escape"), ROWS);
    await page.keyboard.press("Escape");
    await ev(page, () => document.activeElement?.blur());

    // The pointer: a dot alone, its 12px radius and nothing farther; the hand over a dot only; the edges.
    if (!line("the store has a dot 30px from any other", r.alone.length > 0)) throw new Error("no dot alone to point at");
    const J = r.alone[0];
    await away(page);
    await r.point(J);
    const centre = on(await reach(J), J);
    await r.point(J, 0, -11);
    await sleep(150);
    const near = on(await state(page), J);
    await r.point(J, 0, -13);
    await sleep(150);
    const far = await state(page);
    line(`pointer: on dot ${J + 1} and 11px off it the mark sits on the drawn dot within 1px; 13px off nothing is read`, centre.ok && near.ok && !far.tip && !far.mark,
      `${centre.at}; 11px: ${near.ok ? "read" : near.at}; 13px: ${far.tip ? `tooltip "${far.tip.name}"` : "no tooltip"}, ${far.mark ? "mark" : "no mark"}`);
    await r.point(J);
    await reach(J);
    await shot(page, "tooltip");
    const b0 = await ev(page, () => window.quad.box());
    const hand = await ev(page, ([x, y]) => window.quad.cursor(x, y), [b0.l + r.rel[J].x, b0.t + r.rel[J].y]);
    let empty = null; // a point of the plot 20px from every dot
    for (let x = r.dr.frame.l - r.dr.box.l + 10; !empty && x < r.dr.frame.r - r.dr.box.l; x += 7)
      for (let y = r.dr.frame.t - r.dr.box.t + 10; !empty && y < r.dr.frame.b - r.dr.box.t; y += 7)
        if (r.rel.every(p => Math.hypot(p.x - x, p.y - y) > 20)) empty = { x, y };
    await page.mouse.move(b0.l + empty.x, b0.t + empty.y);
    await sleep(150);
    const notHand = await ev(page, ([x, y]) => window.quad.cursor(x, y), [b0.l + empty.x, b0.t + empty.y]);
    line("the pointer is a hand over a dot, and not over empty plot", hand === "pointer" && notHand !== "pointer", `over dot ${J + 1}: ${hand}; over the plot at ${px(empty.x)},${px(empty.y)}: ${notHand}`);
    const edges = [];
    for (const k of [0, N - 1]) { await r.point(k); edges.push(await reach(k)); }
    line("pointer: on the cheapest and the costliest dot the tooltip sits beside the dot, inside the box", edges.every(s => besideIn(s, s.mark?.x)),
      edges.map(s => `${tipAt(s)}, mark at ${s.mark ? px(s.mark.x - s.box.l) : "none"}`).join("; "));

    // A click opens the sheet; its close button closes it.
    await away(page);
    await opens(page, r, "a click", J, async () => { const b = await ev(page, () => window.quad.box()); await page.mouse.click(b.l + r.rel[J].x, b.t + r.rel[J].y); },
      () => page.locator("dialog.sheet[open] .sheet-close").click(), ROWS);
    await page.keyboard.press("Escape");

    // Escape with the focus on another control: the moment a pointer's tooltip shows, and later.
    await ev(page, () => document.activeElement?.blur());
    await away(page);
    await until(() => state(page), s => !s.tip);
    await page.locator("#navTheme").focus();
    await page.locator(ROOT).scrollIntoViewIfNeeded();
    await ev(page, () => {
      window.__esc = 0;
      const mo = new MutationObserver(() => {
        if (!window.quad.tip()) return;
        mo.disconnect();
        window.__esc = 1;
        document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      });
      mo.observe(document.querySelector("#quadrant .quad-box"), { childList: true, subtree: true, attributes: true });
    });
    await r.point(J);
    await sleep(500);
    const quick = { ...(await state(page)), sent: await ev(page, () => window.__esc) };
    line("Escape the moment a pointer's tooltip shows, with the focus on another control, closes it", quick.sent === 1 && !quick.tip && !quick.mark,
      `${quick.sent ? "sent as it showed" : "the tooltip never showed"}; then ${quick.tip ? "tooltip open" : "no tooltip"}, ${quick.mark ? "mark" : "no mark"}`);
    await away(page);
    await until(() => state(page), s => !s.tip);
    await r.point(J);
    const shown = await until(() => state(page), s => s.tip);
    await sleep(500);
    await page.keyboard.press("Escape");
    const later = await until(() => state(page), s => !s.tip && !s.mark);
    const stays = await ev(page, () => document.activeElement?.id ?? "");
    line("Escape later, with the focus on another control, closes the pointer's tooltip and leaves the focus there", !!shown.tip && !later.tip && !later.mark && stays === "navTheme",
      `${shown.tip ? "opened" : "never opened"}; then ${later.tip ? "tooltip open" : "no tooltip"}, ${later.mark ? "mark" : "no mark"}, focus on "#${stays}"`);
    await page.done();
  }

  // ---------- a pile of three sessions, and two sessions at one cost ----------
  {
    const pile = ROWS.slice(40, 43).map(x => x.session_id), [P] = ROWS.slice(40, 41);
    // Two at one cost: the cheapest dot and the session with the most tool calls of the costlier half, far above it.
    const S = ROWS[2], T = ROWS.slice(N / 2).sort((a, b) => b.tool_calls - a.tool_calls)[0];
    const answer = d => edit(edit(d, pile, x => ({ ...x, cost: P.cost, tool_calls: P.tool_calls })), [T.session_id], x => ({ ...x, cost: S.cost }));
    const rows = dotsOf(answer(structuredClone(base)));
    const page = await open("pile", { answer });
    const r = await reading(page, rows), at = ids => ids.map(id => rows.findIndex(x => x.session_id === id));
    const [p0] = at(pile).sort((a, b) => a - b);
    // The others the tooltip counts: the answer's dots whose pixels on the drawn axes are within 4px, the pile's two and
    // any neighbour of the store's.
    const more = r.rel.filter((p, k) => k !== p0 && Math.hypot(p.x - r.rel[p0].x, p.y - r.rel[p0].y) <= 4).length;
    await r.point(p0);
    const s = await until(() => state(page), x => x.tip);
    line(`pointer over a pile of 3 sessions (and ${more - 2} of the store's within 4px): the tooltip says how many more sit there`, more >= 2 && s.tip?.more === `and ${more} more sessions here`,
      `"${s.tip?.more ?? "no tooltip"}"`);
    await away(page);
    await plot(page).focus();
    await page.keyboard.press("Home");
    for (let k = 0; k < p0; k++) await page.keyboard.press("ArrowRight");
    const got = [];
    for (let k = p0; k < p0 + 3; k++) { if (k > p0) await page.keyboard.press("ArrowRight"); got.push(r.on(await r.reach(k), k)); }
    const said = await ev(page, () => window.quad.live());
    line("keys: Right reaches each of the 3 sessions of the pile in turn", got.every(o => o.ok), got.map(o => o.at).join("; ") + `; last said "${said.split(":")[0]}"`);
    await ev(page, () => document.activeElement?.blur());
    const two = [];
    for (const id of [S.session_id, T.session_id]) { const k = rows.findIndex(x => x.session_id === id); await away(page); await r.point(k); two.push(r.on(await r.reach(k), k)); }
    line(`pointer over two sessions at one cost, $${S.cost.toFixed(2)}: each dot reads its own session`, two.every(o => o.ok), two.map(o => o.at).join("; "));
    await page.done();
  }

  // ---------- the axes and the lanes: 16px and 32px text, in a 343px box and at 1440px ----------
  {
    const [A, B, C] = [ROWS[20], ROWS[30], ROWS[50]];
    const answer = d => edit(edit(edit(d, [A.session_id], x => ({ ...x, tool_calls: 0 })), [B.session_id], x => ({ ...x, cost: 0 })), [C.session_id], x => ({ ...x, tool_calls: 2400 }));
    const rows = dotsOf(answer(structuredClone(base)));
    for (const [win, big] of [[W, false], [W, true], [NARROW, false], [NARROW, true]]) {
      const page = await open(`lanes ${win}px${big ? " 32px" : ""}`, { answer, options: { viewport: { width: win, height: 900 } }, init: big ? root32 : null });
      const dr = await drawing(page);
      const what = `a ${px(dr.box.w)}px box at ${big ? 32 : 16}px text, a session at $0, one at 0 and one at 2,400 tool calls`;
      placedLine(dr, rows, what);
      await labels(dr, what, win === NARROW && big ? "narrow" : true);
      await names(page, dr, rows, what);
      if (win === NARROW) await shot(page, big ? "343px-32px" : "343px");
      else if (big) await shot(page, "32px");
      await page.done();
    }
  }

  // ---------- wide labels: a session at 400,000 tool calls and one at $4,000, at 1440px and in a 343px box at 32px ----------
  {
    const [A, B] = [ROWS[25], ROWS[35]];
    const answer = d => edit(edit(d, [A.session_id], x => ({ ...x, tool_calls: 400000 })), [B.session_id], x => ({ ...x, cost: 4000 }));
    const rows = dotsOf(answer(structuredClone(base)));
    for (const [win, big] of [[W, false], [NARROW, true]]) {
      const page = await open(`wide labels ${win}px${big ? " 32px" : ""}`, { answer, options: { viewport: { width: win, height: 900 } }, init: big ? root32 : null });
      const dr = await drawing(page);
      const what = `a ${px(dr.box.w)}px box at ${big ? 32 : 16}px text, a session at 400,000 tool calls and one at $4,000`;
      placedLine(dr, rows, what);
      await labels(dr, what);
      // At 1440px the axes' last labels, "500,000" and "$5,000", are drawn at the plot's top and right ends; in the narrow
      // box at 32px a label beside them may give way, and one six-digit and one four-digit label are drawn.
      const ax = axesOf(dr.texts, dr.frame), ys = (ax?.ys ?? []).map(t => t.text), xs = (ax?.xs ?? []).map(t => t.text);
      const ends = big ? ys.some(t => /^[15]00,000$/.test(t)) && xs.some(t => /^\$[15],000$/.test(t)) : ys.includes("500,000") && xs.includes("$5,000");
      line(`${what}: ${big ? "a six-digit tool-call label and a four-digit cost label are" : "the last labels, \"500,000\" and \"$5,000\", are"} drawn`, ends,
        `cost ${xs.join(" ")}; tool calls ${ys.join(" ")}`);
      await page.done();
    }
  }

  // ---------- names in a 343px box: a 300-character title with no space, a right-to-left one, and a session with no title,
  // start, project, branch or model ----------
  {
    const LONG = "ExportTheQuarterlyInvoiceReportWithoutBreaks".repeat(7).slice(0, 300), RTL = "إصلاح اختبار تصدير الفواتير المتقطع في الحساب الرئيسي";
    const [L, R, Z] = [ROWS[0], ROWS[N - 1], ROWS[N >> 1]];
    const answer = d => edit(edit(edit(d, [L.session_id], x => ({ ...x, title: LONG })), [R.session_id], x => ({ ...x, title: RTL })),
      [Z.session_id], x => ({ ...x, title: null, first_ts: null, last_ts: null, project: null, git_branch: null, peak_model: null, duration_s: null }));
    const rows = dotsOf(answer(structuredClone(base)));
    const page = await open("names 343px", { answer, options: { viewport: { width: NARROW, height: 900 } } });
    const r = await reading(page, rows);
    await plot(page).focus();
    const ends = [];
    for (const [key, k] of [["Home", 0], ["End", N - 1]]) { await page.keyboard.press(key); ends.push([k, await r.reach(k)]); }
    line(`a ${px(r.dr.box.w)}px box: a 300-character title with no space and a right-to-left one show whole in the tooltip, wrapped, beside the dot and inside the box`,
      ends.every(([k, s]) => r.on(s, k).ok && besideIn(s, s.mark?.x)), ends.map(([k, s]) => `${r.on(s, k).ok ? `"${s.tip.name.slice(0, 12)}…" read` : r.on(s, k).at}, ${tipAt(s)}`).join("; "));
    const kz = rows.findIndex(x => x.session_id === Z.session_id);
    await page.keyboard.press("Home");
    for (let k = 0; k < kz; k++) await page.keyboard.press("ArrowRight");
    const z = r.on(await r.reach(kz), kz), said = await ev(page, () => window.quad.live());
    const odd = await ev(page, () => (document.querySelector("#quadrant").textContent.match(/Invalid Date|NaN|undefined|null/g) ?? []));
    line(`a session with no title, start, project, branch or model: its dot reads "started –", nothing in the block says "Invalid Date", NaN, undefined or null, no page error`,
      z.ok && said.includes(", started –:") && !odd.length && !page.errors.length, `${z.ok ? `said "${said}"` : z.at}${odd.length ? `; the block says ${odd.join(", ")}` : ""}${page.errors.length ? `; ${page.errors.join("; ")}` : ""}`);
    await page.keyboard.press("Escape");
    await page.locator(`${ROOT} .chart-table > button`).click();
    const table = await until(() => ev(page, long => {
      const cell = [...document.querySelectorAll("#quadrant .chart-table tbody tr")].find(tr => tr.textContent.includes(long));
      return { rows: document.querySelectorAll("#quadrant .chart-table tbody tr").length, cell: !!cell && cell.getBoundingClientRect().width > 0, sw: document.documentElement.scrollWidth, w: innerWidth };
    }, LONG.slice(0, 40)), t => t.cell);
    line(`the data table open with the 300-character title in a ${px(r.dr.box.w)}px box: the page does not scroll sideways`, table.cell && table.rows === N && table.sw <= table.w,
      `${table.rows} rows, the long title's row ${table.cell ? "shown" : "not shown"}; the page ${table.sw}px wide in ${table.w}px`);
    await page.done();
  }

  // ---------- the page around the block: a 375px window, and 32px text at 1280px ----------
  {
    const page = await open("375px", { options: { viewport: { width: 375, height: 800 } } });
    const sw = await ev(page, () => ({ sw: document.documentElement.scrollWidth, w: innerWidth, dots: window.quad.dots().length, box: window.quad.box().w }));
    line(`a 375px window: the plot is drawn, ${N} dots, and the page does not scroll sideways`, sw.dots === N && sw.sw <= sw.w, `${sw.dots} dots in a ${px(sw.box)}px box; the page ${sw.sw}px wide in ${sw.w}px`);
    await page.done();
  }
  {
    const page = await open("1280px 32px", { options: { viewport: { width: 1280, height: 900 } }, init: root32 });
    const got = await ev(page, () => {
      const els = [document.querySelector("#quadrant"), ...document.querySelectorAll("#quadrant *")].filter(e => e.getBoundingClientRect().width > 0);
      const over = els.filter(e => e.getBoundingClientRect().right > innerWidth + .5);
      return { n: els.length, over: over.map(e => `${e.tagName.toLowerCase()}${e.className && typeof e.className === "string" ? "." + e.className.split(" ")[0] : ""} to ${Math.round(e.getBoundingClientRect().right)}`), w: innerWidth,
        right: Math.round(document.querySelector("#quadrant").getBoundingClientRect().right), dots: window.quad.dots().length };
    });
    line(`1280px at 32px text: the plot is drawn, ${N} dots, and nothing of the block reaches past the window`, got.dots === N && !got.over.length,
      got.over.slice(0, 4).join(", ") || `${got.dots} dots, ${got.n} elements, the block ends at ${got.right} of ${got.w}px`);
    await page.done();
  }

  // ---------- few sessions, the cut and the sessions with no known cost ----------
  for (const n of [2, 1]) {
    const keep = ROWS.slice(0, n).map(x => x.session_id);
    const answer = d => { d.sessions = d.sessions.filter(x => keep.includes(x.session_id)); d.totals = { ...d.totals, sessions: n }; return d; };
    const page = await open(`${n} sessions`, { answer });
    const dr = await drawing(page), notes = await ev(page, () => window.quad.notes()), list = await ev(page, () => window.quad.list());
    const few = `${n} session${n > 1 ? "s" : ""}: too few to split at a median.`;
    line(`${n} session${n > 1 ? "s" : ""}: ${n} dot${n > 1 ? "s" : ""}, no guide, no corner name, no list, and the line "${few}"`,
      dr.dots.length === n && !dr.guides.length && !dr.texts.some(t => t.halo) && !list.length && notes.includes(few),
      `${dr.dots.length} dots, ${dr.guides.length} guides, ${dr.texts.filter(t => t.halo).length} names, ${list.length} list items; notes ${JSON.stringify(notes)}`);
    if (n === 2) await shot(page, "two-sessions");
    await page.done();
  }
  {
    const none = ROWS.slice(10, 12).map(x => x.session_id);
    const answer = d => { edit(d, none, x => ({ ...x, cost: null })); d.totals = { ...d.totals, sessions: 412 }; return d; };
    const rows = dotsOf(answer(structuredClone(base)));
    const page = await open("cut", { answer });
    const dr = await drawing(page), notes = await ev(page, () => window.quad.notes());
    const cut = `The newest ${base.sessions.length} of 412 sessions in this view; the medians are theirs.`, out = "2 sessions with no known cost are left out.";
    line(`412 sessions in the totals, ${base.sessions.length} rows, 2 with no known cost: ${rows.length} dots, the "newest" line and the left-out line`,
      dr.dots.length === rows.length && notes.includes(cut) && notes.includes(out), `${dr.dots.length} dots; notes ${JSON.stringify(notes)}`);
    placedLine(dr, rows, "with 2 sessions left out");
    await page.done();
  }
  {
    // Every session of the newest unpriced, more in the totals: an older one may have a cost, so the block names the sample.
    const answer = d => { edit(d, d.sessions.map(x => x.session_id), x => ({ ...x, cost: null })); d.totals = { ...d.totals, sessions: 412 }; return d; };
    const page = await open("cut, none priced", { answer });
    const n = base.sessions.length;
    const got = await ev(page, () => ({ none: document.querySelector("#quadrant .quad-box .empty")?.textContent ?? null, notes: window.quad.notes() }));
    const none = `No session in the newest ${n} has a known cost, so none can be placed.`, cut = `The newest ${n} of 412 sessions in this view.`;
    line(`412 sessions in the totals, the newest ${n} all with no known cost: the block says none of the newest ${n} has one, and the "newest" line names no median`,
      got.none === none && got.notes.includes(cut), `"${got.none}"; notes ${JSON.stringify(got.notes)}`);
    await page.done();
  }
  {
    // Three sessions with no tool call: the median of tool calls lies on the plot's bottom edge, and the lower quadrants
    // have no height. No name may sit on the other side of a guide from its quadrant.
    const keep = ROWS.slice(0, 3).map(x => x.session_id);
    const answer = d => { d.sessions = d.sessions.filter(x => keep.includes(x.session_id)).map(x => ({ ...x, tool_calls: 0 })); d.totals = { ...d.totals, sessions: 3 }; return d; };
    const page = await open("3 sessions at 0 tool calls", { answer });
    const dr = await drawing(page), list = await ev(page, () => window.quad.list());
    const g = { x: dr.guides.find(x => x.w < 1)?.x, y: dr.guides.find(x => x.h < 1)?.y }, named = dr.texts.filter(t => t.halo);
    const wrong = named.filter(t => {
      const left = t.text.startsWith("Cheap"), top = t.text.endsWith("much done");
      return !((left ? t.r <= g.x + 1 : t.l >= g.x - 1) && (top ? t.b <= g.y + 1 : t.t >= g.y - 1));
    });
    const four = ["Cheap, much done", "Costly, much done", "Cheap, little done", "Costly, little done"].every((q, i) => list[i]?.startsWith(q));
    line(`3 sessions at 0 tool calls in a ${px(dr.box.w)}px box: no corner name drawn across a guide, the list under the plot names all four`,
      g.x != null && g.y != null && named.length > 0 && !wrong.length && list.length === 4 && four,
      `${named.length} drawn: ${named.map(t => `"${t.text}" ${px(t.t)}..${px(t.b)}`).join(", ")}; the tool-call guide at ${px(g.y ?? NaN)}${wrong.length ? `; across a guide: ${wrong.map(t => t.text).join(", ")}` : ""}; list ${list.join("; ")}`);
    await page.done();
  }
  {
    // A custom price list takes any finite rate: a session at about $1e-126 is a dot, its tick in powers of ten.
    const T = ROWS[0];
    const answer = d => edit(d, [T.session_id], x => ({ ...x, cost: 1e-126, unpriced: 0 }));
    const rows = dotsOf(answer(structuredClone(base))), k = rows.findIndex(x => x.session_id === T.session_id);
    // A page the cost breaks may never draw: its line says so, and the run goes on.
    let page;
    try { page = await open("a tiny cost", { answer }); } catch (e) {
      line("a session at $1e-126: the plot is drawn", false, String(e.message).split("\n")[0]);
    }
    if (page) {
      const dr = await drawing(page);
      const xs = dr.frame ? dr.texts.filter(t => !t.halo && !/log scale/.test(t.text) && t.ay > dr.frame.b + 1) : [];
      await plot(page).focus();
      await page.keyboard.press("Home");
      for (let i = 0; i < k; i++) await page.keyboard.press("ArrowRight");
      const tip = await until(() => ev(page, () => document.querySelector("#quadrant .quad-box .tip")?.textContent ?? ""), t => t.includes("Est. cost"));
      const inside = dr.frame ? dr.dots.filter(d => d.x >= dr.frame.l - 1 && d.x <= dr.frame.r + 1 && d.y >= dr.frame.t - 1 && d.y <= dr.frame.b + 1).length : 0;
      line(`a session at $1e-126: no page error, ${rows.length} dots drawn inside the plot, the cost axis in powers of ten, and its tooltip shows "<$0.01"`,
        !page.errors.length && dr.dots.length === rows.length && inside === rows.length && xs.some(t => /^\$\de-\d+$/.test(t.text)) && xs.every(t => /^\$/.test(t.text))
          && tip.includes(nameOf(T)) && tip.includes("Est. cost<$0.01"),
        `${page.errors.join("; ") || "no page error"}; ${inside} of ${dr.dots.length} dots inside; cost ${xs.map(t => t.text).join(" ")}; tooltip "${tip.slice(0, 80)}"`);
      await page.done();
    }
  }

  // ---------- colors: light, dark, an OS flip with no reload ----------
  {
    const page = await open("colors");
    await ev(page, () => { window.__kept = true; });
    const colors = () => ev(page, () => {
      const hue = window.chartfit.tri(getComputedStyle(document.querySelector(".pg-project h1 .pdot")).backgroundColor);
      return { hue, surface: window.chartfit.panel(), dots: window.quad.dots() };
    });
    /** Filled dots in the hue at 0.7, hollow ones the surface in a ring of the hue. */
    const right = c => c.dots.length === N && c.dots.every(d => (d.hollow ? d.fill === c.surface && d.stroke === c.hue : d.fill === c.hue && d.opacity === .7));
    const say = c => `hue rgb(${c.hue}), surface rgb(${c.surface}); ${c.dots.filter(d => !d.hollow).length} filled rgb(${c.dots.find(d => !d.hollow)?.fill}), ${c.dots.filter(d => d.hollow).length} hollow rgb(${c.dots.find(d => d.hollow)?.fill}) in rgb(${c.dots.find(d => d.hollow)?.stroke})`;
    await theme(page, "light");
    const light = await until(colors, right);
    line("light: the dots are the project's color, filled at 0.7 for a commit, hollow in a ring of it", right(light), say(light));
    await theme(page, "dark");
    const dark = await until(colors, c => right(c) && c.hue !== light.hue);
    line("dark: the dots take the project's dark color, filled and hollow", right(dark) && dark.hue !== light.hue, say(dark));
    await shot(page, "dark");
    await theme(page, "system");
    const sys = await until(colors, c => right(c) && c.hue === light.hue);
    await page.emulateMedia({ colorScheme: "dark" });
    const flip = await until(colors, c => right(c) && c.hue === dark.hue);
    await page.emulateMedia({ colorScheme: "light" });
    const back = await until(colors, c => right(c) && c.hue === light.hue);
    const kept = await ev(page, () => window.__kept === true);
    line("System: an OS dark flip and back redraws the dots in each scheme's colors, with no reload", sys.hue === light.hue && flip.hue === dark.hue && back.hue === light.hue && right(flip) && kept,
      `light rgb(${sys.hue}), OS dark rgb(${flip.hue}), back rgb(${back.hue}); ${kept ? "no reload" : "RELOADED"}`);
    await page.done();
  }
  {
    const page = await open("forced colors", { options: { forcedColors: "active" } });
    await plot(page).focus();
    await page.keyboard.press("Home");
    await until(() => state(page), s => s.mark);
    // The chart draws the system colors as the browser resolves them: compared with the probe's.
    const got = await ev(page, () => ({ dr: { dots: window.quad.dots(), guides: window.quad.guides(), texts: window.quad.texts(), frame: window.quad.frame() },
      mark: window.quad.mark(), sys: Object.fromEntries(["CanvasText", "Canvas", "GrayText", "Highlight"].map(c => [c, window.chartfit.probe(c)])) }));
    const { CanvasText: ct, Canvas: cv, GrayText: gt, Highlight: hl } = got.sys, uniq = xs => [...new Set(xs)].map(c => `rgb(${c})`).join(", ");
    const filled = got.dr.dots.filter(d => !d.hollow), hollow = got.dr.dots.filter(d => d.hollow);
    line("forced colors: filled dots CanvasText, hollow ones Canvas in a CanvasText ring, told apart", filled.length > 0 && hollow.length > 0 && ct !== cv
      && filled.every(d => d.fill === ct) && hollow.every(d => d.fill === cv && d.stroke === ct),
      `CanvasText rgb(${ct}), Canvas rgb(${cv}); filled ${uniq(filled.map(d => d.fill))}; hollow ${uniq(hollow.map(d => d.fill))} in ${uniq(hollow.map(d => d.stroke))}`);
    line("forced colors: the guides and every label CanvasText, the names' halo Canvas, the split lines GrayText",
      got.dr.guides.length === 2 && got.dr.guides.every(g => g.stroke === ct) && got.dr.texts.length > 0 && got.dr.texts.every(t => t.fill === ct && (!t.halo || t.halo === cv))
      && got.dr.frame?.strokes.join() === gt,
      `GrayText rgb(${gt}); guides ${uniq(got.dr.guides.map(g => g.stroke))}; texts ${uniq(got.dr.texts.map(t => t.fill))}, halo ${uniq(got.dr.texts.filter(t => t.halo).map(t => t.halo))}; split lines ${uniq(got.dr.frame?.strokes ?? [])}`);
    line("forced colors: the mark is Highlight", !!got.mark && got.mark.stroke === hl, `mark ${got.mark ? `rgb(${got.mark.stroke})` : "none"}, Highlight rgb(${hl})`);
    await shot(page, "forced-colors");
    await page.done();
  }

  // ---------- a touch tap in the 343px box ----------
  {
    const page = await open("touch", { options: { viewport: { width: NARROW, height: 900 }, hasTouch: true } });
    const r = await reading(page, ROWS), J = r.alone[0];
    const edges = [];
    await plot(page).focus();
    for (const [key, k] of [["Home", 0], ["End", N - 1]]) { await page.keyboard.press(key); edges.push(await r.reach(k)); }
    await page.keyboard.press("Escape");
    for (const k of [0, N - 1]) { await r.point(k); edges.push(await r.reach(k)); }
    await away(page);
    await ev(page, () => document.activeElement?.blur());
    line(`a ${px(r.dr.box.w)}px box: on the cheapest and the costliest dot, by keys and by pointer, the tooltip sits beside the dot, inside the box`, edges.every(s => besideIn(s, s.mark?.x)),
      edges.map(s => `${tipAt(s)}, mark at ${s.mark ? px(s.mark.x - s.box.l) : "none"}`).join("; "));
    await opens(page, r, `a touch tap in a ${px(r.dr.box.w)}px box`, J, async () => { const b = await ev(page, () => window.quad.box()); await page.touchscreen.tap(b.l + r.rel[J].x, b.t + r.rel[J].y); },
      () => page.keyboard.press("Escape"), ROWS);
    await page.done();
  }

  // ---------- motion: nothing moves, with motion on and with reduced motion ----------
  for (const motion of ["no-preference", "reduce"]) {
    const page = await open(`motion ${motion}`, { options: { reducedMotion: motion }, init: watchDrawings });
    await sleep(1000);
    const first = await ev(page, () => window.__drawings.length);
    // Newer figures that move every dot: the costliest session twice as costly widens the cost axis.
    let change = null;
    await newerOn(page, () => change);
    const last = ROWS[N - 1].session_id;
    change = d => edit(d, [last], x => ({ ...x, cost: x.cost * 2 }));
    await ev(page, () => window.dispatchEvent(new Event("visibilitychange")));
    const drawings = await until(() => ev(page, () => window.__drawings.length), n => n > first);
    await sleep(1000);
    const after = await ev(page, () => window.__drawings.length);
    const what = motion === "reduce" ? "with reduced motion" : "with motion on";
    line(`${what}: the first drawing and newer figures that move every dot each draw at once, with no frame between`, first === 1 && drawings > first && after === 2,
      `${first} drawing${first > 1 ? "s" : ""} at first, ${after} after newer figures`);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.done();
  }

  // ---------- newer figures: the session read kept, then gone ----------
  {
    const page = await open("newer figures");
    let change = null;
    await newerOn(page, () => change);
    const K = 10, id = ROWS[K].session_id;
    let r = await reading(page, ROWS);
    await plot(page).focus();
    await page.keyboard.press("Home");
    for (let k = 0; k < K; k++) await page.keyboard.press("ArrowRight");
    await r.reach(K);
    await ev(page, () => window.quad.listen());
    // Kept: the costliest session twice as costly moves every dot, the one read too; its words stay the same.
    const last = ROWS[N - 1].session_id, more = d => edit(d, [last], x => ({ ...x, cost: x.cost * 2 }));
    const before = await ev(page, () => window.quad.signature());
    change = more;
    await ev(page, () => window.dispatchEvent(new Event("visibilitychange")));
    await until(() => ev(page, () => window.quad.signature()), s => s !== before);
    await sleep(400);
    const rows = dotsOf(more(structuredClone(base)));
    r = await reading(page, rows);
    const k2 = rows.findIndex(x => x.session_id === id), kept = r.on(await state(page), k2), said = await ev(page, () => window.__said);
    line(`newer figures that keep session ${K + 1} read with the keys: the reading stays on its moved dot, and nothing is said`, kept.ok && !said.length,
      `${kept.at}; said ${JSON.stringify(said)}`);
    // Gone: the session read is not in the newer figures.
    const gone = d => { more(d); d.sessions = d.sessions.filter(x => x.session_id !== id); return d; };
    change = gone;
    await ev(page, () => window.dispatchEvent(new Event("visibilitychange")));
    const dots = await until(() => ev(page, () => window.quad.dots().length), n => n === N - 1);
    await sleep(400);
    const s = await state(page), heard = await ev(page, () => window.__said), errors = page.errors.slice();
    line(`newer figures without session ${K + 1}: ${N - 1} dots drawn, the reading ends, no tooltip, mark or sentence, and no page error`,
      kept.ok && dots === N - 1 && !s.tip && !s.mark && !s.live && !heard.length && !errors.length,
      `${kept.ok ? "read before" : "not read before"}; ${dots} dots, ${s.tip ? `tooltip "${s.tip.name}"` : "no tooltip"}, ${s.mark ? "mark" : "no mark"}, live "${s.live}", said ${JSON.stringify(heard)}${errors.length ? `; ${errors.join("; ")}` : ""}`);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.done();
  }
}
