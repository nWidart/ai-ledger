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
// The page module calls the blocks in its order, with its own checks between them.
import { H, W, line, sleep, until } from "./harness.mjs";

export function chart(h, d) {
  const P = d.points, N = P.length, I = d.at, { one, many } = d.unit, label = d.label;
  const ev = (page, f, arg) => page.evaluate(f, arg);
  /** The point a text names, by its long label at the start: an index of points, or -1. */
  const named = text => P.findIndex(k => text.startsWith(label(k, true)));
  /** Where the chart draws point i when it shows points from..to: the middle of its band. */
  const centre = (g, i, from = 0, to = N - 1) => g.l + (i - from + .5) * (g.r - g.l) / (to - from + 1);
  /** The points shown, from the live region's zoom sentence ("Showing Oct 11 to Oct 20, 10 of 30 days."). */
  const zoomed = new RegExp(`^Showing (.+?) to (.+?), \\d+ of \\d+ ${many}\\.$`);
  const shownBy = text => {
    const m = zoomed.exec(text);
    return m ? { from: P.findIndex(k => label(k) === m[1]), to: P.findIndex(k => label(k) === m[2]) } : null;
  };
  const open = (name, options, init) => h.open({ path: d.path, root: d.root, ready: page => page.waitForFunction(n => window.chartfit.points().length === n, N) }, name, options, init);
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
    N, I, P, named, centre, shownBy, open, shot, ev, drawn, away, box, showAll, state, read,

    /** Colors: light, the toggle's dark, then System with the OS scheme flipped; the slider's handles in light and dark. */
    async colors() {
      const page = await open("colors");
      await ev(page, () => { window.__kept = true; });
      await theme(page, "light");
      const light = await until(() => drawnKeys(page), k => k.ok);
      line("light: each legend key's color is drawn", light.ok, keyLine(light));
      await handleLine(page, "light");
      await shot(page, "light");
      // The first key's color tells the schemes apart: every --proj-N token differs between them.
      const like = want => k => k.ok && k.keys[0].color === want.keys[0].color;
      await theme(page, "dark");
      const dark = await until(() => drawnKeys(page), k => k.ok && k.keys[0].color !== light.keys[0].color);
      const dataTheme = await ev(page, () => document.documentElement.dataset.theme);
      line(`dark (data-theme="${dataTheme}"): each legend key's color is drawn, and differs from light`, dataTheme === "dark" && dark.ok && dark.keys[0].color !== light.keys[0].color, keyLine(dark));
      await handleLine(page, "dark");
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
      // Set as soon as <html> exists, before the app reads the root font size.
      const page = await open("32px root", {}, () => {
        const set = () => { if (!document.documentElement) return false; document.documentElement.style.fontSize = "32px"; return true; };
        if (!set()) new MutationObserver((_, o) => { if (set()) o.disconnect(); }).observe(document, { childList: true });
      });
      const { texts, box, root, size } = await ev(page, () => ({ texts: window.chartfit.texts(), box: window.chartfit.box(), root: getComputedStyle(document.documentElement).fontSize,
        size: window.chartfit.textSize() }));
      line("32px root: the axis labels are drawn at twice their size", root === "32px" && size >= 22, `root ${root}, labels ${size}px`);
      const out = texts.filter(t => t.l < box.l - .5 || t.r > box.r + .5 || t.t < box.t - .5 || t.b > box.b + .5);
      const over = [];
      // Labels overlap when their em boxes do. A text's box is its line box, taller than its glyphs: at 32px the line boxes
      // of "$0" and the first day's label meet where their glyphs are well apart.
      const em = t => ({ ...t, t: (t.t + t.b - t.size) / 2, b: (t.t + t.b + t.size) / 2 });
      const at = t => `${Math.round(t.l - box.l)}..${Math.round(t.r - box.l)} x ${Math.round(t.t - box.t)}..${Math.round(t.b - box.t)}px`;
      texts.map(em).forEach((a, i, all) => all.slice(i + 1).forEach(c => { if (a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b) over.push(`"${a.text}" at ${at(a)} and "${c.text}" at ${at(c)}`); }));
      line("32px root: no axis label leaves the box", texts.length > 0 && !out.length, out.map(t => `"${t.text}" at ${Math.round(t.l - box.l)}..${Math.round(t.r - box.l)}px, ${Math.round(t.t - box.t)}..${Math.round(t.b - box.t)}px of ${Math.round(box.w)}x${Math.round(box.h)}`).join("; ") || `${texts.length} labels`);
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
      line(`the pointer is a hand over a ${one}, not over a ${one} label`, hand === "pointer" && notHand !== "pointer", `over ${one} ${I + 1}: ${hand}; over "${axisText.text}": ${notHand}`);
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
      await page.route(d.data, async route => {
        const res = await route.fetch(), json = await res.json();
        await route.fulfill({ response: res, json: more ? d.newer(json, more) : json });
      });
      await page.route(/\/api\/status/, async route => {
        const res = await route.fetch(), s = await res.json();
        await route.fulfill({ response: res, json: more ? { ...s, last_change: `chartfit ${more}` } : s });
      });
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
  };
}
