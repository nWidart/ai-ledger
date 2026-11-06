// Expected strings are what usage.html printed for the same inputs (en-US).
import { describe, expect, it } from "vitest";
import { big, dayLabel, dur, median, ms, mult, niceStep, num, pct, plural, usd, usd0 } from "./format";

describe("format", () => {
  it("num", () => {
    expect(num(null)).toBe("–");
    expect(num(1234.5)).toBe("1,235");
    expect(num(1234.5, 1)).toBe("1,234.5");
    expect(num(2, 2)).toBe("2.00");
  });
  it("big", () => {
    expect(big(undefined)).toBe("–");
    expect(big(950)).toBe("950");
    expect(big(12_345)).toBe("12.3k");
    expect(big(12_000_200)).toBe("12.0M");
    expect(big(3_456_000_000)).toBe("3.46B");
  });
  it("usd and usd0", () => {
    expect(usd(null)).toBe("–");
    expect(usd(15.8)).toBe("$16");
    expect(usd(3429.4)).toBe("$3,429");
    expect(usd(9.994)).toBe("$9.99");
    expect(usd(0)).toBe("$0.00");
    expect(usd0(0)).toBe("$0");
    expect(usd0(null)).toBe("$0");
    expect(usd0(0.26)).toBe("$0.26");
  });
  it("pct", () => {
    expect(pct(null)).toBe("–");
    expect(pct(0.3333)).toBe("33%");
    expect(pct(0.3333, 1)).toBe("33.3%");
    expect(pct(1.2)).toBe("120%");
  });
  it("dur and ms", () => {
    expect(dur(null)).toBe("–");
    expect(dur(42.4)).toBe("42s");
    expect(dur(1800)).toBe("30m");
    expect(dur(5400)).toBe("1.5h");
    expect(ms(850)).toBe("850ms");
    expect(ms(1234)).toBe("1.2s");
  });
  it("dayLabel reads the day in UTC", () => {
    expect(dayLabel("2026-11-05")).toBe("Nov 5");
    expect(dayLabel("2026-01-01", true)).toBe("Jan 1, 2026");
  });
  it("plural", () => {
    expect(plural(1, "session")).toBe("1 session");
    expect(plural(1503, "session")).toBe("1,503 sessions");
    expect(plural(0, "day")).toBe("0 days");
    expect(plural(2, "match", "matches")).toBe("2 matches");
  });
  it("mult", () => {
    expect(mult(17.83)).toBe("17.8×");
    expect(mult(2)).toBe("2.0×");
    expect(mult(150.4)).toBe("150×");
  });
  it("median skips missing values", () => {
    expect(median([])).toBeNull();
    expect(median([null, undefined])).toBeNull();
    expect(median([3, 1, null, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it("niceStep", () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(0.7)).toBe(1);
    expect(niceStep(1.5)).toBe(2);
    expect(niceStep(3)).toBe(5);
    expect(niceStep(7)).toBe(10);
    expect(niceStep(240)).toBe(500);
    expect(niceStep(0.012)).toBeCloseTo(0.02);
  });
});
