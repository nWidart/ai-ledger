import { describe, expect, it } from "vitest";
import { validateSearch } from "./search";

describe("Activity search", () => {
  it("keeps valid values", () => {
    expect(validateSearch({ q: "fix bug", near: "1", day: "2026-11-04" })).toEqual({ q: "fix bug", near: true, day: "2026-11-04" });
  });

  it("drops invalid values", () => {
    expect(validateSearch({ q: "", near: "0", day: "2026-02-30" })).toEqual({});
    expect(validateSearch({ near: "yes", day: "04-11-2026" })).toEqual({});
    expect(validateSearch({ q: 3, day: 20261104 })).toEqual({});
  });

  it("accepts values already typed", () => {
    expect(validateSearch({ near: true })).toEqual({ near: true });
    expect(validateSearch({ near: false })).toEqual({});
  });

  it("gives an empty object for an empty record", () => {
    expect(validateSearch({})).toEqual({});
  });
});
