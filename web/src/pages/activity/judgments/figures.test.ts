import { describe, expect, it } from "vitest";
import { HELP_COLORS, NEUTRAL, OUTCOME_COLORS, TREND_PARTS, mixParts } from "./figures";

const same = (s: string) => s;

describe("OUTCOME_COLORS", () => {
  it("takes the trend's colors", () => {
    const keys = ["fully_achieved", "mostly_achieved", "partially_achieved", "not_achieved"];
    keys.forEach((k, i) => expect(OUTCOME_COLORS[k]).toBe(TREND_PARTS[i]!.c));
    expect(Object.keys(OUTCOME_COLORS)).toEqual(keys);
  });
  it("leaves TREND_PARTS unchanged", () => {
    expect(TREND_PARTS.map(p => p.c)).toEqual(["var(--good)", "var(--good-text)", "var(--warning)", "var(--critical)", "var(--proj-other)"]);
  });
  it("colors known outcomes like the trend, in the rows' order, and the rest neutral", () => {
    const rows = ["fully_achieved", "mostly_achieved", "partially_achieved", "not_achieved", "unclear_from_transcript", "abandoned"].map(name => ({ name, n: 1 }));
    expect(mixParts(rows, OUTCOME_COLORS, same, 6).map(p => p.color))
      .toEqual([...TREND_PARTS.slice(0, 4).map(p => p.c), NEUTRAL, NEUTRAL]);
  });
});

describe("HELP_COLORS", () => {
  it("has the five ratings' colors", () => {
    expect(HELP_COLORS).toEqual({ essential: "var(--good)", very_helpful: "var(--good-text)", moderately_helpful: "var(--warning)",
      slightly_helpful: "var(--critical-text)", unhelpful: "var(--critical)" });
  });
});

describe("mixParts", () => {
  it("writes each title from the count and its share of the total", () => {
    const parts = mixParts([{ name: "a", n: 117 }, { name: "b", n: 1 }], {}, s => s.toUpperCase(), 150);
    expect(parts.map(p => p.title)).toEqual(["A: 117 sessions, 78%", "B: 1 session, 1%"]);
    expect(parts.map(p => p.key)).toEqual(["a", "b"]);
  });
  it("reads 0% for a zero total", () => {
    expect(mixParts([{ name: "a", n: 0 }], {}, same, 0)[0]!.title).toBe("a: 0 sessions, 0%");
  });
  it("returns a zero row", () => {
    expect(mixParts([{ name: "a", n: 0 }, { name: "b", n: 2 }], {}, same, 2).map(p => p.n)).toEqual([0, 2]);
  });
});
