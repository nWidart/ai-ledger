import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTheme } from "../../theme";
import { FORCED_INK, resolveColor, THEME_INK, useChartEnv } from "./tokens";

// theme.css as text, without comments, and the custom properties its plain `:root { ... }` blocks declare.
const themeCss = readFileSync("src/theme.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, ""); // vitest runs from web/
const declared = new Map<string, string>();
for (const block of themeCss.matchAll(/(?:^|\n):root \{([^}]*)\}/g))
  for (const m of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) declared.set(m[1]!, m[2]!.trim());

// A color zrender's parser reads: hex, rgb() or rgba(), alone or as both sides of light-dark().
const PLAIN = String.raw`(?:#[0-9a-fA-F]{3,8}|rgba?\([^()]*\))`;
const COLOR = new RegExp(String.raw`^(?:${PLAIN}|light-dark\(\s*${PLAIN}\s*,\s*${PLAIN}\s*\))$`);
const tokensIn = (css: string) => [...css.matchAll(/var\((--[\w-]+)\)/g)].map(m => m[1]!);

// A matchMedia whose lists a test can flip, firing "change" as a browser does.
function fakeMedia() {
  const lists = new Map<string, { matches: boolean; listeners: Set<(e: MediaQueryListEvent) => void> }>();
  const list = (q: string) => {
    let l = lists.get(q);
    if (!l) lists.set(q, l = { matches: false, listeners: new Set() });
    return l;
  };
  vi.stubGlobal("matchMedia", (q: string) => {
    const l = list(q);
    return {
      media: q, onchange: null,
      get matches() { return l.matches; },
      addEventListener: (_: string, f: (e: MediaQueryListEvent) => void) => l.listeners.add(f),
      removeEventListener: (_: string, f: (e: MediaQueryListEvent) => void) => l.listeners.delete(f),
      addListener() {}, removeListener() {}, dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  });
  return {
    set(q: string, matches: boolean) {
      const l = list(q);
      l.matches = matches;
      l.listeners.forEach(f => f({ matches, media: q } as MediaQueryListEvent));
    },
    listeners: (q: string) => list(q).listeners.size,
  };
}

// getComputedStyle for the probe, answering from a table a test can change; jsdom resolves no var().
function fakeComputed(table: Record<string, string>) {
  const real = window.getComputedStyle.bind(window);
  const spy = vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element, pseudo?: string | null) => {
    if (el instanceof HTMLElement && el.dataset.chartProbe !== undefined) {
      const css = el.getAttribute("style")!.match(/(?:^|;)\s*color:\s*([^;]*)/)![1]!.trim();
      return { color: table[css] ?? "" } as CSSStyleDeclaration;
    }
    return real(el, pseudo);
  });
  return spy;
}
const probeCalls = (spy: ReturnType<typeof fakeComputed>) =>
  spy.mock.calls.filter(([el]) => el instanceof HTMLElement && el.dataset.chartProbe !== undefined).length;

const root = document.documentElement;
beforeEach(() => { setTheme("system"); });
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete root.dataset.theme;
});

describe("chart tokens", () => {
  it("declares every token the ink roles name in theme.css as a hex or rgb() color", () => {
    const names = [...new Set(Object.values(THEME_INK).flatMap(tokensIn))];
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(declared.has(name), `${name} is not declared in theme.css`).toBe(true);
      expect(declared.get(name), `${name} is not hex or rgb()`).toMatch(COLOR);
    }
  });

  it("draws forced colors in system colors only", () => {
    for (const css of Object.values(FORCED_INK)) expect(css).toMatch(/^(CanvasText|GrayText|Canvas|Highlight)$/);
    expect(Object.keys(FORCED_INK).sort()).toEqual(Object.keys(THEME_INK).sort());
  });
});

describe("resolveColor", () => {
  it("returns its input when the computed color is empty", () => {
    fakeComputed({});
    expect(resolveColor("var(--proj-3)")).toBe("var(--proj-3)");
  });

  it("returns the computed color of one hidden probe that forced colors leaves alone", () => {
    fakeComputed({ "var(--proj-1)": "rgb(42, 100, 200)", "var(--proj-2)": "rgb(15, 133, 116)" });
    expect(resolveColor("var(--proj-1)")).toBe("rgb(42, 100, 200)");
    expect(resolveColor("var(--proj-2)")).toBe("rgb(15, 133, 116)");
    const probes = document.querySelectorAll("[data-chart-probe]");
    expect(probes).toHaveLength(1);
    const style = probes[0]!.getAttribute("style")!;
    expect(style).toMatch(/forced-color-adjust:\s*none/);
    expect(style).toMatch(/visibility:\s*hidden/);
    expect(probes[0]!.getAttribute("aria-hidden")).toBe("true");
  });

  it("gives the inherited color for a value that is not a color, not the previous one", () => {
    // A browser drops an invalid declaration: the probe must not keep the last color it was given.
    fakeComputed({ "var(--proj-1)": "rgb(42, 100, 200)" });
    resolveColor("var(--proj-1)");
    expect(resolveColor("var(--not-a-color)")).toBe("var(--not-a-color)");
    expect(document.querySelector("[data-chart-probe]")!.getAttribute("style")).not.toContain("--proj-1");
  });

  it("caches by string, and clears the cache on an epoch change", () => {
    const table = { "var(--proj-1)": "rgb(42, 100, 200)" };
    const spy = fakeComputed(table);
    const media = fakeMedia();
    const { result } = renderHook(() => useChartEnv(600, 200));
    expect(result.current.color("var(--proj-1)")).toBe("rgb(42, 100, 200)");
    const calls = probeCalls(spy);
    table["var(--proj-1)"] = "rgb(93, 155, 242)";
    expect(result.current.color("var(--proj-1)")).toBe("rgb(42, 100, 200)");
    expect(probeCalls(spy)).toBe(calls);

    act(() => setTheme("dark"));
    expect(result.current.color("var(--proj-1)")).toBe("rgb(93, 155, 242)");

    table["var(--proj-1)"] = "rgb(1, 2, 3)";
    act(() => media.set("(prefers-color-scheme: dark)", true));
    expect(result.current.color("var(--proj-1)")).toBe("rgb(1, 2, 3)");
  });
});

describe("useChartEnv", () => {
  it("keeps the same env while nothing changes", () => {
    fakeMedia();
    const { result, rerender } = renderHook(() => useChartEnv(600, 200));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("gives a new env when setTheme() runs", () => {
    fakeMedia();
    const { result } = renderHook(() => useChartEnv(600, 200));
    const first = result.current;
    act(() => setTheme("dark"));
    expect(result.current).not.toBe(first);
    const second = result.current;
    act(() => setTheme("light"));
    expect(result.current).not.toBe(second);
  });

  it.each(["(prefers-color-scheme: dark)", "(forced-colors: active)", "(prefers-reduced-motion: reduce)"])(
    "gives a new env when %s fires change",
    (q) => {
      const media = fakeMedia();
      const { result } = renderHook(() => useChartEnv(600, 200));
      const first = result.current;
      act(() => media.set(q, true));
      expect(result.current).not.toBe(first);
    },
  );

  it("gives a new env when the box size changes, and carries it", () => {
    fakeMedia();
    const { result, rerender } = renderHook(({ w, h }) => useChartEnv(w, h), { initialProps: { w: 600, h: 200 } });
    const first = result.current;
    expect(first).toMatchObject({ width: 600, height: 200 });
    rerender({ w: 320, h: 200 });
    expect(result.current).not.toBe(first);
    expect(result.current).toMatchObject({ width: 320, height: 200 });
  });

  it("uses the theme roles, with the cursor at 6% of the text color", () => {
    fakeMedia();
    fakeComputed({
      "var(--text-primary)": "rgb(11, 11, 11)", "var(--text-secondary)": "rgb(82, 81, 78)", "var(--text-muted)": "rgb(102, 101, 95)",
      "var(--grid)": "rgb(232, 230, 225)", "var(--surface-1)": "rgb(252, 252, 251)", "var(--border)": "rgb(226, 224, 218)",
      "var(--accent)": "rgb(180, 80, 42)",
    });
    const { result } = renderHook(() => useChartEnv(600, 200));
    expect(result.current.forced).toBe(false);
    expect(result.current.ink).toEqual({
      text: "rgb(11, 11, 11)", secondary: "rgb(82, 81, 78)", muted: "rgb(102, 101, 95)", grid: "rgb(232, 230, 225)",
      surface: "rgb(252, 252, 251)", border: "rgb(226, 224, 218)", cursor: "rgba(11, 11, 11, 0.06)", accent: "rgb(180, 80, 42)",
    });
  });

  it("draws the cursor transparent, not opaque, when the text color is in a form it cannot make translucent", () => {
    fakeMedia();
    const table: Record<string, string> = {};
    fakeComputed(table);
    for (const computed of ["color(srgb 0.04 0.04 0.04)", "rgb(11 11 11 / 50%)", "none", ""]) {
      table["var(--text-primary)"] = computed;
      const { result, unmount } = renderHook(() => useChartEnv(600, 200)); // a first mount clears the cache
      expect({ computed, cursor: result.current.ink.cursor }).toEqual({ computed, cursor: "transparent" });
      unmount();
    }
    table["var(--text-primary)"] = "rgba(11, 11, 11, 0.5)";
    const { result } = renderHook(() => useChartEnv(600, 200));
    expect(result.current.ink.cursor).toBe("rgba(11, 11, 11, 0.03)");
  });

  it("switches to system colors when forced colors turns on, and back when it turns off", () => {
    const media = fakeMedia();
    fakeComputed({
      CanvasText: "rgb(255, 255, 255)", GrayText: "rgb(128, 128, 128)", Canvas: "rgb(0, 0, 0)", Highlight: "rgb(26, 235, 255)",
      "var(--text-primary)": "rgb(11, 11, 11)",
    });
    const { result } = renderHook(() => useChartEnv(600, 200));
    act(() => media.set("(forced-colors: active)", true));
    expect(result.current.forced).toBe(true);
    expect(result.current.ink).toEqual({
      text: "rgb(255, 255, 255)", secondary: "rgb(255, 255, 255)", muted: "rgb(255, 255, 255)", grid: "rgb(128, 128, 128)",
      surface: "rgb(0, 0, 0)", border: "rgb(255, 255, 255)", cursor: "rgba(26, 235, 255, 0.4)", accent: "rgb(26, 235, 255)",
    });
    act(() => media.set("(forced-colors: active)", false));
    expect(result.current.forced).toBe(false);
    expect(result.current.ink.text).toBe("rgb(11, 11, 11)");
  });

  it("turns motion off under reduced motion, and reads the text scale", () => {
    const media = fakeMedia();
    root.style.fontSize = "24px";
    try {
      const { result } = renderHook(() => useChartEnv(600, 200));
      expect(result.current.motion).toBe(true);
      expect(result.current.textScale).toBe(1.5);
      act(() => media.set("(prefers-reduced-motion: reduce)", true));
      expect(result.current.motion).toBe(false);
    } finally {
      root.style.fontSize = "";
    }
  });

  it("removes its media listeners when the last chart unmounts", () => {
    const media = fakeMedia();
    const a = renderHook(() => useChartEnv(600, 200));
    const b = renderHook(() => useChartEnv(300, 200));
    expect(media.listeners("(forced-colors: active)")).toBe(1);
    a.unmount();
    expect(media.listeners("(forced-colors: active)")).toBe(1);
    b.unmount();
    expect(media.listeners("(forced-colors: active)")).toBe(0);
  });
});
