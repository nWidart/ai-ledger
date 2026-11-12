import { describe, expect, it, vi } from "vitest";
import { copyText, dayStamp, toCsv, toTsv } from "./export";

describe("toCsv", () => {
  it("quotes cells with commas, quotes or line breaks, doubling quotes", () => {
    expect(toCsv(["a", "b"], [["x,y", 'say "hi"', "one\ntwo"]])).toBe('a,b\r\n"x,y","say ""hi""","one\ntwo"\r\n');
  });

  it("writes null as an empty cell and numbers plainly, without separators or currency", () => {
    expect(toCsv(["n", "c", "t"], [[null, 1234.5, 0.0001], [-3, NaN, 1e6]])).toBe("n,c,t\r\n,1234.5,0.0001\r\n-3,,1000000\r\n");
  });

  it("guards text that starts with a formula character, not numbers", () => {
    expect(toCsv(["v"], [["=SUM(A1)"], ["+1"], ["-2 apples"], ["@cmd"], ["plain"], [-5]])).toBe("v\r\n'=SUM(A1)\r\n'+1\r\n'-2 apples\r\n'@cmd\r\nplain\r\n-5\r\n");
  });

  it("ends every record with CRLF", () => {
    expect(toCsv(["a"], [["b"], ["c"]])).toBe("a\r\nb\r\nc\r\n");
  });
});

describe("toTsv", () => {
  it("separates cells with tabs and records with LF, turning tabs and line breaks inside a cell into spaces", () => {
    expect(toTsv(["a", "b"], [["x\ty", "two\r\nlines"], [null, 2]])).toBe("a\tb\n" + "x y\ttwo  lines\n" + "\t2\n");
  });

  it("applies the same formula guard and leaves numbers alone", () => {
    expect(toTsv(["v"], [["=1+1"], [-4]])).toBe("v\n'=1+1\n-4\n");
  });
});

describe("dayStamp", () => {
  it("is the local date as YYYY-MM-DD", () => {
    expect(dayStamp(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});

describe("copyText", () => {
  it("resolves true after the clipboard takes the text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await copyText("a\tb")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("a\tb");
    vi.unstubAllGlobals();
  });

  it("resolves false when the clipboard rejects or is missing", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    expect(await copyText("x")).toBe(false);
    vi.stubGlobal("navigator", {});
    expect(await copyText("x")).toBe(false);
    vi.unstubAllGlobals();
  });
});
