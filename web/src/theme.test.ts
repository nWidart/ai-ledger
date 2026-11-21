import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getTheme, nextTheme, setTheme, THEME_KEY, useTheme } from "./theme";

const root = document.documentElement;
afterEach(() => { delete root.dataset.theme; });

describe("theme", () => {
  it("cycles system, light, dark and back", () => {
    expect(nextTheme("system")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
  });
  it("sets the attribute and storage, and system removes both", () => {
    setTheme("dark");
    expect(root.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    setTheme("system");
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });
  it("reads an unknown value as system", () => {
    root.dataset.theme = "sepia";
    expect(getTheme()).toBe("system");
  });
  it("still switches the page when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    setTheme("light");
    expect(getTheme()).toBe("light");
  });
  it("follows a change made in another tab", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe("system");
    act(() => { dispatchEvent(new StorageEvent("storage", { key: THEME_KEY, newValue: "dark" })); });
    expect(result.current).toBe("dark");
    expect(root.dataset.theme).toBe("dark");
    act(() => { dispatchEvent(new StorageEvent("storage", { key: null, newValue: null })); });
    expect(result.current).toBe("system");
    act(() => { dispatchEvent(new StorageEvent("storage", { key: "other", newValue: "light" })); });
    expect(result.current).toBe("system");
  });
  it("is applied before first paint by index.html's head script, with the same key", () => {
    const html = readFileSync("index.html", "utf8"); // vitest runs from web/
    const head = html.slice(0, html.indexOf("</head>"));
    const src = /<script>([\s\S]*?)<\/script>/.exec(head)?.[1];
    expect(src).toContain(JSON.stringify(THEME_KEY));
    expect(head.indexOf("<script>")).toBeLessThan(head.indexOf('rel="stylesheet"'));
    localStorage.setItem(THEME_KEY, "dark");
    new Function(src!)();
    expect(root.dataset.theme).toBe("dark");
    delete root.dataset.theme;
    localStorage.setItem(THEME_KEY, "sepia");
    new Function(src!)();
    expect(root.hasAttribute("data-theme")).toBe(false);
  });
});


// theme.css writes every color once, as light-dark(light, dark). These helpers read those pairs back so the contrast
// notes in the CSS are checked in both themes.
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const themeCss = () => strip(readFileSync("src/theme.css", "utf8")); // vitest runs from web/
const paletteCss = () => strip(readFileSync("src/components/palette/palette.css", "utf8"));

/** Splits on top-level commas, so rgba(...) and nested calls stay whole. */
function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0, from = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    else if (s[i] === "," && depth === 0) { out.push(s.slice(from, i).trim()); from = i + 1; }
  }
  out.push(s.slice(from).trim());
  return out;
}
/** The custom properties declared in the plain `:root { ... }` blocks, raw. */
function rootTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const block of css.matchAll(/(?:^|\n):root \{([^}]*)\}/g))
    for (const m of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens.set(m[1]!, m[2]!.trim());
  return tokens;
}
/** One theme's value for a token: picks a side of every light-dark() and follows var() references. */
function resolve(tokens: Map<string, string>, name: string, theme: "light" | "dark"): string {
  let v = tokens.get(name);
  if (v === undefined) throw new Error(`no token ${name}`);
  for (let guard = 0; guard < 20; guard++) {
    const before: string = v;
    const i = v.lastIndexOf("light-dark(");
    if (i >= 0) {
      let depth = 0, end = i + "light-dark".length;
      for (; end < v.length; end++) { if (v[end] === "(") depth++; else if (v[end] === ")" && --depth === 0) break; }
      const args = splitArgs(v.slice(i + "light-dark(".length, end));
      expect(args).toHaveLength(2);
      v = v.slice(0, i) + args[theme === "light" ? 0 : 1] + v.slice(end + 1);
    }
    v = v.replace(/var\((--[\w-]+)\)/g, (_, n: string) => tokens.get(n) ?? `var(${n})`);
    if (v === before) return v;
  }
  throw new Error(`cannot resolve ${name}`);
}
const lum = (hex: string) => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const contrast = (a: string, b: string) => {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe("theme.css tokens", () => {
  const tokens = rootTokens(themeCss());
  const themes = ["light", "dark"] as const;

  it("writes each color once as a light-dark pair, with no second dark set", () => {
    const css = themeCss();
    expect(css).not.toContain("prefers-color-scheme");
    expect(paletteCss()).not.toContain("prefers-color-scheme");
    expect(css).toMatch(/:root \{[^}]*color-scheme: light dark;/);
    expect(css).toMatch(/:root\[data-theme="light"\] \{ color-scheme: light; \}/);
    expect(css).toMatch(/:root\[data-theme="dark"\] \{ color-scheme: dark; \}/);
    expect(resolve(tokens, "--surface-1", "light")).toBe("#fcfcfb");
    expect(resolve(tokens, "--surface-1", "dark")).toBe("#1a1a19");
    expect(resolve(tokens, "--link", "dark")).toBe("#f0a582");
    expect(resolve(tokens, "--series-1-soft", "dark")).toBe("rgba(57,135,229,.18)");
    expect(resolve(tokens, "--shadow-pop", "light")).toBe("0 6px 24px rgba(20,18,12,.14), 0 8px 28px transparent");
    expect(resolve(tokens, "--shadow-pop", "dark")).toBe("0 6px 24px transparent, 0 8px 28px rgba(0,0,0,.5)");
  });
  it("keeps tokens that do not differ plain", () => {
    for (const n of ["--series-6", "--good", "--scrim", "--shadow-sheet"]) expect(tokens.get(n)).not.toContain("light-dark");
  });
  it("gives control borders 3:1 on surface-1 in both themes", () => {
    for (const t of themes)
      expect(contrast(resolve(tokens, "--control-border", t), resolve(tokens, "--surface-1", t))).toBeGreaterThanOrEqual(3);
  });
  it("keeps the chart fill tokens at 3:1 on surface-1 in both themes", () => {
    for (const n of ["--good", "--good-text", "--warning", "--critical-text", "--critical", "--proj-other"])
      for (const t of themes)
        expect(contrast(resolve(tokens, n, t), resolve(tokens, "--surface-1", t)), `${n} ${t}`).toBeGreaterThanOrEqual(3);
  });
  it("leaves --border soft, for dividers", () => {
    for (const t of themes)
      expect(contrast(resolve(tokens, "--border", t), resolve(tokens, "--surface-1", t))).toBeLessThan(1.5);
  });
  it("gives --series-1-ink 4.5:1 on surface-1 in both themes", () => {
    for (const t of themes)
      expect(contrast(resolve(tokens, "--series-1-ink", t), resolve(tokens, "--surface-1", t))).toBeGreaterThanOrEqual(4.5);
  });
  it("keeps the palette filter ink at 4.5:1 on surface-1 in both themes", () => {
    for (const t of themes)
      expect(contrast(resolve(tokens, "--pal-filter-ink", t), resolve(tokens, "--surface-1", t))).toBeGreaterThanOrEqual(4.5);
  });
  it("uses the control border on inputs, selects and the project picker", () => {
    const css = themeCss();
    expect(css).toMatch(/select, input\[type=date\], input\[type=search\] \{ border-color: var\(--control-border\); \}/);
    expect(css).toMatch(/\.pick-field \{[^}]*border: 1px solid var\(--control-border\)/);
    // The Sessions search keeps that border: Activity's rule sets no border of its own.
    expect(readFileSync("src/pages/activity/activity.css", "utf8")).toMatch(/\.tools-row input\[type=search\] \{ flex: 1 1 16\.25rem; min-width: 0; \}/);
  });
});

describe("forced colors", () => {
  const block = () => {
    const css = themeCss(), at = css.indexOf("@media (forced-colors: active)");
    expect(at).toBeGreaterThan(-1);
    return css.slice(at);
  };
  it("draws low-call rate points hollow in system colors", () => {
    expect(block()).toMatch(/circle\.lowc \{ forced-color-adjust: none; fill: Canvas; stroke: CanvasText; \}/);
  });
  it("frames the hovered and selected chart buckets at full opacity", () => {
    expect(block()).toMatch(/\.chart svg > rect:not\(\.hit\) \{ stroke: Highlight; stroke-width: 2px; fill: none; opacity: 1; \}/);
  });
  it("draws the low-call legend key like its point, over the chart stylesheet's theme colors", () => {
    // chart.css loads after theme.css and styles .pg-activity .legend i.low: the forced-colors rule must be more specific.
    expect(readFileSync("src/components/chart.css", "utf8")).toMatch(/\.pg-activity \.legend i\.low \{/);
    expect(block()).toMatch(/\.pg-activity \.legend \.key i\.low[^{]*\{ forced-color-adjust: none; background: Canvas; border-color: CanvasText; \}/);
  });
  it("has one forced-colors block, last in theme.css", () => {
    expect(themeCss().match(/@media \(forced-colors: active\)/g)).toHaveLength(1);
    expect(block().trimEnd().endsWith("}")).toBe(true);
  });
  it("marks pressed, current and selected states with system colors, not the theme's", () => {
    const css = block();
    expect(css).toMatch(/\.seg button\[aria-pressed=true\] \{[^}]*background: Highlight; color: HighlightText/);
    expect(css).toContain(".appnav a[aria-current=page]");
    expect(css).toContain(".pg-limits .hs-bar[aria-pressed=\"true\"]");
    expect(css).toMatch(/:not\(:focus-visible\) \{ outline: 2px solid Highlight;/);
    expect(css).not.toMatch(/var\(--/);
  });
  it("keeps bars visible and never suppresses a focus ring", () => {
    const css = block();
    expect(css).toMatch(/\.ledger \.bar[^{]*\{ forced-color-adjust: none; outline: 1px solid CanvasText; \}/);
    for (const sel of [".pg-judgments .mixbar", ".pg-judgments .mixbar i:not(.rest)", ".ledger .sw", ".pg-judgments .key .sw"]) {
      expect(css).toMatch(new RegExp(`\\.ledger \\.bar[^{]*${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^{]*\\{ forced-color-adjust: none; outline: 1px solid CanvasText; \\}`));
    }
    expect(css).toContain(".pg-judgments .mixbar i:not(.rest) { outline-offset: -1px; }");
    expect(css).toContain(".bar-seg");
    expect(css).not.toMatch(/outline: *(none|0)/);
  });
});

describe("scroll padding", () => {
  it("reserves the sticky nav and the scope bar once, on the page", () => {
    const base = strip(readFileSync("src/base.css", "utf8"));
    expect(base).toMatch(/:root \{ --bars-h: calc\(var\(--appnav-h, 56px\) \+ var\(--scope-h, 0px\)\); \}/);
    expect(base).toMatch(/html \{ scroll-padding-top: calc\(var\(--bars-h\) \+ 12px\); \}/);
    expect(base).not.toContain("scroll-margin-top");
    expect(base).not.toContain("secidx");
  });
  it("leaves no per-element copy of that offset", () => {
    for (const f of ["src/components/Drawer.css", "src/components/ScopeBar.css"]) expect(readFileSync(f, "utf8")).not.toContain("scroll-margin-top");
  });
  it("sticks the scope bar under the nav, and every lower sticky element under both bars", () => {
    expect(strip(readFileSync("src/components/ScopeBar.css", "utf8"))).toMatch(/\.scopebar \{ position: sticky; top: var\(--appnav-h, 56px\);/);
    const errors = strip(readFileSync("src/pages/errors/errors.css", "utf8"));
    expect(errors).toContain(".pg-errors #detail .dhead { top: var(--bars-h);");
    expect(errors).toContain(".pg-errors #detail .exbar { top: calc(var(--bars-h) + var(--dhead-h, 0px));");
    expect(errors).toContain(".pg-errors .types { position: sticky; top: calc(var(--bars-h) + 12px);");
    // Only the bars themselves read the nav's height alone: a page that did would slide under the scope bar.
    for (const f of ["src/pages/errors/errors.css", "src/pages/live/live.css"]) expect(readFileSync(f, "utf8")).not.toMatch(/var\(--appnav-h/);
  });
});
