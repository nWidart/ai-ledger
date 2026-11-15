import { describe, expect, it } from "vitest";
import { viewOf } from "./api";
import { formatSearch, parseSearch, rootState, sharedSearch, validateRoot, type RootSearch } from "./url";

describe("parseSearch", () => {
  it("strips one leading ? or #", () => {
    expect(parseSearch("")).toEqual({});
    expect(parseSearch("?a=b")).toEqual({ a: "b" });
    expect(parseSearch("#a=b")).toEqual({ a: "b" });
    expect(parseSearch("a=b")).toEqual({ a: "b" });
  });
  it("keeps the last value of a repeated key", () => {
    expect(parseSearch("?a=1&a=2")).toEqual({ a: "2" });
  });
});

describe("formatSearch", () => {
  it("writes true as 1 and leaves out false, empty, null and undefined", () => {
    expect(formatSearch({ auto: true, a: false, b: "", c: null, d: undefined })).toBe("?auto=1");
  });
  it("writes 0", () => {
    expect(formatSearch({ range: 0 })).toBe("?range=0");
  });
  it("is empty when nothing is written", () => {
    expect(formatSearch({})).toBe("");
    expect(formatSearch({ a: false, b: undefined })).toBe("");
  });
  it("follows the object's key order", () => {
    expect(formatSearch({ b: "1", a: "2" })).toBe("?b=1&a=2");
  });
});

describe("legacy hashes", () => {
  it("moves a Usage hash to the query string, with and without validation", () => {
    const hash = "#project=foo&range=30&source=claude&auto=1&session=abc", want = "?project=foo&range=30&source=claude&auto=1&session=abc";
    expect(formatSearch(parseSearch(hash))).toBe(want);
    expect(formatSearch({ ...validateRoot(parseSearch(hash)) })).toBe(want);
  });
  it("keeps page-only keys and unquoted numbers", () => {
    expect(formatSearch(parseSearch("#ex=12345&cat=timeout"))).toBe("?ex=12345&cat=timeout");
    expect(formatSearch(parseSearch("#project=123&range=7"))).toBe("?project=123&range=7");
  });
  it("keeps strings that look like other types as strings", () => {
    const out = formatSearch(parseSearch("#project=my%20proj%2Fsub&session=true"));
    expect(out).toBe("?project=my+proj%2Fsub&session=true");
    expect(parseSearch(out)).toEqual({ project: "my proj/sub", session: "true" });
  });
});

describe("validateRoot", () => {
  it("leaves an absent range absent, read as 30", () => {
    const s = validateRoot({ project: "p" });
    expect("range" in s).toBe(false);
    expect(rootState(s).range).toBe(30);
  });
  it("drops an unknown range", () => {
    expect("range" in validateRoot({ range: "999" })).toBe(false);
    expect("range" in validateRoot({ range: "abc" })).toBe(false);
  });
  it("accepts a range as a string or a number", () => {
    expect(validateRoot({ range: "7" }).range).toBe(7);
    expect(validateRoot({ range: 7 }).range).toBe(7);
    expect(validateRoot({ range: "0" }).range).toBe(0);
    expect(validateRoot({ range: 0 }).range).toBe(0);
  });
  it("drops an unknown source, read as All", () => {
    const s = validateRoot({ source: "grok" });
    expect("source" in s).toBe(false);
    expect(rootState(s).source).toBe("");
    expect(validateRoot({ source: "codex" }).source).toBe("codex");
  });
  it("reads auto=1 and true only", () => {
    expect("auto" in validateRoot({ auto: "0" })).toBe(false);
    expect(validateRoot({ auto: "1" }).auto).toBe(true);
    expect(validateRoot({ auto: true }).auto).toBe(true);
  });
  it("drops unknown keys and empty strings", () => {
    expect(validateRoot({ ex: "1", project: "" , tool: "Bash" })).toEqual({ tool: "Bash" });
  });
  it("writes keys in a fixed order", () => {
    const s = validateRoot({ session: "s", skill: "k", mcp: "m", tool: "t", inspect: "i", auto: "1", source: "claude", range: "7", project: "p" });
    expect(Object.keys(s)).toEqual(["project", "range", "source", "auto", "inspect", "tool", "mcp", "skill", "session"]);
  });
  it("never throws on other types", () => {
    expect(validateRoot({ project: 5, range: {}, auto: null })).toEqual({});
  });
  it("round-trips a valid search", () => {
    const s: RootSearch = { project: "my proj/sub", range: 0, source: "codex", auto: true, inspect: "i", tool: "Bash", mcp: "gh", skill: "ship", session: "true" };
    expect(validateRoot(parseSearch(formatSearch({ ...s })))).toEqual(s);
    expect(validateRoot(parseSearch(formatSearch({})))).toEqual({});
  });
});

describe("rootState", () => {
  it("applies defaults and fits viewOf", () => {
    const s = rootState({});
    expect(s).toEqual({ project: "", range: 30, source: "", auto: false, inspect: "", tool: "", mcp: "", skill: "", session: "" });
    expect(viewOf(rootState({ project: "p", range: 0, auto: true }))).toMatchObject({ project: "p", range: 0, automated: true });
  });
});

describe("sharedSearch", () => {
  it("keeps only project, range, source and auto", () => {
    const s: RootSearch = { session: "s", auto: true, tool: "t", source: "claude", range: 0, project: "p", inspect: "i" };
    expect(Object.entries(sharedSearch(s))).toEqual([["project", "p"], ["range", 0], ["source", "claude"], ["auto", true]]);
    expect(sharedSearch({ session: "s" })).toEqual({});
  });
});
