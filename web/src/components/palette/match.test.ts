import { describe, expect, it } from "vitest";
import { EXACT, PREFIX, SUBSEQUENCE, SUBSTRING, WORD, bestMatch, byScore, match } from "./match";

describe("match", () => {
  it("ranks exact over prefix over word prefix over substring over subsequence", () => {
    expect(match("edit", "Edit")?.rank).toBe(EXACT);
    expect(match("ed", "Edit")?.rank).toBe(PREFIX);
    expect(match("timed", "Command timed out")?.rank).toBe(WORD);
    expect(match("dit", "Edit")?.rank).toBe(SUBSTRING);
    expect(match("edt", "Edit")?.rank).toBe(SUBSEQUENCE);
    expect(match("xyz", "Edit")).toBeNull();
    expect(match("et", "Edit")).toBeNull(); // no subsequence under three letters
  });
  it("finds words after __, spaces and other separators", () => {
    expect(match("gith", "mcp__github__search_issues")).toEqual({ rank: WORD, ranges: [[5, 9]] });
    expect(match("time", "Command timed out")).toEqual({ rank: WORD, ranges: [[8, 12]] });
    expect(match("code", "Claude Code")?.rank).toBe(WORD);
    expect(match("py", "a.py")?.rank).toBe(WORD);
  });
  it("marks the matched characters", () => {
    expect(match("Ba", "Bash")?.ranges).toEqual([[0, 2]]);
    expect(match("edt", "Edit")?.ranges).toEqual([[0, 2], [3, 4]]);
    expect(match("", "Edit")).toEqual({ rank: SUBSEQUENCE, ranges: [] });
  });
  it("takes the better of a name and its label", () => {
    expect(bestMatch("claude code", ["claude", "Claude Code"])).toMatchObject({ rank: EXACT, on: 1 });
    expect(bestMatch("claude", ["claude", "Claude Code"])).toMatchObject({ rank: EXACT, on: 0 });
    expect(bestMatch("q", ["a", "b"])).toBeNull();
  });
  it("breaks ties by count, then by the shorter name", () => {
    const rows = [
      { name: "Bashful", rank: PREFIX, count: 5 }, { name: "Bash", rank: PREFIX, count: 5 },
      { name: "Bashing", rank: PREFIX, count: 9 }, { name: "bash", rank: EXACT, count: 0 },
    ];
    expect(rows.sort(byScore).map(r => r.name)).toEqual(["bash", "Bashing", "Bash", "Bashful"]);
  });
});
