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
