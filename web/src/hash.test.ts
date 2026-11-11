import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { errorsHref, openToolSheet } from "./components/sheets/session";
import { closeSheets, formatHash, go, navigate, parseHash, setHash, sharedHash, useHashState } from "./hash";

describe("parseHash", () => {
  it("reads a Usage URL from before the change", () => {
    const s = parseHash("#project=foo&range=14&inspect=bar&session=abc");
    expect(s).toMatchObject({ project: "foo", range: 14, inspect: "bar", session: "abc", ex: "", cat: "", auto: false });
  });
  it("reads an Errors URL with its page-only keys", () => {
    const s = parseHash("#project=foo&range=0&sub=0&noise=0&gran=week&ex=toolu_1");
    expect(s).toMatchObject({ project: "foo", range: 0, ex: "toolu_1" });
    expect(s.raw).toEqual({ project: "foo", range: "0", sub: "0", noise: "0", gran: "week", ex: "toolu_1" });
  });
  it("defaults the range to 30 and says when the hash had none", () => {
    expect(parseHash("#ex=toolu_1")).toMatchObject({ range: 30, ex: "toolu_1" });
    expect(parseHash("#ex=toolu_1").raw.range).toBeUndefined();
    expect(parseHash("#range=12").range).toBe(30);
    expect(parseHash("").range).toBe(30);
  });
  it("reads auto=1 as including automated sessions", () => {
    expect(parseHash("#auto=1").auto).toBe(true);
    expect(parseHash("#auto=0").auto).toBe(false);
  });
  it("reads a known source, and an unknown one as All", () => {
    expect(parseHash("#source=codex").source).toBe("codex");
    expect(parseHash("#source=claude").source).toBe("claude");
    expect(parseHash("#source=grok")).toMatchObject({ source: "", raw: { source: "grok" } });
    expect(parseHash("").source).toBe("");
  });
  it("reads the inspected tool, MCP server and skill", () => {
    expect(parseHash("#range=7&tool=Bash")).toMatchObject({ tool: "Bash", mcp: "", skill: "" });
    expect(parseHash("#mcp=github&session=s1")).toMatchObject({ mcp: "github", session: "s1", tool: "" });
    expect(parseHash("#skill=ship").skill).toBe("ship");
  });
  it("writes the inspected tool after inspect and before session", () => {
    expect(formatHash({ session: "s", tool: "mcp__a:b", range: "30", ex: "e" })).toBe("#range=30&tool=mcp__a%3Ab&session=s&ex=e");
    expect(formatHash({ skill: "ship", mcp: "gh", inspect: "p" })).toBe("#inspect=p&mcp=gh&skill=ship");
  });
  it("writes keys in the order the pages always did", () => {
    expect(formatHash({ session: "s", range: "30", project: "a b", inspect: "p" })).toBe("#project=a+b&range=30&inspect=p&session=s");
    expect(formatHash({ cat: "x", gran: "week", zz: "1", sub: "0", range: "7" })).toBe("#range=7&sub=0&gran=week&zz=1&cat=x");
    expect(formatHash({})).toBe("");
    expect(formatHash({ auto: "1", source: "codex", range: "7" })).toBe("#range=7&source=codex&auto=1");
  });
});

describe("setHash", () => {
  it("pushes filter and sheet changes, replaces the rest", () => {
    history.replaceState(null, "", "/usage#project=foo&range=30");
    const push = vi.spyOn(history, "pushState"), replace = vi.spyOn(history, "replaceState");
    setHash({ range: 7 });
    expect(push).toHaveBeenCalledTimes(1);
    expect(location.hash).toBe("#project=foo&range=7");
    setHash({ session: "s1" });
    expect(push).toHaveBeenCalledTimes(2);
    setHash({ session: null });
    expect(push).toHaveBeenCalledTimes(3);
    expect(location.hash).toBe("#project=foo&range=7");
    setHash({ gran: "week" });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(3);
    setHash({ gran: "day" }, { push: true });
    expect(push).toHaveBeenCalledTimes(4);
    setHash({ range: 7 }); // no change, no entry
    expect(push).toHaveBeenCalledTimes(4);
    expect(location.pathname).toBe("/usage");
  });
  it("opens a tool sheet with a push, clearing the other sheets", () => {
    history.replaceState(null, "", "/usage#range=30&inspect=foo&session=s1");
    const push = vi.spyOn(history, "pushState");
    openToolSheet("tool", "Bash");
    expect(push).toHaveBeenCalledTimes(1);
    expect(location.hash).toBe("#range=30&tool=Bash");
    openToolSheet("mcp", "github");
    expect(location.hash).toBe("#range=30&mcp=github");
    openToolSheet("skill", "ship");
    expect(location.hash).toBe("#range=30&skill=ship");
    expect(push).toHaveBeenCalledTimes(3);
  });
  it("closes sheets by going back over the entries they pushed", async () => {
    history.replaceState(null, "", "/usage#range=30");
    const len = history.length, clear = { inspect: null, tool: null, mcp: null, skill: null, session: null };
    setHash({ inspect: "foo" });
    setHash({ session: "s1" });
    expect(history.length).toBe(len + 2);
    const back = new Promise(r => addEventListener("popstate", r, { once: true }));
    closeSheets(clear);
    await back;
    expect(location.hash).toBe("#range=30");
    // A sheet opened from a link, or after a filter change, has no entry of its own to go back to: closing replaces.
    history.replaceState(null, "", "/usage#range=30&session=s1");
    closeSheets(clear);
    expect(location.hash).toBe("#range=30");
    setHash({ session: "s2" });
    setHash({ range: 7 });
    expect(history.state).toBeNull();
    setHash({ session: "s3" });
    expect(history.state).toBeNull();
  });
  it("links to Errors with the source and an open type", () => {
    expect(errorsHref("foo", 7, undefined, { source: "codex", cat: "tests" })).toBe("/errors#project=foo&range=7&source=codex&cat=tests");
    expect(errorsHref(null, 0, "t1", { source: "" })).toBe("/errors#range=0&ex=t1");
    expect(errorsHref("foo")).toBe("/errors#project=foo");
  });
  it("writes auto=1 and removes it when off", () => {
    history.replaceState(null, "", "/cost#range=30");
    setHash({ auto: true });
    expect(location.hash).toBe("#range=30&auto=1");
    setHash({ auto: false });
    expect(location.hash).toBe("#range=30");
  });
  it("carries only the shared keys", () => {
    expect(sharedHash("#project=foo&range=14&auto=1&session=s1&ex=t1&sub=0")).toBe("#project=foo&range=14&auto=1");
    expect(sharedHash("#session=s1")).toBe("");
    expect(sharedHash("#range=7&source=codex&cat=x")).toBe("#range=7&source=codex");
  });
});

describe("useHashState", () => {
  it("re-renders on setHash, Back and hash links", () => {
    history.replaceState(null, "", "/usage#range=30");
    const { result } = renderHook(() => useHashState());
    expect(result.current[0].range).toBe(30);
    act(() => result.current[1]({ project: "foo" }));
    expect(result.current[0].project).toBe("foo");
    act(() => {
      history.replaceState(null, "", "/usage#project=bar&range=90");
      dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current[0]).toMatchObject({ project: "bar", range: 90 });
    act(() => {
      history.replaceState(null, "", "/usage#cat=x");
      dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current[0]).toMatchObject({ project: "", range: 30, cat: "x" });
  });
});

describe("go", () => {
  it("writes a page and hash change as one entry and scrolls to the top", () => {
    history.replaceState(null, "", "/usage#range=30");
    const push = vi.spyOn(history, "pushState"), scroll = vi.spyOn(window, "scrollTo"), len = history.length;
    go("/cost#project=foo&range=7&tool=Bash");
    expect(push).toHaveBeenCalledTimes(1);
    expect(history.length).toBe(len + 1);
    expect(location.pathname + location.hash).toBe("/cost#project=foo&range=7&tool=Bash");
    expect(scroll).toHaveBeenCalledWith(0, 0);
  });
  it("adds nothing for the current location", () => {
    history.replaceState(null, "", "/errors#project=foo");
    const push = vi.spyOn(history, "pushState"), len = history.length;
    go("/errors#project=foo");
    expect(push).not.toHaveBeenCalled();
    expect(history.length).toBe(len);
  });
  it("does not scroll for a hash-only change, and tells subscribers", () => {
    history.replaceState(null, "", "/usage#range=30");
    const scroll = vi.spyOn(window, "scrollTo");
    const { result } = renderHook(() => useHashState());
    act(() => go("/usage#range=7"));
    expect(result.current[0].range).toBe(7);
    expect(scroll).not.toHaveBeenCalled();
  });
  it("keeps navigate's page switch", () => {
    history.replaceState(null, "", "/usage#range=30");
    const push = vi.spyOn(history, "pushState"), scroll = vi.spyOn(window, "scrollTo");
    navigate("/errors#range=30");
    expect(location.pathname).toBe("/errors");
    expect(push).toHaveBeenCalledTimes(1);
    expect(scroll).toHaveBeenCalledWith(0, 0);
  });
});
