import { describe, expect, it } from "vitest";
import { pinsOf, validateSearch } from "./search";

describe("Live search", () => {
  it("keeps the wall and tree views and drops any other, and the Org chart layout only in the tree", () => {
    expect(validateSearch({ view: "wall" })).toEqual({ view: "wall" });
    expect(validateSearch({ view: "tree" })).toEqual({ view: "tree" });
    expect(validateSearch({ view: "tree", layout: "org" })).toEqual({ view: "tree", layout: "org" });
    expect(validateSearch({ view: "tree", layout: "cards" })).toEqual({ view: "tree" });
    expect(validateSearch({ layout: "org" })).toEqual({});
    expect(validateSearch({ view: "wall", layout: "org" })).toEqual({ view: "wall" });
    expect(validateSearch({ view: "stream" })).toEqual({});
    expect(validateSearch({ view: "" })).toEqual({});
    expect(validateSearch({ view: true })).toEqual({});
  });

  it("keeps the pins oldest first, each once, the newest two, and drops what is not an id", () => {
    expect(validateSearch({ pin: "a,b" })).toEqual({ pin: "a,b" });
    expect(validateSearch({ pin: "a,b,c" })).toEqual({ pin: "b,c" });
    expect(validateSearch({ pin: "a,a,b" })).toEqual({ pin: "a,b" });
    expect(validateSearch({ pin: "a,b,a,c,bad id" })).toEqual({ pin: "b,c" }); // each once at its first place, then the last two
    expect(validateSearch({ pin: "constructor" })).toEqual({ pin: "constructor" }); // any well-formed id, the page's to find
    expect(validateSearch({ pin: "a b,<x>,c" })).toEqual({ pin: "c" });
    expect(validateSearch({ pin: "," })).toEqual({});
    expect(validateSearch({ pin: 3 })).toEqual({});
    expect(pinsOf("0a0f7777-0000-7000-8000-000000000007,s2")).toEqual(["0a0f7777-0000-7000-8000-000000000007", "s2"]);
    expect(pinsOf(undefined)).toEqual([]);
  });
});
