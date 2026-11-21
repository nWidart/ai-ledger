import { describe, expect, it } from "vitest";
import { modified } from "./keys";

const key = (m: Partial<Record<"altKey" | "ctrlKey" | "metaKey" | "shiftKey", boolean>> = {}) =>
  ({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...m });

describe("modified", () => {
  it("is false for a bare key and true with any modifier", () => {
    expect(modified(key())).toBe(false);
    expect([key({ altKey: true }), key({ ctrlKey: true }), key({ metaKey: true }), key({ shiftKey: true })].map(k => modified(k))).toEqual([true, true, true, true]);
  });
  it("lets Shift through for a handler that gives it a meaning", () => {
    expect(modified(key({ shiftKey: true }), true)).toBe(false);
    expect(modified(key({ altKey: true, shiftKey: true }), true)).toBe(true);
  });
});
