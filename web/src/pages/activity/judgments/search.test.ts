import { describe, expect, it } from "vitest";
import { formatSearch, parseSearch } from "../../../url";
import { validateSearch } from "./search";

describe("validateSearch", () => {
  it("reads each key from its URL string", () => {
    expect(validateSearch({ outcome: "fully achieved", friction: "1", help: "essential", goal: "debug code", fr: "wrong approach", goalf: "debugging", frf: "tooling" }))
      .toEqual({ outcome: "fully achieved", friction: true, help: "essential", goal: "debug code", fr: "wrong approach", goalf: "debugging", frf: "tooling" });
    // Values already typed, as the router may hand them.
    expect(validateSearch({ friction: true, outcome: "mostly achieved", frf: "tooling" })).toEqual({ friction: true, outcome: "mostly achieved", frf: "tooling" });
  });
  it("returns an empty search for no keys and ignores other keys", () => {
    expect(validateSearch({})).toEqual({});
    expect(validateSearch({ project: "p", range: "7", sub: "x", day: "2025-01-01" })).toEqual({});
  });
  it("drops bad values and fills no defaults", () => {
    const bad = { outcome: "", help: 3, goal: null, fr: undefined, goalf: {}, frf: ["a"], friction: "true" };
    expect(validateSearch(bad)).toEqual({});
    expect(Object.keys(validateSearch(bad))).toEqual([]);
    expect(validateSearch({ friction: "0" })).toEqual({});
    expect(validateSearch({ friction: false })).toEqual({});
    expect(validateSearch({ friction: "" })).toEqual({});
    expect(validateSearch({ friction: 1 })).toEqual({});
    // A bad value drops alone: the valid keys beside it stay.
    expect(validateSearch({ outcome: "", help: "essential", friction: "yes" })).toEqual({ help: "essential" });
  });
  it("round-trips: each valid key is written back as it was", () => {
    for (const s of ["?friction=1", "?outcome=fully+achieved", "?outcome=x&friction=1&help=essential&goal=a+b&fr=c&goalf=d&frf=e", "?goal=a%26b%3D"]) {
      const back = formatSearch(validateSearch(parseSearch(s)));
      expect(parseSearch(back)).toEqual(parseSearch(s));
    }
  });
});
