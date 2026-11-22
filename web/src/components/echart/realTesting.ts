// The readers the tests on real ECharts share (*.real.test.tsx): a stand-in for the color probe, so each token draws in a
// color of its own, and readers of the paths and texts ECharts' SVG renderer writes. A test that uses them unmocks
// components/echart/load and calls probeColors() before each test.
import { vi } from "vitest";

// jsdom resolves no var(), so every token would compute to black. The color probe answers each token with an rgb() of its
// own, which the drawing's fills and strokes can be told apart by.
const rgb = new Map<string, string>();
/** The rgb() a token resolves to. */
export const colorOf = (token: string) => {
  if (!rgb.has(token)) rgb.set(token, `rgb(${rgb.size + 1}, 100, 200)`);
  return rgb.get(token)!;
};
/** Each color resolved so far, as colorOf() wrote it (with spaces), to its token: it matches only the colors the renderer
 *  writes as they were given. */
export const colorTokens = () => new Map([...rgb].map(([token, c]) => [c, token]));
/** The token a drawn color resolved from: the renderer writes rgb() with or without spaces. */
export const tokenOf = (c: string | null) => (c ? [...rgb].find(([, v]) => v === c || v.replaceAll(" ", "") === c)?.[0] : undefined);

/** Answers the chart's color probe (tokens.ts) with colorOf(). Call before each test: the spy is restored after it. */
export function probeColors() {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element, pseudo?: string | null) => {
    if (!(el instanceof HTMLElement) || el.dataset.chartProbe === undefined) return real(el, pseudo);
    return { color: colorOf(/;color:(.*)$/.exec(el.getAttribute("style") ?? "")![1]!) } as CSSStyleDeclaration;
  });
}

/** A path's box: ECharts' SVG renderer writes a rect as M, then l moves, a rounded top with L and A, a circle with A and C. */
export function box(dd: string) {
  const xs: number[] = [], ys: number[] = [];
  let x = 0, y = 0;
  for (const [, c, args] of dd.matchAll(/([MLlACZ])([^MLlACZ]*)/g)) {
    const n = (args!.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []).map(Number);
    if (c === "M" || c === "L") [x, y] = [n[0]!, n[1]!];
    else if (c === "l") [x, y] = [x + n[0]!, y + n[1]!];
    else if (c === "A") [x, y] = [n[5]!, n[6]!];
    else if (c === "C") [x, y] = [n[4]!, n[5]!];
    else continue;
    xs.push(x); ys.push(y);
  }
  const left = Math.min(...xs), top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top, cx: (left + Math.max(...xs)) / 2 };
}

/** A dot's centre: the renderer writes a circle as an arc from its rightmost point, "M x y A r r …". */
export const centreX = (e: Element) => {
  const [, x, r] = /^M(-?[\d.]+) -?[\d.]+A([\d.]+)/.exec(e.getAttribute("d") ?? "")!;
  return Number(x) - Number(r);
};

/** A text's anchor x: the renderer writes it in a translate() or as x. */
export const textX = (t: Element) => Number(/translate\(([\d.]+)/.exec(t.getAttribute("transform") ?? "")?.[1] ?? t.getAttribute("x"));
