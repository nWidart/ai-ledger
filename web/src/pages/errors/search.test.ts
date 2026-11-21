import { describe, expect, it } from "vitest";
import { formatSearch, parseSearch } from "../../url";
import { validateSearch } from "./search";

const of = (s: string) => validateSearch(parseSearch(s));

describe("validateSearch", () => {
  it("keeps each valid key as its URL text", () => {
    expect(of("sub=0&noise=0&gran=week&cat=x&ex=t07&at=2026-11-03&etool=Bash"))
      .toEqual({ sub: "0", noise: "0", gran: "week", cat: "x", ex: "t07", at: "2026-11-03", etool: "Bash" });
    expect(of("sub=1&noise=1")).toEqual({ sub: "1", noise: "1" });
  });
  it("drops bad values and fills no defaults", () => {
    expect(of("")).toEqual({});
    expect(of("sub=no&noise=2&gran=day&cat=&ex=&at=junk&etool=")).toEqual({});
    expect(of("at=2026-1-3")).toEqual({});
    expect(of("gran=month")).toEqual({});
    expect(of("project=foo&range=7&tool=Edit")).toEqual({});
  });
  it("accepts values already typed", () => {
    expect(validateSearch({ sub: false, noise: true, gran: "week", at: "2026-11-03", cat: "x" }))
      .toEqual({ sub: "0", noise: "1", gran: "week", at: "2026-11-03", cat: "x" });
    expect(validateSearch({ sub: 0, noise: 1 })).toEqual({ sub: "0", noise: "1" });
    expect(validateSearch({ cat: 5, at: 20261103, gran: true, ex: null, etool: undefined })).toEqual({});
    expect(validateSearch({ sub: {}, cat: [], at: () => 1, ex: Symbol("x") })).toEqual({}); // never throws
  });
  it("round-trips: each valid key is written back as it was", () => {
    for (const s of ["?sub=0", "?noise=0", "?sub=0&noise=0&gran=week", "?etool=Bash&at=2026-11-03&cat=x", "?ex=t07", "?sub=1&noise=1"])
      expect(formatSearch(of(s))).toBe(s);
    expect(formatSearch(of("gran=day&sub=0"))).toBe("?sub=0");
  });
});
