import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { viewOf } from "./api";
import { errorsHref, openSessionSheet, openToolSheet, sessionSheetHref } from "./components/sheets/session";
import { makeTestClient, routerOf, wrapper } from "./testing";
import {
  applyPatch, closeSheets, currentRaw, formatSearch, go, navigate, onNavigate, parseSearch, parseView, rootState, setSearch, sharedOf, sharedSearch, sheetKey,
  useView, useSearchOf, usePathname, validateRoot, type RootSearch,
} from "./url";

/** The URL a test starts at, and the router over it. */
const start = (url: string) => { history.replaceState(null, "", url); return routerOf(makeTestClient()); };
const view = (search: string) => parseView(parseSearch(search));
const popped = () => new Promise(r => addEventListener("popstate", r, { once: true }));
const sheets = () => (history.state as { sheets?: number } | null)?.sheets;
const clear = { inspect: null, tool: null, mcp: null, skill: null, session: null };

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
  it("writes keys in the canonical order, not the object's", () => {
    expect(formatSearch({ b: "1", a: "2", cat: "x", range: "7", ex: "e", inspect: "i", gran: "w", sub: "0", project: "p" })).toBe("?project=p&range=7&sub=0&gran=w&b=1&a=2&inspect=i&ex=e&cat=x");
  });
  it("writes the inspected tool after inspect and before session", () => {
    expect(formatSearch({ session: "s", tool: "mcp__a:b", range: "30", ex: "e" })).toBe("?range=30&tool=mcp__a%3Ab&session=s&ex=e");
    expect(formatSearch({ skill: "ship", mcp: "gh", inspect: "p" })).toBe("?inspect=p&mcp=gh&skill=ship");
  });
  it("writes keys in the order the pages always did", () => {
    expect(formatSearch({ session: "s", range: "30", project: "a b", inspect: "p" })).toBe("?project=a+b&range=30&inspect=p&session=s");
    expect(formatSearch({ cat: "x", gran: "week", zz: "1", sub: "0", range: "7" })).toBe("?range=7&sub=0&gran=week&zz=1&cat=x");
    expect(formatSearch({ auto: "1", source: "codex", range: "7" })).toBe("?range=7&source=codex&auto=1");
  });
});

describe("parseView", () => {
  it("reads a Usage URL from before the change", () => {
    const s = view("?project=foo&range=14&inspect=bar&session=abc");
    expect(s).toEqual({ project: "foo", range: 14, source: "", auto: false, inspect: "bar", tool: "", mcp: "", skill: "", session: "abc", sheet: "" });
  });
  it("reads the shared keys of an Errors URL and leaves its page-only keys out", () => {
    const s = view("?project=foo&range=0&sub=0&noise=0&gran=week&ex=toolu_1");
    expect(s).toMatchObject({ project: "foo", range: 0 });
    expect(Object.keys(s)).toEqual(["project", "range", "source", "auto", "inspect", "tool", "mcp", "skill", "session", "sheet"]);
  });
  it("defaults the range to 30", () => {
    expect(view("?ex=toolu_1").range).toBe(30);
    expect(view("?range=").range).toBe(30);
    expect(view("?range=12").range).toBe(30);
    expect(view("").range).toBe(30);
  });
  it("reads auto=1 as including automated sessions", () => {
    expect(view("?auto=1").auto).toBe(true);
    expect(view("?auto=0").auto).toBe(false);
  });
  it("reads a known source, and an unknown one as All", () => {
    expect(view("?source=codex").source).toBe("codex");
    expect(view("?source=claude").source).toBe("claude");
    expect(view("?source=grok").source).toBe("");
    expect(view("").source).toBe("");
  });
  it("reads the inspected tool, MCP server and skill", () => {
    expect(view("?range=7&tool=Bash")).toMatchObject({ tool: "Bash", mcp: "", skill: "" });
    expect(view("?mcp=github&session=s1")).toMatchObject({ mcp: "github", session: "s1", tool: "" });
    expect(view("?skill=ship").skill).toBe("ship");
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
    expect(s).toEqual({ project: "", range: 30, source: "", auto: false, inspect: "", tool: "", mcp: "", skill: "", session: "", sheet: "" });
    expect(viewOf(rootState({ project: "p", range: 0, auto: true }))).toMatchObject({ project: "p", range: 0, automated: true });
  });
});

describe("sharedOf", () => {
  it("keeps only project, range, source and auto", () => {
    const raw = { session: "s", auto: "1", tool: "t", source: "claude", range: "0", project: "p", inspect: "i" };
    expect(Object.entries(sharedOf(raw))).toEqual([["project", "p"], ["range", "0"], ["source", "claude"], ["auto", "1"]]);
    expect(sharedOf({ session: "s" })).toEqual({});
  });
});

describe("sharedSearch", () => {
  it("carries only the shared keys", () => {
    expect(sharedSearch(parseSearch("?project=foo&range=14&auto=1&session=s1&ex=t1&sub=0"))).toBe("?project=foo&range=14&auto=1");
    expect(sharedSearch(parseSearch("?session=s1"))).toBe("");
    expect(sharedSearch(parseSearch("?range=7&source=codex&cat=x"))).toBe("?range=7&source=codex");
  });
  it("reads the current URL when given nothing", () => {
    start("/usage?project=foo&range=14&session=s1");
    expect(sharedSearch()).toBe("?project=foo&range=14");
  });
});

describe("applyPatch", () => {
  it("removes null, empty and false, writes true as 1, and leaves undefined", () => {
    expect(applyPatch({ a: "1", b: "2", c: "3", d: "4" }, { a: null, b: "", c: false, d: undefined, e: true, f: 0 })).toEqual({ d: "4", e: "1", f: "0" });
  });
});

describe("setSearch", () => {
  it("drops the day in the same write as a project, range or source change, and keeps it otherwise", () => {
    const router = start("/usage?project=foo&range=30&day=2026-11-04"), len = history.length;
    for (const p of [{ project: "foo" }, { range: 30 }, { source: "" }, { q: "api" }, { near: true }, { auto: true }, { session: "s1" }, { session: null }]) setSearch(p);
    expect(location.search).toBe("?project=foo&range=30&auto=1&day=2026-11-04&q=api&near=1");
    expect(history.length).toBe(len + 3); // auto, session on, session off push; the 3 same-value ones are no-ops, q and near replace
    setSearch({ range: 7 });
    expect(location.search).toBe("?project=foo&range=7&auto=1&q=api&near=1");
    expect(history.length).toBe(len + 4); // the day goes in the same write: one entry for the change
    for (const p of [{ project: "bar" }, { source: "codex" }]) {
      router.history.replace(location.pathname + location.search + "&day=2026-11-04");
      router.history.flush();
      expect(location.search).toContain("day=");
      setSearch(p);
      expect(location.search).not.toContain("day=");
    }
  });
  it("keeps the day when a write leaves the parsed view as it was", () => {
    for (const [begin, patch] of [
      ["?day=2026-11-04", { range: 30 }], // no range reads as 30
      ["?range=abc&day=2026-11-04", { range: 30 }], // an unknown range reads as 30
      ["?source=foo&day=2026-11-04", { source: null }], // an unknown source cleaned to All
    ] as const) {
      start("/usage" + begin);
      setSearch(patch, { push: false });
      expect(currentRaw().day).toBe("2026-11-04");
    }
    start("/usage?day=2026-11-04");
    setSearch({ range: 30 });
    expect(location.search).toBe("?range=30&day=2026-11-04");
    setSearch({ range: 7 });
    expect(location.search).toBe("?range=7");
  });
  it("pushes filter and sheet changes, replaces the rest", () => {
    start("/usage?project=foo&range=30");
    let len = history.length;
    const added = () => { const n = history.length - len; len = history.length; return n; };
    setSearch({ range: 7 });
    expect(added()).toBe(1);
    expect(location.search).toBe("?project=foo&range=7");
    setSearch({ session: "s1" });
    expect(added()).toBe(1);
    setSearch({ session: null });
    expect(added()).toBe(1);
    expect(location.search).toBe("?project=foo&range=7");
    setSearch({ gran: "week" });
    expect(added()).toBe(0);
    expect(location.search).toBe("?project=foo&range=7&gran=week");
    setSearch({ gran: "day" }, { push: true });
    expect(added()).toBe(1);
    setSearch({ range: 7 }); // no change, no entry
    expect(added()).toBe(0);
    expect(location.pathname).toBe("/usage");
  });
  it("adds one entry for a filter change and none for a key that does not push", () => {
    start("/usage?range=30");
    const len = history.length;
    setSearch({ project: "foo" });
    expect(history.length).toBe(len + 1);
    setSearch({ q: "api" });
    expect(history.length).toBe(len + 1);
    expect(location.search).toBe("?project=foo&range=30&q=api");
  });
  it("forces an entry with push: true", () => {
    start("/usage?range=30");
    const len = history.length;
    setSearch({ q: "api" }, { push: true });
    expect(history.length).toBe(len + 1);
  });
  it("sees its own earlier write in the next call", () => {
    start("/usage?range=30");
    setSearch({ project: "foo" });
    setSearch({ q: "api" });
    expect(location.search).toBe("?project=foo&range=30&q=api");
  });
  it("opens a tool sheet with a push, clearing the other sheets", () => {
    start("/usage?range=30&inspect=foo&session=s1");
    const len = history.length;
    openToolSheet("tool", "Bash");
    expect(history.length).toBe(len + 1);
    expect(location.search).toBe("?range=30&tool=Bash");
    openToolSheet("mcp", "github");
    expect(location.search).toBe("?range=30&mcp=github");
    openToolSheet("skill", "ship");
    expect(location.search).toBe("?range=30&skill=ship");
    expect(history.length).toBe(len + 3);
  });
  it("keys the session sheet as sheet on Live, where session is the followed session", () => {
    expect([sheetKey("/usage"), sheetKey("/errors"), sheetKey("/insights"), sheetKey("/live")]).toEqual(["session", "session", "session", "sheet"]);
    start("/live?session=s1");
    openSessionSheet("s2");
    expect(location.search).toBe("?session=s1&sheet=s2");
    expect(sheets()).toBe(1);
    openToolSheet("tool", "Bash");
    expect(location.search).toBe("?tool=Bash&session=s1"); // the followed session stays
    start("/live");
    setSearch({ session: "s1" }); // picking a session in the rail opens no sheet
    expect(sheets()).toBeUndefined();
    expect(sessionSheetHref("/live", { session: "s1" }, "s2")).toBe("/live?session=s1&sheet=s2");
    expect(sessionSheetHref("/insights", { range: "7" }, "s2")).toBe("/insights?range=7&session=s2");
  });
  it("closes sheets by going back over the entries they pushed", async () => {
    const router = start("/usage?range=30");
    const len = history.length;
    setSearch({ inspect: "foo" });
    setSearch({ session: "s1" });
    expect(history.length).toBe(len + 2);
    expect(sheets()).toBe(2);
    const back = popped();
    closeSheets(clear);
    await back;
    expect(location.search).toBe("?range=30");
    expect(history.length).toBe(len + 2); // going back adds no entry that reopens a sheet
    // A sheet opened from a link, or after a filter change, has no entry of its own to go back to: closing replaces.
    router.history.replace("/usage?range=30&session=s1");
    router.history.flush();
    const n = history.length;
    closeSheets(clear);
    expect(location.search).toBe("?range=30");
    expect(history.length).toBe(n);
    setSearch({ session: "s2" });
    setSearch({ range: 7 });
    expect(sheets()).toBeUndefined();
    setSearch({ session: "s3" });
    expect(sheets()).toBeUndefined();
  });
  it("returns to the view before two sheets, and leaves history.length as it was", async () => {
    start("/usage?project=foo&range=30");
    const len = history.length;
    setSearch({ inspect: "p" });
    setSearch({ session: "s1" });
    expect(location.search).toBe("?project=foo&range=30&inspect=p&session=s1");
    const back = popped();
    closeSheets(clear);
    await back;
    expect(location.search).toBe("?project=foo&range=30");
    expect(history.length).toBe(len + 2);
  });
  it("closes with a replace when no count is kept", () => {
    start("/usage?range=30&session=s1&inspect=p");
    const len = history.length;
    closeSheets(clear);
    expect(location.search).toBe("?range=30");
    expect(history.length).toBe(len);
  });
  it("rewrites a URL in another key order to the canonical order, adding no entry", () => {
    start("/errors?range=30&cat=x&etool=Edit");
    const len = history.length;
    setSearch({ range: 30 }, { push: false });
    expect(location.search).toBe("?range=30&etool=Edit&cat=x");
    expect(history.length).toBe(len);
  });
  it("links to Errors with the source and an open type", () => {
    expect(errorsHref("foo", 7, undefined, { source: "codex", cat: "tests" })).toBe("/errors?project=foo&range=7&source=codex&cat=tests");
    expect(errorsHref(null, 0, "t1", { source: "" })).toBe("/errors?range=0&ex=t1");
    expect(errorsHref("foo")).toBe("/errors?project=foo");
  });
  it("writes auto=1 and removes it when off", () => {
    start("/cost?range=30");
    setSearch({ auto: true });
    expect(location.search).toBe("?range=30&auto=1");
    setSearch({ auto: false });
    expect(location.search).toBe("?range=30");
  });
});

describe("useSearchOf", () => {
  const pick = (raw: Readonly<Record<string, string>>) => ({ project: raw.project ?? "", q: raw.q ?? "" });

  it("reads the keys its validator names and re-renders only when the selection changes", () => {
    history.replaceState(null, "", "/usage?project=foo&q=a");
    let renders = 0;
    const { result } = renderHook(() => { renders++; return useSearchOf(pick, s => s.project); }, { wrapper: wrapper(makeTestClient()) });
    expect(result.current).toBe("foo");
    const before = renders;
    act(() => setSearch({ q: "ab" }));
    expect(renders).toBe(before);
    act(() => setSearch({ project: "bar" }));
    expect(result.current).toBe("bar");
    expect(renders).toBe(before + 1);
  });

  it("keeps the same object while the validated keys are equal", () => {
    history.replaceState(null, "", "/usage?project=foo");
    const { result } = renderHook(() => useSearchOf(pick), { wrapper: wrapper(makeTestClient()) });
    const first = result.current;
    act(() => setSearch({ session: "s1" }));
    expect(result.current).toBe(first);
    act(() => setSearch({ q: "x" }));
    expect(result.current).toEqual({ project: "foo", q: "x" });
  });
});

describe("useView", () => {
  it("re-renders on setSearch, Back and links", async () => {
    history.replaceState(null, "", "/usage?range=30");
    const { result } = renderHook(() => useView(), { wrapper: wrapper(makeTestClient()) });
    expect(result.current[0].range).toBe(30);
    act(() => result.current[1]({ project: "foo" }));
    expect(result.current[0].project).toBe("foo");
    await act(async () => {
      history.replaceState(null, "", "/usage?project=bar&range=90");
      dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current[0]).toMatchObject({ project: "bar", range: 90 });
    await act(async () => {
      history.replaceState(null, "", "/usage?auto=1");
      dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current[0]).toMatchObject({ project: "", range: 30, auto: true });
  });
  it("keeps the same view while only a page's own key changes", () => {
    history.replaceState(null, "", "/usage?project=foo");
    const { result } = renderHook(() => useView(), { wrapper: wrapper(makeTestClient()) });
    const first = result.current[0];
    act(() => setSearch({ q: "x" }));
    expect(result.current[0]).toBe(first);
    act(() => setSearch({ session: "s1" }));
    expect(result.current[0]).toEqual({ ...first, session: "s1" });
  });
  it("shows the new view after setSearch within the same act", () => {
    history.replaceState(null, "", "/usage?range=30");
    const { result } = renderHook(() => useView(), { wrapper: wrapper(makeTestClient()) });
    act(() => { setSearch({ range: 7 }); });
    expect(result.current[0].range).toBe(7);
  });
});

describe("usePathname", () => {
  it("follows the page", () => {
    history.replaceState(null, "", "/usage?range=30");
    const { result } = renderHook(() => usePathname(), { wrapper: wrapper(makeTestClient()) });
    expect(result.current).toBe("/usage");
    act(() => go("/cost?range=30"));
    expect(result.current).toBe("/cost");
  });
});

describe("go", () => {
  it("writes a page and query change as one entry", () => { // the scroll to the top needs a rendered router: not asserted here
    start("/usage?range=30");
    const len = history.length;
    go("/cost?project=foo&range=7&tool=Bash");
    expect(history.length).toBe(len + 1);
    expect(location.pathname + location.search).toBe("/cost?project=foo&range=7&tool=Bash");
  });
  it("adds one entry for another page", () => {
    start("/usage?range=30");
    const len = history.length;
    go("/cost?project=foo");
    expect(history.length).toBe(len + 1);
    expect(location.pathname + location.search).toBe("/cost?project=foo");
  });
  it("adds nothing for the current location", () => {
    start("/errors?project=foo");
    const len = history.length;
    go("/errors?project=foo");
    expect(history.length).toBe(len);
  });
  it("does not scroll for a query-only change, and tells subscribers", () => {
    history.replaceState(null, "", "/usage?range=30");
    const scroll = vi.spyOn(window, "scrollTo");
    const { result } = renderHook(() => useView(), { wrapper: wrapper(makeTestClient()) });
    act(() => go("/usage?range=7"));
    expect(result.current[0].range).toBe(7);
    expect(scroll).not.toHaveBeenCalled();
  });
  it("keeps navigate's page switch", () => {
    start("/usage?range=30");
    const len = history.length;
    navigate("/errors?range=30");
    expect(location.pathname).toBe("/errors");
    expect(history.length).toBe(len + 1);
  });
});

describe("onNavigate", () => {
  it("fires for go and for Back, not for setSearch, and stops when stopped", async () => {
    start("/usage?range=30");
    const f = vi.fn<() => void>(), stop = onNavigate(f);
    setSearch({ project: "foo" });
    setSearch({ q: "api" });
    expect(f).not.toHaveBeenCalled();
    go("/cost?range=30");
    expect(f).toHaveBeenCalledTimes(1);
    const back = popped();
    history.back();
    await back;
    expect(f).toHaveBeenCalledTimes(2);
    stop();
    go("/errors?range=30");
    expect(f).toHaveBeenCalledTimes(2);
  });
});
