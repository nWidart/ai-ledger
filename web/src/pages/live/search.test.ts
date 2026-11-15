import { describe, expect, it } from "vitest";
import { validateSearch } from "./search";

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
});
