import { describe, expect, it } from "vitest";
import { validateSearch } from "./search";

describe("Activity search", () => {
  it("keeps valid values", () => {
    expect(validateSearch({ q: "fix bug", near: "1", day: "2026-11-04" })).toEqual({ q: "fix bug", near: true, day: "2026-11-04" });
    expect(validateSearch({ near: true })).toEqual({ near: true }); // already typed
  });

  it("drops invalid values", () => {
    expect(validateSearch({ q: "", near: "0", day: "2026-02-30" })).toEqual({});
    expect(validateSearch({ near: false })).toEqual({});
    expect(validateSearch({ near: "yes", day: "04-11-2026" })).toEqual({});
    expect(validateSearch({ q: 3, day: 20261104 })).toEqual({});
  });

  it("keeps a week or a day, never both, and a known tab", () => {
    expect(validateSearch({ week: "2026-11-02", tab: "loops" })).toEqual({ week: "2026-11-02", tab: "loops" });
    expect(validateSearch({ day: "2026-11-04", week: "2026-11-02" })).toEqual({ day: "2026-11-04" });
    expect(validateSearch({ week: "2026-02-30", tab: "hours" })).toEqual({});
    // A week is named by its Monday: another day names no bar.
    expect(validateSearch({ week: "2026-11-18" })).toEqual({});
    // Sessions is the default: it has no key.
    expect(validateSearch({ tab: "sessions" })).toEqual({});
  });
});
