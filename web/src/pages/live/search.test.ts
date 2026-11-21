import { describe, expect, it } from "vitest";
import { pinsOf, validateSearch } from "./search";

describe("Live search", () => {
  it("keeps the wall view", () => {
    expect(validateSearch({ view: "wall" })).toEqual({ view: "wall" });
  });

  it("drops any other view", () => {
    expect(validateSearch({ view: "stream" })).toEqual({});
    expect(validateSearch({ view: "" })).toEqual({});
    expect(validateSearch({ view: true })).toEqual({});
  });

  it("accepts a typed view", () => {
    expect(validateSearch({ view: "wall" })).toEqual({ view: "wall" });
  });

  it("gives an empty object for an empty record", () => {
    expect(validateSearch({})).toEqual({});
  });

  it("keeps the pins oldest first, each once, the newest two, and drops what is not an id", () => {
    expect(validateSearch({ pin: "a,b" })).toEqual({ pin: "a,b" });
    expect(validateSearch({ pin: "a,b,c" })).toEqual({ pin: "b,c" });
    expect(validateSearch({ pin: "a,a,b" })).toEqual({ pin: "a,b" });
    expect(validateSearch({ pin: "a b,<x>,c" })).toEqual({ pin: "c" });
    expect(validateSearch({ pin: "," })).toEqual({});
    expect(validateSearch({ pin: 3 })).toEqual({});
    expect(pinsOf("0a0f7777-0000-7000-8000-000000000007,s2")).toEqual(["0a0f7777-0000-7000-8000-000000000007", "s2"]);
    expect(pinsOf(undefined)).toEqual([]);
  });
});
