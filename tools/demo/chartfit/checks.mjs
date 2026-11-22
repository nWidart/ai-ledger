// The checks every chart runs, from its page's descriptor. chart(h, d) binds them to the harness h and the descriptor d:
//   name     the page's name, for the screenshots (<name>-chart-<what>.png)
//   path     the page's URL path, with the view's query
//   root     the selector of the chart's panel; the readers look under it
//   points   the key of each point, in order: the chart is drawn once it draws as many bars' columns
//   label    label(key, long): the point's short label, or its long one, as the axis, tooltip and live region word them
//   unit     { one, many }: what a point is ("day", "days"), as the checks' lines and the page's words name it
//   at       the index of the point the pointer and the keys read
//   data     the request of the chart's payload, a RegExp
//   newer    newer(payload, more): the payload with figures more higher, the same view
//   kept     [name, selector] pairs of what a zoom leaves alone, beside the URL and the requests
// and, when the page needs them:
//   setup    a function run in every page before its scripts, such as one that picks a measure in localStorage
//   answer   answer(payload): the chart's payload as every page of the descriptor gets it, for a case the store lacks
//   zoom     false for a chart with no zoom slider: the colors block then checks no slider handles
//   activates false for a chart that takes no activation: the pointer is then never a hand over it
//   said     said(key): the point as the zoom sentence names it, label(key) by default; the sentence may name "the weeks of"
//   tell     the index of the legend key whose color differs between light and dark, 0 by default
//   fewer    fewer(payload, n): the payload without its first n points, the same view, for the backfill block
// A chart below the first screen is scrolled into view once drawn, so the pointer can reach it.
// The page module calls the blocks in its order, with its own checks between them.
import { H, W, line, sleep, until } from "./harness.mjs";

/** An init script for 200% text: the root font size at 32px, set as soon as <html> exists, before the app reads it. */
export const root32 = () => {
  const set = () => { if (!document.documentElement) return false; document.documentElement.style.fontSize = "32px"; return true; };
  if (!set()) new MutationObserver((_, o) => { if (set()) o.disconnect(); }).observe(document, { childList: true });
};

export function chart(h, d) {
  const P = d.points, N = P.length, I = d.at, { one, many } = d.unit, label = d.label;
  const ev = (page, f, arg) => page.evaluate(f, arg);
  /** The point a text names, by its long label at the start: an index of points, or -1. */
  const named = text => P.findIndex(k => text.startsWith(label(k, true)));
  /** Where the chart draws point i when it shows points from..to: the middle of its band. */
  const centre = (g, i, from = 0, to = N - 1) => g.l + (i - from + .5) * (g.r - g.l) / (to - from + 1);
  /** The points shown, from the live region's zoom sentence ("Showing Oct 11 to Oct 20, 10 of 30 days."). */
  const zoomed = new RegExp(`^Showing (?:the ${many} of )?(.+?) to (.+?), \\d+ of \\d+ ${many}\\.$`);
  const said = d.said ?? (k => label(k));
  const shownBy = text => {
    const m = zoomed.exec(text);
    return m ? { from: P.findIndex(k => said(k) === m[1]), to: P.findIndex(k => said(k) === m[2]) } : null;
  };
  /** A page of the chart, drawn: on another path, with another answer to its payload, or drawing another count of points. */
  const openOn = ({ path = d.path, answer = d.answer, points = N } = {}, name, options, init) => h.open({ path, root: d.root, setup: d.setup, data: d.data, answer,
    ready: async page => {
      await page.waitForFunction(n => window.chartfit.points().length === n, points);
      await page.locator(d.root).scrollIntoViewIfNeeded();
    } }, name, options, init);
  const open = (name, options, init) => openOn({}, name, options, init);
  const shot = (page, what) => h.shot(page, d.root, `${d.name}-chart-${what}`);
  const drawn = page => ev(page, () => window.chartfit.points().length);
  const away = page => page.mouse.move(2, H - 2);
  const box = page => page.locator(`${d.root} .echart`);
  const showAll = page => page.locator(`${d.root} .show-all`);
  const state = page => ev(page, () => ({ band: window.chartfit.band(), tip: window.chartfit.tip(), readout: window.chartfit.readout(), grid: window.chartfit.grid() }));
  /** Whether the band, the tooltip and the readout are on point i, drawn at x; a line saying where each is. */
  const onPoint = (s, i, x) => {
    const bandAt = s.band ? (s.band.l + s.band.r) / 2 : NaN;
    const ok = s.band && Math.abs(bandAt - x) <= 1.5 && named(s.tip?.day ?? "") === i && named(s.readout) === i;
    return { ok, at: `band at ${Math.round(bandAt)}px (${one} ${i + 1} at ${Math.round(x)}px), tooltip "${s.tip?.day ?? "none"}", readout "${s.readout.split(":")[0]}"` };
  };
  // Beside the point read: right of it, or left of it near the box's right edge, and never over it.
  const beside = (s, x) => s.tip && (s.tip.l >= x + 4 || s.tip.r <= x - 4);
  /** The texts that leave the box, and the pairs that overlap, each said with its place in the box. Texts overlap when
   *  their em boxes do. A text's box is its line box, taller than its glyphs: at 32px the line boxes of "$0" and the first
   *  day's label meet where their glyphs are well apart. */
  const fit = (texts, box) => {
    const em = t => ({ ...t, t: (t.t + t.b - t.size) / 2, b: (t.t + t.b + t.size) / 2 });
    const at = t => `${Math.round(t.l - box.l)}..${Math.round(t.r - box.l)} x ${Math.round(t.t - box.t)}..${Math.round(t.b - box.t)}px`;
    const out = texts.filter(t => t.l < box.l - .5 || t.r > box.r + .5 || t.t < box.t - .5 || t.b > box.b + .5)
      .map(t => `"${t.text}" at ${Math.round(t.l - box.l)}..${Math.round(t.r - box.l)}px, ${Math.round(t.t - box.t)}..${Math.round(t.b - box.t)}px of ${Math.round(box.w)}x${Math.round(box.h)}`);
    const over = [];
    texts.map(em).forEach((a, i, all) => all.slice(i + 1).forEach(c => { if (a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b) over.push(`"${a.text}" at ${at(a)} and "${c.text}" at ${at(c)}`); }));
    return { out, over };
  };
  /** Moves the pointer off the chart and waits for its reading to end. */
  const leave = async page => {
    await ev(page, () => document.activeElement?.blur());
    await away(page);
    await until(() => state(page), s => !s.band && !s.tip);
  };
  /** The band's centre's distance from column c's, and where the band, the tooltip and the readout are for point i. */
  const offBy = (s, c) => (s.band && c ? Math.abs((s.band.l + s.band.r) / 2 - c.x) : Infinity);
  const where = (s, c, i) => `${one} ${i + 1}: band at ${s.band ? ((s.band.l + s.band.r) / 2).toFixed(1) : "none"}px, its bar at ${c ? c.x.toFixed(1) : "none"}px, tooltip "${s.tip?.day ?? "none"}", readout "${s.readout.split(":")[0]}"`;
  const mid = r => (r ? (r.l + r.r) / 2 : NaN);
  const px = n => (Number.isFinite(n) ? `${n.toFixed(1)}px` : "none");
  /** A page whose chart's payload is answered with before(payload) at first, and after(payload) from fill() on: fill()
   *  makes the page ask for it again, as a window focus after a background ingest does, and resolves once the chart has
   *  drawn something else (its bars, or its slider's handles when a zoom keeps the same days), with whether it did. Both
   *  get the payload as the descriptor's answer makes it. points: the bars' columns drawn at first. */
  const openMoving = async (name, { before, after = p => p, points }, options) => {
    let moved = false;
    const answer = json => { const base = d.answer ? d.answer(json) : json; return moved ? after(base) : before(base); };
    const page = await openOn({ answer, points }, name, options);
    await page.route(/\/api\/status/, route => h.answer(route, s => (moved ? { ...s, last_change: "chartfit backfill" } : s)));
    const look = () => ev(page, () => JSON.stringify([window.chartfit.bars().map(r => [Math.round(r.l), Math.round(r.t), Math.round(r.h)]), window.chartfit.handles().map(r => Math.round(r.l))]));
    const fill = async () => {
      const was = await look();
      moved = true;
      await ev(page, () => window.dispatchEvent(new Event("visibilitychange")));
      return (await until(look, s => s !== was)) !== was;
    };
    return { page, fill };
  };
  /** The point labels drawn under the plot, left first: the texts there that are a point's short label. */
  const labels = async page => (await ev(page, () => {
    const g = window.chartfit.grid();
    return g ? window.chartfit.texts().filter(t => t.t >= g.b - 1).sort((a, b) => a.l - b.l).map(t => t.text) : [];
  })).filter(t => P.some(k => label(k) === t));
  const ends = ls => (ls.length ? `${ls[0]} to ${ls.at(-1)}` : "no labels");
  /** Notes on each animation frame, from now until framed(), where the tooltip and the band are, what the tooltip names,
   *  which drawing the bars are (their columns' count and outer edges), how many columns are drawn, and which of them the
   *  band is on (-1 for none). zrender stops its own frame loop after 10 still frames, and a redraw or the band's action
   *  starts it again after this loop has asked for its next frame, so in each frame this loop runs first: a note is taken
   *  before zrender draws that frame. It holds the tooltip as the browser then paints it, and the band and the bars as the
   *  frame before painted them, so in the notes the band reaches a new place one frame late. */
  const watch = page => ev(page, () => {
    window.__frames = [];
    window.__framing = true;
    const tick = () => {
      const t = window.chartfit.tip(), b = window.chartfit.band(), cs = window.chartfit.columns();
      window.__frames.push({ tip: t && { l: t.l, r: t.r, day: t.day }, band: b && { l: b.l, r: b.r },
        bars: cs.length ? `${cs.length} ${Math.round(cs[0].l)} ${Math.round(cs.at(-1).r)}` : "",
        cols: cs.length, col: b ? cs.findIndex(c => Math.abs(c.x - (b.l + b.r) / 2) <= 1) : -1 });
      if (window.__framing) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const framed = page => ev(page, () => { window.__framing = false; return window.__frames; });
  /** The tooltip's gap to the place it points at (tipAt() in web/src/components/chart.ts): right of it, or left near the
   *  box's right edge. */
  const GAP = 14;
  /** How far the place a tooltip points at is from x. */
  const aim = (tip, x) => Math.min(Math.abs(tip.l - GAP - x), Math.abs(tip.r + GAP - x));
  /** Whether, on every frame noted, the tooltip was open, named point k and pointed within half a band of the band's
   *  centre; with still, a pixel, whether the band stayed within half a band of it; without, whether the band was on point
   *  k's column. Points not yet drawn are the oldest (a backfill), or with newest the newest, so on a frame of fewer
   *  columns than points point k's column is k less the points missing, or k. A redraw drops ECharts' band for a frame or
   *  two: on such a frame the tooltip is held to the band of the nearest frame with the same bars, so it is still held to
   *  the drawing on screen. */
  const steady = (fs, k, { still = null, newest = false } = {}) => {
    let tipOff = 0, bandOff = 0, bare = 0, over = 0, closed = 0, loose = 0, half = 0;
    const off = new Set(), cols = new Set();
    if (still == null) for (const f of fs) if (f.band && f.col !== (newest ? k : k - (N - f.cols))) cols.add(`${f.col < 0 ? "none" : `column ${f.col + 1}`} of ${f.cols}`);
    const near = i => {
      for (let j = 1; j < fs.length; j++) for (const at of [i - j, i + j]) if (fs[at]?.band && fs[at].bars === fs[i].bars) return fs[at].band;
      return null;
    };
    fs.forEach((f, i) => {
      if (!f.band) bare++;
      if (!f.tip) { closed++; return; }
      if (named(f.tip.day) !== k) off.add(f.tip.day);
      const band = f.band ?? near(i);
      if (!band) { loose++; return; }
      half = (band.r - band.l) / 2;
      const c = mid(band), t = aim(f.tip, c);
      tipOff = Math.max(tipOff, t);
      if (still != null && f.band) bandOff = Math.max(bandOff, Math.abs(c - still));
      if (t > half || (still != null && f.band && Math.abs(c - still) > half)) over++;
    });
    return {
      ok: fs.length > 0 && fs.some(f => f.band) && !closed && !loose && !off.size && !over && !cols.size,
      at: `${fs.length} frames, ${bare} without a band${loose ? ` (${loose} with no band of the same bars)` : ""}, ${closed} with no tooltip; the tooltip pointed at most ${px(tipOff)} from the band's centre${still != null ? `, the band moved at most ${px(bandOff)}` : ""}, half a band ${px(half)}${over ? `, ${over} frames off` : ""}${off.size ? `; named ${[...off].map(t => `"${t}"`).join(", ")}` : ""}${still == null ? (cols.size ? `; the band on ${[...cols].join(", ")}, not ${one} ${k + 1}'s` : `; the band on ${one} ${k + 1}'s column`) : ""}`,
    };
  };
  /** Focuses the chart's box and reads point I with the keys. */
  const read = async page => {
    await box(page).focus();
    for (let k = 0; k <= I; k++) await page.keyboard.press("ArrowRight");
  };

  /** Whether every legend key's color is drawn, and the keys' colors. */
  const drawnKeys = page => ev(page, () => {
    const fills = new Set(window.chartfit.bars().map(b => b.fill));
    const keys = window.chartfit.keys();
    return { keys, ok: keys.length > 0 && keys.every(k => fills.has(k.color) && k.color === window.chartfit.probe(k.css)), fills: [...fills] };
  });
  const keyLine = k => k.keys.map(x => `${x.name} ${x.css} rgb(${x.color})`).join(", ");
  /** Answers the chart's payload with figures more() higher once more() is not 0, and the status with a new change then, so
   *  a window focus (a visibilitychange) makes the page fetch its payload again, as a background ingest does. */
  const newerOn = async (page, more) => {
    await page.route(d.data, route => h.answer(route, json => {
      const base = d.answer ? d.answer(json) : json;
      return more() ? d.newer(base, more()) : base;
    }));
    await page.route(/\/api\/status/, route => h.answer(route, s => (more() ? { ...s, last_change: `chartfit ${more()}` } : s)));
  };
  /** Bars that grow during act() and the second after it: the most bar segments drawn growing in any frame. */
  const growth = async (page, act) => {
    await ev(page, () => {
      window.__grew = 0;
      window.__watching = true;
      const tick = () => { window.__grew = Math.max(window.__grew, window.chartfit.growing()); if (window.__watching) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    await act();
    await sleep(1000);
    return ev(page, () => { window.__watching = false; return window.__grew; });
  };
  /** Counts, from the page's first frame, the most bar segments drawn growing in any frame, as window.__grew. */
  const watchGrowth = () => {
    window.__grew = 0;
    const tick = () => { if (window.chartfit) window.__grew = Math.max(window.__grew, window.chartfit.growing()); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
  const theme = async (page, want) => {
    for (let i = 0; i < 3 && (await page.locator("#navTheme").getAttribute("aria-label")) !== `Theme: ${want}`; i++) await page.locator("#navTheme").click();
  };
  /** The slider's two handles stand out from the panel behind them: 3:1 at least, as a control's boundary must. */
  const handleLine = async (page, scheme) => {
    const h = await ev(page, () => {
      const panel = window.chartfit.panel();
      return { panel, handles: window.chartfit.handles().map(x => ({ fill: x.fill, ratio: window.chartfit.contrast(x.fill, panel) })) };
    });
    line(`${scheme}: the slider's two handles stand out from the panel, 3:1 at least`, h.handles.length === 2 && h.handles.every(x => x.ratio >= 3),
      `${h.handles.map(x => `rgb(${x.fill}) ${x.ratio.toFixed(2)}:1`).join(", ") || "no handles"} on rgb(${h.panel})`);
  };

  return {
    N, I, P, named, centre, shownBy, open, openOn, shot, ev, drawn, away, box, showAll, state, read, onPoint, drawnKeys, keyLine, newerOn,
    mid, px, beside, aim, openMoving, labels, ends, watch, framed, steady,

    /** Colors: light, the toggle's dark, then System with the OS scheme flipped; the slider's handles in light and dark. */
    async colors() {
      const page = await open("colors");
      await ev(page, () => { window.__kept = true; });
      await theme(page, "light");
      const light = await until(() => drawnKeys(page), k => k.ok);
      line("light: each legend key's color is drawn", light.ok, keyLine(light));
      if (d.zoom !== false) await handleLine(page, "light");
      await shot(page, "light");
      // The first key's color tells the schemes apart: every --proj-N token differs between them. A chart whose first key's
      // token is the same in both (the trend's --good) names the key that tells them apart, d.tell.
      const T = d.tell ?? 0;
      const like = want => k => k.ok && k.keys[T].color === want.keys[T].color;
      await theme(page, "dark");
      const dark = await until(() => drawnKeys(page), k => k.ok && k.keys[T].color !== light.keys[T].color);
      const dataTheme = await ev(page, () => document.documentElement.dataset.theme);
      line(`dark (data-theme="${dataTheme}"): each legend key's color is drawn, and differs from light`, dataTheme === "dark" && dark.ok && dark.keys[T].color !== light.keys[T].color, keyLine(dark));
      if (d.zoom !== false) await handleLine(page, "dark");
      await shot(page, "dark");
      await theme(page, "system");
      const sysLight = await until(() => drawnKeys(page), like(light));
      await page.emulateMedia({ colorScheme: "dark" });
      const flipped = await until(() => drawnKeys(page), like(dark));
      await page.emulateMedia({ colorScheme: "light" });
      const back = await until(() => drawnKeys(page), like(light));
      const kept = await ev(page, () => window.__kept === true);
      line("System: an OS dark flip and back redraws in each scheme's colors, with no reload", like(light)(sysLight) && like(dark)(flipped) && like(light)(back) && kept,
        `light ${keyLine(sysLight)}; OS dark ${keyLine(flipped)}; ${kept ? "no reload" : "RELOADED"}`);
      await page.done();
    },

    /** The reading keeps the drawing's colors: in light, with the keys on point I, each legend key's color is still drawn,
     *  and no bar is drawn in a color that is not a key's. By default ECharts highlights the items under its axis pointer:
     *  it redrew the bars read in lifted colors, and gave a line with no symbols a dot in its own palette. */
    async readColors() {
      const page = await open("reading colors");
      await theme(page, "light");
      await until(() => drawnKeys(page), k => k.ok);
      await read(page);
      await until(() => state(page), s => s.band);
      await sleep(200); // a highlight is drawn on a frame after the band's
      const k = await drawnKeys(page);
      const off = k.fills.filter(f => !k.keys.some(x => x.color === f));
      line(`light, with ${one} ${I + 1} read: each legend key's color is drawn, and no bar in another color`, k.ok && !off.length,
        off.length ? `not a key's: ${off.map(f => `rgb(${f})`).join(", ")}; ${keyLine(k)}` : keyLine(k));
      await page.done();
    },

    /** Forced colors: system colors for the text, the band and the bars' edges. */
    async forcedColors() {
      const page = await open("forced colors", { forcedColors: "active" });
      const g = await ev(page, () => window.chartfit.grid());
      await page.mouse.move(centre(g, I), (g.t + g.b) / 2);
      const got = await until(() => ev(page, () => ({ band: window.chartfit.band(), texts: window.chartfit.texts(), bars: window.chartfit.bars(),
        canvasText: window.chartfit.probe("CanvasText"), highlight: window.chartfit.probe("Highlight") })), r => r.band);
      const off = got.texts.filter(t => t.fill !== got.canvasText);
      line("forced colors: the axis text is CanvasText", got.texts.length > 0 && !off.length, `CanvasText rgb(${got.canvasText}); ${off.length ? off.map(t => `"${t.text}" rgb(${t.fill})`).join(", ") : `${got.texts.length} texts`}`);
      line(`forced colors: the ${one} read is a band in Highlight`, got.band?.fill === got.highlight,
        got.band ? `band rgb(${got.band.fill}) at ${got.band.opacity}, Highlight rgb(${got.highlight})` : "no band");
      const edged = got.bars.filter(x => x.stroke && x.stroke !== "none");
      line("forced colors: every bar segment has an edge", got.bars.length > 0 && edged.length === got.bars.length,
        `${edged.length} of ${got.bars.length} stroked${edged[0] ? `, ${edged[0].stroke}` : ""}${edged.length < got.bars.length ? `; not: ${got.bars.filter(x => !edged.includes(x)).map(x => `rgb(${x.fill}) at ${Math.round(x.l)},${Math.round(x.t)} ${Math.round(x.w)}x${Math.round(x.h)}`).join(", ")}` : ""}`);
      await shot(page, "forced-colors");
      await page.done();
    },

    /** 200% text: the axis labels stay in the box and apart. */
    async textSize() {
      const page = await open("32px root", {}, root32);
      const { texts, box, root, size } = await ev(page, () => ({ texts: window.chartfit.texts(), box: window.chartfit.box(), root: getComputedStyle(document.documentElement).fontSize,
        size: window.chartfit.textSize() }));
      line("32px root: the axis labels are drawn at twice their size", root === "32px" && size >= 22, `root ${root}, labels ${size}px`);
      const { out, over } = fit(texts, box);
      line("32px root: no axis label leaves the box", texts.length > 0 && !out.length, out.join("; ") || `${texts.length} labels`);
      line("32px root: no two labels overlap", !over.length, over.join("; "));
      await shot(page, "text-32px");
      await page.done();
    },

    /** The pointer on point I and on the last point: band, tooltip, readout, and the hand over a point only. */
    async pointer(page) {
      const g = await ev(page, () => window.chartfit.grid());
      await page.mouse.move(centre(g, I), (g.t + g.b) / 2);
      const moved = await until(() => state(page), s => onPoint(s, I, centre(g, I)).ok);
      const pm = onPoint(moved, I, centre(g, I));
      line(`pointer over ${one} ${I + 1}: band, tooltip and readout name ${label(P[I], true)}`, pm.ok, pm.at);
      line("pointer: the tooltip sits beside the band, to its right", beside(moved, centre(g, I)) && moved.tip.l > centre(g, I),
        moved.tip ? `tooltip ${Math.round(moved.tip.l)}..${Math.round(moved.tip.r)}px, point at ${Math.round(centre(g, I))}px` : "no tooltip");
      await shot(page, "tooltip");
      const hand = await ev(page, ([x, y]) => getComputedStyle(document.elementFromPoint(x, y)).cursor, [centre(g, I), (g.t + g.b) / 2]);
      const axisText = (await ev(page, () => window.chartfit.texts())).find(t => t.t >= g.b);
      await page.mouse.move((axisText.l + axisText.r) / 2, (axisText.t + axisText.b) / 2);
      await sleep(100);
      const notHand = await ev(page, ([x, y]) => getComputedStyle(document.elementFromPoint(x, y)).cursor, [(axisText.l + axisText.r) / 2, (axisText.t + axisText.b) / 2]);
      if (d.activates === false) line(`the pointer is never a hand: a ${one} takes no activation`, hand !== "pointer" && notHand !== "pointer", `over ${one} ${I + 1}: ${hand}; over "${axisText.text}": ${notHand}`);
      else line(`the pointer is a hand over a ${one}, not over a ${one} label`, hand === "pointer" && notHand !== "pointer", `over ${one} ${I + 1}: ${hand}; over "${axisText.text}": ${notHand}`);
      await page.mouse.move(centre(g, N - 1), (g.t + g.b) / 2);
      const last = await until(() => state(page), s => named(s.readout) === N - 1);
      line(`pointer over the last ${one}: the tooltip flips to the band's left, inside the window`, beside(last, centre(g, N - 1)) && last.tip.r < centre(g, N - 1) && last.tip.l >= 0 && last.tip.r <= W,
        last.tip ? `tooltip ${Math.round(last.tip.l)}..${Math.round(last.tip.r)}px, point at ${Math.round(centre(g, N - 1))}px` : "no tooltip");
    },

    /** The keys read point I: band, tooltip and readout on it. Leaves the box focused on it. */
    async keys(page) {
      await away(page);
      await read(page);
      const keyed = await until(() => state(page), s => onPoint(s, I, centre(s.grid, I)).ok);
      const km = onPoint(keyed, I, centre(keyed.grid, I));
      line(`${I + 1} presses of Right: band, tooltip and readout name ${label(P[I], true)}`, km.ok, km.at);
      line("keys: the tooltip sits beside the band", beside(keyed, centre(keyed.grid, I)),
        keyed.tip ? `tooltip ${Math.round(keyed.tip.l)}..${Math.round(keyed.tip.r)}px, point at ${Math.round(centre(keyed.grid, I))}px` : "no tooltip");
    },

    /** The zoom keys: plus around the point read, minus back; Ctrl+plus is the browser's. */
    async zoomKeys(page) {
      await ev(page, () => window.chartfit.listen());
      await ev(page, () => document.activeElement?.blur());
      await read(page);
      await page.keyboard.press("+");
      // ECharts draws the band on the frame after the zoom: wait for it at the point's new place, not for the band it had.
      const z = await until(() => state(page), s => {
        const w = shownBy(s.readout);
        return w && s.band && Math.abs((s.band.l + s.band.r) / 2 - centre(s.grid, I, w.from, w.to)) <= 1.5;
      });
      const shown = await drawn(page);
      const w = shownBy(z.readout);
      const zm = w && onPoint({ ...z, readout: label(P[I], true) }, I, centre(z.grid, I, w.from, w.to));
      line(`plus zooms around the ${one} read, and the band stays on its pixels`, !!w && shown === w.to - w.from + 1 && shown < N && zm.ok,
        w ? `${shown} ${many} drawn, ${label(P[w.from])} to ${label(P[w.to])}; ${zm.at}` : `live region "${z.readout}"`);
      await shot(page, "zoomed");
      await page.keyboard.press("-");
      const all = await until(() => drawn(page), n => n === N);
      line(`minus shows every ${one} again`, all === N, `${all} of ${N} ${many} drawn`);
      await ev(page, () => addEventListener("keydown", e => { window.__prevented = e.defaultPrevented; }, { once: true }));
      await page.keyboard.press("Control+Equal");
      await sleep(200);
      const ctrl = await ev(page, () => ({ prevented: window.__prevented, points: window.chartfit.points().length }));
      line("Ctrl+plus is left to the browser", ctrl.prevented === false && ctrl.points === N, `default ${ctrl.prevented ? "prevented" : "kept"}, ${ctrl.points} ${many} drawn`);
    },

    /** A real drag of the slider's handles, what it leaves alone and says, then "Show all". Ends with every point shown. */
    async slider(page) {
      await ev(page, () => document.activeElement?.blur());
      await away(page);
      const fixed = async () => {
        const v = {};
        for (const [k, sel] of d.kept) v[k] = await page.locator(sel).textContent();
        return { ...v, url: page.url(), requests: page.requests.length };
      };
      const before = await fixed();
      const handle = await ev(page, () => {
        const hs = window.chartfit.handles(), r = hs.at(-1);
        return hs.length === 2 ? { x: (r.l + r.r) / 2, y: (r.t + r.b) / 2, slider: r.r - hs[0].l } : null;
      });
      if (!line("the zoom slider has handles under the plot", !!handle)) throw new Error("no slider handle to drag");
      await ev(page, () => { window.__said = []; });
      await page.mouse.move(handle.x, handle.y);
      await page.mouse.down();
      for (let k = 1; k <= 12; k++) { await page.mouse.move(handle.x - handle.slider * .45 * k / 12, handle.y); await sleep(40); }
      await sleep(300);
      const whileDown = await ev(page, () => window.__said.filter(t => t.startsWith("Showing")));
      await page.mouse.up();
      await sleep(400);
      const after = await fixed();
      const dragged = await ev(page, () => ({ points: window.chartfit.points().length, said: window.__said.filter(t => t.startsWith("Showing")) }));
      line(`dragging a slider handle changes the ${many} drawn`, dragged.points < N, `${dragged.points} of ${N} ${many} drawn`);
      line(`the drag leaves ${d.kept.map(([k]) => `the ${k}`).join(", ")}, the URL and the requests alone`, JSON.stringify(before) === JSON.stringify(after),
        Object.keys(before).filter(k => before[k] !== after[k]).map(k => `${k}: ${before[k]} became ${after[k]}`).join("; "));
      line(`the live region says the ${many} shown once, on release`, whileDown.length === 0 && dragged.said.length === 1 && shownBy(dragged.said[0])?.to - shownBy(dragged.said[0])?.from + 1 === dragged.points,
        `${whileDown.length} while down, then ${JSON.stringify(dragged.said)}`);
      // A release right after the last move. ECharts can throttle the slider's updates: one still pending at the release
      // would come after it and be said a second time. Six moves of the left handle and the release, as fast as they go.
      const left = await ev(page, () => {
        const hs = window.chartfit.handles(), l = hs[0];
        return hs.length === 2 ? { x: (l.l + l.r) / 2, y: (l.t + l.b) / 2 } : null;
      });
      await ev(page, () => { window.__said = []; });
      await page.mouse.move(left.x, left.y);
      await page.mouse.down();
      for (let k = 1; k <= 6; k++) await page.mouse.move(left.x + handle.slider * .2 * k / 6, left.y);
      await page.mouse.up();
      await sleep(400);
      const quick = await ev(page, () => ({ points: window.chartfit.points().length, said: window.__said.filter(t => t.startsWith("Showing")) }));
      line(`a release right after the last move says the ${many} shown once, as they are drawn`,
        quick.points < dragged.points && quick.said.length === 1 && shownBy(quick.said[0])?.to - shownBy(quick.said[0])?.from + 1 === quick.points,
        `${quick.points} ${many} drawn, said ${JSON.stringify(quick.said)}`);
      const shown = await showAll(page).isVisible();
      if (shown) await showAll(page).click();
      const reset = await until(() => drawn(page), n => n === N);
      const focus = await ev(page, root => ({ chart: document.activeElement === document.querySelector(`${root} .echart`), button: !!document.querySelector(`${root} .show-all`) }), d.root);
      line(`"Show all ${many}" shows every ${one} and returns focus to the chart`, shown && reset === N && focus.chart && !focus.button,
        `${shown ? "shown" : "never shown"}, ${reset} ${many} drawn, focus ${focus.chart ? "on the chart" : "elsewhere"}`);
    },

    /** Newer figures for the same view, as an ingest in the background brings about every minute while a session runs. The
     *  status answer names a new change when the window is focused again, so the page fetches its payload again, with
     *  higher figures in it. The zoom, "Show all" and the focus on it stay, and the live region says nothing. */
    async refresh() {
      const page = await open("refresh");
      let more = 0;
      await newerOn(page, () => more);
      const name = await box(page).getAttribute("aria-label");
      const bars = () => ev(page, () => JSON.stringify(window.chartfit.bars().map(r => [Math.round(r.l), Math.round(r.t), Math.round(r.h)])));
      await box(page).focus();
      await page.keyboard.press("+");
      const zoomed = await until(() => drawn(page), n => n < N);
      const nameNow = await box(page).getAttribute("aria-label");
      line("zooming leaves the chart's accessible name as it was", zoomed < N && nameNow === name, nameNow === name ? `${zoomed} ${many} drawn` : `"${name}" became "${nameNow}"`);
      // The button follows the chart's report of the zoom, a render after the points are drawn.
      if (!line(`"Show all ${many}" shows while zoomed`, await showAll(page).waitFor({ timeout: 4000 }).then(() => true, () => false))) throw new Error("no zoom to keep");
      await showAll(page).focus();
      const before = await bars();
      await ev(page, () => window.chartfit.listen());
      more = 1000;
      await ev(page, () => window.dispatchEvent(new Event("visibilitychange")));
      const after = await until(bars, s => s !== before);
      await sleep(400);
      const kept = await ev(page, root => ({ points: window.chartfit.points().length, focus: document.activeElement === document.querySelector(`${root} .show-all`), said: window.__said }), d.root);
      line("newer figures for the same view are drawn", after !== before);
      line(`the refresh keeps the ${many} shown, "Show all ${many}" and the focus on it, and says nothing`, kept.points === zoomed && kept.focus && !kept.said.length,
        `${kept.points} of ${N} ${many} drawn, ${zoomed} before; focus ${kept.focus ? "on the button" : "lost"}; said ${JSON.stringify(kept.said)}`);
      // The browser's text size changes with no event, and here the chart's box keeps its size: the next redraw, for newer
      // figures again, draws the labels at the new size.
      const size = () => ev(page, () => Math.max(...window.chartfit.texts().map(t => t.size)));
      const small = await size(), drawnBefore = await bars();
      await ev(page, () => { document.documentElement.style.fontSize = "32px"; });
      more = 2000;
      await ev(page, () => window.dispatchEvent(new Event("visibilitychange")));
      await until(bars, s => s !== drawnBefore);
      const large = await until(size, s => s === 22);
      line("after the root font size doubles, the next redraw draws the labels at twice their size", small === 11 && large === 22, `labels ${small}px, then ${large}px`);
      // A refetch may still be on its way through a route: let it go, or its failed fetch ends the script before it cleans up.
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await page.done();
    },

    /** With motion on, the bars grow once, on the first drawing. A zoom out makes ECharts create the bars the zoom left out:
     *  they stand at their full height at once, the same as a moment later. */
    async motion() {
      const page = await open("motion", { reducedMotion: "no-preference" });
      await sleep(1500); // the first drawing's growth
      const heights = () => ev(page, () => JSON.stringify(window.chartfit.bars().map(r => [Math.round(r.l), Math.round(r.h)])));
      await box(page).focus();
      await page.keyboard.press("+");
      const zoomed = await until(() => drawn(page), n => n < N);
      await sleep(700);
      await page.keyboard.press("-");
      const back = await until(() => drawn(page), n => n === N);
      const atOnce = await heights();
      await sleep(1200);
      const settled = await heights();
      line(`with motion on, a zoom out draws the ${many} that come back at full height, at once`, zoomed < N && back === N && atOnce === settled,
        `${zoomed} ${many} zoomed, ${back} back; ${atOnce === settled ? "no bar grew" : "bars grew again"}`);
      await page.done();
    },

    /** Newer figures for the same view keep the point read with the keys: its band, tooltip and readout stay on it, and the
     *  live region says nothing, since its figures did not change. newer() must leave point I as it is. */
    async refreshRead() {
      const page = await open("refresh while reading");
      let more = 0;
      await newerOn(page, () => more);
      const bars = () => ev(page, () => JSON.stringify(window.chartfit.bars().map(r => [Math.round(r.l), Math.round(r.t), Math.round(r.h)])));
      await read(page);
      await until(() => state(page), s => onPoint(s, I, centre(s.grid, I)).ok);
      const before = await bars();
      await ev(page, () => window.chartfit.listen());
      more = 1000;
      await ev(page, () => window.dispatchEvent(new Event("visibilitychange")));
      const after = await until(bars, s => s !== before);
      await sleep(400);
      const s = await state(page), at = onPoint(s, I, centre(s.grid, I)), heard = await ev(page, () => window.__said);
      line(`newer figures keep the ${one} read with the keys, and say nothing`, after !== before && at.ok && !heard.length,
        `${after !== before ? "redrawn" : "NOT REDRAWN"}; ${at.at}; said ${JSON.stringify(heard)}`);
      await page.done();
    },

    /** A backfill: n older points join at the front of the same view, as an ingest of older transcripts brings them. The
     *  page opens on fewer(payload, n), with point I of its points read by the keys and, on a chart with a zoom, plus
     *  pressed around it; the next request gets the whole payload. The points that joined are drawn: every column, or
     *  when zoomed the slider's handles move, since the same days are a smaller share. The band stays over the point's
     *  bar (on its pixels when zoomed, at its new place when not), the tooltip names it beside the band, the first and the
     *  last label drawn stay (zoomed), "Show all" stays (zoomed), and the live region says nothing new: a zoom sentence
     *  the new count makes untrue is dropped, which may empty it. On each animation frame through the redraw the tooltip
     *  names the point and points within half a band of the band's centre; a zoomed band does not move, and a band not
     *  zoomed is on the point's column. */
    async backfill(n = 2) {
      const K = n + I, M = N - n, zooms = d.zoom !== false;
      const { page, fill } = await openMoving("backfill", { before: p => d.fewer(p, n), points: M });
      await read(page);
      let s0 = await until(() => state(page), s => onPoint(s, K, centre(s.grid, I, 0, M - 1)).ok);
      let w = null;
      if (zooms) {
        await page.keyboard.press("+");
        s0 = await until(() => state(page), s => { w = shownBy(s.readout); return w && s.band && Math.abs(mid(s.band) - centre(s.grid, K, w.from, w.to)) <= 1.5; });
        await showAll(page).waitFor({ timeout: 4000 }).catch(() => {});
      }
      const was = await labels(page);
      // The labels reader proven on the zoom sentence: it names the first and the last point shown.
      const proven = !zooms || (!!w && was.length > 0 && was[0] === label(P[w.from]) && was.at(-1) === label(P[w.to]));
      const handles = () => ev(page, () => JSON.stringify(window.chartfit.handles().map(r => Math.round(r.l))));
      const h0 = await handles();
      await ev(page, () => window.chartfit.listen());
      await watch(page);
      const redrawn = await fill();
      const want = s => (zooms ? mid(s0.band) : centre(s.grid, K));
      // A late sentence would come after the drawing: the band and the tooltip on the point first, then a while more.
      await until(() => state(page), s => s.band && Math.abs(mid(s.band) - want(s)) <= 1.5 && named(s.tip?.day ?? "") === K);
      await sleep(400);
      const fs = await framed(page);
      const s = await state(page), now = await labels(page), all = zooms && await showAll(page).isVisible(), h1 = await handles();
      const cols = await ev(page, () => window.chartfit.columns()), heard = await ev(page, () => window.__said.filter(t => t !== ""));
      const at = mid(s.band), bar = cols.find(c => Math.abs(c.x - at) <= 1);
      // More points drawn: every column when not zoomed; zoomed, the same days are a smaller share, so the handles move.
      const more = zooms ? h1 !== h0 : cols.length === N;
      const kept = !zooms || (now.length > 0 && now[0] === was[0] && now.at(-1) === was.at(-1));
      const what = zooms ? `zoomed by plus around ${one} ${K + 1}` : `${one} ${K + 1} read`;
      line(`a backfill of ${n} older ${n === 1 ? one : many}, ${what}: the band stays over its bar, the tooltip names it beside the band${zooms ? `, the first and the last ${one} drawn stay, "Show all ${many}" stays` : ""}, and nothing is said`,
        redrawn && more && proven && Math.abs(at - want(s)) <= 1.5 && !!bar && named(s.tip?.day ?? "") === K && beside(s, at) && kept && (!zooms || all) && !heard.length,
        `${redrawn ? "redrawn" : "NOT REDRAWN"}, ${zooms ? `the handles ${h1 !== h0 ? `moved from ${h0} to ${h1}` : `STILL at ${h1}`}` : `${cols.length} of ${N} columns drawn`}; band at ${px(at)}, want ${px(want(s))}, bar at ${px(bar?.x)}; tooltip "${s.tip?.day ?? "none"}" ${s.tip ? `${Math.round(s.tip.l)}..${Math.round(s.tip.r)}px` : ""}`
        + `${zooms ? `; labels ${ends(now)}, were ${ends(was)}${proven ? "" : ` (NOT the window said, ${w ? `${label(P[w.from])} to ${label(P[w.to])}` : "none"})`}; "Show all ${many}" ${all ? "shown" : "gone"}` : ""}; said ${JSON.stringify(heard)}`);
      const f = steady(fs, K, { still: zooms ? mid(s0.band) : null });
      line(`through the backfill, on each animation frame the tooltip names ${one} ${K + 1} and points within half a band of the band's centre${zooms ? ", and the band does not move" : `, and the band is on ${one} ${K + 1}'s column`}`,
        redrawn && f.ok, f.at);
      await page.done();
    },

    /** Escape closes a tooltip the pointer opened while the focus is on another control, and leaves the focus there. */
    async escapeElsewhere(page) {
      await ev(page, () => document.activeElement?.blur());
      await away(page);
      await page.locator("#navTheme").focus();
      await page.locator(d.root).scrollIntoViewIfNeeded(); // the focus scrolled the page to the control
      const g = await ev(page, () => window.chartfit.grid());
      await page.mouse.move(centre(g, I), (g.t + g.b) / 2);
      const open = await until(() => state(page), s => s.tip);
      await page.keyboard.press("Escape");
      const closed = await until(() => state(page), s => !s.tip && !s.band);
      const focus = await ev(page, () => document.activeElement?.id ?? "");
      line("Escape with the focus on another control closes a tooltip the pointer opened, and leaves the focus there", !!open.tip && !closed.tip && !closed.band && focus === "navTheme",
        `${open.tip ? "opened" : "never opened"}; after Escape ${closed.tip ? "tooltip open" : "no tooltip"}, ${closed.band ? "band drawn" : "no band"}; focus on "#${focus}"`);
      await away(page);
    },

    /** With motion on, the bars grow on the first drawing and on no later one: each act(page, refresh) of acts, [what, act]
     *  pairs, must grow no bar. refresh() brings newer figures, as the refresh block does, and resolves once they are drawn. */
    async motionOnce(acts) {
      const page = await open("motion once", { reducedMotion: "no-preference" }, watchGrowth);
      await sleep(1500);
      const first = await ev(page, () => window.__grew);
      line(`with motion on, the bars grow on the first drawing`, first > 0, `${first} segments grew`);
      let more = 0;
      await newerOn(page, () => more);
      const bars = () => ev(page, () => JSON.stringify(window.chartfit.bars().map(r => [Math.round(r.l), Math.round(r.t), Math.round(r.h)])));
      const refresh = async () => {
        const before = await bars();
        more += 1000;
        await ev(page, () => window.dispatchEvent(new Event("visibilitychange")));
        await until(bars, s => s !== before);
      };
      for (const [what, act] of acts) {
        const grew = await growth(page, () => act(page, refresh));
        line(`with motion on, ${what} grows no bar again`, grew === 0, `${grew} segments grew`);
      }
      await page.done();
    },

    /** Under reduced motion no bar grows, from the first frame on. */
    async reducedMotion() {
      const page = await open("reduced motion", {}, watchGrowth);
      await sleep(1000);
      const grew = await ev(page, () => window.__grew);
      line("with reduced motion, no bar grows on the first drawing", grew === 0, `${grew} segments grew`);
      await page.done();
    },

    /** The first and the last point, where a grid that left the others' fit (ECharts 6 shrinks a grid whose labels would
     *  leave the box) shows first: the pointer at the centre of the point's column of bars, Home and End, and the pointer
     *  over the column's right third each read the point: the band is centred on the column, within 1px, and the tooltip
     *  and the readout name the point. what starts each line. Gives the columns, read with the page at rest. */
    async edges(page, what) {
      await leave(page);
      const cols = await ev(page, () => window.chartfit.columns()), g = await ev(page, () => window.chartfit.grid());
      const counted = cols.length === N ? "" : `; ${cols.length} columns for ${N} ${many}`;
      // A missing column is read at its place in the grid, and its lines fail on the count.
      const col = i => cols[i] ?? { l: centre(g, i) - 1, r: centre(g, i) + 1, x: centre(g, i) };
      // A third of the way down the frame: over the bars, in the first track of a chart of several.
      const y = g.t + (g.b - g.t) / 3, ends = [0, N - 1];
      const by = async (move, i, ok) => { await leave(page); await move(); return until(() => state(page), s => ok(s, i)); };
      /** Point i read: the band centred on its bar, the tooltip and the readout naming it. */
      const reads = (s, i) => offBy(s, col(i)) <= 1 && named(s.tip?.day ?? "") === i && named(s.readout) === i;
      const pointed = [], keyed = [], third = [];
      for (const i of ends) pointed.push([i, await by(() => page.mouse.move(col(i).x, y), i, reads)]);
      for (const i of ends) keyed.push([i, await by(async () => { await box(page).focus(); await page.keyboard.press(i ? "End" : "Home"); }, i, reads)]);
      await page.keyboard.press("Escape");
      for (const i of ends) third.push([i, await by(() => page.mouse.move(col(i).l + (col(i).r - col(i).l) * 5 / 6, y), i, reads)]);
      await leave(page);
      const all = got => cols.length === N && got.every(([i, s]) => reads(s, i));
      const said = got => got.map(([i, s]) => where(s, col(i), i)).join("; ") + counted;
      line(`${what}: the pointer on the first and the last ${one}'s bar centres the band on it, within 1px`, all(pointed), said(pointed));
      line(`${what}: Home and End centre the band on the first and the last ${one}'s bar, within 1px`, all(keyed), said(keyed));
      line(`${what}: the pointer over the right third of the first and the last ${one}'s bar reads that ${one}: band, tooltip and readout`, all(third), said(third));
      return cols;
    },

    /** No text of the chart is cut by its box or overlaps another; with newest, the newest point's axis label is drawn and
     *  ends at or inside the plot's right edge. what starts each line. */
    async labelsFit(page, what, newest = false) {
      const { texts, box, g } = await ev(page, () => ({ texts: window.chartfit.texts(), box: window.chartfit.box(), g: window.chartfit.grid() }));
      const { out, over } = fit(texts, box);
      line(`${what}: no axis or value label is cut by the chart's box or overlaps another`, texts.length > 0 && !out.length && !over.length,
        [...out.map(x => `cut: ${x}`), ...over.map(x => `overlap: ${x}`)].join("; ") || `${texts.length} labels in ${Math.round(box.w)}x${Math.round(box.h)}`);
      if (!newest) return;
      const want = label(P[N - 1]), got = texts.find(t => t.t >= g.b && t.text === want);
      line(`${what}: the newest ${one}'s label is drawn and ends at or inside the plot's right edge`, !!got && got.r <= g.r + .5,
        got ? `"${want}" ${got.l.toFixed(1)}..${got.r.toFixed(1)}px, plot ${g.l.toFixed(1)}..${g.r.toFixed(1)}px` : `no "${want}"; under the plot: ${texts.filter(t => t.t >= g.b).map(t => t.text).join(", ")}`);
    },

    /** The theme toggle on a light, dark or system value. */
    theme,
  };
}
