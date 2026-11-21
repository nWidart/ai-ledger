import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COLUMNS_KEY, getColumnChoice, HIDE_WIDTHS, resetColumnChoice, setColumnChoice, useWidthHides } from "./sessionColumns";

beforeEach(() => { localStorage.clear(); resetColumnChoice(); });
afterEach(() => { vi.unstubAllGlobals(); resetColumnChoice(); });

// Writing the choice, reading it on the next visit and removing it are proven through the page (ActivityPage.test, "Sessions
// columns"); these cover what the page cannot easily set up.
describe("the Sessions column choice", () => {
  it("ignores a stored value that is not a JSON object", () => {
    for (const raw of ["{not json", "[false]", "null", "\"tokens\""]) {
      localStorage.setItem(COLUMNS_KEY, raw);
      resetColumnChoice();
      expect(getColumnChoice()).toEqual({});
    }
  });
  it("drops an unknown column, the Session column and a value that is not a boolean, and keeps the rest", () => {
    localStorage.setItem(COLUMNS_KEY, JSON.stringify({ gone: false, first_ts: false, tokens: "yes", commits: 0, compactions: false, model_ms: true }));
    resetColumnChoice();
    expect(getColumnChoice()).toEqual({ compactions: false, model_ms: true });
  });
  it("reads no choice when storage refuses reads, and still keeps one made on the page", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(getColumnChoice()).toEqual({});
    setColumnChoice({ compactions: false });
    expect(getColumnChoice()).toEqual({ compactions: false });
  });
});

describe("the widths that hide Sessions columns", () => {
  // The page CSS hides the columns; the script only reads the width. Both must name the same three steps.
  it("equal the max-width of the opt2, opt1 and opt rules in activity.css", () => {
    const css = readFileSync(join(__dirname, "activity.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const step = (rule: string) => {
      const m = css.match(new RegExp(String.raw`@media \(max-width: ([\d.]+em)\) \{[^@]*?\.pg-activity #sessions ${rule} \{ display: none`));
      return m?.[1];
    };
    expect([step(String.raw`:is\(\.opt, \.opt1, \.opt2\)`), step(String.raw`\.opt1`), step(String.raw`\.opt2`)]).toEqual([...HIDE_WIDTHS]);
  });

  /** A window this many CSS pixels wide, at the default 16px text size. */
  const width = (px: number) => {
    const subs = new Set<() => void>();
    vi.stubGlobal("matchMedia", (q: string) => {
      const max = /max-width: ([\d.]+)em/.exec(q);
      return { media: q, get matches() { return !!max && px <= Number(max[1]) * 16; },
        addEventListener: (_: string, f: () => void) => subs.add(f), removeEventListener: (_: string, f: () => void) => subs.delete(f) };
    });
    return { resize: (to: number) => { px = to; subs.forEach(f => f()); } };
  };

  it("say which priorities the window hides, and follow a resize", () => {
    const w = width(1440);
    const { result } = renderHook(() => useWidthHides());
    expect([0, 1, 2].map(p => result.current(p as 0 | 1 | 2))).toEqual([false, false, false]);
    act(() => w.resize(1000));
    expect([0, 1, 2].map(p => result.current(p as 0 | 1 | 2))).toEqual([false, true, true]);
    act(() => w.resize(390));
    expect([0, 1, 2].map(p => result.current(p as 0 | 1 | 2))).toEqual([true, true, true]);
  });
});
