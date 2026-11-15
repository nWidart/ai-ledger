import { afterEach, describe, expect, it } from "vitest";
import { dayAxis, scaleMargins, textScale } from "./chart";

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

  it("is 1 at the default size", () => {
    document.documentElement.style.fontSize = "16px";
    expect(textScale()).toBe(1);
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
