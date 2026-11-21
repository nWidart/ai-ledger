import { describe, expect, it } from "vitest";
import { validateSearch } from "./search";

describe("Context search", () => {
  it("keeps a valid tip", () => {
    expect(validateSearch({ tip: "cache-breaks" })).toEqual({ tip: "cache-breaks" });
  });

  it("drops an empty or non-string tip", () => {
    expect(validateSearch({ tip: "" })).toEqual({});
    expect(validateSearch({ tip: 7 })).toEqual({});
  });

  it("keeps the growth and cache tabs, and drops the default or an unknown one", () => {
    expect(validateSearch({ tab: "growth" })).toEqual({ tab: "growth" });
    expect(validateSearch({ tab: "cache", tip: "near_limit" })).toEqual({ tab: "cache", tip: "near_limit" });
    expect(validateSearch({ tab: "overhead" })).toEqual({});
    expect(validateSearch({ tab: "fills" })).toEqual({});
    expect(validateSearch({ tab: 1 })).toEqual({});
  });

  it("gives an empty object for an empty record", () => {
    expect(validateSearch({})).toEqual({});
  });
});
