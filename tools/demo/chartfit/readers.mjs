// The in-page readers of one chart's drawing, installed in every page before its scripts as window.chartfit, for the chart
// whose box is under the root selector; also the CSP violations, as window.__csp. ECharts' SVG names no element. The bar
// segments are the svg group's direct paths with a solid fill and no fill-opacity, down to the bottom grid line: the grid
// lines are unfilled, the hatch fills with a url() pattern, the band and the slider's filler are translucent, the average
// lines sit in groups and the slider's handles below the grid. The selection is a framed rectangle as tall as the grid; the
// band never has a stroke. This function runs in the page: it uses nothing from this module.
export function readers(root) {
  window.__csp = [];
  addEventListener("securitypolicyviolation", e => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  const tri = c => (String(c).match(/[\d.]+/g) || []).slice(0, 3).map(n => Math.round(Number(n))).join(",");
  const rect = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const $ = sel => document.querySelector(`${root} ${sel}`);
  const top = () => [...($(".echart-plot svg")?.querySelector(":scope > g")?.children ?? [])];
  const fill = e => e.getAttribute("fill") ?? "none";
  const stroked = e => (e.getAttribute("stroke") ?? "none") !== "none";
  const solid = e => e.tagName === "path" && fill(e) !== "none" && !fill(e).startsWith("url(");
  const grid = () => {
    const lines = top().filter(e => e.tagName === "path" && fill(e) === "none" && rect(e).h < 1 && rect(e).w > 0).map(rect);
    if (!lines.length) return null;
    return { l: Math.min(...lines.map(r => r.l)), r: Math.max(...lines.map(r => r.r)), t: Math.min(...lines.map(r => r.t)), b: Math.max(...lines.map(r => r.b)) };
  };
  const bars = () => {
    const g = grid();
    return g ? top().filter(e => solid(e) && !e.hasAttribute("fill-opacity") && rect(e).b <= g.b + 1 && rect(e).w > 0)
      .map(e => ({ fill: tri(fill(e)), stroke: e.getAttribute("stroke"), ...rect(e) })) : [];
  };
  /** A path as tall as the grid, and narrower than half of it. */
  const column = (e, g) => e.tagName === "path" && rect(e).h >= (g.b - g.t) * .8 && rect(e).w < (g.r - g.l) / 2;
  window.chartfit = {
    tri, grid, bars,
    /** A CSS color as the browser computes it, kept from forced colors as the chart's probe is. */
    probe: css => {
      const s = document.createElement("span");
      s.style.cssText = `position:absolute;forced-color-adjust:none;color:${css}`;
      document.body.append(s);
      const c = getComputedStyle(s).color;
      s.remove();
      return tri(c);
    },
    keys: () => [...document.querySelectorAll(`${root} .legend i:not(.line):not(.hatch)`)]
      .map(i => ({ name: i.parentElement.textContent.trim(), css: i.style.background, color: tri(getComputedStyle(i).backgroundColor) })),
    /** The left edge of each point's bar drawn, in order. */
    points: () => [...new Set(bars().map(b => Math.round(b.l)))].sort((a, b) => a - b),
    /** The cursor band: a translucent path as tall as the grid, with no stroke. */
    band: () => {
      const g = grid(), e = g && top().find(e => solid(e) && e.hasAttribute("fill-opacity") && !stroked(e) && column(e, g));
      return e ? { fill: tri(fill(e)), opacity: Number(e.getAttribute("fill-opacity")), ...rect(e) } : null;
    },
    /** The selection: a framed path as tall as the grid, tinted or unfilled; a bar, opaque, is never it. */
    selection: () => {
      const g = grid(), e = g && top().find(e => stroked(e) && column(e, g) && (fill(e) === "none" || e.hasAttribute("fill-opacity")));
      return e ? { fill: fill(e) === "none" ? "none" : tri(fill(e)), stroke: tri(e.getAttribute("stroke")), width: Number(e.getAttribute("stroke-width") ?? 1), ...rect(e) } : null;
    },
    /** The zoom slider's two handles, under the grid: solid paths narrower than 12px, left first. */
    handles: () => {
      const g = grid();
      return g ? top().filter(e => solid(e) && !e.hasAttribute("fill-opacity") && rect(e).t > g.b + 1 && rect(e).w < 12).map(e => ({ fill: tri(fill(e)), ...rect(e) })).sort((a, c) => a.l - c.l) : [];
    },
    /** The WCAG contrast ratio of two "r,g,b" colors. */
    contrast: (a, c) => {
      const lum = t => t.split(",").map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
      const [x, y] = [lum(a), lum(c)].sort((p, q) => q - p);
      return (x + .05) / (y + .05);
    },
    texts: () => top().filter(e => e.tagName === "text").map(e => ({ text: e.textContent, fill: tri(fill(e)), size: parseFloat(getComputedStyle(e).fontSize), ...rect(e) })),
    tip: () => {
      const t = $(".echart .tip");
      return t && getComputedStyle(t).display !== "none" ? { day: t.querySelector(".muted")?.textContent ?? "", ...rect(t) } : null;
    },
    readout: () => $(".echart + .sr")?.textContent ?? "",
    box: () => rect($(".echart")),
    /** The panel's background color, behind the chart. */
    panel: () => tri(getComputedStyle(document.querySelector(root)).backgroundColor),
    /** The largest font size of the plot's texts, in px. */
    textSize: () => Math.max(...[...document.querySelectorAll(`${root} .echart-plot svg text`)].map(t => parseFloat(getComputedStyle(t).fontSize) || 0)),
    /** The live region's texts from now on. */
    listen: () => {
      window.__said = [];
      new MutationObserver(() => window.__said.push($(".echart + .sr").textContent))
        .observe($(".echart + .sr"), { childList: true, characterData: true, subtree: true });
    },
    /** How many lines an element's text wraps to. */
    lines: el => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return new Set([...r.getClientRects()].filter(c => c.width > 0).map(c => Math.round(c.top))).size;
    },
  };
}
