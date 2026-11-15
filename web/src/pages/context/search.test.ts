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

  it("accepts a typed tip", () => {
    expect(validateSearch({ tip: "cache-breaks" })).toEqual({ tip: "cache-breaks" });
  });

  it("gives an empty object for an empty record", () => {
    expect(validateSearch({})).toEqual({});
  });
});
