import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { formatHash, parseHash, setHash, sharedHash, useHashState } from "./hash";

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
  it("writes keys in the order the pages always did", () => {
    expect(formatHash({ session: "s", range: "30", project: "a b", inspect: "p" })).toBe("#project=a+b&range=30&inspect=p&session=s");
    expect(formatHash({ cat: "x", gran: "week", zz: "1", sub: "0", range: "7" })).toBe("#range=7&sub=0&gran=week&zz=1&cat=x");
    expect(formatHash({})).toBe("");
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
