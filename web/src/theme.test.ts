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
  });
});
