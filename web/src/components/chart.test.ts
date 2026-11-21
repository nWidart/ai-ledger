import { afterEach, describe, expect, it } from "vitest";
import { dayAxis, niceMax, scaleMargins, stackHeights, textScale } from "./chart";

afterEach(() => { document.documentElement.style.fontSize = ""; });

describe("textScale", () => {
  it("is 1 when the root font size cannot be read", () => {
    expect(textScale()).toBe(1);
  });

  it("is the root font size over 16", () => {
    document.documentElement.style.fontSize = "20px";
    expect(textScale()).toBe(1.25);
    document.documentElement.style.fontSize = "32px";
    expect(textScale()).toBe(2);
  });
});

describe("scaleMargins and dayAxis", () => {
  const m = { t: 22, r: 8, b: 26, l: 52 }, step = (r: number) => Math.max(1, Math.ceil(r));
  it("leaves the margins as they are at a scale of 1", () => {
    expect(scaleMargins(m, 1)).toBe(m);
    expect(dayAxis(800, 240, 30, 10, step).m).toEqual(m);
  });

  it("grows the label room and thins the tick labels with the scale", () => {
    const a = dayAxis(800, 240, 30, 10, step, m, 2);
    expect(a.m).toEqual({ t: 44, r: 16, b: 52, l: 104 });
    expect(a.every).toBeGreaterThan(dayAxis(800, 240, 30, 10, step).every);
  });
});

describe("niceMax", () => {
  const steps = [(r: number) => Math.max(1, Math.ceil(r)), (r: number) => 10 ** Math.floor(Math.log10(r || 1)), () => .25];
  it.each([0, .3, 1, 7, 10, 99.5, 1234, 1e6])("gives the max and step dayAxis gives (max %d)", max => {
    for (const s of steps) {
      const a = dayAxis(800, 240, 30, max, s);
      expect(niceMax(max, s)).toEqual({ max: a.yMax, step: a.step });
    }
  });
});

describe("stackHeights", () => {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  it("splits the bar in proportion when every slot is above its minimum", () => {
    expect(stackHeights([1, 3], 100, [1, 3])).toEqual([25, 75]);
  });

  it("gives thin segments their minimum and shrinks the others, so the slots still fill the bar", () => {
    const s = stackHeights([998, 1, 1], 200, [1, 3, 3]);
    expect(s.slice(1)).toEqual([3, 3]);
    expect(s[0]).toBeCloseTo(194);
    expect(sum(s)).toBeCloseTo(200);
  });

  it("is each minimum when the bar is shorter than the minimums", () => {
    expect(stackHeights([5, 5], 2, [1, 3])).toEqual([1, 3]);
  });
});
