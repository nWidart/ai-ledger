import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./useDebounced";

afterEach(() => vi.useRealTimers());

describe("useDebouncedValue", () => {
  it("gives the first value at once and a new one only after it stood still for the delay", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 200), { initialProps: { v: "a" } });
    expect(result.current).toBe("a");
    rerender({ v: "ab" });
    act(() => { vi.advanceTimersByTime(199); });
    expect(result.current).toBe("a");
    rerender({ v: "abc" }); // typing on restarts the wait
    act(() => { vi.advanceTimersByTime(199); });
    expect(result.current).toBe("a");
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe("abc");
  });
});
