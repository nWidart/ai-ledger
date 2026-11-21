import { describe, expect, it } from "vitest";
import { colorOf, HELP_COLORS, NEUTRAL, OUTCOME_COLORS, TREND_PARTS, mixParts } from "./figures";

const same = (s: string) => s;

describe("OUTCOME_COLORS", () => {
  it("colors known outcomes like the trend, in the rows' order, and the rest neutral", () => {
    const rows = ["fully_achieved", "mostly_achieved", "partially_achieved", "not_achieved", "unclear_from_transcript", "abandoned"].map(name => ({ name, n: 1 }));
    expect(mixParts(rows, OUTCOME_COLORS, same, 6).map(p => p.color))
      .toEqual([...TREND_PARTS.slice(0, 4).map(p => p.c), NEUTRAL, NEUTRAL]);
  });
});

describe("mixParts", () => {
  it("reads 0% for a zero total", () => {
    expect(mixParts([{ name: "a", n: 0 }], {}, same, 0)[0]!.title).toBe("a: 0 sessions, 0%");
  });
  it("gives a name every object inherits the neutral color, like any unknown value", () => {
    const rows = ["constructor", "__proto__", "toString", "hasOwnProperty"].map(name => ({ name, n: 1 }));
    for (const colors of [HELP_COLORS, OUTCOME_COLORS]) {
      expect(mixParts(rows, colors, same, 4).map(p => p.color)).toEqual([NEUTRAL, NEUTRAL, NEUTRAL, NEUTRAL]);
      expect(rows.map(r => colorOf(colors, r.name))).toEqual([NEUTRAL, NEUTRAL, NEUTRAL, NEUTRAL]);
    }
    expect(colorOf(HELP_COLORS, "unhelpful")).toBe("var(--critical)");
  });
});
