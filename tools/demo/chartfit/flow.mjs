// Cost's "Where the cost goes" flow on /cost?range=30 (#flow): a graph with no axis, so none of checks.mjs's shared checks
// fit it; its own checks, on its own in-page readers (window.flowfit), against the graph the usage answer makes (graph(),
// the fold, kinds and colors of the design, computed here from the payload, never from the drawing):
// - the bands and nodes drawn are the payload's: every column's nodes, every band between the nodes it joins, each node
//   as tall as its cost; each node's color is its token and each band its source node's at 0.4, in light, after the
//   theme toggle sets dark, and after an OS dark flip and back with the theme on System, with no reload;
// - the section's total is the heading's figure, and the data table's rows of each step add up to it;
// - the pointer at a point inside every node and every band drawn (a kind of a few cents, drawn 2px tall, and its 1px
//   band included) reads that item, with its sentence, its tooltip and the mark on its drawn shape within 1px; where two
//   bands cross, the one drawn on top is read; the margin and a column's gap read nothing;
// - the hand cursor shows over a named project and not over a model, a band, a label or "(no project)";
// - the tooltip stays inside the box beside the leftmost and the rightmost node, at 1440px and in a 343px box;
// - Right, Right, Right, Down, Left, Up (stopping), Down, Home, End, Left and on to a kind read the items of decision 6's
//   table, with the mark on each within 1px; Up and Down do not scroll the page; Right on a kind stays;
// - Escape ends a reading on the focused box, with the focus on another control, and the moment a pointer's tooltip shows;
// - Enter on a project read by keys and a click on a project open its sheet, the sheet takes the focus, the URL keeps its
//   filter; Enter or a click on a model, a band, "Other" or "(no project)" opens nothing and the reading stays;
// - in a 343px box with touch, a tap on a band reads it and a tap on a project opens its sheet;
// - newer figures keep the pointer's reading, its tooltip with the new figure, and say nothing; a reading a key made says
//   its new sentence once; newer figures in which the item read folds into Other end the reading: no tooltip, no mark,
//   no sentence, no page error;
// - forced colors: bands unfilled with a CanvasText edge, nodes and labels CanvasText, the mark Highlight, the key's
//   swatches CanvasText, each named;
// - labels at 16px and 32px text, in a 343px box and at 1440px: none outside the box or over another, the long name cut
//   with "…", at 11px or 22px, the middle column's over the bands with a 3px halo in the surface color; at 343px and 32px
//   the models go to the key under the graph, which wraps inside its panel;
// - no sideways page scroll at 1440px, at a 375px window and at 1280px with 32px text, and the box ends inside its panel;
// - one project selected: two columns, model and token kind, and the table named for that project;
// - nothing in the drawing animates with motion on, on the first drawing, newer figures or a view change, and under
//   reduced motion nothing in the section animates on a view change.
import { H, PHONE, line, sleep, until } from "./harness.mjs";
import { root32 } from "./checks.mjs";

const ROOT = "#flow", PATH = "/cost?range=30", DATA = /\/api\/usage\?/;
/** A name too long for any label room. */
const LONG = "atlas-api-billing-invoicing-and-reconciliation-service";

/** The flow's readers, in the page before its scripts, as window.flowfit. ECharts' SVG names no element: a band is a path
 *  of two cubic curves ("M x0 y0 C … Z"), a node a path of four straight sides ("M x y l w 0 l 0 h l -w 0 Z"), a label a
 *  text. The mark, the tooltip, the live region and the key are the component's HTML. Runs in the page. */
function flowReaders() {
  const R = "#flow";
  const tri = c => (String(c).match(/[\d.]+/g) || []).slice(0, 3).map(n => Math.round(Number(n))).join(",");
  const rect = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const q = s => document.querySelector(`${R} ${s}`);
  const svg = () => q(".echart-plot svg");
  const nums = d => (d.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
  const NODE = /^M-?[\d.]+ -?[\d.]+l-?[\d.]+ 0l0 -?[\d.]+l-?[\d.]+ 0Z$/;
  const isBand = e => /^M[^C]*C/.test(e.getAttribute("d") ?? "");
  const isNode = e => NODE.test(e.getAttribute("d") ?? "");
  const band = d => { const n = nums(d); return { x0: n[0], y0: n[1], x1: n[6], y1: n[7], h: n[9] - n[7] }; };
  const node = d => { const n = nums(d); return { x: n[0], y: n[1], w: n[2], h: n[5] }; };
  const paths = () => [...(svg()?.querySelectorAll("path") ?? [])];
  const bez = (a, b, c, d, t) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;
  const mid = (b, t) => { const cx = (b.x0 + b.x1) / 2; return { x: bez(b.x0, cx, cx, b.x1, t), y: bez(b.y0, b.y0, b.y1, b.y1, t) + b.h / 2 }; };
  /** Whether a point of the svg is beside a node's bar, where the pointer reads the node. */
  const nearNode = (ns, x) => ns.some(n => x >= n.x - 6 && x <= n.x + n.w + 6);
  const T = [...Array(81).keys()].map(j => j / 80).sort((a, b) => Math.abs(a - .5) - Math.abs(b - .5));
  const point = (o, x, y) => ({ X: Math.round(o.l + x), Y: Math.round(o.t + y) });
  const inside = (e, o, p) => e.isPointInFill(new DOMPoint(p.X - o.l, p.Y - o.t));
  window.flowfit = {
    tri,
    /** What ECharts drew: the bands in drawing order and the nodes in the svg's coordinates, the texts in the window's. */
    drawing: () => {
      const s = svg();
      if (!s) return { plot: null, bands: [], nodes: [], texts: [] };
      const ps = paths(), color = (e, a) => { const v = e.getAttribute(a); return !v || v === "none" ? "none" : tri(v); };
      return {
        plot: rect(s),
        bands: ps.filter(isBand).map((e, i) => ({ i, ...band(e.getAttribute("d")), fill: color(e, "fill"), op: Number(e.getAttribute("fill-opacity") ?? 1),
          stroke: color(e, "stroke"), sw: Number(e.getAttribute("stroke-width") ?? 1) })),
        nodes: ps.filter(isNode).map(e => ({ ...node(e.getAttribute("d")), fill: color(e, "fill") })),
        texts: [...s.querySelectorAll("text")].map(e => ({ text: e.textContent, fill: color(e, "fill"), stroke: color(e, "stroke"), sw: Number(e.getAttribute("stroke-width") ?? 0),
          paint: e.getAttribute("paint-order") ?? "", size: parseFloat(getComputedStyle(e).fontSize), ...rect(e) })),
      };
    },
    /** A point in the window inside band i's drawn shape, where no band drawn after it lies and no node is read; or null. */
    spot: i => {
      const s = svg(), o = rect(s), ps = paths(), bs = ps.filter(isBand), e = bs[i], b = band(e.getAttribute("d"));
      const ns = ps.filter(isNode).map(n => node(n.getAttribute("d"))), later = bs.slice(i + 1);
      for (const t of T) {
        const m = mid(b, t);
        if (nearNode(ns, m.x)) continue;
        for (const dy of [0, -.5, .5]) {
          const p = point(o, m.x, m.y + dy);
          if (inside(e, o, p) && !later.some(l => inside(l, o, p))) return p;
        }
      }
      return null;
    },
    /** A point where two bands cross, away from the nodes: the band drawn on top and one under it. */
    crossing: () => {
      const s = svg(), o = rect(s), ps = paths(), bs = ps.filter(isBand), ns = ps.filter(isNode).map(n => node(n.getAttribute("d")));
      for (let i = bs.length - 1; i > 0; i--) {
        const b = band(bs[i].getAttribute("d"));
        for (const t of T) {
          const m = mid(b, t);
          if (nearNode(ns, m.x)) continue;
          const p = point(o, m.x, m.y);
          if (!inside(bs[i], o, p) || bs.slice(i + 1).some(l => inside(l, o, p))) continue;
          const under = bs.slice(0, i).findIndex(l => inside(l, o, p));
          if (under >= 0) return { ...p, top: i, under };
        }
      }
      return null;
    },
    /** The reading shown: the live region's sentence, the tooltip and the mark. */
    read: () => {
      const t = q(".flow-box > .tip"), m = q("svg.flow-mark"), k = m?.firstElementChild;
      const cs = k && getComputedStyle(k);
      return {
        plot: svg() ? rect(svg()) : null,
        live: q(".flow-live")?.textContent ?? "",
        tip: t && getComputedStyle(t).display !== "none" ? { text: t.textContent, ...rect(t) } : null,
        mark: k ? { tag: k.tagName, d: k.getAttribute("d"), x: Number(k.getAttribute("x")), y: Number(k.getAttribute("y")), w: Number(k.getAttribute("width")), h: Number(k.getAttribute("height")),
          o: rect(m), stroke: tri(cs.stroke), fill: cs.fill === "none" ? "none" : tri(cs.fill), fillOpacity: Number(cs.fillOpacity) } : null,
      };
    },
    /** The cursor over a point of the window. */
    cursor: (X, Y) => getComputedStyle(document.elementFromPoint(X, Y)).cursor,
    /** The keys under the graph: their column, their entries' names and swatches, and whether one scrolls sideways. */
    keys: () => [...document.querySelectorAll(`${R} .flow-key`)].map(k => ({
      title: k.querySelector(".flow-key-title")?.textContent ?? "", scrolls: k.scrollWidth > k.clientWidth + 1, ...rect(k),
      items: [...k.querySelectorAll("li")].map(li => ({ text: li.textContent.trim(), swatch: tri(getComputedStyle(li.querySelector("i")).backgroundColor) })),
    })),
    box: () => rect(q(".flow-box")),
    /** The section's content box: inside its padding. */
    panel: () => { const s = document.querySelector(R), r = rect(s), cs = getComputedStyle(s); return { l: r.l + parseFloat(cs.paddingLeft), r: r.r - parseFloat(cs.paddingRight) }; },
    label: () => q(".echart")?.getAttribute("aria-label") ?? "",
    /** The live region's sentences from now on. */
    listen: () => {
      window.__said = [];
      if (window.__listening) return;
      window.__listening = true;
      new MutationObserver(() => { const t = q(".flow-live").textContent; if (t) window.__said.push(t); }).observe(q(".flow-live"), { childList: true, subtree: true, characterData: true });
    },
  };
}

/** Counts, from the page's first frame, the different drawings of the flow, and each one's frames: an animation draws
 *  each of its steps for a frame or two. Also every animation of the section and what is in it, by its target. */
function watchDrawing() {
  window.__shapes = [];
  window.__anims = new Set();
  const tick = () => {
    const s = document.querySelector("#flow .echart-plot svg"), f = document.querySelector("#flow");
    if (s?.querySelector("path")) {
      const k = [...s.querySelectorAll("path, text")].map(p => ["d", "x", "y", "fill-opacity", "opacity", "transform", "style"].map(a => p.getAttribute(a) ?? "").join(",")).join(";");
      const last = window.__shapes.at(-1);
      if (last?.k === k) last.frames++;
      else window.__shapes.push({ k, frames: 1 });
    }
    if (f) for (const a of document.getAnimations()) { const t = a.effect?.target; if (t && f.contains(t)) window.__anims.add(t === f ? "section" : t.closest(".echart-plot") ? "drawing" : t.className?.baseVal ?? t.className ?? t.tagName); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// The graph the payload makes, by the design's rules, kept apart from the component's code.
const hash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return h >>> 0; };
/** colors.ts's slots: the six busiest projects of all time, each a hue. */
const slots = order => {
  const out = new Map(), used = new Set();
  for (const p of order.slice(0, 6).sort()) { let i = hash(p) % 6; while (used.has(i)) i = (i + 1) % 6; used.add(i); out.set(p, i); }
  return out;
};
const KINDS = [["k:input", "Input", m => m.cost_input ?? 0], ["k:output", "Output + thinking", m => m.cost_output ?? 0],
  ["k:write", "Cache write", m => (m.cost_cache_5m ?? 0) + (m.cost_cache_1h ?? 0)], ["k:read", "Cache read", m => m.cost_cache_read ?? 0]];
const short = m => m.replace(/^claude-/, "");
const ranked = m => [...m].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
const add = (m, k, v) => m.set(k, (m.get(k) ?? 0) + v);

/** The columns of nodes, top first, each with its id, name, cost, color token and the start of its sentence; the bands. */
function graph(d) {
  const slot = slots(d.project_order ?? []);
  const pairs = d.cost_flow.pairs.filter(p => p.cost > 0), total = pairs.reduce((s, p) => s + p.cost, 0);
  const fold = m => {
    const on = ranked(m);
    let n = 0;
    while (n < on.length && n < 5 && on[n][1] >= .01 * total) n++;
    if (on.length - n === 1) n++;
    return { kept: on.slice(0, n), rest: on.slice(n) };
  };
  const other = (id, rest, word) => (rest.length > 1 ? [{ id, label: `Other (${rest.length})`, value: rest.reduce((s, r) => s + r[1], 0), token: "--proj-other", head: `Other, ${rest.length} ${word}s:` }] : []);
  const modelCost = new Map();
  for (const p of pairs) add(modelCost, p.model, p.cost);
  const series = new Map(ranked(modelCost).slice(0, 6).map(([m], i) => [m, `--series-${i + 1}`]));
  const models = fold(modelCost), modelId = new Map([...models.kept.map(([m]) => [m, "m:" + m]), ...models.rest.map(([m]) => [m, "m"])]);
  const columns = [], bands = new Map();
  const flow = (from, to, v) => { if (v > 0) { const id = `${from}|${to}`; bands.set(id, { id, from, to, value: (bands.get(id)?.value ?? 0) + v }); } };
  if (!d.project) {
    const cost = new Map();
    for (const p of pairs) add(cost, p.project ?? "", p.cost);
    const projects = fold(cost), id = new Map([...projects.kept.map(([p]) => [p, "p:" + p]), ...projects.rest.map(([p]) => [p, "p"])]);
    columns.push({ key: "project", nodes: [...projects.kept.map(([p, value]) => ({ id: "p:" + p, label: p || "(no project)", value, project: p || null,
      token: slot.has(p) ? `--proj-${slot.get(p) + 1}` : "--proj-other", head: `Project ${p || "(no project)"}:` })), ...other("p", projects.rest, "project")] });
    for (const p of pairs) flow(id.get(p.project ?? ""), modelId.get(p.model), p.cost);
  }
  columns.push({ key: "model", nodes: [...models.kept.map(([m, value]) => ({ id: "m:" + m, label: short(m), value, token: series.get(m) ?? "--proj-other", head: `Model ${short(m)}:` })),
    ...other("m", models.rest, "model")] });
  const kinds = new Map();
  for (const m of d.cost_flow.models) {
    const id = modelId.get(m.model);
    if (!id) continue;
    let est = 0;
    for (const [k, , of] of KINDS) { const v = of(m); est += v; if (v > 0) { flow(id, k, v); add(kinds, k, v); } }
    if (m.cost - est > 1e-9) { flow(id, "k:reported", m.cost - est); add(kinds, "k:reported", m.cost - est); }
  }
  const label = new Map([...KINDS.map(([k, l]) => [k, l]), ["k:reported", "Reported"]]);
  columns.push({ key: "kind", nodes: [...ranked([...kinds].filter(([k]) => k !== "k:reported")).sort((a, b) => b[1] - a[1] || (label.get(a[0]) < label.get(b[0]) ? -1 : 1)),
    ...(kinds.has("k:reported") ? [["k:reported", kinds.get("k:reported")]] : [])]
    .map(([k, value]) => ({ id: k, label: label.get(k), value, token: "--text-secondary", head: k === "k:reported" ? "Reported, not split by kind:" : `${label.get(k)}:` })) });
  const nodes = new Map(columns.flatMap((c, ci) => c.nodes.map((n, i) => [n.id, { ...n, ci, i }])));
  const all = [...bands.values()].map(b => ({ ...b, head: `${nodes.get(b.from).label} to ${nodes.get(b.to).label}:` }));
  const order = id => nodes.get(id).i;
  return {
    total, columns, nodes, bands: all,
    out: id => all.filter(b => b.from === id).sort((a, b) => order(a.to) - order(b.to)),
    into: id => all.filter(b => b.to === id).sort((a, b) => order(a.from) - order(b.from)),
  };
}

/** The payload with its pairs changed by f, and each model's cost and kinds scaled with its pairs, so the columns still add up. */
const withPairs = (d, f) => {
  const was = new Map(), now = new Map();
  for (const p of d.cost_flow.pairs) add(was, p.model, p.cost);
  const pairs = f(d.cost_flow.pairs.map(p => ({ ...p })));
  for (const p of pairs) add(now, p.model, p.cost);
  const scale = (m, r) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, typeof v === "number" ? v * r : v]));
  return { ...d, cost_flow: { pairs, models: d.cost_flow.models.map(m => scale(m, (now.get(m.model) ?? 0) / (was.get(m.model) || 1))) } };
};
/** A kind of a few cents in a view of hundreds of dollars: Input is 3 cents, all of it one model's; the rest of the input
 *  cost is reported. */
const tiny = d => ({ ...d, cost_flow: { ...d.cost_flow, models: d.cost_flow.models.map((m, i) => (m.cost_input == null ? m : { ...m, cost_input: i ? 0 : .03 })) } });
/** The costliest project under a long name. */
const long = d => {
  const top = d.cost_flow.pairs.reduce((m, p) => add(m, p.project, p.cost), new Map()), first = ranked(top)[0][0];
  const name = p => (p === first ? LONG : p);
  return { ...d, project_order: d.project_order.map(name), cost_flow: { ...d.cost_flow, pairs: d.cost_flow.pairs.map(p => ({ ...p, project: name(p.project) })) } };
};

/** A drawing matched to the graph: each drawn node to the graph's node in its place, each band to the nodes its ends touch. */
function match(dr, g) {
  const xs = [...new Set(dr.nodes.map(n => Math.round(n.x)))].sort((a, b) => a - b);
  const cols = xs.map(x => dr.nodes.filter(n => Math.round(n.x) === x).sort((a, b) => a.y - b.y));
  const bad = [];
  if (cols.length !== g.columns.length) bad.push(`${cols.length} columns of nodes drawn, ${g.columns.length} in the payload`);
  cols.forEach((c, ci) => {
    const want = g.columns[ci]?.nodes ?? [];
    if (c.length !== want.length) bad.push(`column ${ci + 1}: ${c.length} nodes drawn, ${want.length} in the payload`);
    c.forEach((n, i) => { n.want = want[i]; });
  });
  for (let ci = cols.length; ci < g.columns.length; ci++) bad.push(`column ${ci + 1}: not drawn, ${g.columns[ci].nodes.length} nodes in the payload`);
  const touch = (x, y, right) => {
    const c = cols.find(c => Math.abs((right ? c[0].x + c[0].w : c[0].x) - x) <= .5);
    return c?.find(n => y >= n.y - 1 && y <= n.y + n.h + 1);
  };
  for (const b of dr.bands) {
    b.src = touch(b.x0, b.y0 + b.h / 2, true);
    const t = touch(b.x1, b.y1 + b.h / 2, false);
    b.want = b.src?.want && t?.want ? g.bands.find(w => w.id === `${b.src.want.id}|${t.want.id}`) : null;
  }
  const loose = dr.bands.filter(b => !b.want).length;
  if (loose) bad.push(`${loose} bands drawn join no two nodes of a band of the payload`);
  const ids = dr.bands.filter(b => b.want).map(b => b.want.id);
  const missing = g.bands.filter(b => !ids.includes(b.id)).length, twice = ids.length - new Set(ids).size;
  if (missing) bad.push(`${missing} of the payload's ${g.bands.length} bands not drawn`);
  if (twice) bad.push(`${twice} bands drawn twice`);
  // One scale for every node: each one's height over its cost, the 2px drawn minimum aside.
  const ks = dr.nodes.filter(n => n.want && n.h > 2.5).map(n => n.h / n.want.value), k = Math.min(...ks);
  const off = dr.nodes.filter(n => n.want && n.h > 2.5 && Math.abs(n.h - n.want.value * k) > 1);
  if (off.length) bad.push(`${off.length} nodes not as tall as their cost: ${off.map(n => n.want.label).join(", ")}`);
  return { ok: !bad.length && dr.nodes.length > 0, bad, cols, nodes: dr.nodes, bands: dr.bands };
}

const bez = (a, b, c, d, t) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;
const nums = d => (d.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
/** A band's top and bottom edge at its two ends and its middle, in the window. */
const edges = (b, o) => [0, .5, 1].map(t => { const cx = (b.x0 + b.x1) / 2, top = bez(b.y0, b.y0, b.y1, b.y1, t); return [o.l + bez(b.x0, cx, cx, b.x1, t), o.t + top, o.t + top + b.h]; });
/** How far the mark is from the drawn item: a band's edges at its ends and middle, or a node's sides with its 2px ring. */
function markOff(mark, item, plot) {
  if (!mark) return Infinity;
  if (item.x0 != null) {
    if (mark.tag !== "path") return Infinity;
    const n = nums(mark.d), m = { x0: n[0], y0: n[1], x1: n[6], y1: n[7], h: n[9] - n[7] };
    const a = edges(m, mark.o), b = edges(item, plot);
    return Math.max(...a.flatMap((p, i) => p.map((v, j) => Math.abs(v - b[i][j]))));
  }
  if (mark.tag !== "rect") return Infinity;
  return Math.max(Math.abs(mark.o.l + mark.x + 2 - (plot.l + item.x)), Math.abs(mark.o.t + mark.y + 2 - (plot.t + item.y)), Math.abs(mark.w - 4 - item.w), Math.abs(mark.h - 4 - item.h));
}
const money = s => Number(s.replace(/[$,]/g, ""));

export async function flow(h) {
  const usage = await h.json("/api/usage?range=30");
  const ev = (page, f, arg) => page.evaluate(f, arg);
  const drawing = page => ev(page, () => window.flowfit.drawing());
  const reading = page => ev(page, () => window.flowfit.read());
  const box = page => page.locator(`${ROOT} .echart`);
  /** A page of the flow, drawn or given up on after 4s (a page that draws nothing still gets its checks). */
  const open = (name, { path = PATH, answer = null, options = {}, init = null } = {}) => h.open({ path, root: ROOT, setup: flowReaders, data: DATA, answer,
    ready: async page => {
      await page.waitForSelector(`${ROOT} .echart-plot svg`);
      await until(() => drawing(page), dr => dr.nodes.length > 0);
      await page.locator(ROOT).scrollIntoViewIfNeeded();
    } }, `flow ${name}`, options, init);
  const shot = (page, what) => h.shot(page, ROOT, `flow-${what}`);
  /** Whether the page drew the payload's graph, so its items can be pointed at; when not, a line that says so. */
  const usable = (m, what) => m.ok || line(`${what}: the payload's graph is drawn`, false, m.bad.join("; "));
  /** The drawing matched to the graph of the payload the page got. */
  const matched = async (page, payload) => match(await drawing(page), graph(payload));
  const theme = async (page, want) => {
    for (let i = 0; i < 3 && (await page.locator("#navTheme").getAttribute("aria-label")) !== `Theme: ${want}`; i++) await page.locator("#navTheme").click();
  };
  const blur = page => ev(page, () => document.activeElement?.blur());
  const away = page => page.mouse.move(2, H - 2);
  /** Presses a key by its name in decision 6's table: Right, Left, Up, Down, Home, End. */
  const press = (page, key) => page.keyboard.press(["Right", "Left", "Up", "Down"].includes(key) ? `Arrow${key}` : key);
  /** Ends any reading: the focus off the graph, the pointer away. */
  const rest = async page => { await blur(page); await away(page); await until(() => reading(page), r => !r.live && !r.tip && !r.mark); };
  const sheet = page => ev(page, () => {
    const d = document.querySelector("dialog[open]");
    return d ? { text: d.textContent.slice(0, 200), focus: d.contains(document.activeElement) } : null;
  });
  const closeSheet = async page => { if (await sheet(page)) { await page.keyboard.press("Escape"); await until(() => sheet(page), s => !s); } };
  const params = page => { const u = new URL(page.url()); return { path: u.pathname, project: u.searchParams.get("project"), range: u.searchParams.get("range"), inspect: u.searchParams.get("inspect") }; };

  /** Whether the reading shown is item's: its sentence, its tooltip, and the mark on its drawn shape within 1px. */
  const readsItem = (r, want, drawn, tip = true) => {
    const off = drawn && r.plot ? markOff(r.mark, drawn, r.plot) : Infinity;
    const ok = r.live.startsWith(want.head) && (!tip || r.tip?.text.includes(want.label ?? want.head.split(" to ")[0])) && off <= 1;
    return { ok, at: `"${r.live.split(":")[0] || "nothing said"}"${tip ? `, tooltip ${r.tip ? "shown" : "none"}` : ""}, mark ${off === Infinity ? "none" : `${off.toFixed(2)}px off`}` };
  };
  /** Each drawn item's centre or a point inside it, in the window. */
  const nodeAt = (m, plot, n) => ({ X: Math.round(plot.l + n.x + n.w / 2), Y: Math.round(plot.t + n.y + n.h / 2) });

  // 1. Colors, in light, dark and after an OS flip; the totals.
  {
    const page = await open("colors");
    await ev(page, () => { window.__kept = true; });
    const colors = async () => {
      const m = await matched(page, usage);
      const probes = await ev(page, ts => Object.fromEntries(ts.map(t => [t, window.chartfit.probe(`var(${t})`)])), [...new Set(m.nodes.filter(n => n.want).map(n => n.want.token))]);
      const nodesOff = m.nodes.filter(n => n.want && n.fill !== probes[n.want.token]);
      const bandsOff = m.bands.filter(b => b.src && (b.fill !== b.src.fill || Math.abs(b.op - .4) > .01));
      const first = m.nodes[0];
      return { m, ok: m.ok && !nodesOff.length && !bandsOff.length, first: first?.fill ?? "none",
        detail: `${m.nodes.length} nodes, ${m.bands.length} bands${m.bad.length ? `; ${m.bad.join("; ")}` : ""}${nodesOff.length ? `; not their token: ${nodesOff.map(n => `${n.want.label} rgb(${n.fill}) for ${n.want.token} rgb(${probes[n.want.token]})`).join(", ")}` : ""}${bandsOff.length ? `; ${bandsOff.length} bands not in their source's color at 0.4` : ""}; ${first?.want?.label ?? "no node"} rgb(${first?.fill ?? "none"})` };
    };
    await theme(page, "light");
    const light = await until(colors, c => c.ok);
    const g = graph(usage);
    line(`light: the ${g.columns.map(c => c.nodes.length).join(", ")} nodes and ${g.bands.length} bands of the payload are drawn, each node in its token, each band in its source's at 0.4`, light.ok, light.detail);
    await shot(page, "light");
    await theme(page, "dark");
    const dark = await until(colors, c => c.ok && c.first !== light.first);
    line("dark: every node in its token and every band in its source's, apart from light's", dark.ok && dark.first !== light.first, dark.detail);
    await shot(page, "dark");
    await theme(page, "system");
    const sys = await until(colors, c => c.ok && c.first === light.first);
    await page.emulateMedia({ colorScheme: "dark" });
    const flipped = await until(colors, c => c.ok && c.first === dark.first);
    await page.emulateMedia({ colorScheme: "light" });
    const back = await until(colors, c => c.ok && c.first === light.first);
    const kept = await ev(page, () => window.__kept === true);
    line("System: an OS dark flip and back redraws every node and band in each scheme's colors, with no reload",
      sys.ok && sys.first === light.first && flipped.ok && flipped.first === dark.first && back.ok && back.first === light.first && kept,
      `light rgb(${sys.first}), OS dark rgb(${flipped.first}), back rgb(${back.first}); ${kept ? "no reload" : "RELOADED"}`);

    // The total: the heading's figure, the label's, and each step of the data table.
    const { heading, said } = await until(() => ev(page, () => ({ heading: document.querySelector("#lede .amt")?.textContent ?? "",
      said: /, (\$[\d,.]+) in all/.exec(window.flowfit.label())?.[1] ?? "none" })), t => t.heading === t.said);
    line("the section's total is the heading's figure", said === heading, `label ${said}, heading ${heading}`);
    await page.locator(`${ROOT} .chart-table button`).click();
    const rows = await ev(page, r => [...document.querySelectorAll(`${r} table tbody tr`)].map(tr => [...tr.cells].map(c => c.textContent)), ROOT);
    const steps = {};
    for (const r of rows) steps[r[0]] = (steps[r[0]] ?? 0) + money(r[3]);
    const sums = Object.entries(steps);
    line("the data table's rows of each step add up to the total", sums.length === 2 && sums.every(([, v]) => Math.abs(v - usage.totals.cost) <= .005 * rows.length && `$${Math.round(v).toLocaleString("en-US")}` === heading),
      `${sums.map(([k, v]) => `${k} $${v.toFixed(2)}`).join(", ") || "no rows"} of $${usage.totals.cost.toFixed(2)} (${rows.length} rows)`);
    await page.done();
  }

  // 2. The pointer, the mark, the cursor, the tooltip and the keys, with a kind of a few cents.
  reading: {
    const payload = tiny(usage), g = graph(payload);
    const page = await open("reading", { answer: tiny });
    const m = await matched(page, payload), plot = (await drawing(page)).plot;
    const small = m.nodes.find(n => n.want?.id === "k:input"), smallBand = m.bands.find(b => b.want?.to === "k:input");
    line("the payload is drawn, with Input at 3 cents as a node 2px tall and a band 1px thick", m.ok && small && Math.abs(small.h - 2) < .01 && smallBand && Math.abs(smallBand.h - 1) < .01,
      `${m.bad.join("; ") || `${m.nodes.length} nodes, ${m.bands.length} bands`}; Input ${small ? `${small.h.toFixed(2)}px` : "not drawn"}, its band ${smallBand ? `${smallBand.h.toFixed(2)}px` : "not drawn"}`);
    if (!m.ok) { await page.done(); break reading; }

    // Every node and band, at a point inside its drawn shape.
    const missed = [];
    for (const n of m.nodes) {
      if (!n.want) continue;
      const p = nodeAt(m, plot, n);
      await page.mouse.move(p.X, p.Y);
      const r = await until(() => reading(page), r => readsItem(r, n.want, n).ok);
      if (!readsItem(r, n.want, n).ok) missed.push(`${n.want.label} at ${p.X},${p.Y}: ${readsItem(r, n.want, n).at}`);
    }
    let covered = 0;
    for (const b of m.bands) {
      if (!b.want) continue;
      const p = await ev(page, i => window.flowfit.spot(i), b.i);
      if (!p) { covered++; continue; }
      await page.mouse.move(p.X, p.Y);
      const r = await until(() => reading(page), r => readsItem(r, b.want, b).ok);
      if (!readsItem(r, b.want, b).ok) missed.push(`${b.want.head} at ${p.X},${p.Y}: ${readsItem(r, b.want, b).at}`);
    }
    line(`the pointer inside each of the ${m.nodes.length} nodes and ${m.bands.length - covered} bands drawn reads it, with its tooltip and the mark on it within 1px`,
      m.nodes.length > 0 && !missed.length && covered === 0, `${missed.join("; ") || "all read"}${covered ? `; ${covered} bands have no point of their own` : ""}`);
    if (small) {
      const p = nodeAt(m, plot, small);
      await page.mouse.move(p.X, p.Y);
      const r = await until(() => reading(page), r => readsItem(r, small.want, small).ok);
      line("the 2px Input node reads with its mark on it", readsItem(r, small.want, small).ok, readsItem(r, small.want, small).at);
      await shot(page, "read");
    }
    const x = await ev(page, () => window.flowfit.crossing());
    if (line("two bands cross somewhere", !!x)) {
      const top = m.bands[x.top], under = m.bands[x.under];
      await page.mouse.move(x.X, x.Y);
      const r = await until(() => reading(page), r => readsItem(r, top.want, top).ok);
      line(`where "${top.want?.head}" crosses "${under.want?.head}", the band drawn on top is read`, readsItem(r, top.want, top).ok, readsItem(r, top.want, top).at);
    }
    // The margin left of the projects' labels, the gap between two nodes of a column, and a column's title read nothing.
    const c0 = m.cols[0], gapY = (c0[0].y + c0[0].h + c0[1].y) / 2;
    const empty = [["the margin", { X: Math.round(plot.l + 3), Y: Math.round(plot.t + plot.h / 2) }], ["the gap under the first project", { X: Math.round(plot.l + c0[0].x + c0[0].w / 2), Y: Math.round(plot.t + gapY) }],
      ["the first column's title", { X: Math.round(plot.l + c0[0].x - 10), Y: Math.round(plot.t + 6) }]];
    const read = [];
    for (const [what, p] of empty) {
      await page.mouse.move(p.X, p.Y);
      await sleep(150);
      const r = await reading(page);
      if (r.live || r.tip || r.mark) read.push(`${what}: "${r.live.split(":")[0]}"`);
    }
    line("the margin, the gap between two nodes and a column's title read nothing", !read.length, read.join("; ") || "nothing read");

    // The cursor: a hand over a named project only.
    const named = m.nodes.find(n => n.want?.project), model = m.cols[1][0], band = m.bands.find(b => b.want);
    const bandAt = await ev(page, i => window.flowfit.spot(i), band.i);
    const label = (await drawing(page)).texts.find(t => t.text === named.want.label);
    const cursors = [];
    for (const [what, p] of [[`project ${named.want.label}`, nodeAt(m, plot, named)], [`model ${model.want.label}`, nodeAt(m, plot, model)], ["a band", bandAt],
      ["the project's label", label && { X: Math.round((label.l + label.r) / 2), Y: Math.round((label.t + label.b) / 2) }]]) {
      if (!p) { cursors.push([what, "nowhere"]); continue; }
      await page.mouse.move(p.X, p.Y);
      await sleep(150);
      cursors.push([what, await ev(page, p => window.flowfit.cursor(p.X, p.Y), p)]);
    }
    line("the cursor is a hand over a named project, and not over a model, a band or a label",
      cursors[0][1] === "pointer" && cursors.slice(1).every(([, c]) => c !== "pointer" && c !== "nowhere"), cursors.map(([w, c]) => `${w} ${c}`).join(", "));

    // The tooltip inside the box, beside the leftmost and the rightmost node.
    const tipIn = async (n, what) => {
      await page.mouse.move(nodeAt(m, plot, n).X, nodeAt(m, plot, n).Y);
      const r = await until(() => reading(page), r => r.tip);
      const b = await ev(page, () => window.flowfit.box());
      return { ok: r.tip && r.tip.l >= b.l - .5 && r.tip.r <= b.r + .5, at: `${what}: tooltip ${r.tip ? `${Math.round(r.tip.l - b.l)}..${Math.round(r.tip.r - b.l)}px` : "none"} of ${Math.round(b.w)}px` };
    };
    const edgesIn = [await tipIn(m.cols[0][0], "first project"), await tipIn(m.cols.at(-1)[0], "first kind")];
    line(`at 1440px the tooltip stays inside the box at the left and the right`, edgesIn.every(e => e.ok), edgesIn.map(e => e.at).join("; "));

    // Escape the moment the pointer's tooltip shows, with the focus on another control: in the very task that draws it.
    await rest(page);
    await page.locator("#navTheme").focus();
    await page.locator(ROOT).scrollIntoViewIfNeeded();
    await ev(page, () => {
      window.__escaped = false;
      const o = window.__escaper = new MutationObserver(() => {
        if (!document.querySelector("#flow .flow-box > .tip")) return;
        o.disconnect();
        document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
        window.__escaped = true;
      });
      o.observe(document.querySelector("#flow .flow-box"), { childList: true, subtree: true });
    });
    // The focus scrolled the page to the control: the drawing is elsewhere in the window now.
    const p0 = nodeAt(m, (await drawing(page)).plot, m.cols[0][0]);
    await page.mouse.move(p0.X, p0.Y);
    await until(() => ev(page, () => window.__escaped));
    await sleep(300);
    const atOnce = { escaped: await ev(page, () => { window.__escaper.disconnect(); return window.__escaped; }), r: await reading(page) };
    line("Escape the moment a pointer's tooltip shows, with the focus on another control, closes it", atOnce.escaped && !atOnce.r.tip && !atOnce.r.mark && !atOnce.r.live,
      `${atOnce.escaped ? "Escape pressed as it showed" : "the tooltip never showed"}; after it ${atOnce.r.tip ? "tooltip open" : "no tooltip"}, ${atOnce.r.mark ? "mark drawn" : "no mark"}`);
    // And once it is open.
    await away(page);
    await page.mouse.move(p0.X, p0.Y);
    const opened = await until(() => reading(page), r => r.tip);
    await page.keyboard.press("Escape");
    const closed = await until(() => reading(page), r => !r.tip && !r.mark);
    const focus = await ev(page, () => document.activeElement?.id ?? "");
    line("Escape with the focus on another control closes a tooltip the pointer opened, and leaves the focus there", !!opened.tip && !closed.tip && !closed.mark && focus === "navTheme",
      `${opened.tip ? "opened" : "never opened"}; after Escape ${closed.tip ? "tooltip open" : "no tooltip"}; focus on "#${focus}"`);

    // The keys along the bands.
    await rest(page);
    await box(page).focus();
    const y0 = await ev(page, () => scrollY);
    const P = g.columns[0].nodes, M = g.columns[1].nodes;
    const pa = P[0], ba = g.out(pa.id)[0], mb = M[M.findIndex(n => n.id === ba.to) + 1];
    const ins = g.into(mb.id), last = ins.at(-1), src = g.nodes.get(last.from);
    const steps = [["Right", pa], ["Right", ba], ["Right", g.nodes.get(ba.to)], ["Down", mb], ["Left", ins[0]], ["Up", ins[0]], ["Down", ins[1] ?? ins[0]], ["Home", ins[0]], ["End", last],
      ["Left", src], ["Home", P[0]], ["End", P.at(-1)], ["Up", P.at(-2)], ["Right", g.out(P.at(-2).id)[0]], ["Right", g.nodes.get(g.out(P.at(-2).id)[0].to)]];
    const k1 = g.out(steps.at(-1)[1].id)[0];
    steps.push(["Right", k1], ["Right", g.nodes.get(k1.to)], ["Right", g.nodes.get(k1.to)]);
    const wrong = [];
    for (const [key, want] of steps) {
      await press(page, key);
      const drawn = want.from ? m.bands.find(b => b.want?.id === want.id) : m.nodes.find(n => n.want?.id === want.id);
      const r = await until(() => reading(page), r => readsItem(r, want, drawn).ok);
      const at = readsItem(r, want, drawn);
      if (!at.ok) wrong.push(`${key} wants "${want.head}": ${at.at}`);
    }
    line(`the keys ${steps.map(s => s[0]).join(", ")} read decision 6's items, each with its tooltip and the mark on it within 1px`, !wrong.length, wrong.join("; ") || `ending on "${steps.at(-1)[1].head}"`);
    // Up and Down, each on its own, from a place the page can scroll both ways.
    await ev(page, () => scrollBy(0, -40));
    const ys = [await ev(page, () => scrollY)];
    for (const key of ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowDown"]) {
      await page.keyboard.press(key);
      await sleep(150);
      ys.push(await ev(page, () => scrollY));
    }
    line("Up and Down do not scroll the page", y0 > 0 && ys.every(y => y === ys[0]), `scrollY ${ys.join(", ")}`);

    // Enter on a model, a band and Other opens nothing, and the reading stays; Escape on the box ends it.
    const url = page.url(), declined = [];
    const other = M.at(-1).id === "m" ? M.at(-1) : null;
    await page.keyboard.press("Escape");
    for (const [key, want] of [["Right", P[0]], ["Right", g.out(P[0].id)[0]], ["Right", g.nodes.get(g.out(P[0].id)[0].to)], ...(other ? [["End", other]] : [])]) {
      await press(page, key);
      await until(() => reading(page), r => r.live.startsWith(want.head));
      if (want === P[0]) continue;
      await page.keyboard.press("Enter");
      await sleep(300);
      const r = await reading(page), s = await sheet(page);
      if (s || page.url() !== url || !r.live.startsWith(want.head)) declined.push(`${want.head} ${s ? "opened a sheet" : page.url() !== url ? `moved to ${page.url()}` : `reading "${r.live.split(":")[0]}"`}`);
    }
    line(`Enter on a band, a model${other ? " and Other" : ""} opens nothing, and the reading stays`, !!other && !declined.length, declined.join("; ") || (other ? "declined" : "no Other model in the payload"));
    await page.keyboard.press("Escape");
    const ended = await until(() => reading(page), r => !r.live && !r.tip && !r.mark);
    line("Escape on the focused box ends the reading", !ended.live && !ended.tip && !ended.mark, ended.live || "ended");

    // Enter on a project read by keys opens its sheet, which takes the focus; the URL keeps its filter.
    await page.keyboard.press("ArrowRight");
    await until(() => reading(page), r => r.live.startsWith(P[0].head));
    const was = params(page);
    await page.keyboard.press("Enter");
    const s = await until(() => sheet(page), s => s?.focus);
    const now = params(page);
    line(`Enter on project ${P[0].label} opens its sheet, the sheet takes the focus, the URL keeps its filter`,
      !!s && s.focus && s.text.includes(P[0].label) && now.inspect === P[0].project && now.path === was.path && now.project === was.project && now.range === was.range,
      `${s ? `sheet "${s.text.slice(0, 40).trim()}…", focus ${s.focus ? "in it" : "outside"}` : "no sheet"}; inspect=${now.inspect}, range=${now.range}, project=${now.project}`);
    await closeSheet(page);
    await page.done();
  }

  // 3. Clicks: on a project its sheet, on "(no project)", a model, a band and Other nothing; Enter on "(no project)".
  clicks: {
    const none = d => withPairs(d, ps => { const last = ranked(ps.reduce((m, p) => add(m, p.project, p.cost), new Map())).at(-1)[0]; return ps.map(p => (p.project === last ? { ...p, project: null } : p)); });
    const payload = none(usage), g = graph(payload);
    const page = await open("clicks", { answer: none });
    const m = await matched(page, payload), plot = (await drawing(page)).plot;
    if (!usable(m, "clicks")) { await page.done(); break clicks; }
    const nop = m.nodes.find(n => n.want?.id === "p:"), proj = m.nodes.find(n => n.want?.project), model = m.cols[1][0], other = m.nodes.find(n => n.want?.id === "m");
    const band = m.bands.find(b => b.want), bandAt = await ev(page, i => window.flowfit.spot(i), band.i);
    const url = page.url(), declined = [];
    for (const [what, want, p] of [["(no project)", nop?.want, nop && nodeAt(m, plot, nop)], [`model ${model.want.label}`, model.want, nodeAt(m, plot, model)],
      ["Other", other?.want, other && nodeAt(m, plot, other)], ["a band", band.want, bandAt]]) {
      if (!want || !p) { declined.push(`${what} not drawn`); continue; }
      await page.mouse.click(p.X, p.Y);
      await sleep(300);
      const r = await reading(page), s = await sheet(page);
      if (s || page.url() !== url || !r.live.startsWith(want.head)) declined.push(`${what} ${s ? "opened a sheet" : page.url() !== url ? `moved to ${page.url()}` : `reading "${r.live.split(":")[0]}"`}`);
    }
    if (nop) {
      await page.mouse.move(nodeAt(m, plot, nop).X, nodeAt(m, plot, nop).Y);
      await sleep(150);
      const c = await ev(page, p => window.flowfit.cursor(p.X, p.Y), nodeAt(m, plot, nop));
      if (c === "pointer") declined.push("a hand over (no project)");
    }
    line("a click on (no project), a model, Other or a band opens nothing, and the reading stays; no hand over (no project)", !declined.length, declined.join("; ") || "declined");
    // Enter on "(no project)".
    await rest(page);
    await box(page).focus();
    const P = g.columns[0].nodes, i = P.findIndex(n => n.id === "p:");
    await page.keyboard.press("ArrowRight");
    for (let k = 0; k < i; k++) await page.keyboard.press("ArrowDown");
    await until(() => reading(page), r => r.live.startsWith("Project (no project):"));
    await page.keyboard.press("Enter");
    await sleep(300);
    const r = await reading(page), s = await sheet(page);
    line("Enter on (no project) opens nothing, and the reading stays", !s && page.url() === url && r.live.startsWith("Project (no project):"), `${s ? "a sheet opened" : "no sheet"}, reading "${r.live.split(":")[0]}"`);
    // A click on a project opens its sheet and keeps the filter.
    await rest(page);
    const was = params(page);
    await page.mouse.click(nodeAt(m, plot, proj).X, nodeAt(m, plot, proj).Y);
    const opened = await until(() => sheet(page));
    const now = params(page);
    line(`a click on project ${proj.want.label} opens its sheet, the URL keeps its filter`, !!opened && opened.text.includes(proj.want.label) && now.inspect === proj.want.project && now.range === was.range && now.project === was.project,
      `${opened ? "sheet open" : "no sheet"}; inspect=${now.inspect}, range=${now.range}, project=${now.project}`);
    await closeSheet(page);
    await page.done();
  }

  // 4. Touch, in a 343px box.
  touch: {
    const page = await open("touch", { options: { viewport: { width: PHONE, height: 900 }, hasTouch: true } });
    const m = await matched(page, usage), plot = (await drawing(page)).plot;
    if (!usable(m, "touch")) { await page.done(); break touch; }
    const band = m.bands.find(b => b.want && b.h > 4), p = await ev(page, i => window.flowfit.spot(i), band.i);
    await page.touchscreen.tap(p.X, p.Y);
    const r = await until(() => reading(page), r => r.live.startsWith(band.want.head));
    line(`in a ${Math.round(plot.w)}px box a tap on a band reads it`, r.live.startsWith(band.want.head), `"${r.live.split(":")[0] || "nothing read"}"`);
    // The tooltip inside the box, beside the leftmost and the rightmost node.
    const tips = [];
    for (const n of [m.cols[0][0], m.cols.at(-1)[0]]) {
      await page.mouse.move(nodeAt(m, plot, n).X, nodeAt(m, plot, n).Y);
      const t = await until(() => reading(page), r => r.tip && r.live.startsWith(n.want.head));
      const b = await ev(page, () => window.flowfit.box());
      tips.push({ ok: t.tip && t.tip.l >= b.l - .5 && t.tip.r <= b.r + .5, at: `${n.want.label}: tooltip ${t.tip ? `${Math.round(t.tip.l - b.l)}..${Math.round(t.tip.r - b.l)}px` : "none"} of ${Math.round(b.w)}px` });
    }
    line(`in a ${Math.round(plot.w)}px box the tooltip stays inside the box at the left and the right`, tips.every(t => t.ok), tips.map(t => t.at).join("; "));
    const proj = m.cols[0][0];
    await page.touchscreen.tap(nodeAt(m, plot, proj).X, nodeAt(m, plot, proj).Y);
    const s = await until(() => sheet(page));
    line(`a tap on project ${proj.want.label} opens its sheet`, !!s && s.text.includes(proj.want.label), s ? "sheet open" : "no sheet");
    await page.done();
  }

  // 5. Newer figures: the reading kept, said again by a key's, ended when its item is gone.
  newer: {
    let next = null;
    const page = await open("newer");
    await page.route(DATA, route => h.answer(route, d => (next ? next(d) : d)));
    let change = 0;
    await page.route(/\/api\/status/, route => h.answer(route, s => (change ? { ...s, last_change: `chartfit flow ${change}` } : s)));
    const newer = async f => {
      const before = JSON.stringify((await drawing(page)).bands.map(b => [b.y0, b.h]));
      next = f;
      change++;
      await ev(page, () => window.dispatchEvent(new Event("visibilitychange")));
      return until(async () => JSON.stringify((await drawing(page)).bands.map(b => [b.y0, b.h])), s => s !== before).then(s => s !== before);
    };
    const g = graph(usage), m = await matched(page, usage), plot = (await drawing(page)).plot;
    if (!usable(m, "newer figures")) { await page.unrouteAll({ behavior: "ignoreErrors" }); await page.done(); break newer; }
    const P = g.columns[0].nodes, first = m.cols[0][0];
    // The pointer's reading: the first project, whose cost goes up by $50.
    const up = d => withPairs(d, ps => { let done = false; return ps.map(p => (!done && p.project === P[0].project ? ((done = true), { ...p, cost: p.cost + 50 }) : p)); });
    await page.mouse.move(nodeAt(m, plot, first).X, nodeAt(m, plot, first).Y);
    await until(() => reading(page), r => r.live.startsWith(P[0].head));
    await ev(page, () => window.flowfit.listen());
    const redrawn = await newer(up);
    await sleep(400);
    const want = `$${Math.round(P[0].value + 50)}`;
    const r = await reading(page), heard = await ev(page, () => window.__said);
    line("newer figures keep the pointer's reading, its tooltip shows the new figure, and nothing is said", redrawn && r.live.startsWith(P[0].head) && r.tip?.text.includes(want) && !heard.length,
      `${redrawn ? "redrawn" : "NOT REDRAWN"}; reading "${r.live.split(":")[0]}", tooltip ${r.tip?.text.includes(want) ? `with ${want}` : "without the new figure"}; said ${JSON.stringify(heard)}`);
    // A key's reading says its new sentence once.
    await rest(page);
    await box(page).focus();
    await page.keyboard.press("ArrowRight");
    await until(() => reading(page), r => r.live.startsWith(P[0].head));
    await ev(page, () => window.flowfit.listen());
    const again = await newer(d => up(up(d)));
    await sleep(400);
    const said = await ev(page, () => window.__said);
    line("newer figures keep a key's reading, and say its new sentence once", again && said.length === 1 && said[0].startsWith(P[0].head) && said[0].includes(`$${Math.round(P[0].value + 100)}`),
      `${again ? "redrawn" : "NOT REDRAWN"}; said ${JSON.stringify(said.map(s => s.split(".")[0]))}`);
    // The last two projects fold into Other: the reading on the last one ends, with nothing shown and no error.
    const gone = P.at(-1), keep = new Set(P.slice(0, -2).map(p => p.project));
    for (let k = 1; k < P.length; k++) await page.keyboard.press("ArrowDown");
    await until(() => reading(page), r => r.live.startsWith(gone.head));
    const fold = d => withPairs(d, ps => ps.map(p => (keep.has(p.project) ? p : { ...p, cost: p.cost * 1e-3 })));
    const folded = await newer(fold);
    const after = await until(() => reading(page), r => !r.live && !r.tip && !r.mark);
    const still = graph(fold(usage)).nodes.has(gone.id);
    line(`newer figures in which ${gone.label} folds into Other end its reading: no tooltip, no mark, no sentence`, folded && !still && !after.live && !after.tip && !after.mark,
      `${folded ? "redrawn" : "NOT REDRAWN"}; ${still ? "still a node" : "folded"}; ${after.live ? `says "${after.live.split(":")[0]}"` : "nothing said"}, ${after.tip ? "tooltip" : "no tooltip"}, ${after.mark ? "mark" : "no mark"}`);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.done();
  }

  // 6. Forced colors, at 32px text in a 343px box, where the models are in the key.
  {
    const page = await open("forced colors", { options: { viewport: { width: PHONE, height: 900 }, forcedColors: "active" }, init: root32 });
    const m = await matched(page, usage), dr = await drawing(page);
    const sys = await ev(page, () => ({ text: window.chartfit.probe("CanvasText"), hi: window.chartfit.probe("Highlight") }));
    const bandsOff = dr.bands.filter(b => b.fill !== "none" || b.stroke !== sys.text), nodesOff = dr.nodes.filter(n => n.fill !== sys.text), textsOff = dr.texts.filter(t => t.fill !== sys.text);
    line("forced colors: every band unfilled with a CanvasText edge, every node and label CanvasText", m.ok && !bandsOff.length && !nodesOff.length && dr.texts.length > 0 && !textsOff.length,
      `CanvasText rgb(${sys.text}); ${dr.bands.length} bands${bandsOff.length ? `, ${bandsOff.length} not (fill ${bandsOff[0].fill}, stroke ${bandsOff[0].stroke})` : ""}, ${dr.nodes.length} nodes${nodesOff.length ? `, ${nodesOff.length} not` : ""}, ${dr.texts.length} texts${textsOff.length ? `, ${textsOff.map(t => `"${t.text}" rgb(${t.fill})`).join(", ")}` : ""}${m.bad.length ? `; ${m.bad.join("; ")}` : ""}`);
    const band = m.bands.find(b => b.want), p = band && await ev(page, i => window.flowfit.spot(i), band.i);
    if (p) await page.mouse.move(p.X, p.Y);
    const r = p ? await until(() => reading(page), r => r.mark) : await reading(page), off = r.mark ? markOff(r.mark, band, r.plot) : Infinity;
    line("forced colors: the mark is a Highlight outline with no fill, on the band read", r.mark?.stroke === sys.hi && r.mark?.fill === "none" && off <= 1,
      r.mark ? `stroke rgb(${r.mark.stroke}), fill ${r.mark.fill}, ${off.toFixed(2)}px off; Highlight rgb(${sys.hi})` : `no mark${p ? "" : ": no band drawn to read"}`);
    const keys = await ev(page, () => window.flowfit.keys());
    const sw = keys.flatMap(k => k.items);
    line("forced colors: the key's swatches are CanvasText, each beside its name", sw.length > 0 && sw.every(i => i.swatch === sys.text && i.text.length > 1),
      sw.map(i => `${i.text.split(" $")[0]} rgb(${i.swatch})`).join(", ") || "no key");
    await shot(page, "forced");
    await page.done();
  }

  // 7. Labels by their real widths, at 16px and 32px text, at 1440px and in a 343px box; the sideways scroll and the panel.
  const fit = async (page, s, keyed, what) => {
    const dr = await drawing(page), plot = dr.plot, texts = dr.texts;
    const em = t => ({ ...t, t: (t.t + t.b - t.size) / 2, b: (t.t + t.b + t.size) / 2 });
    const out = texts.filter(t => t.l < plot.l - .5 || t.r > plot.r + .5 || t.t < plot.t - .5 || t.b > plot.b + .5).map(t => `"${t.text}" at ${Math.round(t.l - plot.l)}..${Math.round(t.r - plot.l)}px`);
    const over = [];
    texts.map(em).forEach((a, i, all) => all.slice(i + 1).forEach(c => { if (a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b) over.push(`"${a.text}" and "${c.text}"`); }));
    const cut = texts.find(t => t.text.endsWith("…") && t.text.length > 2 && LONG.startsWith(t.text.slice(0, -1)));
    const sizes = [...new Set(texts.map(t => t.size))];
    const xs = [...new Set(dr.nodes.map(n => Math.round(n.x)))].sort((a, b) => a - b);
    // The middle column's labels: right of its bars, left of the last column's.
    const middle = texts.filter(t => t.l > plot.l + xs[1] && t.r < plot.l + xs[2]);
    const surface = await ev(page, () => window.chartfit.probe("var(--surface-1)"));
    const halo = middle.filter(t => t.stroke !== surface || t.sw !== 3 || t.paint !== "stroke");
    const keys = await ev(page, () => window.flowfit.keys()), b = await ev(page, () => window.flowfit.box()), panel = await ev(page, () => window.flowfit.panel());
    const keyOff = keys.filter(k => k.t < b.b - .5 || k.l < panel.l - .5 || k.r > panel.r + .5 || k.scrolls);
    const titles = keys.map(k => k.title);
    const ok = texts.length > 0 && !out.length && !over.length && cut && cut.text.endsWith("…") && cut.text !== LONG && sizes.length === 1 && sizes[0] === 11 * s &&
      (keyed ? !middle.length : middle.length > 0 && !halo.length) && titles.join() === (keyed ? "Model" : "") && !keyOff.length;
    line(`${what}: no label leaves the box or overlaps another, the long name is cut with "…", the labels are ${11 * s}px, ${keyed ? "the models are in the key under the graph" : "the middle ones have a 3px halo in the surface color"}`, ok,
      `${texts.length} texts at ${sizes.join(", ")}px; ${out.length ? `outside: ${out.join(", ")}; ` : ""}${over.length ? `overlapping: ${over.join(", ")}; ` : ""}long name ${cut ? `"${cut.text}"` : "not drawn"}; ` +
      `${middle.length} middle labels${halo.length ? `, ${halo.length} without the halo` : ""}; key ${titles.length ? titles.map(t => `"${t}"`).join(", ") : "none"}${keyOff.length ? " out of place or scrolling" : ""}`);
  };
  /** The page does not scroll sideways (or, with whole false, nothing in the section reaches past the window), and the box
   *  ends inside its panel. */
  const scroll = async (page, what, whole = true) => {
    const s = await ev(page, r => ({ w: document.documentElement.scrollWidth, iw: innerWidth,
      flow: Math.max(...[document.querySelector(r), ...document.querySelectorAll(`${r} *`)].map(e => e.getBoundingClientRect().right)) }), ROOT);
    const b = await ev(page, () => window.flowfit.box()), panel = await ev(page, () => window.flowfit.panel());
    const inside = b.l >= panel.l - .5 && b.r <= panel.r + .5;
    if (whole) line(`${what}: the page does not scroll sideways, and the flow's box ends inside its panel`, s.w <= s.iw && inside,
      `page ${s.w}px in a ${s.iw}px window; box ${Math.round(b.l)}..${Math.round(b.r)}px in ${Math.round(panel.l)}..${Math.round(panel.r)}px`);
    else line(`${what}: nothing in the flow's section reaches past the window, and its box ends inside its panel`, s.flow <= s.iw + .5 && inside,
      `the section's content ends at ${Math.round(s.flow)}px of ${s.iw}px (the page is ${s.w}px wide); box ${Math.round(b.l)}..${Math.round(b.r)}px in ${Math.round(panel.l)}..${Math.round(panel.r)}px`);
  };
  for (const [width, s] of [[1440, 1], [1440, 2], [PHONE, 1], [PHONE, 2]]) {
    const page = await open(`labels ${width}px ${16 * s}px`, { answer: long, options: { viewport: { width, height: 900 } }, init: s === 2 ? root32 : null });
    const w = Math.round((await drawing(page)).plot?.w ?? 0);
    await fit(page, s, width === PHONE && s === 2, `a ${w}px box, ${16 * s}px text`);
    if (width === 1440 && s === 1) await scroll(page, "a 1440px window");
    if (s === 2) await shot(page, `${w}px-32px`);
    if (width === PHONE && s === 1) await shot(page, `${w}px`);
    await page.done();
  }
  for (const [width, s] of [[375, 1], [1280, 2]]) {
    const page = await open(`${width}px window`, { options: { viewport: { width, height: 900 } }, init: s === 2 ? root32 : null });
    // At 1280px and 32px text the app's nav runs past the window, whatever the flow does: the flow's own content is checked.
    await scroll(page, `a ${width}px window${s === 2 ? " at 32px text" : ""}`, s === 1);
    await page.done();
  }

  // 8. One project selected: two columns, and the table named for it.
  {
    const project = graph(usage).columns[0].nodes.find(n => n.project).project;
    const path = `${PATH}&project=${encodeURIComponent(project)}`;
    const one = await h.json(`/api/usage?range=30&project=${encodeURIComponent(project)}`);
    const page = await open("one project", { path });
    const m = await matched(page, one), titles = (await drawing(page)).texts.map(t => t.text);
    await page.locator(`${ROOT} .chart-table button`).click();
    const table = await ev(page, r => document.querySelector(`${r} table`)?.getAttribute("aria-label") ?? "", ROOT);
    line(`one project selected: two columns, model and token kind, and the table named for ${project}`,
      m.ok && m.cols.length === 2 && titles.includes("Model") && titles.includes("Token kind") && !titles.includes("Project") && table === `Estimated cost on ${project} from model to token kind`,
      `${m.cols.map(c => c.length).join(" and ")} nodes${m.bad.length ? `; ${m.bad.join("; ")}` : ""}; titles ${titles.filter(t => ["Project", "Model", "Token kind"].includes(t)).join(", ")}; table "${table}"`);
    await shot(page, "one-project");
    await page.done();
  }

  // 9. Motion: nothing in the drawing animates; under reduced motion nothing in the section does.
  for (const motion of ["no-preference", "reduce"]) {
    const page = await open(`motion ${motion}`, { options: { reducedMotion: motion }, init: watchDrawing });
    let change = 0;
    await page.route(DATA, route => h.answer(route, d => (change ? withPairs(d, ps => ps.map((p, i) => (i ? p : { ...p, cost: p.cost + 40 * change }))) : d)));
    await page.route(/\/api\/status/, route => h.answer(route, s => (change ? { ...s, last_change: `chartfit flow motion ${change}` } : s)));
    await sleep(1200);
    const shapes = () => ev(page, () => window.__shapes.map(s => s.frames));
    const first = await shapes();
    change = 1;
    await ev(page, () => window.dispatchEvent(new Event("visibilitychange")));
    await until(shapes, s => s.length > first.length);
    await sleep(1200);
    const newer = await shapes();
    await ev(page, () => window.__anims.clear());
    await page.locator("#fRange button", { hasText: /^7d$/ }).click();
    await until(shapes, s => s.length > newer.length);
    await sleep(1200);
    const all = await shapes(), anims = await ev(page, () => [...window.__anims]);
    // A drawing an animation makes lasts a frame or two; every drawing here must stay, but the last of each change.
    const steps = all.slice(0, -1).filter(f => f < 3).length;
    if (motion === "no-preference") line("with motion on, the drawing does not animate: on the first drawing, newer figures or a view change, each is drawn at once",
      steps === 0 && newer.length > first.length && all.length > newer.length && !anims.includes("drawing"),
      `${all.length} drawings, frames each ${all.join(", ")}; animated: ${anims.join(", ") || "nothing"}`);
    else line("under reduced motion nothing in the section animates on a view change, and the drawing does not either", steps === 0 && all.length > newer.length && !anims.length,
      `${all.length} drawings, frames each ${all.join(", ")}; animated: ${anims.join(", ") || "nothing"}`);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.done();
  }
}
