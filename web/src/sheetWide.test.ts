import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSheetWide, resetSheetWide, SHEET_WIDE_KEY, setSheetWide, useSheetWide } from "./sheetWide";

beforeEach(() => { localStorage.clear(); resetSheetWide(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("sheetWide", () => {
  it("defaults to narrow", () => {
    expect(getSheetWide()).toBe(false);
  });
  it("stores wide as \"1\" and reads it back", () => {
    setSheetWide(true);
    expect(getSheetWide()).toBe(true);
    expect(localStorage.getItem(SHEET_WIDE_KEY)).toBe("1");
  });
  it("removes the key when set narrow", () => {
    setSheetWide(true);
    setSheetWide(false);
    expect(getSheetWide()).toBe(false);
    expect(localStorage.getItem(SHEET_WIDE_KEY)).toBeNull();
  });
  it("reads an unknown stored value as narrow", () => {
    localStorage.setItem(SHEET_WIDE_KEY, "yes");
    resetSheetWide();
    expect(getSheetWide()).toBe(false);
  });
  it("still switches the sheet when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => setSheetWide(true)).not.toThrow();
    expect(getSheetWide()).toBe(true);
  });
  it("follows a change made in another tab", () => {
    const { result } = renderHook(() => useSheetWide());
    expect(result.current).toBe(false);
    act(() => { dispatchEvent(new StorageEvent("storage", { key: SHEET_WIDE_KEY, newValue: "1" })); });
    expect(result.current).toBe(true);
    act(() => { dispatchEvent(new StorageEvent("storage", { key: null, newValue: null })); });
    expect(result.current).toBe(false);
    act(() => { dispatchEvent(new StorageEvent("storage", { key: "other", newValue: "1" })); });
    expect(result.current).toBe(false);
  });
});
